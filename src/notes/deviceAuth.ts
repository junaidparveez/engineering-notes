import { PUBLISH } from '../config/app.config';
import { getRepoConfig, validateRepoConfig } from '../config/repoConfig';
import { getPasscode } from './syncApi';
import {
  DEFAULT_TOKEN_LIFETIME_SECONDS,
  headroomFor,
  interpretPoll,
  isTokenUsable,
} from './deviceAuthRules';
import type { PollOutcome, PollResponse } from './deviceAuthRules';

/**
 * The GitHub device flow, client side.
 *
 * Why this shape: there is no GitHub token in any environment variable in this
 * project. Writing to the repo requires authorising it from the UI, the
 * resulting token lives in sessionStorage for minutes, not hours, and it can be
 * revoked from GitHub settings at any time. If the Vercel account or the notes
 * passcode leaks, neither can write to the repo.
 *
 * A GitHub App rather than an OAuth App, deliberately: an OAuth App's `repo`
 * scope grants write access to every repository the user owns, while a GitHub
 * App's user token only reaches repositories where the app is installed, with
 * only the permissions it declares.
 */

const TOKEN_KEY = 'junaid_github_user_token';

export interface DeviceCode {
  deviceCode: string;
  /** Shown to the user, e.g. 'ABCD-1234'. */
  userCode: string;
  /** Where to enter it, e.g. https://github.com/login/device */
  verificationUri: string;
  /** Absolute time the code stops working. */
  expiresAt: number;
  /** Seconds between polls, per GitHub. */
  intervalSeconds: number;
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

/**
 * sessionStorage, not localStorage: the token dies with the tab. That is the
 * deliberate trade - re-authorising takes about twenty seconds and happens a
 * few times a week, against a repo-write credential sitting on disk.
 */
export function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredToken;
    const headroom = headroomFor(PUBLISH.tokenLifetimeMinutes * 60 * 1000);
    if (!stored.token || !isTokenUsable(stored.expiresAt, Date.now(), headroom)) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return stored.token;
  } catch {
    return null;
  }
}

/**
 * Stores the token for the SHORTER of GitHub's expiry and our own limit.
 *
 * GitHub hands out eight hours; publishing needs seconds. On a work machine
 * that difference is the whole risk, so the app keeps it for
 * PUBLISH.tokenLifetimeMinutes and then makes you authorise again.
 */
export function storeToken(token: string, expiresInSeconds: number): void {
  const ourLimitMs = PUBLISH.tokenLifetimeMinutes * 60 * 1000;
  const githubLimitMs = expiresInSeconds * 1000;
  const stored: StoredToken = { token, expiresAt: Date.now() + Math.min(ourLimitMs, githubLimitMs) };
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  } catch {
    // Private mode: publishing still works this session, from memory upward,
    // but the token will not survive a reload.
  }
}

export function forgetToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing stored */
  }
}

/** When the stored token expires, or null if there is none. */
export function tokenExpiresAt(): number | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as StoredToken).expiresAt ?? null;
  } catch {
    return null;
  }
}

async function callProxy<T>(payload: Record<string, unknown>): Promise<T> {
  const passcode = getPasscode();
  const response = await fetch('/api/github-auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // The proxy is behind the same passcode as the notes.
      ...(passcode ? { 'x-notes-key': passcode } : {}),
    },
    body: JSON.stringify({ client_id: getRepoConfig().clientId, ...payload }),
  });

  if (response.status === 401) {
    throw new Error('Enter your notes passcode in Settings before authorising GitHub.');
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `GitHub authorisation failed (${response.status})`);
  }
  return (await response.json()) as T;
}

interface StartResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

/** Step 1: ask GitHub for a code for the user to type. */
export async function startDeviceFlow(): Promise<DeviceCode> {
  const problem = validateRepoConfig(getRepoConfig()).clientId;
  if (problem) {
    throw new Error(`GitHub App client ID: ${problem} Set it in Settings -> Publishing target.`);
  }

  const data = await callProxy<StartResponse>({ action: 'start' });
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(
      data.error_description || data.error || 'GitHub did not return a device code.',
    );
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresAt: Date.now() + (Number(data.expires_in) || 900) * 1000,
    intervalSeconds: Number(data.interval) || 5,
  };
}

/** One poll. The caller owns the waiting, so the UI can show a countdown. */
export async function pollOnce(deviceCode: string): Promise<PollOutcome> {
  const data = await callProxy<PollResponse>({ action: 'poll', device_code: deviceCode });
  return interpretPoll(data);
}

/**
 * Polls until GitHub answers, storing the token on success.
 *
 * `signal` lets the UI stop a flow that is no longer on screen - without it a
 * poll loop would keep running against a closed panel until the code expired.
 */
export async function waitForAuthorisation(
  code: DeviceCode,
  { signal, onWaiting }: { signal?: AbortSignal; onWaiting?: () => void } = {},
): Promise<void> {
  let intervalMs = code.intervalSeconds * 1000;

  for (;;) {
    if (signal?.aborted) throw new Error('Authorisation cancelled.');
    if (Date.now() > code.expiresAt) {
      throw new Error('That code expired. Start the authorisation again.');
    }

    await sleep(intervalMs, signal);
    if (signal?.aborted) throw new Error('Authorisation cancelled.');

    const outcome = await pollOnce(code.deviceCode);
    switch (outcome.kind) {
      case 'token':
        storeToken(outcome.token, outcome.expiresInSeconds || DEFAULT_TOKEN_LIFETIME_SECONDS);
        return;
      case 'pending':
        onWaiting?.();
        break;
      case 'slow-down':
        // GitHub asks for more space between polls; honour it or it keeps
        // returning slow_down and the flow never completes.
        intervalMs += outcome.addSeconds * 1000;
        onWaiting?.();
        break;
      case 'expired':
        throw new Error('That code expired. Start the authorisation again.');
      case 'denied':
        throw new Error('Authorisation was cancelled on GitHub.');
      case 'failed':
        throw new Error(outcome.message);
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
