import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOKEN_LIFETIME_SECONDS,
  formatCountdown,
  headroomFor,
  interpretPoll,
  isTokenUsable,
  secondsRemaining,
} from './deviceAuthRules';

/**
 * Every documented device-flow response, including the two that are normal
 * (pending, slow_down) and the one that means the app is misconfigured
 * (unsupported_grant_type). A missing case here shows up as a spinner that
 * never resolves, which is exactly what these are meant to prevent.
 */
describe('interpretPoll', () => {
  it('returns the token on success', () => {
    const outcome = interpretPoll({ access_token: 'ghu_abc123', expires_in: 28_800 });
    expect(outcome).toEqual({ kind: 'token', token: 'ghu_abc123', expiresInSeconds: 28_800 });
  });

  it('falls back to an 8-hour lifetime if GitHub omits expires_in', () => {
    const outcome = interpretPoll({ access_token: 'ghu_abc123' });
    expect(outcome).toEqual({
      kind: 'token',
      token: 'ghu_abc123',
      expiresInSeconds: DEFAULT_TOKEN_LIFETIME_SECONDS,
    });
  });

  it('treats authorization_pending as normal', () => {
    expect(interpretPoll({ error: 'authorization_pending' })).toEqual({ kind: 'pending' });
  });

  it('asks for 5 more seconds on slow_down', () => {
    expect(interpretPoll({ error: 'slow_down' })).toEqual({ kind: 'slow-down', addSeconds: 5 });
  });

  it('reports an expired code', () => {
    expect(interpretPoll({ error: 'expired_token' })).toEqual({ kind: 'expired' });
  });

  it('reports a cancelled authorisation', () => {
    expect(interpretPoll({ error: 'access_denied' })).toEqual({ kind: 'denied' });
  });

  it('names the device-flow setting for unsupported_grant_type', () => {
    // The single most common setup mistake: Device Flow is off by default on a
    // new GitHub App, and GitHub's own error says nothing about it.
    const outcome = interpretPoll({ error: 'unsupported_grant_type' });
    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.message).toContain('Enable Device Flow');
  });

  it('names the client ID for incorrect_client_credentials', () => {
    const outcome = interpretPoll({ error: 'incorrect_client_credentials' });
    expect(outcome.kind === 'failed' && outcome.message).toContain('client ID');
  });

  it('passes through an unrecognised error rather than swallowing it', () => {
    const outcome = interpretPoll({ error: 'something_new', error_description: 'Try again later' });
    expect(outcome).toEqual({ kind: 'failed', message: 'Try again later' });
  });

  it('never returns pending for an empty response', () => {
    // An empty body must not look like "keep waiting", or the UI hangs.
    expect(interpretPoll({}).kind).toBe('failed');
  });
});

describe('countdown helpers', () => {
  const now = new Date('2026-09-20T10:00:00').getTime();

  it('counts down and stops at zero', () => {
    expect(secondsRemaining(now + 900_000, now)).toBe(900);
    expect(secondsRemaining(now - 5_000, now)).toBe(0);
  });

  it('formats as mm:ss', () => {
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });
});

describe('isTokenUsable', () => {
  const now = new Date('2026-09-20T10:00:00').getTime();

  it('accepts a token with plenty of time left', () => {
    expect(isTokenUsable(now + 3_600_000, now)).toBe(true);
  });

  it('rejects an expired token', () => {
    expect(isTokenUsable(now - 1, now)).toBe(false);
  });

  it('rejects a token about to expire', () => {
    // A minute of headroom, so a publish cannot start valid and fail with a
    // 401 partway through pushing blobs.
    expect(isTokenUsable(now + 30_000, now)).toBe(false);
    expect(isTokenUsable(now + 61_000, now)).toBe(true);
  });
});

describe('headroomFor', () => {
  it('keeps a full minute of headroom for a long-lived token', () => {
    expect(headroomFor(8 * 60 * 60 * 1000)).toBe(60_000);
    expect(headroomFor(15 * 60 * 1000)).toBe(60_000);
  });

  it('shrinks the headroom rather than eating a short lifetime', () => {
    // With a 2-minute token, a flat minute of headroom would leave one usable
    // minute; with a 1-minute token it would be unusable on arrival.
    expect(headroomFor(2 * 60 * 1000)).toBe(30_000);
    expect(headroomFor(60_000)).toBe(15_000);
  });

  it('leaves a freshly issued short token usable', () => {
    const lifetimeMs = 2 * 60 * 1000;
    const now = Date.now();
    expect(isTokenUsable(now + lifetimeMs, now, headroomFor(lifetimeMs))).toBe(true);
  });
});
