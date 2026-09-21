import { describe, expect, it } from 'vitest';
import { WEEKS } from '../data/weeks';
import type { AppState } from '../types';
import {
  allTasks,
  currentWeek,
  overallPct,
  pct,
  phasePct,
  readinessLabel,
  taskId,
  weekProgress,
} from './progress';

/** An empty state; individual tests tick only what they care about. */
function emptyState(overrides: Partial<AppState> = {}): AppState {
  return {
    completed: {},
    skills: {},
    metrics: {},
    startDate: '2026-01-01',
    roadFilter: 'All',
    ...overrides,
  };
}

/** Marks the first `n` tasks of `week` complete. */
function withWeekDone(week: number, n: number): AppState {
  const completed: Record<string, boolean> = {};
  for (let i = 0; i < n; i++) completed[taskId(week, i)] = true;
  return emptyState({ completed });
}

describe('the ported data itself', () => {
  it('has the 24 weeks and 120 tasks the roadmap promises', () => {
    expect(WEEKS).toHaveLength(24);
    expect(allTasks()).toHaveLength(120);
  });

  it('numbers the weeks 1..24 with no gaps', () => {
    expect(WEEKS.map((w) => w.week)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('gives every task a unique persistence key', () => {
    const ids = allTasks().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('pct', () => {
  it('rounds to the nearest whole percent', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });

  it('returns 0 rather than NaN when there is nothing to divide by', () => {
    expect(pct(0, 0)).toBe(0);
  });
});

describe('currentWeek', () => {
  const start = '2026-09-20';

  it('is week 1 on the start date itself', () => {
    expect(currentWeek(start, new Date('2026-09-20T09:00:00'))).toBe(1);
  });

  it('stays in week 1 for the first six days', () => {
    expect(currentWeek(start, new Date('2026-09-26T23:59:00'))).toBe(1);
  });

  it('rolls to week 2 exactly seven days in', () => {
    expect(currentWeek(start, new Date('2026-09-27T00:00:00'))).toBe(2);
  });

  it('clamps to 1 when the start date is in the future', () => {
    expect(currentWeek(start, new Date('2026-08-01T00:00:00'))).toBe(1);
  });

  it('clamps to 24 long after the plan ends', () => {
    expect(currentWeek(start, new Date('2028-01-01T00:00:00'))).toBe(24);
  });

  it('is still 24 on the last day of week 24, not 25', () => {
    // 24 weeks = 168 days; day 167 is the final day inside the plan.
    expect(currentWeek(start, new Date('2027-03-05T12:00:00'))).toBe(24);
  });

  it('treats the start date as local midnight, not UTC', () => {
    // Late evening on day 6 local time is still week 1. Parsed as UTC the
    // start would shift and this would wrongly report week 2 in +HH zones.
    expect(currentWeek('2026-09-20', new Date('2026-09-26T23:30:00'))).toBe(1);
  });
});

describe('weekProgress', () => {
  const week1 = WEEKS[0]!;

  it('is 0 with nothing ticked', () => {
    expect(weekProgress(week1, emptyState())).toBe(0);
  });

  it('is 100 with every task in the week ticked', () => {
    expect(weekProgress(week1, withWeekDone(1, week1.tasks.length))).toBe(100);
  });

  it('counts only the tasks belonging to that week', () => {
    // Ticking week 2 must not move week 1.
    expect(weekProgress(week1, withWeekDone(2, 5))).toBe(0);
  });

  it('rounds partial completion the same way the old app did', () => {
    expect(weekProgress(week1, withWeekDone(1, 2))).toBe(40); // 2 of 5
  });
});

describe('phasePct', () => {
  it('is 0 with nothing ticked', () => {
    expect(phasePct('Foundation', emptyState())).toBe(0);
  });

  it('counts every week in the phase, not just the first', () => {
    const foundationWeeks = WEEKS.filter((w) => w.phase === 'Foundation');
    const completed: Record<string, boolean> = {};
    for (const w of foundationWeeks) {
      w.tasks.forEach((_, i) => {
        completed[taskId(w.week, i)] = true;
      });
    }
    expect(phasePct('Foundation', emptyState({ completed }))).toBe(100);
  });

  it('ignores tasks from other phases', () => {
    const other = WEEKS.find((w) => w.phase !== 'Foundation')!;
    const completed: Record<string, boolean> = {};
    other.tasks.forEach((_, i) => {
      completed[taskId(other.week, i)] = true;
    });
    expect(phasePct('Foundation', emptyState({ completed }))).toBe(0);
  });
});

describe('overallPct and readinessLabel', () => {
  it('reports 100% when all 120 tasks are ticked', () => {
    const completed: Record<string, boolean> = {};
    for (const t of allTasks()) completed[t.id] = true;
    expect(overallPct(emptyState({ completed }))).toBe(100);
  });

  it('uses the same thresholds as the old app', () => {
    expect(readinessLabel(0)).toBe('Building foundation');
    expect(readinessLabel(14)).toBe('Building foundation');
    expect(readinessLabel(15)).toBe('Backend depth forming');
    expect(readinessLabel(34)).toBe('Backend depth forming');
    expect(readinessLabel(35)).toBe('Cloud + design emerging');
    expect(readinessLabel(54)).toBe('Cloud + design emerging');
    expect(readinessLabel(55)).toBe('Interview-ready in progress');
    expect(readinessLabel(74)).toBe('Interview-ready in progress');
    expect(readinessLabel(75)).toBe('Strong interview mode');
    expect(readinessLabel(89)).toBe('Strong interview mode');
    expect(readinessLabel(90)).toBe('Execution / offer mode');
    expect(readinessLabel(100)).toBe('Execution / offer mode');
  });
});
