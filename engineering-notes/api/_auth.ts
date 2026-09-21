import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The passcode gate in front of every stored note.
 *
 * Files under /api whose name starts with an underscore are not routed by
 * Vercel, so this is a shared module rather than an endpoint.
 *
 * This passcode is the only thing protecting the notes, so:
 *  - it is compared in constant time, because a plain === leaks how many
 *    leading characters were right through how long the comparison took;
 *  - both sides are hashed first, so the comparison operates on two equal
 *    32-byte buffers - timingSafeEqual throws on a length mismatch, which
 *    would itself leak the length of the real passcode;
 *  - it is never echoed back, not in a response body and not in an error.
 */

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function isAuthorised(request: Request): boolean {
  const expected = process.env.NOTES_PASSCODE;
  // An unset passcode must fail closed. Treating "no passcode configured" as
  // "everything allowed" would publish the whole store on a misconfigured
  // deploy.
  if (!expected) return false;

  const provided = request.headers.get('x-notes-key');
  if (!provided) return false;

  return timingSafeEqual(digest(provided), digest(expected));
}

/** 401 with nothing useful in it. */
export function unauthorised(): Response {
  return json({ error: 'Unauthorised' }, 401);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // These endpoints are personal and per-request; nothing should be cached
      // by Vercel's edge or by the browser.
      'cache-control': 'no-store',
    },
  });
}
