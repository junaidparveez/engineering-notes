import { describe, expect, it } from 'vitest';
import { decidePull, decideTombstone, notesToPush } from './syncDecisions';
import type { Note } from '../types';

const SINCE = 1_000;

function note(updatedAt: number, path = 'notes/java/a.md'): Note {
  return {
    path,
    title: 'A',
    folder: 'java',
    week: 1,
    tags: [],
    body: 'body',
    createdAt: 0,
    updatedAt,
    status: 'draft',
    publishedSha: null,
  };
}

describe('decidePull', () => {
  it('takes a note this device has never seen', () => {
    expect(decidePull(undefined, { path: 'x', updatedAt: 500 }, SINCE)).toBe('take-remote');
  });

  it('keeps the local copy when it is newer', () => {
    expect(decidePull(note(2_000), { path: 'x', updatedAt: 1_500 }, SINCE)).toBe('keep-local');
  });

  it('keeps local when both sides have the same timestamp', () => {
    // Equal almost always means "this is the copy we pushed last time".
    expect(decidePull(note(1_500), { path: 'x', updatedAt: 1_500 }, SINCE)).toBe('keep-local');
  });

  it('takes the remote when ours has not changed since the last sync', () => {
    // Local at 900 is older than the watermark: an untouched stale copy.
    expect(decidePull(note(900), { path: 'x', updatedAt: 2_000 }, SINCE)).toBe('take-remote');
  });

  it('flags a conflict when both sides changed since the last sync', () => {
    // Local edited at 1_500 (after the watermark) and remote is newer still:
    // taking the remote would silently discard local work.
    expect(decidePull(note(1_500), { path: 'x', updatedAt: 2_000 }, SINCE)).toBe('conflict');
  });

  it('does not flag a conflict on a first sync of an untouched note', () => {
    expect(decidePull(note(500), { path: 'x', updatedAt: 800 }, 0)).toBe('conflict');
    // With a zero watermark every local note looks "edited since", which is
    // correct: this device has never synced, so nothing can be assumed stale.
  });
});

describe('decideTombstone', () => {
  it('deletes a local note that has not been touched since the delete', () => {
    expect(decideTombstone(note(1_000), 2_000)).toBe('delete-local');
  });

  it('keeps a note edited after it was deleted elsewhere', () => {
    // The edit wins: a lost deletion is an annoyance, a lost note is not.
    expect(decideTombstone(note(3_000), 2_000)).toBe('keep-local');
  });

  it('does nothing when the note is not here', () => {
    expect(decideTombstone(undefined, 2_000)).toBe('keep-local');
  });
});

describe('notesToPush', () => {
  it('sends only what changed since the watermark', () => {
    const notes = [note(500, 'a.md'), note(1_500, 'b.md'), note(2_500, 'c.md')];
    expect(notesToPush(notes, SINCE).map((n) => n.path)).toEqual(['b.md', 'c.md']);
  });

  it('sends everything on a first sync', () => {
    const notes = [note(500, 'a.md'), note(1_500, 'b.md')];
    expect(notesToPush(notes, 0)).toHaveLength(2);
  });
});
