import { isAuthorised, json, unauthorised } from './_auth';

/**
 * A proxy for exactly two GitHub endpoints, and nothing else.
 *
 * It exists for one reason: GitHub's OAuth endpoints live on github.com, which
 * sends no CORS headers, so a browser cannot call them directly. Every other
 * GitHub call this app makes goes straight to api.github.com, which does
 * support CORS.
 *
 * One honest caveat about the design: the access token DOES pass through here,
 * in the response body of the poll call, because that call has to be proxied
 * too. It is forwarded and never stored, never logged and never written to disk
 * - but "the token never touches my server" is not quite true, and it is better
 * to know that than to believe otherwise.
 *
 * There is no client secret here, and there is no repository token in any
 * environment variable. The device flow is designed for clients that cannot
 * keep a secret, which is the whole point of using it.
 */

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

interface Body {
  action?: 'start' | 'poll';
  /** Public by design - it is in the client bundle either way. */
  client_id?: string;
  device_code?: string;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);

  // Gated by the same passcode as the notes. Not required by the flow - the
  // client id is public and an attacker cannot finish an authorisation they
  // cannot see the code for - but it stops a stranger who finds this URL from
  // using it to mint device codes against the app and burn its rate limit.
  if (!isAuthorised(request)) return unauthorised();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.client_id) return json({ error: 'client_id is required' }, 400);

  try {
    if (body.action === 'start') {
      // GitHub Apps take no `scope`: permissions come from the app definition.
      return await forward(DEVICE_CODE_URL, { client_id: body.client_id });
    }

    if (body.action === 'poll') {
      if (!body.device_code) return json({ error: 'device_code is required' }, 400);
      return await forward(ACCESS_TOKEN_URL, {
        client_id: body.client_id,
        device_code: body.device_code,
        grant_type: DEVICE_GRANT_TYPE,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'GitHub request failed' }, 502);
  }
}

/**
 * Posts to GitHub and hands back its JSON untouched.
 *
 * GitHub answers 200 with an `error` field for the normal in-progress cases
 * (authorization_pending, slow_down), so the status is passed through as-is
 * and the client decides what each one means. Nothing is logged: the poll
 * response contains the token.
 */
async function forward(url: string, params: Record<string, string>): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });

  const payload: unknown = await response.json().catch(() => ({ error: 'unparseable_response' }));
  return json(payload, response.ok ? 200 : response.status);
}
