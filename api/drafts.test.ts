import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the endpoint against an in-memory stand-in for Upstash.
 *
 * This does not prove the app talks to a real Redis - only a deploy does that.
 * What it does prove is the part most likely to be wrong by inspection: that
 * the passcode gate is actually in front of every action, that each action
 * reads and writes the keys the schema says it does, and that saving a note
 * after deleting it clears its tombstone.
 */

/** The handful of Redis operations these endpoints use. */
class FakeRedis {
  hashes = new Map<string, Record<string, unknown>>();
  zset = new Map<string, number>();
  strings = new Map<string, unknown>();

  hgetall(key: string) {
    return Promise.resolve(this.hashes.get(key) ?? null);
  }
  hset(key: string, value: Record<string, unknown>) {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...value });
    return Promise.resolve(1);
  }
  hdel(key: string, field: string) {
    const hash = this.hashes.get(key);
    if (hash) delete hash[field];
    return Promise.resolve(1);
  }
  del(key: string) {
    this.hashes.delete(key);
    this.strings.delete(key);
    return Promise.resolve(1);
  }
  zadd(_key: string, entry: { score: number; member: string }) {
    this.zset.set(entry.member, entry.score);
    return Promise.resolve(1);
  }
  zrem(_key: string, member: string) {
    this.zset.delete(member);
    return Promise.resolve(1);
  }
  zrange(_key: string, min: number, _max: string) {
    const members = [...this.zset.entries()]
      .filter(([, score]) => score > min)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    return Promise.resolve(members);
  }
  get(key: string) {
    return Promise.resolve(this.strings.get(key) ?? null);
  }
  set(key: string, value: unknown) {
    this.strings.set(key, value);
    return Promise.resolve('OK');
  }

  /** Records calls and replays them on exec, like the real pipeline. */
  pipeline() {
    const queued: (() => Promise<unknown>)[] = [];
    const self = this;
    return {
      hgetall(key: string) {
        queued.push(() => self.hgetall(key));
      },
      hset(key: string, value: Record<string, unknown>) {
        queued.push(() => self.hset(key, value));
      },
      hdel(key: string, field: string) {
        queued.push(() => self.hdel(key, field));
      },
      del(key: string) {
        queued.push(() => self.del(key));
      },
      zadd(key: string, entry: { score: number; member: string }) {
        queued.push(() => self.zadd(key, entry));
      },
      zrem(key: string, member: string) {
        queued.push(() => self.zrem(key, member));
      },
      exec: () => Promise.all(queued.map((fn) => fn())),
    };
  }
}

const fake = new FakeRedis();

vi.mock('./_redis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./_redis')>();
  return { ...actual, redis: () => fake };
});

const { default: handler } = await import('./drafts');

const PASSCODE = 'a-long-random-passcode';

function call(body: unknown, key: string | null = PASSCODE): Promise<Response> {
  return handler(
    new Request('https://example.com/api/drafts', {
      method: 'POST',
      headers: key ? { 'x-notes-key': key, 'content-type': 'application/json' } : {},
      body: JSON.stringify(body),
    }),
  );
}

const note = {
  path: 'notes/java/collections.md',
  title: 'Collections',
  folder: 'java',
  week: 1,
  tags: ['java', 'maps'],
  body: '# Collections\n',
  createdAt: 1_000,
  updatedAt: 2_000,
  publishedSha: null,
};

beforeEach(() => {
  process.env.NOTES_PASSCODE = PASSCODE;
  fake.hashes.clear();
  fake.zset.clear();
  fake.strings.clear();
});

afterEach(() => {
  delete process.env.NOTES_PASSCODE;
});

describe('the passcode gate', () => {
  it('rejects every action without the right key', async () => {
    for (const action of ['list', 'get', 'put', 'delete']) {
      const res = await call({ action, path: note.path, note }, 'wrong');
      expect(res.status).toBe(401);
    }
    // And nothing was written on the way past.
    expect(fake.hashes.size).toBe(0);
  });

  it('rejects a missing key', async () => {
    expect((await call({ action: 'list' }, null)).status).toBe(401);
  });

  it('refuses anything but POST', async () => {
    const res = await handler(new Request('https://example.com/api/drafts', { method: 'GET' }));
    expect(res.status).toBe(405);
  });
});

describe('put and get', () => {
  it('round-trips a note, tags included', async () => {
    await call({ action: 'put', note });
    const res = await call({ action: 'get', path: note.path });
    const body = (await res.json()) as { note: typeof note };
    expect(body.note.title).toBe('Collections');
    // Tags are stored as JSON so a tag containing a comma survives.
    expect(body.note.tags).toEqual(['java', 'maps']);
    expect(body.note.week).toBe(1);
    expect(body.note.publishedSha).toBeNull();
  });

  it('indexes the note by updatedAt so list can find it', async () => {
    await call({ action: 'put', note });
    expect(fake.zset.get(note.path)).toBe(2_000);
  });

  it('404s for a note that is not there', async () => {
    expect((await call({ action: 'get', path: 'notes/nope.md' })).status).toBe(404);
  });

  it('requires a path', async () => {
    expect((await call({ action: 'put', note: { title: 'no path' } })).status).toBe(400);
  });
});

describe('list', () => {
  it('returns only notes newer than the watermark', async () => {
    await call({ action: 'put', note });
    await call({ action: 'put', note: { ...note, path: 'notes/java/streams.md', updatedAt: 5_000 } });

    const res = await call({ action: 'list', since: 3_000 });
    const body = (await res.json()) as { notes: { path: string }[]; now: number };
    expect(body.notes.map((n) => n.path)).toEqual(['notes/java/streams.md']);
    expect(body.now).toBeGreaterThan(0);
  });

  it('returns everything on a first sync', async () => {
    await call({ action: 'put', note });
    const res = await call({ action: 'list', since: 0 });
    const body = (await res.json()) as { notes: unknown[] };
    expect(body.notes).toHaveLength(1);
  });
});

describe('delete', () => {
  it('removes the note, its index entry, and leaves a tombstone', async () => {
    await call({ action: 'put', note });
    await call({ action: 'delete', path: note.path, deletedAt: 9_000 });

    expect(fake.hashes.has(`note:${note.path}`)).toBe(false);
    expect(fake.zset.has(note.path)).toBe(false);

    const res = await call({ action: 'list', since: 0 });
    const body = (await res.json()) as { tombstones: Record<string, number> };
    expect(body.tombstones[note.path]).toBe(9_000);
  });

  it('clears the tombstone when the note is saved again', async () => {
    // Without this, the next sync would delete the note that was just restored.
    await call({ action: 'put', note });
    await call({ action: 'delete', path: note.path, deletedAt: 9_000 });
    await call({ action: 'put', note: { ...note, updatedAt: 10_000 } });

    const res = await call({ action: 'list', since: 0 });
    const body = (await res.json()) as { tombstones: Record<string, number>; notes: unknown[] };
    expect(body.tombstones[note.path]).toBeUndefined();
    expect(body.notes).toHaveLength(1);
  });
});

describe('bad input', () => {
  it('rejects an unknown action', async () => {
    expect((await call({ action: 'drop-everything' })).status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await handler(
      new Request('https://example.com/api/drafts', {
        method: 'POST',
        headers: { 'x-notes-key': PASSCODE },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });
});
