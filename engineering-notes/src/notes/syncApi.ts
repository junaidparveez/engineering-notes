import type { Note } from '../types';

/**
 * The browser half of sync: the passcode, and thin wrappers over the two
 * endpoints.
 *
 * Everything here is explicitly called by a sync hook. No component imports
 * this directly, and nothing in it runs on page load - the app still opens
 * from IndexedDB with no network request.
 */

const PASSCODE_KEY = 'junaid_notes_passcode';

/**
 * The passcode lives in localStorage so sync survives a reload.
 *
 * That is a real trade-off on a shared or work machine: anything with access to
 * this browser profile can read it. It is kept out of the repo and out of every
 * response body, there is a "Forget" button in Settings, and the blast radius
 * is the notes themselves - it grants no access to the GitHub repo, which is
 * why publishing uses a separate short-lived token instead.
 */
export function getPasscode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

export function setPasscode(value: string): void {
  try {
    localStorage.setItem(PASSCODE_KEY, value);
  } catch {
    // Private mode: sync will not work this session, the app still will.
  }
}

export function forgetPasscode(): void {
  try {
    localStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function hasPasscode(): boolean {
  return Boolean(getPasscode());
}

/** Thrown when the server rejects the passcode, so the UI can ask again. */
export class UnauthorisedError extends Error {
  constructor() {
    super('That passcode was rejected.');
    this.name = 'UnauthorisedError';
  }
}

async function post<T>(endpoint: string, payload: unknown): Promise<T> {
  const passcode = getPasscode();
  if (!passcode) throw new UnauthorisedError();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-notes-key': passcode },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) throw new UnauthorisedError();
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Sync failed (${response.status})`);
  }
  return (await response.json()) as T;
}

// --- notes -----------------------------------------------------------------

export interface RemoteNote {
  path: string;
  title: string;
  folder: string;
  week: number | null;
  tags: string[];
  body: string;
  createdAt: number;
  updatedAt: number;
  publishedSha: string | null;
}

export interface DraftListResult {
  notes: RemoteNote[];
  /** path -> deletedAt */
  tombstones: Record<string, number>;
  /** Server clock, stored as the next watermark. */
  now: number;
}

/** Only what changed since `since` - never the whole set. */
export function listDrafts(since: number): Promise<DraftListResult> {
  return post<DraftListResult>('/api/drafts', { action: 'list', since });
}

export function putDraft(note: Note): Promise<{ ok: boolean; updatedAt: number }> {
  // status is not sent: it is derived locally from the blob SHA on each device.
  const { status: _status, ...rest } = note;
  return post('/api/drafts', { action: 'put', note: rest });
}

export function deleteDraft(path: string, deletedAt: number): Promise<{ ok: boolean }> {
  return post('/api/drafts', { action: 'delete', path, deletedAt });
}

// --- roadmap progress -------------------------------------------------------

export interface RemoteProgress<T> {
  state: T;
  updatedAt: number;
}

export function getProgress<T>(): Promise<{ progress: RemoteProgress<T> | null }> {
  return post('/api/progress', { action: 'get' });
}

export function putProgress<T>(
  state: T,
  updatedAt: number,
): Promise<{ ok: boolean; stale?: boolean; progress?: RemoteProgress<T> }> {
  return post('/api/progress', { action: 'put', state, updatedAt });
}
