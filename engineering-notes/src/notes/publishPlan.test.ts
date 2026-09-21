import { describe, expect, it } from 'vitest';
import { renderNoteFile } from './frontmatter';
import { gitBlobSha } from './gitBlobSha';
import { deriveStatus } from './noteStatus';
import { buildPlan, buildReadme, commitMessage, readmePath } from './publishPlan';
import type { Note } from '../types';

function note(overrides: Partial<Note> = {}): Note {
  return {
    path: 'notes/java/collections.md',
    title: 'Collections',
    folder: 'java',
    week: 1,
    tags: ['java'],
    body: 'Body.\n',
    createdAt: new Date('2026-09-20T09:00:00').getTime(),
    updatedAt: new Date('2026-09-21T09:00:00').getTime(),
    status: 'draft',
    publishedSha: null,
    ...overrides,
  };
}

describe('buildPlan', () => {
  it('splits notes into new and updated, and ignores published ones', () => {
    const plan = buildPlan(
      [
        note({ path: 'a.md', status: 'draft' }),
        note({ path: 'b.md', status: 'modified' }),
        note({ path: 'c.md', status: 'published' }),
      ],
      [],
    );
    expect(plan.created.map((n) => n.path)).toEqual(['a.md']);
    expect(plan.updated.map((n) => n.path)).toEqual(['b.md']);
    expect(plan.total).toBe(2);
  });

  it('skips tombstones for notes that never reached GitHub', () => {
    // Deleting a draft is purely local - there is nothing to remove remotely.
    const plan = buildPlan([], [
      { path: 'never-published.md', deletedAt: 1, previousSha: null },
      { path: 'was-published.md', deletedAt: 2, previousSha: 'abc123' },
    ]);
    expect(plan.removed.map((t) => t.path)).toEqual(['was-published.md']);
    expect(plan.total).toBe(1);
  });

  it('is empty when nothing changed', () => {
    expect(buildPlan([note({ status: 'published' })], []).total).toBe(0);
  });
});

describe('commitMessage', () => {
  it('matches the format the spec asks for', () => {
    const plan = buildPlan(
      [
        note({ path: 'a.md', status: 'draft' }),
        note({ path: 'b.md', status: 'draft' }),
        note({ path: 'c.md', status: 'modified' }),
      ],
      [{ path: 'd.md', deletedAt: 1, previousSha: 'sha' }],
    );
    expect(commitMessage(plan)).toBe(
      'notes: publish 4 notes (2 new, 1 updated, 1 removed) [skip ci]',
    );
  });

  it('says "note" for a single note', () => {
    const plan = buildPlan([note({ status: 'draft' })], []);
    expect(commitMessage(plan)).toBe('notes: publish 1 note (1 new) [skip ci]');
  });

  it('always carries the skip-ci tag', () => {
    // Notes live in the same repo as the app; without this every publish
    // spends a deployment rebuilding an unchanged site.
    const plan = buildPlan([note({ status: 'modified' })], []);
    expect(commitMessage(plan)).toContain('[skip ci]');
  });
});

describe('buildReadme', () => {
  const now = new Date('2026-09-27T10:00:00');

  it('lists every note grouped by folder, with relative links', () => {
    const readme = buildReadme(
      [
        note({ path: 'notes/java/collections.md', title: 'Collections', folder: 'java' }),
        note({ path: 'notes/kafka/retries.md', title: 'Retries', folder: 'kafka', week: 7 }),
      ],
      now,
    );
    expect(readme).toContain('## java (1)');
    expect(readme).toContain('## kafka (1)');
    // Relative to notes/, since README.md sits inside that folder.
    expect(readme).toContain('- [Collections](java/collections.md)');
    expect(readme).toContain('- [Retries](kafka/retries.md) — week 7');
  });

  it('counts the notes and dates the file', () => {
    const readme = buildReadme([note()], now);
    expect(readme).toContain('1 note from the 24-week roadmap.');
    expect(readme).toContain('_Last updated 2026-09-27._');
  });

  it('says it is generated, so nobody edits it by hand', () => {
    expect(buildReadme([note()], now)).toContain('Generated at publish time');
  });

  it('handles an empty note set without breaking', () => {
    const readme = buildReadme([], now);
    expect(readme).toContain('0 notes');
  });

  it('is written into the notes folder', () => {
    expect(readmePath()).toBe('notes/README.md');
  });
});

describe('what publish stores back', () => {
  it('leaves a published note reading as published, not modified', async () => {
    // The trap: the frontmatter has an `updated:` line. Render the blob with
    // today's date while status derives from the note's edit date and every
    // note reads as modified the instant it is published.
    const published = note();
    const fileSentToGitHub = renderNoteFile(published, new Date(published.updatedAt));
    const blobSha = await gitBlobSha(fileSentToGitHub);

    const afterPublish = { ...published, publishedSha: blobSha };
    await expect(deriveStatus(afterPublish)).resolves.toBe('published');

    // And still published a week later, without touching the note.
    await expect(deriveStatus(afterPublish, new Date('2026-10-05T10:00:00'))).resolves.toBe(
      'published',
    );
  });

  it('reads as modified once the note is edited again', async () => {
    const published = note();
    const blobSha = await gitBlobSha(renderNoteFile(published, new Date(published.updatedAt)));
    const edited = { ...published, publishedSha: blobSha, body: 'Rewritten.\n' };
    await expect(deriveStatus(edited)).resolves.toBe('modified');
  });
});
