import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Note } from '../types';

/**
 * IndexedDB: the local source of truth for notes.
 *
 * Every note lives here, always. The app reads this on start and nothing else -
 * opening the app makes no network request, and opening a note makes none
 * either. Redis and GitHub are copies that this one feeds, never the reverse.
 *
 * `idb` is a thin promise wrapper over IndexedDB's callback API. It is the one
 * dependency in this project bought purely for readability, and the difference
 * is the whole file below versus about three times as much event plumbing.
 */

const DB_NAME = 'sde-career-os-notes';
const DB_VERSION = 1;
const STORE = 'notes';
const TOMBSTONES = 'tombstones';

interface NotesDb extends DBSchema {
  notes: {
    key: string; // the note path, e.g. 'notes/java/collections.md'
    value: Note;
    indexes: { 'by-updated': number; 'by-folder': string };
  };
  tombstones: {
    key: string; // path of a deleted note
    value: { path: string; deletedAt: number; previousSha: string | null };
  };
}

let dbPromise: Promise<IDBPDatabase<NotesDb>> | null = null;

/**
 * Opens the database once and reuses the connection.
 *
 * The upgrade callback is IndexedDB's schema migration: it runs only when the
 * stored version is older than DB_VERSION. Adding a store or an index later
 * means bumping the version and extending this switch - the same shape as a
 * numbered SQL migration.
 */
function db(): Promise<IDBPDatabase<NotesDb>> {
  if (!dbPromise) {
    dbPromise = openDB<NotesDb>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const notes = database.createObjectStore(STORE, { keyPath: 'path' });
          notes.createIndex('by-updated', 'updatedAt');
          notes.createIndex('by-folder', 'folder');
          database.createObjectStore(TOMBSTONES, { keyPath: 'path' });
        }
      },
    });
  }
  return dbPromise;
}

/** Every note, newest first. */
export async function getAllNotes(): Promise<Note[]> {
  const all = await (await db()).getAllFromIndex(STORE, 'by-updated');
  return all.reverse();
}

export async function getNote(path: string): Promise<Note | undefined> {
  return (await db()).get(STORE, path);
}

export async function putNote(note: Note): Promise<void> {
  // An empty string is a legal IndexedDB key, so a note that reached here
  // without a path would be stored as a phantom record under '' rather than
  // failing. A draft carries path: '' until it is first saved, so this is the
  // one mistake worth making loud.
  if (!note.path) throw new Error('Refusing to store a note with no path');
  await (await db()).put(STORE, note);
}

/** Writes several notes in one transaction - used by sync in phase 7. */
export async function putNotes(notes: Note[]): Promise<void> {
  const tx = (await db()).transaction(STORE, 'readwrite');
  await Promise.all([...notes.map((n) => tx.store.put(n)), tx.done]);
}

/**
 * Removes a note locally.
 *
 * A note that was never published can simply go. One that exists on GitHub
 * leaves a tombstone instead, because the publish step needs to know to delete
 * the file there too - without it, deleting locally would silently resurrect
 * the note on the next pull.
 */
export async function deleteNote(note: Note): Promise<void> {
  const database = await db();
  const tx = database.transaction([STORE, TOMBSTONES], 'readwrite');
  await tx.objectStore(STORE).delete(note.path);
  if (note.publishedSha) {
    await tx.objectStore(TOMBSTONES).put({
      path: note.path,
      deletedAt: Date.now(),
      previousSha: note.publishedSha,
    });
  }
  await tx.done;
}

export async function getTombstones() {
  return (await db()).getAll(TOMBSTONES);
}

export async function clearTombstone(path: string): Promise<void> {
  await (await db()).delete(TOMBSTONES, path);
}

/**
 * Moves a note to a new path, as a rename does.
 *
 * Path is the primary key, so this is a delete plus a put rather than an
 * update. Both happen in one transaction so a rename can never leave the note
 * under both paths or neither.
 *
 * `previousSha` is the SHA the note had at its OLD path. The caller passes a
 * note whose own publishedSha is null, because nothing has ever been published
 * at the new path - the renamed note is new to GitHub, and the old path needs
 * deleting there, which is what the tombstone records.
 */
export async function renameNote(
  oldPath: string,
  previousSha: string | null,
  note: Note,
): Promise<void> {
  const database = await db();
  const tx = database.transaction([STORE, TOMBSTONES], 'readwrite');
  await tx.objectStore(STORE).delete(oldPath);
  await tx.objectStore(STORE).put(note);
  if (previousSha) {
    await tx.objectStore(TOMBSTONES).put({ path: oldPath, deletedAt: Date.now(), previousSha });
  }
  await tx.done;
}
