import { WEEKS, PHASE_ORDER } from '../data/weeks';
import type { AppState, Phase, Task, Week } from '../types';

/**
 * Every calculation the UI needs, as pure functions: inputs in, value out, no
 * React and no localStorage. The equivalent of a stateless service class in
 * Spring — trivially unit-testable, which is why the numbers that used to be
 * computed inside render code all live here now.
 */

/** A task with the identity used as its persistence key. */
export interface IdentifiedTask extends Task {
  /** `w{week}t{index}` — the key stored in AppState.completed. */
  id: string;
  week: number;
}

/**
 * Percentage, rounded. Ported verbatim from the old app, including the
 * divide-by-zero guard: any other rounding drifts by a percent against the
 * deployed version, which is exactly the kind of difference that looks like a
 * bug during a side-by-side check.
 */
export function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0;
}

/** The persistence key for one task. The one place this format is defined. */
export function taskId(week: number, index: number): string {
  return `w${week}t${index}`;
}

/** All 120 tasks, flattened, each carrying its id and week. */
export function allTasks(): IdentifiedTask[] {
  return WEEKS.flatMap((w) => w.tasks.map((t, i) => ({ ...t, id: taskId(w.week, i), week: w.week })));
}

export function completedCount(state: AppState): number {
  return allTasks().filter((t) => state.completed[t.id]).length;
}

export function totalTaskCount(): number {
  return allTasks().length;
}

/** Percentage of one week's tasks that are ticked. */
export function weekProgress(week: Week, state: AppState): number {
  const done = week.tasks.filter((_, i) => state.completed[taskId(week.week, i)]).length;
  return pct(done, week.tasks.length);
}

/** Percentage of all tasks in one phase that are ticked. */
export function phasePct(phase: Phase, state: AppState): number {
  const ids = WEEKS.filter((w) => w.phase === phase).flatMap((w) =>
    w.tasks.map((_, i) => taskId(w.week, i)),
  );
  return pct(ids.filter((id) => state.completed[id]).length, ids.length);
}

/** Overall roadmap completion, 0–100. Drives the dashboard ring. */
export function overallPct(state: AppState): number {
  return pct(completedCount(state), totalTaskCount());
}

/**
 * Which week of the plan today falls in: whole days since the start date,
 * divided by 7, plus one, clamped to 1–24.
 *
 * `now` is a parameter rather than a `new Date()` inside the function so tests
 * are not date-dependent — otherwise they would pass today and fail next month.
 *
 * The 'T00:00:00' suffix is deliberate: `new Date('2026-09-20')` is parsed as
 * UTC midnight, which shifts the week boundary by a day for anyone east or
 * west of Greenwich. With the suffix it is parsed as *local* midnight, which is
 * what the old app did and what the user means by "the day I started".
 */
export function currentWeek(startDate: string, now: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00');
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  return Math.min(24, Math.max(1, Math.floor(days / 7) + 1));
}

/** The Week object for the current week, falling back to week 1. */
export function currentWeekObj(startDate: string, now: Date = new Date()): Week {
  const n = currentWeek(startDate, now);
  return WEEKS.find((w) => w.week === n) ?? WEEKS[0]!;
}

/** The label shown under the dashboard ring. Thresholds ported unchanged. */
export function readinessLabel(p: number): string {
  if (p < 15) return 'Building foundation';
  if (p < 35) return 'Backend depth forming';
  if (p < 55) return 'Cloud + design emerging';
  if (p < 75) return 'Interview-ready in progress';
  if (p < 90) return 'Strong interview mode';
  return 'Execution / offer mode';
}

/** Phase list for the roadmap filter bar: 'All' plus every phase, in order. */
export function roadmapFilters(): string[] {
  return ['All', ...PHASE_ORDER];
}
