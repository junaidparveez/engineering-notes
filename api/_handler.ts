/**
 * The bridge between how these handlers are written and how Vercel calls them.
 *
 * Every handler here is written against the web standard: take a `Request`,
 * return a `Response`. Vercel's Node runtime does not call a default export
 * that way - it calls it as `(req, res)` with a Node request whose `headers` is
 * a plain object. The first thing each handler does is read a header, so the
 * mismatch surfaced as `TypeError: request.headers.get is not a function`,
 * thrown before any of the handler's own logic ran.
 *
 * Rather than rewrite three handlers and their tests around Node's request and
 * response objects, this converts at the boundary. Handlers stay standard and
 * stay directly callable with a `Request` in tests; the conversion lives in one
 * place.
 *
 * Both shapes are exercised by _handler.test.ts, because only one of them is
 * reachable locally - the other is what production actually does.
 */

/** The parts of a Node request this needs. */
interface NodeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** The parts of a Node response this needs. */
interface NodeResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

/**
 * Called with a `Request` it returns a `Response`; called the way Vercel calls
 * it, it writes to `res` and returns nothing. The overloads keep the first form
 * exact so tests can read `.status` off the result without a cast.
 */
export interface VercelHandler {
  (request: Request): Promise<Response>;
  (req: NodeRequest, res: NodeResponse): Promise<void>;
}

export function webHandler(handle: (request: Request) => Promise<Response>): VercelHandler {
  async function handler(req: Request | NodeRequest, res?: NodeResponse): Promise<unknown> {
    // A real Request means a test, or a runtime that already speaks the
    // standard; nothing to convert.
    if (req instanceof Request) return handle(req);

    const response = await handle(await toRequest(req));
    return writeTo(res, response);
  }
  return handler as VercelHandler;
}

async function toRequest(req: NodeRequest): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }

  // Only the host and path matter to these handlers; the scheme is cosmetic,
  // but `new Request` requires an absolute URL.
  const host = headers.get('host') ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);

  const method = (req.method ?? 'GET').toUpperCase();
  // GET and HEAD must not carry a body - Request throws if one is passed.
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);

  return new Request(url, { method, headers, body });
}

/**
 * Vercel may hand over a body already parsed as an object, as a string or
 * Buffer, or not at all with the stream still unread. Getting this wrong does
 * not crash - it turns every request into "Invalid JSON", which looks like a
 * client bug rather than a runtime one - so all four cases are handled.
 */
async function readBody(req: NodeRequest): Promise<string | undefined> {
  const body = req.body;

  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  if (body !== undefined && body !== null) return JSON.stringify(body);

  const stream = req as unknown as AsyncIterable<Uint8Array> | undefined;
  if (!stream || typeof (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== 'function') {
    return undefined;
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
}

async function writeTo(res: NodeResponse | undefined, response: Response): Promise<void> {
  // Only reachable if a runtime calls with neither shape; nothing to write to.
  if (!res) return;

  const text = await response.text();
  res.status(response.status);
  // Carried across deliberately: `cache-control: no-store` from _auth.ts is set
  // on every response here and must not be dropped in translation.
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(text);
}
