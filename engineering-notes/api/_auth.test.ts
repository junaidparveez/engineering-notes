import { afterEach, describe, expect, it } from 'vitest';
import { isAuthorised, json, unauthorised } from './_auth';

/**
 * This passcode is the only thing standing between the open internet and every
 * note, so the cases below are the ones that would quietly open the door.
 */

function requestWith(key?: string): Request {
  return new Request('https://example.com/api/drafts', {
    method: 'POST',
    headers: key === undefined ? {} : { 'x-notes-key': key },
  });
}

afterEach(() => {
  delete process.env.NOTES_PASSCODE;
});

describe('isAuthorised', () => {
  it('accepts the right passcode', () => {
    process.env.NOTES_PASSCODE = 'correct-horse-battery-staple';
    expect(isAuthorised(requestWith('correct-horse-battery-staple'))).toBe(true);
  });

  it('rejects a wrong passcode', () => {
    process.env.NOTES_PASSCODE = 'correct-horse-battery-staple';
    expect(isAuthorised(requestWith('correct-horse-battery-stapl3'))).toBe(false);
  });

  it('rejects a missing header', () => {
    process.env.NOTES_PASSCODE = 'correct-horse-battery-staple';
    expect(isAuthorised(requestWith())).toBe(false);
    expect(isAuthorised(requestWith(''))).toBe(false);
  });

  it('fails closed when no passcode is configured', () => {
    // A deploy that forgot the env var must not become a public notes API.
    delete process.env.NOTES_PASSCODE;
    expect(isAuthorised(requestWith('anything'))).toBe(false);
    expect(isAuthorised(requestWith(''))).toBe(false);
  });

  it('rejects a prefix of the real passcode', () => {
    process.env.NOTES_PASSCODE = 'long-secret-value';
    expect(isAuthorised(requestWith('long'))).toBe(false);
    expect(isAuthorised(requestWith('long-secret-value-extra'))).toBe(false);
  });

  it('does not throw on a length mismatch', () => {
    // timingSafeEqual throws if the two buffers differ in length, which is why
    // both sides are hashed to a fixed 32 bytes before comparing.
    process.env.NOTES_PASSCODE = 'short';
    expect(() => isAuthorised(requestWith('a-very-much-longer-attempt'))).not.toThrow();
  });
});

describe('responses', () => {
  it('never echoes the passcode back', async () => {
    process.env.NOTES_PASSCODE = 'correct-horse-battery-staple';
    const body = await unauthorised().text();
    expect(body).not.toContain('correct-horse');
    expect(body).toBe('{"error":"Unauthorised"}');
  });

  it('marks responses no-store', () => {
    expect(json({ ok: true }).headers.get('cache-control')).toBe('no-store');
  });
});
