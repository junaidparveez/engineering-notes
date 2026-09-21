import { EXPORT_FILENAME, STORAGE_KEY } from '../config/app.config';
import { METRICS } from '../data/metrics';
import { SKILLS } from '../data/skills';
import type { AppState } from '../types';

/**
 * Everything that reads or writes persisted progress. Pure functions where it
 * is possible; the two that touch localStorage and the DOM are at the bottom
 * and do nothing else, so the interesting logic stays testable.
 *
 * The saved shape is frozen. A backup exported by the old single-file app has
 * to import into this one, which rules out renaming a field or changing what a
 * key means.
 *
 * localStorage is the source of truth *today*. In phase 7 this same state also
 * syncs through Upstash Redis behind the notes passcode, so progress follows
 * you between laptop and phone - planned as a single `progress:state` key
 * carrying an `updatedAt` stamp, resolved last-write-wins like the notes.
 * That changes where state is *copied to*, not what it looks like: localStorage
 * stays the instant local read, and everything in this file keeps working
 * offline. Export/import survives as an optional manual snapshot and as the
 * only route in for a backup from the old app.
 */

/** 'YYYY-MM-DD' for a given day, in local time. */
export function toDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

/**
 * A fresh state: nothing completed, every skill at its resume baseline, every
 * counter at zero, starting today.
 *
 * `today` is a parameter so tests do not depend on the day they run.
 */
export function defaultState(today: Date = new Date()): AppState {
  return {
    completed: {},
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, s.now])),
    metrics: Object.fromEntries(METRICS.map((m) => [m.id, 0])),
    startDate: toDateKey(today),
    roadFilter: 'All',
  };
}

/** Keeps only `Record<string, number>` entries, ignoring anything malformed. */
function mergeNumbers(
  defaults: Record<string, number>,
  stored: unknown,
  clamp?: (n: number) => number,
): Record<string, number> {
  const merged = { ...defaults };
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      const n = Number(value);
      if (Number.isFinite(n)) merged[key] = clamp ? clamp(n) : n;
    }
  }
  return merged;
}

/** Keeps only the `true` entries; a false or missing value means "not done". */
function mergeCompleted(stored: unknown): Record<string, boolean> {
  const merged: Record<string, boolean> = {};
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (value === true) merged[key] = true;
    }
  }
  return merged;
}

/**
 * Merges anything that claims to be saved progress over a fresh default state.
 *
 * Merging per field rather than the old app's single `{...defaults, ...data}`
 * spread matters for `skills` and `metrics`: a shallow spread replaces those
 * objects wholesale, so a backup taken before a skill existed would come back
 * with that skill missing entirely rather than at its baseline. Here an old
 * backup gains the new skill at its default and keeps every value it did have.
 *
 * Anything unrecognised in the input (`exportedAt`, a field from a future
 * version) is dropped rather than carried into state.
 */
export function mergeIntoState(stored: unknown, today: Date = new Date()): AppState {
  const defaults = defaultState(today);
  if (!stored || typeof stored !== 'object') return defaults;

  const input = stored as Partial<Record<keyof AppState, unknown>>;
  const clampLevel = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

  return {
    completed: mergeCompleted(input.completed),
    skills: mergeNumbers(defaults.skills, input.skills, clampLevel),
    // Counters have no upper bound, but a negative count is meaningless.
    metrics: mergeNumbers(defaults.metrics, input.metrics, (n) => Math.max(0, Math.round(n))),
    startDate: isValidDateKey(input.startDate) ? input.startDate : defaults.startDate,
    roadFilter: typeof input.roadFilter === 'string' ? input.roadFilter : defaults.roadFilter,
  };
}

/** The fields that make a JSON object recognisable as a progress backup. */
const BACKUP_KEYS = ['completed', 'skills', 'metrics', 'startDate', 'roadFilter'] as const;

/**
 * Parses exported JSON into state.
 *
 * Requires at least one recognised field, which matters more than it looks:
 * without that check any JSON object at all - `{}`, a package.json, some
 * unrelated download - merges into a clean default state and silently *erases*
 * real progress while reporting success. Import is the only destructive action
 * in the app, so it refuses anything it does not recognise.
 */
export function parseImported(json: string, today: Date = new Date()): AppState {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('That file does not look like a progress backup.');
  }
  const hasKnownField = BACKUP_KEYS.some((key) => key in (parsed as Record<string, unknown>));
  if (!hasKnownField) {
    throw new Error('That file does not look like a progress backup.');
  }
  return mergeIntoState(parsed, today);
}

/**
 * The JSON written by Export. `exportedAt` is extra information for a human
 * reading the file; import ignores it, and the old app wrote the same field,
 * so files move in both directions.
 */
export function serializeForExport(state: AppState, now: Date = new Date()): string {
  return JSON.stringify({ ...state, exportedAt: now.toISOString() }, null, 2);
}

// --- the two functions that touch the browser -------------------------------

/** Reads saved progress, falling back to defaults on anything unreadable. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return mergeIntoState(raw ? JSON.parse(raw) : null);
  } catch {
    // Private-mode localStorage, corrupted JSON, a half-written value: none of
    // these are worth an error screen on a personal tracker. Start clean.
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode. The app keeps working in memory for this session.
  }
}

/** Triggers a browser download of the progress JSON. */
export function downloadExport(state: AppState): void {
  const blob = new Blob([serializeForExport(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}
