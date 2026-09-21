import { forwardRef, useState } from 'react';
import { taskId, weekProgress } from '../../state/progress';
import type { AppState, TaskKind, Week } from '../../types';
import styles from './WeekCard.module.css';

/**
 * Colour per task kind. An explicit map rather than building a class name from
 * the kind string, because a typo in a template literal fails silently while a
 * missing key here fails to compile.
 */
const KIND_CLASS: Record<TaskKind, string> = {
  learn: '',
  build: styles.kindBuild!,
  dsa: styles.kindDsa!,
  proof: styles.kindProof!,
  career: styles.kindCareer!,
  design: styles.kindDesign!,
  interview: styles.kindInterview!,
};

interface WeekCardProps {
  week: Week;
  state: AppState;
  /** Highlighted, and expanded when the card first renders. */
  isCurrent: boolean;
  onToggleTask: (id: string) => void;
}

/**
 * One week: a header that expands the card, and a task per row.
 *
 * forwardRef lets the roadmap page hold a handle to this card's DOM node so it
 * can scroll the current week into view. Without it a ref put on a component
 * would have nothing to attach to — components are not elements.
 */
const WeekCard = forwardRef<HTMLElement, WeekCardProps>(function WeekCard(
  { week, state, isCurrent, onToggleTask },
  ref,
) {
  // Open/closed is per card and nothing outside cares, so it stays local
  // rather than going into the shared context.
  const [open, setOpen] = useState(isCurrent);

  return (
    <article
      ref={ref}
      className={`panel ${styles.weekCard} ${isCurrent ? styles.current : ''}`}
      aria-labelledby={`week-${week.week}-title`}
    >
      <button
        type="button"
        className={styles.weekHead}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
      >
        <span className={styles.weekNum}>W{week.week}</span>
        <span className={styles.weekTitle}>
          <b id={`week-${week.week}-title`}>{week.focus}</b>
          <span>
            {week.phase} · DSA: {week.dsa}
          </span>
        </span>
        <span className={styles.weekSide}>
          <b>{weekProgress(week, state)}%</b>
          <span>{week.why}</span>
        </span>
      </button>

      {open && (
        <div className={styles.weekBody}>
          {week.tasks.map((task, index) => {
            const id = taskId(week.week, index);
            const done = Boolean(state.completed[id]);
            return (
              <button
                type="button"
                className={`${styles.task} ${done ? styles.done : ''}`}
                key={id}
                onClick={() => onToggleTask(id)}
                aria-pressed={done}
              >
                <span className={styles.check}>{done ? '✓' : ''}</span>
                <span className={`${styles.kind} ${KIND_CLASS[task.kind]}`}>{task.kind}</span>
                <span className={styles.text}>{task.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
});

export default WeekCard;
