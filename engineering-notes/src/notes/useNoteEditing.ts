import { useCallback, useState } from 'react';
import type { EditorFields } from '../components/notes/NoteFields';
import { folderForWeek } from './folders';
import { noteTemplate, parseTags, slug } from './frontmatter';
import { notePath } from './useNotes';
import type { Note } from '../types';

/**
 * The editing session: which note is open, what is in the form, whether it has
 * unsaved changes, and what to write when it is saved.
 *
 * Kept out of the page component so the page is layout and this is behaviour.
 * It holds no storage of its own - saving is handed back to useNotes, which
 * owns IndexedDB.
 */

interface Session {
  /** The note as last saved, or a fresh draft that has never been written. */
  note: Note | null;
  /** The path it was loaded from, or null if it has never been saved. */
  savedPath: string | null;
}

interface UseNoteEditingArgs {
  currentWeek: number;
  saveNote: (note: Note) => Promise<Note>;
  renameAndSave: (oldPath: string, note: Note) => Promise<Note>;
  removeNote: (note: Note) => Promise<void>;
}

/** Turns a stored note into the form's fields. */
function fieldsFor(note: Note): EditorFields {
  return {
    title: note.title,
    folder: note.folder,
    filename: note.path.split('/').pop()?.replace(/\.md$/, '') ?? '',
    week: note.week,
    tags: note.tags.join(', '),
    body: note.body,
  };
}

export function useNoteEditing({ currentWeek, saveNote, renameAndSave, removeNote }: UseNoteEditingArgs) {
  const [session, setSession] = useState<Session>({ note: null, savedPath: null });
  const [fields, setFields] = useState<EditorFields | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /** Guards anything that would throw away unsaved edits. */
  const confirmDiscard = useCallback(() => !dirty || confirm('Discard unsaved changes?'), [dirty]);

  const startNew = useCallback(() => {
    if (!confirmDiscard()) return;
    const now = Date.now();
    const draft: Note = {
      path: '',
      title: '',
      folder: folderForWeek(currentWeek),
      week: currentWeek,
      tags: [],
      body: noteTemplate(),
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      publishedSha: null,
    };
    setSession({ note: draft, savedPath: null });
    setFields({ ...fieldsFor(draft), filename: '' });
    setDirty(false);
    setMessage(null);
  }, [confirmDiscard, currentWeek]);

  const open = useCallback(
    (note: Note) => {
      if (!confirmDiscard()) return;
      setSession({ note, savedPath: note.path });
      setFields(fieldsFor(note));
      setDirty(false);
      setMessage(null);
    },
    [confirmDiscard],
  );

  const edit = useCallback((next: EditorFields) => {
    setFields(next);
    setDirty(true);
    setMessage(null);
  }, []);

  const save = useCallback(async () => {
    if (!fields || !session.note) return;
    if (!fields.title.trim()) {
      setMessage({ ok: false, text: 'Give the note a title first.' });
      return;
    }

    const path = notePath(fields.folder, fields.filename || fields.title);
    const next: Note = {
      ...session.note,
      path,
      title: fields.title.trim(),
      folder: slug(fields.folder),
      week: fields.week,
      tags: parseTags(fields.tags),
      body: fields.body,
    };

    // Retitling or refoldering an existing note moves its file. Saving without
    // removing the old path would leave the note duplicated under both names.
    const isRename = Boolean(session.savedPath && session.savedPath !== path);
    const saved = isRename ? await renameAndSave(session.savedPath!, next) : await saveNote(next);

    setSession({ note: saved, savedPath: saved.path });
    setFields({ ...fields, filename: saved.path.split('/').pop()?.replace(/\.md$/, '') ?? '' });
    setDirty(false);
    setMessage({
      ok: true,
      text: isRename ? `Saved locally as ${saved.path}.` : `Saved locally · ${saved.status}.`,
    });
  }, [fields, session, renameAndSave, saveNote]);

  const remove = useCallback(async () => {
    if (!session.note || !session.savedPath) return;
    if (!confirm(`Delete ${session.savedPath}? This removes it from this device.`)) return;
    await removeNote(session.note);
    setSession({ note: null, savedPath: null });
    setFields(null);
    setDirty(false);
    setMessage({ ok: true, text: 'Deleted locally.' });
  }, [session, removeNote]);

  return { session, fields, dirty, message, startNew, open, edit, save, remove };
}
