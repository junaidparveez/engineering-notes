import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './github-auth';

/**
 * Checks what the proxy actually sends to GitHub. Two of these are the exact
 * mistakes the flow fails on: sending a `scope` (GitHub Apps take none) and
 * getting the grant_type string wrong.
 */

const PASSCODE = 'a-long-random-passcode';
const CLIENT_ID = 'Iv23liExampleClientId';

let fetchMock: ReturnType<typeof vi.fn>;

function call(body: unknown, key: string | null = PASSCODE): Promise<Response> {
  return handler(
    new Request('https://example.com/api/github-auth', {
      method: 'POST',
      headers: key ? { 'x-notes-key': key, 'content-type': 'application/json' } : {},
      body: JSON.stringify(body),
    }),
  );
}

/** The JSON body of the most recent call to GitHub. */
function sentBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

beforeEach(() => {
  process.env.NOTES_PASSCODE = PASSCODE;
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ device_code: 'dc', user_code: 'ABCD-1234' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete process.env.NOTES_PASSCODE;
  vi.unstubAllGlobals();
});

describe('the gate', () => {
  it('refuses anything but POST', async () => {
    const res = await handler(new Request('https://example.com/api/github-auth', { method: 'GET' }));
    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong or missing passcode without calling GitHub', async () => {
    expect((await call({ action: 'start', client_id: CLIENT_ID }, 'wrong')).status).toBe(401);
    expect((await call({ action: 'start', client_id: CLIENT_ID }, null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a client_id', async () => {
    expect((await call({ action: 'start' })).status).toBe(400);
  });

  it('rejects an unknown action', async () => {
    expect((await call({ action: 'sideload', client_id: CLIENT_ID })).status).toBe(400);
  });
});

describe('start', () => {
  it('posts the client id to the device-code endpoint', async () => {
    await call({ action: 'start', client_id: CLIENT_ID });
    const [url] = fetchMock.mock.calls.at(-1) as [string];
    expect(url).toBe('https://github.com/login/device/code');
    expect(sentBody()).toEqual({ client_id: CLIENT_ID });
  });

  it('sends no scope - GitHub Apps take their permissions from the app', () => {
    return call({ action: 'start', client_id: CLIENT_ID }).then(() => {
      expect(sentBody()).not.toHaveProperty('scope');
    });
  });

  it('asks for JSON rather than form encoding', async () => {
    await call({ action: 'start', client_id: CLIENT_ID });
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect((init.headers as Record<string, string>).accept).toBe('application/json');
  });
});

describe('poll', () => {
  it('sends the device code and the exact device-flow grant type', async () => {
    await call({ action: 'poll', client_id: CLIENT_ID, device_code: 'dc-123' });
    const [url] = fetchMock.mock.calls.at(-1) as [string];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(sentBody()).toEqual({
      client_id: CLIENT_ID,
      device_code: 'dc-123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('requires a device_code', async () => {
    expect((await call({ action: 'poll', client_id: CLIENT_ID })).status).toBe(400);
  });

  it('passes an in-progress error through with a 200, not an error status', async () => {
    // GitHub answers 200 with {error: authorization_pending} while waiting.
    // Turning that into a failure status would break the poll loop.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 200 }),
    );
    const res = await call({ action: 'poll', client_id: CLIENT_ID, device_code: 'dc' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ error: 'authorization_pending' });
  });

  it('does not cache token responses', async () => {
    const res = await call({ action: 'poll', client_id: CLIENT_ID, device_code: 'dc' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('reports a network failure as a bad gateway', async () => {
    fetchMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND github.com'));
    const res = await call({ action: 'poll', client_id: CLIENT_ID, device_code: 'dc' });
    expect(res.status).toBe(502);
  });
});
