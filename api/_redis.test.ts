import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Which credential pair a Vercel deployment gets depends on how the Redis store
 * was added, and picking the wrong one fails in ways that look unrelated: the
 * read-only token authenticates and then rejects every save, and the TCP URLs
 * are not something an HTTP client can talk to at all. These pin the order.
 *
 * redis() memoises its client, so each case re-imports the module rather than
 * sharing one across tests.
 */

const REDIS_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'KV_REST_API_READ_ONLY_TOKEN',
  'KV_URL',
  'REDIS_URL',
];

async function freshRedis() {
  vi.resetModules();
  return (await import('./_redis.js')).redis;
}

beforeEach(() => {
  for (const name of REDIS_VARS) delete process.env[name];
});

afterEach(() => {
  for (const name of REDIS_VARS) delete process.env[name];
});

describe('redis()', () => {
  it('uses the KV_ pair a dashboard-created store injects', async () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    const redis = await freshRedis();
    expect(() => redis()).not.toThrow();
  });

  it('uses the UPSTASH_ pair a directly installed integration injects', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
    const redis = await freshRedis();
    expect(() => redis()).not.toThrow();
  });

  it('returns the same client on a warm instance rather than reconnecting', async () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    const redis = await freshRedis();
    expect(redis()).toBe(redis());
  });

  it('refuses the read-only token, which would reject every save', async () => {
    process.env.KV_REST_API_URL = 'https://example.upstash.io';
    process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-only-token';
    const redis = await freshRedis();
    expect(() => redis()).toThrow(/not configured/);
  });

  it('refuses the TCP connection strings, which an HTTP client cannot use', async () => {
    process.env.KV_URL = 'rediss://default:pw@example.upstash.io:6379';
    process.env.REDIS_URL = 'rediss://default:pw@example.upstash.io:6379';
    const redis = await freshRedis();
    expect(() => redis()).toThrow(/not configured/);
  });

  it('names the variables that did arrive, so a half-configured deploy is visible', async () => {
    process.env.KV_URL = 'rediss://default:pw@example.upstash.io:6379';
    const redis = await freshRedis();
    expect(() => redis()).toThrow(/KV_URL/);
  });

  it('never puts a token value in the error', async () => {
    process.env.KV_REST_API_READ_ONLY_TOKEN = 'super-secret-token';
    const redis = await freshRedis();
    expect(() => redis()).toThrow(/KV_REST_API_READ_ONLY_TOKEN/);
    expect(() => redis()).not.toThrow(/super-secret-token/);
  });
});
