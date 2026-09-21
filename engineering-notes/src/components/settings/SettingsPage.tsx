import { Trash2 } from 'lucide-react';
import { DEPLOY_STEPS } from '../../data/content';
import { useAppState } from '../../state/useAppState';
import BackupCard from './BackupCard';
import GitHubCard from './GitHubCard';
import PublishTargetCard from './PublishTargetCard';
import SyncCard from './SyncCard';
import styles from './SettingsPage.module.css';

/** Splits a deployment step around its bolded fragment, if it has one. */
function DeployStep({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <span>{text}</span>;
  const at = text.indexOf(emphasis);
  return (
    <span>
      {text.slice(0, at)}
      <strong>{emphasis}</strong>
      {text.slice(at + emphasis.length)}
    </span>
  );
}

/** Start date, manual backup, the deployment note and reset. */
export default function SettingsPage() {
  const { state, setStartDate, resetAll } = useAppState();

  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Settings &amp; progress backup</h3>
          <p>Vercel can host this as a static file. Progress is stored locally in your browser.</p>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        <div className={`panel ${styles.setting}`}>
          <label htmlFor="startDate">Roadmap start date</label>
          <input
            id="startDate"
            className="field"
            type="date"
            value={state.startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className={styles.hint}>
            The dashboard calculates your current week from this date. Change it if you pause or restart
            the plan.
          </p>
        </div>

        <SyncCard />

        <PublishTargetCard />

        <GitHubCard />

        <BackupCard />

        <div className={`panel ${styles.setting}`}>
          <label>Deployment</label>
          {/*
            Carried over verbatim from the old app, which was a single static
            file. These steps describe that deploy, not this one - the real
            Vercel instructions for the React build go in the README.
          */}
          <div className="deliverables">
            {DEPLOY_STEPS.map((step, index) => (
              <div key={step.text}>
                <i>{index + 1}</i>
                <DeployStep text={step.text} emphasis={step.emphasis} />
              </div>
            ))}
          </div>
        </div>

        <div className={`panel ${styles.setting}`}>
          <label>Reset</label>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm('Reset all progress on this browser? Export a backup first.')) resetAll();
            }}
          >
            <Trash2 />
            Reset all progress
          </button>
          <p className={styles.hint}>
            Export a backup first. Reset removes task state, counters, start date and manual skill-level
            changes on this browser.
          </p>
        </div>
      </div>
    </section>
  );
}
