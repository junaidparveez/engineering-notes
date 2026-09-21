import { CalendarDays, CircleCheckBig, Code2, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './StatGrid.module.css';

interface Stat {
  Icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}

interface StatGridProps {
  currentWeek: number;
  currentPhase: string;
  tasksDone: number;
  tasksTotal: number;
  dsaSolved: number;
  applications: number;
}

/**
 * The four headline numbers. The targets (120 DSA problems, 80 applications)
 * are the same literals the old app used; they also exist as metric targets in
 * data/metrics.ts, but these captions are the old app's wording and stay in
 * step with it rather than being derived.
 */
export default function StatGrid({
  currentWeek,
  currentPhase,
  tasksDone,
  tasksTotal,
  dsaSolved,
  applications,
}: StatGridProps) {
  const stats: Stat[] = [
    {
      Icon: CalendarDays,
      label: 'Current week',
      value: `W${currentWeek}`,
      note: currentPhase,
    },
    {
      Icon: CircleCheckBig,
      label: 'Tasks complete',
      value: `${tasksDone} / ${tasksTotal}`,
      note: 'Across learn · build · DSA · proof · career',
    },
    {
      Icon: Code2,
      label: 'DSA solved',
      value: `${dsaSolved} / 120`,
      note: 'Curated patterns, not competitive programming',
    },
    {
      Icon: Send,
      label: 'Applications',
      value: `${applications} / 80`,
      note: 'Quality targeting + referrals + interview loops',
    },
  ];

  return (
    <div className={styles.statGrid}>
      {stats.map(({ Icon, label, value, note }) => (
        <div className={`panel ${styles.stat}`} key={label}>
          <div className={styles.label}>
            <Icon />
            {label}
          </div>
          <b>{value}</b>
          <small>{note}</small>
        </div>
      ))}
    </div>
  );
}
