import { webHandler } from './_handler.js';
import { isAuthorised, json, unauthorised } from './_auth.js';
import { KEYS, redis, toStoredNote } from './_redis.js';
import type { StoredNote } from './_redis.js';

/**
 * Note storage for cross-device drafts: one POST endpoint, four actions.
 *
 * This is a copy, not the source of truth. IndexedDB in the browser holds every
 * note and answers every read the UI makes; this exists so the laptop and the
 * phone converge. Nothing here talks to GitHub.
 */

interface Body {
  action?: 'list' | 'get' | 'put' | 'delete';
  since?: number;
  path?: string;
  note?: Partial<StoredNote>;
  deletedAt?: number;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!isAuthorised(request)) return unauthorised();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    switch (body.action) {
      case 'list':
        return await list(body.since ?? 0);
      case 'get':
        return await get(body.path);
      case 'put':
        return await put(body.note);
      case 'delete':
        return await remove(body.path, body.deletedAt);
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    // The message may name a missing environment variable, which is useful and
    // safe; it never contains the passcode, which is only ever compared.
    return json({ error: error instanceof Error ? error.message : 'Upstash request failed' }, 500);
  }
}

/**
 * Everything that changed since `since`, plus tombstones.
 *
 * ZRANGEBYSCORE on the index means a device that synced a minute ago pulls the
 * one note it missed rather than all of them. `now` comes back so the client
 * can store a watermark without trusting its own clock against the server's.
 */
async function list(since: number): Promise<Response> {
  const db = redis();
  const paths = await db.zrange<string[]>(KEYS.index, since, '+inf', {
    byScore: true,
    // Exclusive, so a note whose updatedAt equals the watermark is not
    // returned again on every subsequent sync.
    offset: 0,
    count: 1000,
  });

  const notes: StoredNote[] = [];
  if (paths.length) {
    const pipeline = db.pipeline();
    for (const path of paths) pipeline.hgetall(KEYS.note(path));
    const rows = (await pipeline.exec()) as (Record<string, unknown> | null)[];
    for (const row of rows) {
      const note = row ? toStoredNote(row) : null;
      if (note) notes.push(note);
    }
  }

  const tombstones = (await db.hgetall<Record<string, number>>(KEYS.tombstones)) ?? {};
  return json({ notes, tombstones, now: Date.now() });
}

async function get(path: string | undefined): Promise<Response> {
  if (!path) return json({ error: 'path is required' }, 400);
  const row = await redis().hgetall<Record<string, unknown>>(KEYS.note(path));
  const note = row ? toStoredNote(row) : null;
  return note ? json({ note }) : json({ error: 'Not found' }, 404);
}

async function put(note: Partial<StoredNote> | undefined): Promise<Response> {
  if (!note?.path) return json({ error: 'note.path is required' }, 400);

  const updatedAt = Number(note.updatedAt) || Date.now();
  const record = {
    path: note.path,
    title: String(note.title ?? ''),
    folder: String(note.folder ?? ''),
    week: note.week ?? '',
    // Stored as JSON so a tag containing a comma survives the round trip.
    tags: JSON.stringify(note.tags ?? []),
    body: String(note.body ?? ''),
    createdAt: Number(note.createdAt) || updatedAt,
    updatedAt,
    publishedSha: note.publishedSha ?? '',
  };

  const db = redis();
  const tx = db.pipeline();
  tx.hset(KEYS.note(note.path), record);
  tx.zadd(KEYS.index, { score: updatedAt, member: note.path });
  // Saving a note again after deleting it must clear the tombstone, otherwise
  // the next sync would delete the note it just received.
  tx.hdel(KEYS.tombstones, note.path);
  await tx.exec();

  return json({ ok: true, updatedAt });
}

async function remove(path: string | undefined, deletedAt: number | undefined): Promise<Response> {
  if (!path) return json({ error: 'path is required' }, 400);

  const db = redis();
  const tx = db.pipeline();
  tx.del(KEYS.note(path));
  tx.zrem(KEYS.index, path);
  // The tombstone is what tells another device to delete its local copy;
  // without it the note would simply reappear from that device on next sync.
  tx.hset(KEYS.tombstones, { [path]: deletedAt ?? Date.now() });
  await tx.exec();

  return json({ ok: true });
}

/** Converted at the boundary: Vercel calls this as (req, res). */
export default webHandler(handler);
