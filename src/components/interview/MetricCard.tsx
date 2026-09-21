import { pct } from '../../state/progress';
import type { Metric } from '../../types';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  metric: Metric;
  value: number;
  onChange: (value: number) => void;
}

/** One counter: minus, a typeable number, plus, and a bar against the target. */
export default function MetricCard({ metric, value, onChange }: MetricCardProps) {
  return (
    <div className={`panel ${styles.metric}`}>
      <div className={styles.metricTop}>
        <b>{metric.label}</b>
        <span>
          {value}/{metric.target}
        </span>
      </div>

      <div className={styles.counter}>
        <button type="button" onClick={() => onChange(value - 1)} aria-label={`Decrease ${metric.label}`}>
          −
        </button>
        <input
          type="number"
          min="0"
          value={value}
          aria-label={metric.label}
          // A controlled input: the value shown is always the one in state, so
          // typing, the buttons and an import can never disagree. Clearing the
          // field yields '' from the DOM, which Number() turns into 0.
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`Increase ${metric.label}`}>
          +
        </button>
      </div>

      <div className="bar">
        {/* Capped at 100% so overshooting the target does not overflow the bar. */}
        <i style={{ width: `${Math.min(100, pct(value, metric.target))}%` }} />
      </div>
      <small>{metric.note}</small>
    </div>
  );
}
