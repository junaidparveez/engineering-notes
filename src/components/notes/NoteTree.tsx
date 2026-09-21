import { pretty } from '../../notes/frontmatter';
import type { Note } from '../../types';
import styles from './NotesPage.module.css';

interface NoteTreeProps {
  notes: Note[];
  selectedPath: string | null;
  onOpen: (note: Note) => void;
  /** True when notes exist but the search matched none of them. */
  hasNotes: boolean;
}

/** Groups notes by their folder, the way the file tree in the old app did. */
function groupByFolder(notes: Note[]): Map<string, Note[]> {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const relative = note.path.replace(/^notes\//, '');
    const at = relative.lastIndexOf('/');
    const folder = at > -1 ? relative.slice(0, at) : 'root';
    const list = groups.get(folder) ?? [];
    list.push(note);
    groups.set(folder, list);
  }
  // Sorted so the tree does not reshuffle when a note is edited.
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** The status dot: amber for a draft, cyan for modified, nothing if published. */
function StatusDot({ status }: { status: Note['status'] }) {
  if (status === 'draft') return <span className={`${styles.statusDot} ${styles.draft}`} title="Draft" />;
  if (status === 'modified')
    return <span className={`${styles.statusDot} ${styles.modified}`} title="Modified since publish" />;
  return <span className={styles.statusDot} />;
}

export default function NoteTree({ notes, selectedPath, onOpen, hasNotes }: NoteTreeProps) {
  if (!notes.length) {
    return (
      <div className={styles.empty}>
        {hasNotes ? (
          'Nothing matches that search.'
        ) : (
          <>
            No notes yet. Create one with <b>New note</b> — it is saved on this device straight away.
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      {[...groupByFolder(notes).entries()].map(([folder, items]) => (
        <div key={folder}>
          <div className={styles.folder}>
            <span>{folder}</span>
            <span>{items.length}</span>
          </div>
          {items.map((note) => (
            <button
              type="button"
              key={note.path}
              className={`${styles.file} ${note.path === selectedPath ? styles.on : ''}`}
              title={note.path}
              onClick={() => onOpen(note)}
            >
              <StatusDot status={note.status} />
              <span className={styles.fileName}>{pretty(note.path.split('/').pop() ?? note.path)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
