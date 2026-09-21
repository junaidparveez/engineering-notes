import { slug } from '../../notes/frontmatter';
import styles from './NoteEditor.module.css';

export interface EditorFields {
  title: string;
  folder: string;
  /** Empty means "follow the title", which is how auto-slugging stays visible. */
  filename: string;
  week: number | null;
  tags: string;
  body: string;
}

interface NoteFieldsProps {
  fields: EditorFields;
  onChange: (fields: EditorFields) => void;
  /** Folders already in use, offered as suggestions. */
  folderOptions: string[];
}

/** Title, folder, filename and tags. Inputs only, no logic of its own. */
export default function NoteFields({ fields, onChange, folderOptions }: NoteFieldsProps) {
  const set = <K extends keyof EditorFields>(key: K, value: EditorFields[K]) =>
    onChange({ ...fields, [key]: value });

  return (
    <>
      <div className={styles.meta}>
        <input
          className="field"
          placeholder="Title"
          aria-label="Title"
          value={fields.title}
          onChange={(e) => set('title', e.target.value)}
        />
        <input
          className="field"
          placeholder="Folder"
          aria-label="Folder"
          list="note-folders"
          value={fields.folder}
          onChange={(e) => set('folder', e.target.value)}
        />
        <datalist id="note-folders">
          {folderOptions.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <input
          className="field"
          // The placeholder shows what the title would slug to, so leaving this
          // empty is visibly the same as accepting the generated name.
          placeholder={slug(fields.title) + '.md'}
          aria-label="Filename"
          value={fields.filename}
          onChange={(e) => set('filename', e.target.value)}
        />
      </div>

      {/*
        No week picker. A new note is stamped with the current week when it is
        created (see useNoteEditing) and that value rides along in the
        frontmatter; there is nothing to choose, so there is nothing to show.
      */}
      <input
        className={`field ${styles.tags}`}
        placeholder="tags, comma separated"
        aria-label="Tags"
        value={fields.tags}
        onChange={(e) => set('tags', e.target.value)}
      />
    </>
  );
}
