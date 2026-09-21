import { describe, expect, it } from 'vitest';
import { renderNoteFile } from './frontmatter';
import { gitBlobSha } from './gitBlobSha';
import { deriveStatus } from './noteStatus';
import type { Note } from '../types';

const EDITED = new Date('2026-09-27T10:00:00');

function note(overrides: Partial<Note> = {}): Note {
  return {
    path: 'notes/java/hashmap-internals.md',
    title: 'HashMap internals',
    folder: 'java',
    week: 1,
    tags: ['java'],
    body: 'Original body.\n',
    createdAt: new Date('2026-09-20T08:30:00').getTime(),
    updatedAt: EDITED.getTime(),
    status: 'draft',
    publishedSha: null,
    ...overrides,
  };
}

/** The SHA the note would have if published exactly as it stands. */
async function shaOf(n: Note): Promise<string> {
  return gitBlobSha(renderNoteFile(n, new Date(n.updatedAt)));
}

describe('deriveStatus', () => {
  it('is draft when the note has never been published', async () => {
    await expect(deriveStatus(note())).resolves.toBe('draft');
  });

  it('is published when the content still hashes to the stored SHA', async () => {
    const base = note();
    const published = { ...base, publishedSha: await shaOf(base) };
    await expect(deriveStatus(published)).resolves.toBe('published');
  });

  it('is modified after the body changes', async () => {
    const base = note();
    const published = { ...base, publishedSha: await shaOf(base) };
    const edited = { ...published, body: 'Rewritten body.\n' };
    await expect(deriveStatus(edited)).resolves.toBe('modified');
  });

  it('is modified after only the tags change', async () => {
    const base = note();
    const published = { ...base, publishedSha: await shaOf(base) };
    const retagged = { ...published, tags: ['java', 'collections'] };
    await expect(deriveStatus(retagged)).resolves.toBe('modified');
  });

  it('returns to published when an edit is undone', async () => {
    // This is what a stored "dirty" flag would get wrong: type a character,
    // delete it, and the note is byte-identical again. Hashing the content
    // rather than tracking edits gets it right for free.
    const base = note();
    const published = { ...base, publishedSha: await shaOf(base) };
    const touched = { ...published, body: 'Original body.\nx' };
    await expect(deriveStatus(touched)).resolves.toBe('modified');

    const undone = { ...touched, body: 'Original body.\n' };
    await expect(deriveStatus(undone)).resolves.toBe('published');
  });

  it('does not report a note as modified just because a day has passed', async () => {
    // The frontmatter carries an `updated:` line. If status were computed
    // against today's date, every note published yesterday would look modified
    // this morning. It is computed against the note's own last-edit time.
    const base = note();
    const published = { ...base, publishedSha: await shaOf(base) };
    const muchLater = new Date('2027-01-15T09:00:00');
    await expect(deriveStatus(published, muchLater)).resolves.toBe('published');
  });
});
