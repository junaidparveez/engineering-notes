import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Week } from '../../types';
import styles from './CurrentWeekCard.module.css';

interface CurrentWeekCardProps {
  week: Week;
  /** That week's completion, 0–100. */
  progressPct: number;
}

/** "You are here": the current week's focus and its first four tasks. */
export default function CurrentWeekCard({ week, progressPct }: CurrentWeekCardProps) {
  const navigate = useNavigate();

  return (
    <div className={`panel ${styles.currentCard}`}>
      <div className={styles.currentTop}>
        <span className="phase-badge">You are here · Week {week.week}</span>
        <span className="tag">{progressPct}% complete</span>
      </div>
      <h4>{week.focus}</h4>
      <p>{week.why}</p>
      <div className={styles.focusList}>
        {/* Four is what fits the card; the rest are on the roadmap page. */}
        {week.tasks.slice(0, 4).map((task) => (
          <div className={styles.focusItem} key={task.text}>
            <i />
            <span>{task.text}</span>
          </div>
        ))}
      </div>
      <button type="button" className={`btn primary ${styles.openWeek}`} onClick={() => navigate('/roadmap')}>
        <ArrowRight />
        Open this week
      </button>
    </div>
  );
}
