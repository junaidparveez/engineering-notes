import { Redis } from '@upstash/redis';

/**
 * The Upstash connection and the key schema, in one place.
 *
 * Keys:
 *   note:{path}        HASH    every Note field, body included
 *   notes:index        ZSET    score = updatedAt (ms), member = path
 *   notes:tombstones   HASH    path -> deletedAt
 *   meta:lastPublish   STRING  commit SHA of the last successful publish
 *   progress:state     STRING  the roadmap AppState as JSON, with updatedAt
 *
 * The ZSET is the point of the whole design: a device syncing asks for members
 * scored above the last time it looked, so it pulls only what changed rather
 * than the entire note set on every load.
 */

export const KEYS = {
  note: (path: string) => `note:${path}`,
  index: 'notes:index',
  tombstones: 'notes:tombstones',
  lastPublish: 'meta:lastPublish',
  progress: 'progress:state',
} as const;

let client: Redis | null = null;

/**
 * Reads the credentials the Upstash Vercel integration injects. Created once
 * per warm function instance rather than per request.
 */
export function redis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('Upstash is not configured: UPSTASH_REDIS_REST_URL / _TOKEN are missing');
    }
    client = new Redis({ url, token });
  }
  return client;
}

/** The stored shape of a note. Tags are a JSON array; everything else is flat. */
export interface StoredNote {
  path: string;
  title: string;
  folder: string;
  week: number | null;
  tags: string[];
  body: string;
  createdAt: number;
  updatedAt: number;
  publishedSha: string | null;
}

/**
 * Upstash returns hash values already JSON-parsed where it can, and as strings
 * where it cannot, so each field is coerced on the way out rather than trusted.
 * Status is deliberately absent: it is derived locally from the blob SHA, never
 * stored.
 */
export function toStoredNote(raw: Record<string, unknown>): StoredNote | null {
  if (!raw || typeof raw.path !== 'string' || !raw.path) return null;
  return {
    path: raw.path,
    title: String(raw.title ?? ''),
    folder: String(raw.folder ?? ''),
    week: raw.week === null || raw.week === undefined || raw.week === '' ? null : Number(raw.week),
    tags: parseTags(raw.tags),
    body: String(raw.body ?? ''),
    createdAt: Number(raw.createdAt ?? 0),
    updatedAt: Number(raw.updatedAt ?? 0),
    publishedSha:
      raw.publishedSha === null || raw.publishedSha === undefined || raw.publishedSha === ''
        ? null
        : String(raw.publishedSha),
  };
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
