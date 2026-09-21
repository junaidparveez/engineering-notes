import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudDownload, CloudUpload, FilePlus2 } from 'lucide-react';
import { existingFolders } from '../../notes/folders';
import * as db from '../../notes/db';
import { buildPlan } from '../../notes/publishPlan';
import { useNoteEditing } from '../../notes/useNoteEditing';
import { useDraftSync } from '../../notes/useDraftSync';
import { useNotes } from '../../notes/useNotes';
import { usePublish } from '../../notes/usePublish';
import { usePull } from '../../notes/usePull';
import { currentWeek } from '../../state/progress';
import { useAppState } from '../../state/useAppState';
import NoteEditor from './NoteEditor';
import NoteTree from './NoteTree';
import PublishPanel from './PublishPanel';
import PullPanel from './PullPanel';
import SyncBar from './SyncBar';
import type { Tombstone } from '../../notes/publishPlan';
import styles from './NotesPage.module.css';

/**
 * Notes: a file tree on the left, the editor on the right.
 *
 * Reads are always local - IndexedDB answers everything the UI asks, so opening
 * a note makes no network request. Saving writes locally first and only then
 * schedules a sync, which means the editor never waits on the network and works
 * offline unchanged.
 *
 * Nothing here talks to GitHub. Publishing is phase 9 and stays explicit.
 */
export default function NotesPage() {
  const { state } = useAppState();
  const { notes, reload, saveNote, renameAndSave, removeNote } = useNotes();
  const sync = useDraftSync({ onChanged: () => void reload() });
  const [search, setSearch] = useState('');

  // Local write first, then a debounced push. Wrapping here rather than inside
  // useNotes keeps storage unaware of sync, so notes still work with no
  // passcode set and no network.
  const editing = useNoteEditing({
    currentWeek: currentWeek(state.startDate),
    saveNote: async (note) => {
      const saved = await saveNote(note);
      sync.scheduleSync();
      return saved;
    },
    renameAndSave: async (oldPath, note) => {
      const saved = await renameAndSave(oldPath, note);
      sync.scheduleSync();
      return saved;
    },
    removeNote: async (note) => {
      await removeNote(note);
      sync.scheduleSync();
    },
  });

  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter(
      (n) =>
        n.path.toLowerCase().includes(needle) ||
        n.title.toLowerCase().includes(needle) ||
        n.tags.some((t) => t.toLowerCase().includes(needle)),
    );
  }, [notes, search]);

  const folderOptions = useMemo(() => existingFolders(notes.map((n) => n.path)), [notes]);

  // Tombstones live in IndexedDB rather than in the notes list, so the publish
  // plan needs them read separately. Refreshed whenever the notes change.
  const [tombstones, setTombstones] = useState<Tombstone[]>([]);
  const refreshTombstones = useCallback(() => {
    void db.getTombstones().then(setTombstones);
  }, []);
  useEffect(refreshTombstones, [refreshTombstones, notes]);

  const plan = useMemo(() => buildPlan(notes, tombstones), [notes, tombstones]);

  const [panel, setPanel] = useState<'none' | 'publish' | 'pull'>('none');

  const afterRemoteChange = useCallback(() => {
    void reload();
    refreshTombstones();
  }, [reload, refreshTombstones]);

  const publishing = usePublish(notes, afterRemoteChange);
  const pulling = usePull(afterRemoteChange);

  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Notes</h3>
          <p>Saved on this device as you write. Publishing to GitHub is a separate, explicit step.</p>
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              pulling.reset();
              setPanel(panel === 'pull' ? 'none' : 'pull');
            }}
          >
            <CloudDownload />
            Pull
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              publishing.reset();
              setPanel(panel === 'publish' ? 'none' : 'publish');
            }}
          >
            <CloudUpload />
            Publish
            {plan.total > 0 && <span className={styles.badge}>{plan.total}</span>}
          </button>
          <button type="button" className="btn primary" onClick={editing.startNew}>
            <FilePlus2 />
            New note
          </button>
        </div>
      </div>

      {panel === 'publish' && (
        <PublishPanel
          plan={plan}
          phase={publishing.phase}
          progress={publishing.progress}
          error={publishing.error}
          result={publishing.result}
          onConfirm={() => void publishing.publish(plan)}
          onClose={() => setPanel('none')}
        />
      )}

      {panel === 'pull' && (
        <PullPanel
          phase={pulling.phase}
          progress={pulling.progress}
          error={pulling.error}
          summary={pulling.summary}
          conflicts={pulling.conflicts}
          onPull={() => void pulling.pull()}
          onResolve={(path, choice) => void pulling.resolve(path, choice)}
          onClose={() => setPanel('none')}
        />
      )}

      <SyncBar
        state={sync.state}
        error={sync.error}
        lastSyncedAt={sync.lastSyncedAt}
        conflicts={sync.conflicts}
        onSync={() => void sync.sync()}
        onResolve={(path, choice) => void sync.resolve(path, choice)}
      />

      <div className={styles.wrap}>
        <aside className={`panel ${styles.side}`}>
          <input
            className={styles.search}
            placeholder="Search notes…"
            aria-label="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <NoteTree
            notes={matching}
            selectedPath={editing.session.savedPath}
            onOpen={editing.open}
            hasNotes={notes.length > 0}
          />
        </aside>

        {editing.fields ? (
          <NoteEditor
            savedPath={editing.session.savedPath}
            fields={editing.fields}
            onChange={editing.edit}
            onSave={() => void editing.save()}
            onDelete={() => void editing.remove()}
            dirty={editing.dirty}
            message={editing.message}
            folderOptions={folderOptions}
          />
        ) : (
          <div className={`panel ${styles.placeholder}`}>
            <p>
              Pick a note from the tree, or start a new one. Notes live in this browser&apos;s database —
              opening one makes no network request at all.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
