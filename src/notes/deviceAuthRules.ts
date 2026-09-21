/**
 * What each documented device-flow response means, as a pure function.
 *
 * Silent polling failure is miserable to debug - you sit watching a spinner
 * with no idea whether GitHub is waiting for you, rate-limiting you, or
 * refusing outright - so every documented error from GitHub is turned into an
 * explicit outcome here, and tested.
 */

export interface PollResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export type PollOutcome =
  /** Authorised. `token` is a ghu_ user token. */
  | { kind: 'token'; token: string; expiresInSeconds: number }
  /** Normal: the code has not been entered yet. Keep polling. */
  | { kind: 'pending' }
  /** Polling too fast. Add 5s to the interval and continue. */
  | { kind: 'slow-down'; addSeconds: number }
  /** The code expired. Start the flow again. */
  | { kind: 'expired' }
  /** Cancelled on github.com. Stop. */
  | { kind: 'denied' }
  /** Unrecoverable: message is meant to be shown as-is. */
  | { kind: 'failed'; message: string };

/** GitHub App user tokens last 8 hours when expiry is enabled. */
export const DEFAULT_TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

export function interpretPoll(response: PollResponse): PollOutcome {
  if (response.access_token) {
    return {
      kind: 'token',
      token: response.access_token,
      // Falls back to 8 hours if GitHub omits it, so a token is never treated
      // as valid forever.
      expiresInSeconds: Number(response.expires_in) || DEFAULT_TOKEN_LIFETIME_SECONDS,
    };
  }

  switch (response.error) {
    case 'authorization_pending':
      return { kind: 'pending' };
    case 'slow_down':
      return { kind: 'slow-down', addSeconds: 5 };
    case 'expired_token':
      return { kind: 'expired' };
    case 'access_denied':
      return { kind: 'denied' };
    case 'unsupported_grant_type':
      // By far the most common setup mistake, and the error GitHub returns for
      // it says nothing useful, so spell it out.
      return {
        kind: 'failed',
        message:
          'GitHub rejected the device flow (unsupported_grant_type). Enable Device Flow in the GitHub App settings — it is off by default.',
      };
    case 'incorrect_client_credentials':
      return {
        kind: 'failed',
        message:
          'GitHub did not recognise the client ID. Check it in Settings -> Publishing target.',
      };
    case 'device_flow_disabled':
      return {
        kind: 'failed',
        message: 'Device flow is disabled for this GitHub App. Enable it in the app settings.',
      };
    default:
      return {
        kind: 'failed',
        message: response.error_description || response.error || 'GitHub refused the authorisation.',
      };
  }
}

/** Seconds left before a code or token expires, never negative. */
export function secondsRemaining(expiresAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.round((expiresAt - now) / 1000));
}

/** mm:ss for the countdown. */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * A token is treated as expired slightly early, so a publish that starts just
 * before the deadline does not fail halfway through with a 401.
 *
 * The headroom is capped at a quarter of the token's own lifetime: with a
 * deliberately short lifetime, a flat minute would eat most of it and a freshly
 * authorised token could look unusable the moment it arrives.
 */
export function headroomFor(lifetimeMs: number): number {
  return Math.min(60_000, Math.floor(lifetimeMs / 4));
}

export function isTokenUsable(
  expiresAt: number,
  now: number = Date.now(),
  headroomMs = 60_000,
): boolean {
  return expiresAt - now > headroomMs;
}
