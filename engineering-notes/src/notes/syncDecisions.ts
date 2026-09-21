import type { Note } from '../types';

/**
 * What to do with one note during a pull.
 *
 * This is the only genuinely tricky logic in sync, so it lives here as a pure
 * function rather than inside the hook: given a local note, a remote note and
 * the watermark from the last sync, decide - with no database, no network and
 * no React in the way.
 */

export type PullDecision =
  /** Nothing local, or remote is newer and we had no unpushed changes. */
  | 'take-remote'
  /** Ours is newer or identical; the next push will carry it. */
  | 'keep-local'
  /** Both sides moved since the last sync. Ask rather than guess. */
  | 'conflict';

export function decidePull(
  local: Note | undefined,
  remote: { path: string; updatedAt: number },
  since: number,
): PullDecision {
  if (!local) return 'take-remote';

  // Equal timestamps mean the same version: the remote copy is almost always
  // the one this device pushed last time.
  if (local.updatedAt >= remote.updatedAt) return 'keep-local';

  // Remote is newer. The question is whether we would be discarding anything:
  // a local note untouched since the last sync is just an old copy, but one
  // edited since holds work the server has never seen.
  return local.updatedAt > since ? 'conflict' : 'take-remote';
}

export type TombstoneDecision = 'delete-local' | 'keep-local';

/**
 * A note deleted on another device.
 *
 * If it was edited here after the delete, the edit wins and the next push
 * revives it. Losing a deletion is an annoyance; losing a note someone just
 * wrote is not.
 */
export function decideTombstone(local: Note | undefined, deletedAt: number): TombstoneDecision {
  if (!local) return 'keep-local'; // nothing here to delete
  return local.updatedAt < deletedAt ? 'delete-local' : 'keep-local';
}

/** Notes changed since the watermark - what a push needs to send. */
export function notesToPush(notes: Note[], since: number): Note[] {
  return notes.filter((n) => n.updatedAt > since);
}
