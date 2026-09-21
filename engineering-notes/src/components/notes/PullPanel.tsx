import { CloudDownload, X } from 'lucide-react';
import { repoLabel } from '../../config/repoConfig';
import DeviceAuthCard from './DeviceAuthCard';
import type { PullConflict, PullPhase, PullSummary } from '../../notes/usePull';
import styles from './PublishPanel.module.css';

interface PullPanelProps {
  phase: PullPhase;
  progress: string;
  error: string | null;
  summary: PullSummary | null;
  conflicts: PullConflict[];
  onPull: () => void;
  onResolve: (path: string, choice: 'mine' | 'theirs') => void;
  onClose: () => void;
}

/**
 * Pull from GitHub: for a new device, or to recover after losing local data.
 *
 * Explicit on purpose. Nothing here runs on load, so a device that has been
 * offline cannot quietly overwrite itself with an older published copy.
 */
export default function PullPanel({
  phase,
  progress,
  error,
  summary,
  conflicts,
  onPull,
  onResolve,
  onClose,
}: PullPanelProps) {
  const busy = phase === 'reading' || phase === 'fetching';

  return (
    <div className={`panel ${styles.panel}`}>
      <div className={styles.head}>
        <b>Pull from GitHub</b>
        <button type="button" className="btn" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>

      {phase === 'needs-auth' ? (
        <>
          <p className={styles.hint}>Authorise GitHub first — reading the repo needs the same token.</p>
          <DeviceAuthCard onAuthorised={onPull} />
        </>
      ) : (
        <>
          <p className={styles.hint}>
            Reads {repoLabel()} and fetches only the notes missing here or differing from
            what was last published. Your unpublished work is never overwritten without asking.
          </p>

          {summary && (
            <p className={styles.hint}>
              {summary.added} added · {summary.updated} updated · {summary.unchanged} already current.
            </p>
          )}

          {conflicts.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <b>
                  {conflicts.length} note{conflicts.length > 1 ? 's' : ''} changed in both places
                </b>
              </div>
              {conflicts.map(({ local, remote }) => (
                <div className={styles.row} key={local.path}>
                  <span className={styles.path}>
                    {local.path}
                    <br />
                    <span className={styles.at}>
                      Mine: {new Date(local.updatedAt).toLocaleString()} · GitHub:{' '}
                      {new Date(remote.updatedAt).toLocaleString()}
                    </span>
                  </span>
                  <span className={styles.actions}>
                    <button type="button" className="btn" onClick={() => onResolve(local.path, 'mine')}>
                      Keep mine
                    </button>
                    <button type="button" className="btn" onClick={() => onResolve(local.path, 'theirs')}>
                      Take theirs
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className="btn primary" onClick={onPull} disabled={busy}>
              <CloudDownload />
              {busy ? progress || 'Pulling…' : 'Pull from GitHub'}
            </button>
          </div>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
