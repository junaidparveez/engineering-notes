import { useEffect, useRef } from 'react';
import { WEEKS } from '../../data/weeks';
import {
  completedCount,
  currentWeek,
  roadmapFilters,
  totalTaskCount,
} from '../../state/progress';
import { useAppState } from '../../state/useAppState';
import FilterBar from './FilterBar';
import WeekCard from './WeekCard';
import styles from './RoadmapPage.module.css';

/** Smooth scrolling, unless the OS asks for reduced motion. */
function scrollBehaviour(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export default function RoadmapPage() {
  const { state, setRoadFilter, toggleTask } = useAppState();

  const activeWeek = currentWeek(state.startDate);
  const weeks = WEEKS.filter((w) => state.roadFilter === 'All' || w.phase === state.roadFilter);

  // A handle to the current week's card, so the effect below can scroll to it.
  const currentCardRef = useRef<HTMLElement>(null);

  // Runs once after the page first renders. The 150ms delay is the old app's:
  // it lets layout settle so the card is measured where it will actually sit.
  //
  // The returned function is the cleanup - React calls it if the page unmounts
  // first, which cancels a timer that would otherwise fire against a card that
  // is no longer on screen. Think of it as the finally block for an effect.
  useEffect(() => {
    const timer = setTimeout(() => {
      currentCardRef.current?.scrollIntoView({ behavior: scrollBehaviour(), block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section>
      <div className="section-head">
        <div>
          <h3>24-week execution roadmap</h3>
          <p>
            Each week has one learning thread, one proof/build outcome, DSA and career/interview work.
          </p>
        </div>
        <div className="tag">
          {completedCount(state)} / {totalTaskCount()} tasks
        </div>
      </div>

      <FilterBar filters={roadmapFilters()} active={state.roadFilter} onChange={setRoadFilter} />

      <div className={styles.weekList}>
        {weeks.map((week) => (
          <WeekCard
            key={week.week}
            ref={week.week === activeWeek ? currentCardRef : undefined}
            week={week}
            state={state}
            isCurrent={week.week === activeWeek}
            onToggleTask={toggleTask}
          />
        ))}
      </div>
    </section>
  );
}
