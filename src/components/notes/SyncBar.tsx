import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { hasPasscode, setPasscode } from '../../notes/syncApi';
import type { Conflict, SyncState } from '../../notes/useDraftSync';
import styles from './SyncBar.module.css';

interface SyncBarProps {
  state: SyncState;
  error: string | null;
  lastSyncedAt: number | null;
  conflicts: Conflict[];
  onSync: () => void;
  onResolve: (path: string, choice: 'mine' | 'theirs') => void;
}

function describe(state: SyncState, lastSyncedAt: number | null): string {
  switch (state) {
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return 'Offline — saved on this device, will sync later.';
    case 'unauthorised':
      return 'Enter your notes passcode to sync across devices.';
    case 'error':
      return 'Sync failed.';
    default:
      return lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Local only.';
  }
}

/**
 * Sync status, the passcode prompt, and any conflicts to settle.
 *
 * Everything it reports is about the copy in Redis. Notes are already saved
 * locally before any of this runs, so a failure here is informational, never
 * data loss - which is why nothing in it is an error dialog.
 */
export default function SyncBar({
  state,
  error,
  lastSyncedAt,
  conflicts,
  onSync,
  onResolve,
}: SyncBarProps) {
  const [entry, setEntry] = useState('');
  const needsPasscode = state === 'unauthorised' || !hasPasscode();

  return (
    <div className={styles.bar}>
      <div className={styles.status}>
        {state === 'offline' ? <CloudOff /> : state === 'error' ? <TriangleAlert /> : <Cloud />}
        <span className={state === 'error' ? styles.error : undefined}>
          {error ?? describe(state, lastSyncedAt)}
        </span>
      </div>

      {needsPasscode ? (
        <form
          className={styles.passcodeForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (!entry.trim()) return;
            setPasscode(entry.trim());
            setEntry('');
            onSync();
          }}
        >
          <input
            className="field"
            type="password"
            placeholder="Notes passcode"
            aria-label="Notes passcode"
            autoComplete="current-password"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <button type="submit" className="btn">
            Connect
          </button>
        </form>
      ) : (
        <button type="button" className="btn" onClick={onSync} disabled={state === 'syncing'}>
          <RefreshCw />
          Sync now
        </button>
      )}

      {conflicts.length > 0 && (
        <div className={styles.conflicts}>
          <b>
            {conflicts.length} note{conflicts.length > 1 ? 's' : ''} changed in both places
          </b>
          {conflicts.map(({ local, remote }) => (
            <div className={styles.conflict} key={local.path}>
              <div className={styles.conflictPath}>{local.path}</div>
              <div className={styles.conflictMeta}>
                Mine: {new Date(local.updatedAt).toLocaleString()} · Theirs:{' '}
                {new Date(remote.updatedAt).toLocaleString()}
              </div>
              <div className={styles.conflictActions}>
                <button type="button" className="btn" onClick={() => onResolve(local.path, 'mine')}>
                  Keep mine
                </button>
                <button type="button" className="btn" onClick={() => onResolve(local.path, 'theirs')}>
                  Take theirs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
