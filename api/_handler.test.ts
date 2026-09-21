import { describe, expect, it } from 'vitest';
import { webHandler } from './_handler';

/**
 * The classic shape below is the one production uses and the one nothing else
 * here exercises: every other test calls handlers with a real Request, which is
 * exactly why `request.headers.get is not a function` reached the deployed site.
 */

/** Echoes back what the handler actually received, so the conversion is visible. */
const echo = webHandler(async (request: Request) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = 'unparseable';
  }
  return new Response(
    JSON.stringify({ method: request.method, key: request.headers.get('x-notes-key'), body }),
    { status: 201, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
});

/** Collects what a handler writes, the way Vercel's response object would. */
function fakeResponse() {
  const sent = { status: 0, headers: {} as Record<string, string>, body: '' };
  return {
    sent,
    res: {
      status(code: number) {
        sent.status = code;
        return this;
      },
      setHeader(name: string, value: string) {
        sent.headers[name.toLowerCase()] = value;
        return this;
      },
      end(body?: string) {
        sent.body = body ?? '';
        return this;
      },
    },
  };
}

function nodeRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    url: '/api/drafts',
    headers: { host: 'example.com', 'content-type': 'application/json', ...headers },
    body,
  };
}

describe('the web shape, which tests and standards-compliant runtimes use', () => {
  it('returns the Response untouched', async () => {
    const res = await echo(
      new Request('https://example.com/api/drafts', {
        method: 'POST',
        headers: { 'x-notes-key': 'secret' },
        body: JSON.stringify({ action: 'get' }),
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ method: 'POST', key: 'secret', body: { action: 'get' } });
  });
});

describe('the classic (req, res) shape, which Vercel uses', () => {
  it('converts headers so .get() works, which is the bug that shipped', async () => {
    const { sent, res } = fakeResponse();
    await echo(nodeRequest({ action: 'get' }, { 'x-notes-key': 'secret' }), res);
    expect(JSON.parse(sent.body).key).toBe('secret');
  });

  it('writes the status and carries cache-control across', async () => {
    const { sent, res } = fakeResponse();
    await echo(nodeRequest({ action: 'get' }), res);
    expect(sent.status).toBe(201);
    expect(sent.headers['cache-control']).toBe('no-store');
  });

  it('accepts a body already parsed into an object', async () => {
    const { sent, res } = fakeResponse();
    await echo(nodeRequest({ action: 'get' }), res);
    expect(JSON.parse(sent.body).body).toEqual({ action: 'get' });
  });

  it('accepts a body left as a string', async () => {
    const { sent, res } = fakeResponse();
    await echo(nodeRequest(JSON.stringify({ action: 'put' })), res);
    expect(JSON.parse(sent.body).body).toEqual({ action: 'put' });
  });

  it('accepts a body left as a Buffer', async () => {
    const { sent, res } = fakeResponse();
    await echo(nodeRequest(Buffer.from(JSON.stringify({ action: 'delete' }))), res);
    expect(JSON.parse(sent.body).body).toEqual({ action: 'delete' });
  });

  it('reads the body off the stream when the runtime left it unread', async () => {
    const { sent, res } = fakeResponse();
    const streamed = {
      ...nodeRequest(undefined),
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"action":');
        yield Buffer.from('"list"}');
      },
    };
    await echo(streamed, res);
    expect(JSON.parse(sent.body).body).toEqual({ action: 'list' });
  });

  it('sends no body on GET, which Request refuses to carry', async () => {
    const { sent, res } = fakeResponse();
    await echo({ ...nodeRequest(undefined), method: 'GET' }, res);
    expect(sent.status).toBe(201);
    expect(JSON.parse(sent.body).method).toBe('GET');
  });

  it('keeps a repeated header rather than dropping all but one', async () => {
    const { sent, res } = fakeResponse();
    const req = nodeRequest({ action: 'get' });
    (req.headers as Record<string, unknown>)['x-forwarded-for'] = ['1.1.1.1', '2.2.2.2'];
    await echo(req, res);
    expect(sent.status).toBe(201);
  });
});
