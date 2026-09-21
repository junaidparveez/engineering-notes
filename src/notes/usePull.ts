import { useCallback, useState } from 'react';
import * as db from './db';
import { getStoredToken } from './deviceAuth';
import { parseFrontmatter, parseTags } from './frontmatter';
import * as gh from './github';
import { withDerivedStatus } from './noteStatus';
import { readmePath } from './publishPlan';
import type { Note } from '../types';

/**
 * Pull from GitHub: for recovery, and for a device that has nothing yet.
 *
 * Never automatic. Opening the app reads IndexedDB and nothing else; this runs
 * only when asked, which is why a laptop that has been offline for a week does
 * not quietly overwrite itself on the next load.
 *
 * It fetches a blob only when the path is missing locally or its SHA differs
 * from what we published, so a normal pull costs one tree read and no blobs.
 */

export type PullPhase = 'idle' | 'reading' | 'fetching' | 'done' | 'needs-auth' | 'error';

/** A note that GitHub and this device both changed. */
export interface PullConflict {
  local: Note;
  remote: Note;
}

export interface PullSummary {
  added: number;
  updated: number;
  unchanged: number;
}

/** Turns a published file back into a Note. */
export function noteFromFile(path: string, content: string, blobSha: string): Note {
  const { meta, body } = parseFrontmatter(content);
  const now = Date.now();
  const parsedCreated = meta.created ? Date.parse(`${meta.created}T00:00:00`) : NaN;
  const parsedUpdated = meta.updated ? Date.parse(`${meta.updated}T00:00:00`) : NaN;

  return {
    path,
    title: meta.title ?? '',
    folder: meta.category ?? path.split('/').slice(1, -1).join('/'),
    week: meta.week ? Number(meta.week) : null,
    tags: parseTags(meta.tags ?? ''),
    body,
    createdAt: Number.isNaN(parsedCreated) ? now : parsedCreated,
    updatedAt: Number.isNaN(parsedUpdated) ? now : parsedUpdated,
    status: 'published',
    // It is on GitHub with exactly this SHA, which is what "published" means.
    publishedSha: blobSha,
  };
}

export function usePull(onChanged: () => void) {
  const [phase, setPhase] = useState<PullPhase>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PullSummary | null>(null);
  const [conflicts, setConflicts] = useState<PullConflict[]>([]);

  const pull = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setPhase('needs-auth');
      return;
    }

    setError(null);
    setSummary(null);
    setConflicts([]);

    try {
      setPhase('reading');
      setProgress('Reading the repository…');
      const index = readmePath();
      const entries = (await gh.readNotesTree(token)).filter((e) => e.path !== index);

      const found: PullConflict[] = [];
      let added = 0;
      let updated = 0;
      let unchanged = 0;

      setPhase('fetching');
      for (const entry of entries) {
        const local = await db.getNote(entry.path);

        // The cheap check first: if the blob SHA matches what we published,
        // the file is byte-identical to our copy and needs no fetch at all.
        if (local && local.publishedSha === entry.sha) {
          unchanged++;
          continue;
        }

        setProgress(`Fetching ${entry.path}…`);
        const content = await gh.readBlob(token, entry.sha);
        const remote = noteFromFile(entry.path, content, entry.sha);

        if (!local) {
          await db.putNote(await withDerivedStatus(remote));
          added++;
          continue;
        }

        // Local has unpublished work and GitHub has something different:
        // taking either side silently would throw away one of them.
        if (local.status === 'draft' || local.status === 'modified') {
          found.push({ local, remote });
          continue;
        }

        await db.putNote(await withDerivedStatus(remote));
        updated++;
      }

      setSummary({ added, updated, unchanged });
      setConflicts(found);
      setPhase('done');
      setProgress('');
      if (added || updated) onChanged();
    } catch (err) {
      if (err instanceof gh.GitHubError && err.status === 401) {
        setPhase('needs-auth');
        return;
      }
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Pull failed.');
    }
  }, [onChanged]);

  /** Keep the local copy, or take the one from GitHub. */
  const resolve = useCallback(
    async (path: string, choice: 'mine' | 'theirs') => {
      const conflict = conflicts.find((c) => c.local.path === path);
      if (!conflict) return;

      if (choice === 'theirs') {
        await db.putNote(await withDerivedStatus(conflict.remote));
      } else {
        // Keeping mine records what GitHub currently holds, so the note reads
        // as "modified" rather than "draft" and the next publish overwrites it.
        await db.putNote(
          await withDerivedStatus({ ...conflict.local, publishedSha: conflict.remote.publishedSha }),
        );
      }
      setConflicts((prev) => prev.filter((c) => c.local.path !== path));
      onChanged();
    },
    [conflicts, onChanged],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setSummary(null);
    setProgress('');
  }, []);

  return { phase, progress, error, summary, conflicts, pull, resolve, reset };
}
