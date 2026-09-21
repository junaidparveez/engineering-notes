import { PUBLISH } from '../config/app.config';
import { getRepoConfig, readmePath } from '../config/repoConfig';
import { pretty } from './frontmatter';
import type { Note } from '../types';

/**
 * What a publish would do, worked out before anything is sent.
 *
 * Pure: notes and tombstones in, a plan out. The panel renders this, the
 * publish executes it, and the tests check it - all from the same description,
 * so what is shown and what happens cannot drift apart.
 */

export interface Tombstone {
  path: string;
  deletedAt: number;
  previousSha: string | null;
}

export interface PublishPlan {
  /** Never published before. */
  created: Note[];
  /** Published, then edited. */
  updated: Note[];
  /** Deleted locally, still on GitHub. */
  removed: Tombstone[];
  /** created + updated + removed. */
  total: number;
}

export function buildPlan(notes: Note[], tombstones: Tombstone[]): PublishPlan {
  const created = notes.filter((n) => n.status === 'draft');
  const updated = notes.filter((n) => n.status === 'modified');
  // A tombstone with no published SHA never reached GitHub, so there is
  // nothing to remove there.
  const removed = tombstones.filter((t) => Boolean(t.previousSha));

  return { created, updated, removed, total: created.length + updated.length + removed.length };
}

/**
 * The commit message, e.g.
 *   notes: publish 4 notes (2 new, 1 updated, 1 removed) [skip ci]
 *
 * The [skip ci] tag matters: notes live in the same repository as the app, so
 * without it every publish would spend a Vercel deployment rebuilding a site
 * whose code did not change.
 */
export function commitMessage(plan: PublishPlan): string {
  const parts: string[] = [];
  if (plan.created.length) parts.push(`${plan.created.length} new`);
  if (plan.updated.length) parts.push(`${plan.updated.length} updated`);
  if (plan.removed.length) parts.push(`${plan.removed.length} removed`);

  const noun = plan.total === 1 ? 'note' : 'notes';
  const detail = parts.length ? ` (${parts.join(', ')})` : '';
  return `${PUBLISH.commitMessagePrefix} publish ${plan.total} ${noun}${detail} ${PUBLISH.skipCiTag}`;
}

/**
 * notes/README.md: a linked index of every note that will exist after this
 * publish, grouped by folder.
 *
 * Generated from the note set rather than maintained by hand, and included in
 * the same commit, so the index can never describe a state the repository was
 * never in.
 */
export function buildReadme(notes: Note[], now: Date = new Date()): string {
  const { notesDir } = getRepoConfig();
  const live = [...notes].sort((a, b) => a.path.localeCompare(b.path));

  const byFolder = new Map<string, Note[]>();
  for (const note of live) {
    const folder = note.folder || 'misc';
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), note]);
  }

  const lines: string[] = [
    '# Notes',
    '',
    `${live.length} note${live.length === 1 ? '' : 's'} from the 24-week roadmap.`,
    '',
    '<!-- Generated at publish time. Edits here are overwritten. -->',
    '',
  ];

  for (const folder of [...byFolder.keys()].sort()) {
    const items = byFolder.get(folder)!;
    lines.push(`## ${folder} (${items.length})`, '');
    for (const note of items) {
      // Links are relative to notes/, since that is where this file sits.
      const relative = note.path.replace(new RegExp(`^${notesDir}/`), '');
      const title = note.title || pretty(relative.split('/').pop() ?? relative);
      const week = note.week ? ` — week ${note.week}` : '';
      lines.push(`- [${title}](${relative})${week}`);
    }
    lines.push('');
  }

  lines.push(`_Last updated ${now.toISOString().slice(0, 10)}._`, '');
  return lines.join('\n');
}

/** Where the generated index lives. A function now that the folder is configurable. */
export { readmePath };
