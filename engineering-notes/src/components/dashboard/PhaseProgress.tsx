import { PHASE_ORDER, WEEKS } from '../../data/weeks';
import { phasePct } from '../../state/progress';
import type { AppState, Phase } from '../../types';
import styles from './PhaseProgress.module.css';

/** "Weeks 1–4" for a phase, read off the data rather than hard-coded. */
function weekRange(phase: Phase): string {
  const numbers = WEEKS.filter((w) => w.phase === phase).map((w) => w.week);
  return `Weeks ${numbers[0]}–${numbers[numbers.length - 1]}`;
}

/** One row per phase: name, week range, bar, percentage. */
export default function PhaseProgress({ state }: { state: AppState }) {
  return (
    <div className={`panel ${styles.timeline}`}>
      <div className="section-head" style={{ margin: '0 0 6px' }}>
        <div>
          <h3>Phase progress</h3>
          <p>Where you are versus the complete path</p>
        </div>
      </div>
      {PHASE_ORDER.map((phase) => {
        const percent = phasePct(phase, state);
        return (
          <div className={styles.phaseRow} key={phase}>
            <div>
              <b>{phase}</b>
              <br />
              <span>{weekRange(phase)}</span>
            </div>
            <div className="bar">
              <i style={{ width: `${percent}%` }} />
            </div>
            <b className={styles.phasePct}>{percent}%</b>
          </div>
        );
      })}
    </div>
  );
}
