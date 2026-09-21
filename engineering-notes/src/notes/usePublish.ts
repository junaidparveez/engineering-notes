import { useCallback, useState } from 'react';
import { PUBLISH } from '../config/app.config';
import * as db from './db';
import { forgetToken, getStoredToken } from './deviceAuth';
import { renderNoteFile } from './frontmatter';
import * as gh from './github';
import { withDerivedStatus } from './noteStatus';
import { buildReadme, commitMessage, readmePath } from './publishPlan';
import type { PublishPlan } from './publishPlan';
import type { Note } from '../types';

/**
 * Publishing: however many notes changed, exactly one commit.
 *
 * The sequence is the Git Data API's, and each step is a plain call in
 * github.ts:
 *   1. read where the branch points          -> base commit SHA
 *   2. read that commit                       -> base tree SHA
 *   3. upload each changed note               -> blob SHAs
 *   4. build one tree over the base tree
 *   5. create one commit with that tree
 *   6. move the branch, never forced
 */

export type PublishPhase =
  | 'idle'
  | 'reading'
  | 'uploading'
  | 'committing'
  | 'done'
  | 'needs-auth'
  | 'error';

export interface PublishResult {
  commitSha: string;
  url: string;
  published: number;
}

export function usePublish(notes: Note[], onPublished: () => void) {
  const [phase, setPhase] = useState<PublishPhase>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  const publish = useCallback(
    async (plan: PublishPlan) => {
      const token = getStoredToken();
      if (!token) {
        setPhase('needs-auth');
        return;
      }
      if (plan.total === 0) return;

      setError(null);
      setResult(null);

      try {
        setPhase('reading');
        setProgress('Reading the branch…');

        // The file each changed note becomes, rendered once and reused for the
        // blob and for the SHA stored afterwards.
        const changed = [...plan.created, ...plan.updated];
        const files = new Map<string, string>();
        for (const note of changed) {
          // Rendered against the note's own last-edit time, NOT today's date.
          // The frontmatter carries an `updated:` line, and noteStatus derives
          // status by re-rendering the same way; stamping "today" here would
          // make every note read as modified the moment it was published.
          files.set(note.path, renderNoteFile(note, new Date(note.updatedAt)));
        }

        // The index describes the notes that will exist AFTER this publish:
        // everything local, minus what is being removed.
        const removedPaths = new Set(plan.removed.map((t) => t.path));
        const surviving = notes.filter((n) => !removedPaths.has(n.path));
        files.set(readmePath(), buildReadme(surviving));

        setPhase('uploading');
        const blobs = new Map<string, string>();
        let done = 0;
        for (const [path, content] of files) {
          setProgress(`Uploading ${++done} of ${files.size}…`);
          blobs.set(path, await gh.createBlob(token, content));
        }

        setPhase('committing');
        setProgress('Creating the commit…');
        const commitSha = await commitOnce(token, plan, blobs, commitMessage(plan));

        // Only once GitHub has accepted everything: record the published SHA
        // for each note so status derivation says "published", and drop the
        // tombstones that have now been acted on.
        await recordPublished(changed, blobs, plan);

        setResult({ commitSha, url: gh.commitUrl(commitSha), published: plan.total });
        setPhase('done');
        setProgress('');

        // A repo-write credential has no reason to outlive the publish it was
        // obtained for.
        if (PUBLISH.forgetTokenAfterPublish) forgetToken();

        onPublished();
      } catch (err) {
        if (err instanceof gh.GitHubError && err.status === 401) {
          forgetToken();
          setPhase('needs-auth');
          return;
        }
        setPhase('error');
        setError(err instanceof Error ? err.message : 'Publish failed.');
      }
    },
    [notes, onPublished],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setResult(null);
    setProgress('');
  }, []);

  return { phase, progress, error, result, publish, reset };
}

/**
 * Steps 4-6, with one retry.
 *
 * If the branch moved between reading it and updating it, step 6 returns 422.
 * That means someone (or another device) committed in between, so the tree has
 * to be rebuilt on the new base - not forced over. One retry, then a clear
 * error: a loop here could spin against a busy branch forever.
 */
async function commitOnce(
  token: string,
  plan: PublishPlan,
  blobs: Map<string, string>,
  message: string,
  attempt = 1,
): Promise<string> {
  const { commitSha: baseCommit, treeSha: baseTree } = await gh.readBranch(token);

  const changes: gh.TreeChange[] = [
    ...[...blobs.entries()].map(([path, sha]) => ({ path, sha })),
    // A null SHA removes the path in the new tree.
    ...plan.removed.map((t) => ({ path: t.path, sha: null })),
  ];

  const treeSha = await gh.createTree(token, baseTree, changes);
  const commitSha = await gh.createCommit(token, message, treeSha, baseCommit);

  try {
    await gh.updateBranch(token, commitSha);
    return commitSha;
  } catch (err) {
    if (err instanceof gh.GitHubError && err.status === 422 && attempt === 1) {
      return commitOnce(token, plan, blobs, message, 2);
    }
    if (err instanceof gh.GitHubError && err.status === 422) {
      throw new Error(
        'The branch moved while publishing, twice. Pull from GitHub and try again — nothing was force-pushed.',
      );
    }
    throw err;
  }
}

/** Marks everything published locally, after GitHub has accepted the commit. */
async function recordPublished(
  changed: Note[],
  blobs: Map<string, string>,
  plan: PublishPlan,
): Promise<void> {
  for (const note of changed) {
    const sha = blobs.get(note.path);
    if (!sha) continue;
    // publishedSha is what makes status derivation report "published" until
    // the note is edited again.
    await db.putNote(await withDerivedStatus({ ...note, publishedSha: sha }));
  }
  for (const tombstone of plan.removed) {
    await db.clearTombstone(tombstone.path);
  }
}
