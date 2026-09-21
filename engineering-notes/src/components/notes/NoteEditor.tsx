import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Save, Trash2 } from 'lucide-react';
import { mdToHtml } from '../../notes/markdown';
import { notePath } from '../../notes/useNotes';
import NoteFields from './NoteFields';
import type { EditorFields } from './NoteFields';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  /** Null while editing a note that has not been saved yet. */
  savedPath: string | null;
  fields: EditorFields;
  onChange: (fields: EditorFields) => void;
  onSave: () => void;
  onDelete: () => void;
  dirty: boolean;
  message: { ok: boolean; text: string } | null;
  folderOptions: string[];
}

export default function NoteEditor({
  savedPath,
  fields,
  onChange,
  onSave,
  onDelete,
  dirty,
  message,
  folderOptions,
}: NoteEditorProps) {
  const [previewing, setPreviewing] = useState(false);

  const path = notePath(fields.folder, fields.filename || fields.title);

  // Re-rendering Markdown on every keystroke is wasted work while typing;
  // useMemo caches it until the body actually changes.
  const html = useMemo(() => mdToHtml(fields.body), [fields.body]);

  // Ctrl/Cmd+S saves - locally, not to GitHub. The listener is on window so the
  // shortcut works wherever the cursor is; the cleanup removes it when the
  // editor unmounts, otherwise each visit would add another listener and the
  // save would run several times per keypress.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSave]);

  return (
    <div className={`panel ${styles.main}`}>
      <div className={styles.bar}>
        <div className={styles.path}>
          {dirty && <span className={styles.dirtyDot} />}
          Saves to <b>{path}</b>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => setPreviewing((p) => !p)}>
            {previewing ? <EyeOff /> : <Eye />}
            {previewing ? 'Edit' : 'Preview'}
          </button>
          <button type="button" className="btn primary" onClick={onSave}>
            <Save />
            Save
          </button>
          {savedPath && (
            <button type="button" className="btn danger" onClick={onDelete}>
              <Trash2 />
              Delete
            </button>
          )}
        </div>
      </div>

      <NoteFields fields={fields} onChange={onChange} folderOptions={folderOptions} />

      {previewing ? (
        // markdown.ts escapes every piece of note content before wrapping it in
        // tags, so the only HTML reaching the page is the tags it produced.
        <div className={styles.preview} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <textarea
          className={styles.editor}
          aria-label="Note body"
          value={fields.body}
          onChange={(e) => onChange({ ...fields, body: e.target.value })}
        />
      )}

      <div className={styles.foot}>
        <div
          className={`${styles.status} ${message ? (message.ok ? styles.ok : styles.err) : ''}`}
          role="status"
        >
          {message?.text ?? (dirty ? 'Unsaved changes — Ctrl/Cmd+S to save locally.' : '')}
        </div>
      </div>
    </div>
  );
}
