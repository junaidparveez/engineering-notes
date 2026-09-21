import { useCallback, useEffect, useRef, useState } from 'react';
import * as db from './db';
import { withDerivedStatus } from './noteStatus';
import {
  UnauthorisedError,
  deleteDraft,
  hasPasscode,
  listDrafts,
  putDraft,
} from './syncApi';
import type { RemoteNote } from './syncApi';
import { decidePull, decideTombstone, notesToPush } from './syncDecisions';
import type { Note } from '../types';

/**
 * Keeps IndexedDB and Upstash in step.
 *
 * Direction of travel: IndexedDB is the source of truth and answers every read.
 * This pushes what changed a couple of seconds after typing stops, and pulls
 * only what changed since this device last looked.
 *
 * It is not a replication protocol. Two devices, one person, edits minutes or
 * hours apart - so last-write-wins by updatedAt, except where that would throw
 * away work, which is what the conflict list is for.
 */

const WATERMARK_KEY = 'junaid_notes_sync_watermark';
const PUSH_DELAY_MS = 2000;

function readWatermark(): number {
  try {
    return Number(localStorage.getItem(WATERMARK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeWatermark(value: number): void {
  try {
    localStorage.setItem(WATERMARK_KEY, String(value));
  } catch {
    /* private mode: every sync re-pulls, which is correct if wasteful */
  }
}

function toNote(remote: RemoteNote): Note {
  return { ...remote, status: 'draft' };
}

/** A remote note that is newer than local changes we have not pushed. */
export interface Conflict {
  local: Note;
  remote: Note;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'unauthorised' | 'error';

interface UseDraftSyncArgs {
  /** Called when sync changed what is stored, so the UI can reload. */
  onChanged: () => void;
}

export function useDraftSync({ onChanged }: UseDraftSyncArgs) {
  const [state, setState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  // A ref, not state: changing it must not re-render, and the timer has to
  // survive re-renders so a burst of keystrokes collapses into one push.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pull = useCallback(async () => {
    const since = readWatermark();
    const { notes: remoteNotes, tombstones, now } = await listDrafts(since);

    const found: Conflict[] = [];
    let changed = false;

    for (const remote of remoteNotes) {
      const local = await db.getNote(remote.path);
      switch (decidePull(local, remote, since)) {
        case 'take-remote':
          await db.putNote(await withDerivedStatus(toNote(remote)));
          changed = true;
          break;
        case 'conflict':
          found.push({ local: local!, remote: toNote(remote) });
          break;
        case 'keep-local':
          break;
      }
    }

    for (const [path, deletedAt] of Object.entries(tombstones)) {
      const local = await db.getNote(path);
      if (local && decideTombstone(local, Number(deletedAt)) === 'delete-local') {
        await db.deleteNote(local);
        changed = true;
      }
    }

    writeWatermark(now);
    setConflicts(found);
    if (changed) onChanged();
  }, [onChanged]);

  const push = useCallback(async () => {
    const since = readWatermark();
    const all = await db.getAllNotes();
    const changed = notesToPush(all, since);
    for (const note of changed) await putDraft(note);

    const tombstones = await db.getTombstones();
    for (const stone of tombstones) await deleteDraft(stone.path, stone.deletedAt);
  }, []);

  /** Pull then push, reporting what went wrong rather than throwing. */
  const sync = useCallback(async () => {
    if (!hasPasscode()) {
      setState('unauthorised');
      return;
    }
    setState('syncing');
    setError(null);
    try {
      await pull();
      await push();
      setLastSyncedAt(Date.now());
      setState('idle');
    } catch (err) {
      if (err instanceof UnauthorisedError) {
        setState('unauthorised');
      } else if (!navigator.onLine) {
        // Offline is normal, not a failure: everything is already saved
        // locally and the next sync catches up.
        setState('offline');
      } else {
        setState('error');
        setError(err instanceof Error ? err.message : 'Sync failed');
      }
    }
  }, [pull, push]);

  /** Called after each local save; collapses a burst of edits into one sync. */
  const scheduleSync = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void sync(), PUSH_DELAY_MS);
  }, [sync]);

  /** Resolve one conflict: keep the local copy, or take the remote one. */
  const resolve = useCallback(
    async (path: string, choice: 'mine' | 'theirs') => {
      const conflict = conflicts.find((c) => c.local.path === path);
      if (!conflict) return;

      if (choice === 'theirs') {
        await db.putNote(await withDerivedStatus(conflict.remote));
      } else {
        // Keeping ours means re-stamping it so it wins the next comparison.
        await db.putNote(await withDerivedStatus({ ...conflict.local, updatedAt: Date.now() }));
      }
      setConflicts((prev) => prev.filter((c) => c.local.path !== path));
      onChanged();
      scheduleSync();
    },
    [conflicts, onChanged, scheduleSync],
  );

  // One sync when the notes page opens, if a passcode is set. Nothing here runs
  // on app start - opening the app still makes no request at all.
  //
  // The cleanup clears a pending debounce so a timer cannot fire after the page
  // is gone and sync against a half-torn-down state.
  useEffect(() => {
    if (hasPasscode()) void sync();
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // Deliberately once on mount: sync() changes identity whenever its inputs
    // do, and listing it here would re-sync on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, error, lastSyncedAt, conflicts, sync, scheduleSync, resolve };
}
