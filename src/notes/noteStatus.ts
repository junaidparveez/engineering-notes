import { renderNoteFile } from './frontmatter';
import { gitBlobSha } from './gitBlobSha';
import type { Note, NoteStatus } from '../types';

/**
 * Works out whether a note is a draft, published, or modified since publish.
 *
 * Nothing about status is stored by hand. We render the exact file we would
 * publish, hash it the way git would, and compare with the SHA GitHub gave us
 * last time. That means status cannot drift: editing a note and editing it back
 * leaves it `published`, which a "dirty" flag would get wrong.
 *
 * `deleted` is not produced here - a deleted note is a tombstone in IndexedDB
 * rather than a Note, since the record itself is gone.
 */
export async function deriveStatus(note: Note, now: Date = new Date()): Promise<NoteStatus> {
  if (!note.publishedSha) return 'draft';

  // The `updated:` line in the frontmatter is stamped from `now`, so a note
  // published on an earlier day would always look modified. Compare using the
  // date the note was last actually edited instead of today's date.
  const sha = await gitBlobSha(renderNoteFile(note, new Date(note.updatedAt || now.getTime())));
  return sha === note.publishedSha ? 'published' : 'modified';
}

/** Returns the note with its status recomputed. */
export async function withDerivedStatus(note: Note, now: Date = new Date()): Promise<Note> {
  return { ...note, status: await deriveStatus(note, now) };
}
