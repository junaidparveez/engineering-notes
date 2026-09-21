import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultState, downloadExport, loadState, saveState, toDateKey } from './storage';
import { useProgressSync } from './useProgressSync';
import type { AppState } from '../types';

/**
 * The single source of truth for roadmap progress.
 *
 * React context is the rough equivalent of a singleton bean: the provider holds
 * one instance, and any component below it can ask for it without having it
 * passed down through every layer in between.
 *
 * The trade-off to know about: every component that calls useAppState()
 * re-renders whenever *any* field of this state changes. For an app this size
 * that is measured in microseconds and is not worth optimising around — the
 * alternative (splitting into several contexts, or adding a state library) buys
 * nothing here and costs a lot of indirection to read later.
 */

export interface AppStateContextValue {
  state: AppState;
  /** Ticks or un-ticks one task by its `w{week}t{index}` id. */
  toggleTask: (taskId: string) => void;
  /** Sets a skill to a level, 1–5. */
  setSkillLevel: (skillId: string, level: number) => void;
  /** Sets an interview counter to an absolute value. */
  setMetric: (metricId: string, value: number) => void;
  /** 'YYYY-MM-DD'; an empty value resets to today. */
  setStartDate: (date: string) => void;
  setRoadFilter: (filter: string) => void;
  /** Replaces everything — used by import. */
  replaceState: (next: AppState) => void;
  /** Back to defaults. The confirmation prompt belongs to the caller. */
  resetAll: () => void;
  /** Writes the progress JSON to a file. */
  exportToFile: () => void;
  /** Cross-device sync status, shown in Settings. */
  syncStatus: ReturnType<typeof useProgressSync>;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // The initialiser is passed as a function so localStorage is read once on
  // mount rather than on every render.
  const [state, setState] = useState<AppState>(() => loadState());

  // Persist after every change. The effect runs *after* the render commits, so
  // the UI never waits on localStorage. Dependency array: re-run only when
  // `state` changes - with no array it would write on every render.
  useEffect(() => {
    saveState(state);
  }, [state]);

  // useCallback keeps each function identical between renders unless something
  // it closes over changes. These close over nothing, so they are created once.
  const toggleTask = useCallback((taskId: string) => {
    setState((prev) => {
      const completed = { ...prev.completed };
      if (completed[taskId]) delete completed[taskId];
      else completed[taskId] = true;
      return { ...prev, completed };
    });
  }, []);

  const setSkillLevel = useCallback((skillId: string, level: number) => {
    const clamped = Math.min(5, Math.max(1, Math.round(level)));
    setState((prev) => ({ ...prev, skills: { ...prev.skills, [skillId]: clamped } }));
  }, []);

  const setMetric = useCallback((metricId: string, value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    setState((prev) => ({ ...prev, metrics: { ...prev.metrics, [metricId]: safe } }));
  }, []);

  const setStartDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, startDate: date || toDateKey(new Date()) }));
  }, []);

  const setRoadFilter = useCallback((filter: string) => {
    setState((prev) => ({ ...prev, roadFilter: filter }));
  }, []);

  const replaceState = useCallback((next: AppState) => setState(next), []);
  const resetAll = useCallback(() => setState(defaultState()), []);

  // Cross-device progress. It reads and writes the same state as everything
  // else here; localStorage remains the source of truth and this is a copy, so
  // the app still opens instantly and works with no passcode and no network.
  const progressSync = useProgressSync({ state, onRemoteState: replaceState });

  // Reads state, so it is rebuilt when state changes - hence the dependency.
  const exportToFile = useCallback(() => downloadExport(state), [state]);

  // One object identity per state change, so consumers are not re-rendered by
  // a fresh object literal on every render of this provider.
  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      toggleTask,
      setSkillLevel,
      setMetric,
      setStartDate,
      setRoadFilter,
      replaceState,
      resetAll,
      exportToFile,
      syncStatus: progressSync,
    }),
    [
      state,
      toggleTask,
      setSkillLevel,
      setMetric,
      setStartDate,
      setRoadFilter,
      replaceState,
      resetAll,
      exportToFile,
      progressSync,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
