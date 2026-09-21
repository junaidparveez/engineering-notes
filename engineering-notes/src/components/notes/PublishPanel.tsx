import { CloudUpload, ExternalLink, FileMinus2, FilePen, FilePlus2, X } from 'lucide-react';
import DeviceAuthCard from './DeviceAuthCard';
import type { PublishPhase, PublishResult } from '../../notes/usePublish';
import type { PublishPlan } from '../../notes/publishPlan';
import { commitMessage } from '../../notes/publishPlan';
import styles from './PublishPanel.module.css';

interface PublishPanelProps {
  plan: PublishPlan;
  phase: PublishPhase;
  progress: string;
  error: string | null;
  result: PublishResult | null;
  onConfirm: () => void;
  onClose: () => void;
}

function when(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Exactly what a publish will change, before it happens.
 *
 * Grouped as New / Updated / Removed with the path and last-edit time for each
 * row, because "publish 4 notes" is not something to confirm blind.
 */
export default function PublishPanel({
  plan,
  phase,
  progress,
  error,
  result,
  onConfirm,
  onClose,
}: PublishPanelProps) {
  const busy = phase === 'reading' || phase === 'uploading' || phase === 'committing';

  return (
    <div className={`panel ${styles.panel}`}>
      <div className={styles.head}>
        <b>Publish to GitHub</b>
        <button type="button" className="btn" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>

      {phase === 'needs-auth' ? (
        <>
          <p className={styles.hint}>Authorise GitHub first — it takes about twenty seconds.</p>
          <DeviceAuthCard onAuthorised={onConfirm} />
        </>
      ) : result ? (
        <div className={styles.done}>
          <p>
            Published {result.published} {result.published === 1 ? 'note' : 'notes'} in one commit.
          </p>
          <a className="btn" href={result.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            View commit
          </a>
        </div>
      ) : plan.total === 0 ? (
        <p className={styles.hint}>Nothing to publish — every note matches what is on GitHub.</p>
      ) : (
        <>
          <Group icon={<FilePlus2 />} title="New" rows={plan.created.map(toRow)} />
          <Group icon={<FilePen />} title="Updated" rows={plan.updated.map(toRow)} />
          <Group
            icon={<FileMinus2 />}
            title="Removed"
            rows={plan.removed.map((t) => ({ path: t.path, at: t.deletedAt }))}
          />

          <p className={styles.commit}>
            <span>Commit message</span>
            <code>{commitMessage(plan)}</code>
          </p>

          <div className={styles.actions}>
            <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>
              <CloudUpload />
              {busy ? progress || 'Publishing…' : `Publish ${plan.total}`}
            </button>
            <span className={styles.hint}>
              One commit, whatever the count. The branch is never force-pushed.
            </span>
          </div>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

interface Row {
  path: string;
  at: number;
}

function toRow(note: { path: string; updatedAt: number }): Row {
  return { path: note.path, at: note.updatedAt };
}

function Group({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        {icon}
        <b>
          {title} ({rows.length})
        </b>
      </div>
      {rows.map((row) => (
        <div className={styles.row} key={row.path}>
          <span className={styles.path}>{row.path}</span>
          <span className={styles.at}>{when(row.at)}</span>
        </div>
      ))}
    </div>
  );
}
