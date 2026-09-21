import { APPLICATION_STRATEGY, PLAN_CHANGE_NOTICES } from '../../data/content';
import {
  completedCount,
  currentWeekObj,
  overallPct,
  totalTaskCount,
  weekProgress,
} from '../../state/progress';
import { useAppState } from '../../state/useAppState';
import CurrentWeekCard from './CurrentWeekCard';
import Hero from './Hero';
import PhaseProgress from './PhaseProgress';
import ProgressRing from './ProgressRing';
import StatGrid from './StatGrid';
import styles from './CurrentWeekCard.module.css';

/**
 * The dashboard: everything derived from one read of state. No calculation
 * happens in the markup below — each number comes from a function in
 * state/progress.ts, which is where to look if one of them is wrong.
 */
export default function DashboardPage() {
  const { state } = useAppState();

  const week = currentWeekObj(state.startDate);
  const done = completedCount(state);
  const total = totalTaskCount();

  return (
    <section>
      <Hero aside={<ProgressRing percent={overallPct(state)} />} />

      <StatGrid
        currentWeek={week.week}
        currentPhase={week.phase}
        tasksDone={done}
        tasksTotal={total}
        dsaSolved={state.metrics.dsa ?? 0}
        applications={state.metrics.apps ?? 0}
      />

      <div className="grid-2">
        <CurrentWeekCard week={week} progressPct={weekProgress(week, state)} />
        <PhaseProgress state={state} />
      </div>

      <div className="section-head">
        <div>
          <h3>What I changed from your old plan</h3>
          <p>Higher ROI for a competitive 3–5 year backend market.</p>
        </div>
      </div>
      <div className="grid-3">
        {PLAN_CHANGE_NOTICES.map((notice) => (
          <div className={`notice ${notice.tone === 'good' ? 'good' : ''}`} key={notice.label}>
            <strong>{notice.label}</strong>
            <br />
            {notice.body}
          </div>
        ))}
      </div>

      <div className="section-head">
        <div>
          <h3>Application strategy</h3>
          <p>Do not wait until Week 24 to apply.</p>
        </div>
      </div>
      <div className={`panel ${styles.currentCard}`}>
        <div className={styles.focusList}>
          {APPLICATION_STRATEGY.map((line) => (
            <div className={styles.focusItem} key={line.label}>
              <i />
              <span>
                <strong>{line.label}</strong> {line.body}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
