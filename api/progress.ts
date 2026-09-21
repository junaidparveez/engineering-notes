import { isAuthorised, json, unauthorised } from './_auth.js';
import { KEYS, redis } from './_redis.js';

/**
 * Roadmap progress, shared between devices.
 *
 * Not in the original plan - progress was localStorage only - but once there is
 * a database it is the same two calls, and it means ticking a task on the
 * laptop shows up on the phone without exporting a file.
 *
 * Deliberately one key holding the whole state rather than a row per task:
 * progress is small (a few hundred booleans), always read and written as a
 * unit, and one key means no partial-update races between devices.
 *
 * Conflict rule is last-write-wins on `updatedAt`, decided here rather than in
 * the browser so two devices with skewed clocks still agree on the order.
 */

interface StoredProgress {
  state: unknown;
  updatedAt: number;
}

interface Body {
  action?: 'get' | 'put';
  state?: unknown;
  updatedAt?: number;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!isAuthorised(request)) return unauthorised();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  try {
    const db = redis();

    if (body.action === 'get') {
      const stored = await db.get<StoredProgress>(KEYS.progress);
      return json({ progress: stored ?? null });
    }

    if (body.action === 'put') {
      if (!body.state || typeof body.state !== 'object') {
        return json({ error: 'state is required' }, 400);
      }
      const updatedAt = Number(body.updatedAt) || Date.now();

      // Refuse a write that is older than what is stored: a tab left open on
      // another device could otherwise flush stale state over newer progress
      // when it finally reconnects.
      const existing = await db.get<StoredProgress>(KEYS.progress);
      if (existing && existing.updatedAt > updatedAt) {
        return json({ ok: false, stale: true, progress: existing });
      }

      await db.set(KEYS.progress, { state: body.state, updatedAt } satisfies StoredProgress);
      return json({ ok: true, updatedAt });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upstash request failed' }, 500);
  }
}
