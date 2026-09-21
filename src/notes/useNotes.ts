import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRepoConfig } from '../config/repoConfig';
import * as db from './db';
import { slug } from './frontmatter';
import { withDerivedStatus } from './noteStatus';
import type { Note } from '../types';

/**
 * Loading, saving and deleting notes, with IndexedDB behind it.
 *
 * Save is local only in this phase: it writes to IndexedDB and nothing else.
 * Nothing in this file touches the network - pushing to Redis and publishing to
 * GitHub are separate, later, and explicitly triggered.
 */

/** Builds the path a note lives at. The one definition of that format. */
export function notePath(folder: string, filename: string): string {
  return `${getRepoConfig().notesDir}/${slug(folder)}/${slug(filename)}.md`;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  /** Re-reads every note from IndexedDB. Called after sync changes things. */
  const reload = useCallback(async () => {
    const stored = await db.getAllNotes();
    setNotes(await Promise.all(stored.map((n) => withDerivedStatus(n))));
    setLoading(false);
  }, []);

  // Loads every note once on mount. IndexedDB is local, so this is fast enough
  // that there is no loading state worth designing for - but it is still
  // asynchronous, hence the effect rather than a plain read.
  //
  // `cancelled` is the cleanup guard: if the component unmounts while the read
  // is in flight, the late result must not call setState on a dead component.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await db.getAllNotes();
      const withStatus = await Promise.all(stored.map((n) => withDerivedStatus(n)));
      if (!cancelled) {
        setNotes(withStatus);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Writes a note and refreshes it in the list. */
  const saveNote = useCallback(async (note: Note): Promise<Note> => {
    const stamped = await withDerivedStatus({ ...note, updatedAt: Date.now() });
    await db.putNote(stamped);
    setNotes((prev) => {
      const without = prev.filter((n) => n.path !== stamped.path);
      return [stamped, ...without];
    });
    return stamped;
  }, []);

  /** Saves a note under a new path, leaving a tombstone for the old one. */
  const renameAndSave = useCallback(async (oldPath: string, note: Note): Promise<Note> => {
    // Nothing has been published at the new path, so the new record starts with
    // no publishedSha; the old path keeps its SHA in the tombstone so publish
    // knows to remove that file from GitHub.
    const moved = await withDerivedStatus({
      ...note,
      publishedSha: null,
      updatedAt: Date.now(),
    });
    await db.renameNote(oldPath, note.publishedSha, moved);
    setNotes((prev) => [moved, ...prev.filter((n) => n.path !== oldPath && n.path !== moved.path)]);
    return moved;
  }, []);

  const removeNote = useCallback(async (note: Note) => {
    await db.deleteNote(note);
    setNotes((prev) => prev.filter((n) => n.path !== note.path));
  }, []);

  /** Counts for the publish badge in phase 9. */
  const pendingCount = useMemo(
    () => notes.filter((n) => n.status === 'draft' || n.status === 'modified').length,
    [notes],
  );

  return { notes, loading, reload, saveNote, renameAndSave, removeNote, pendingCount };
}
