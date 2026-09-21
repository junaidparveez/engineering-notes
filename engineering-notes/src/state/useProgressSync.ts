import { useCallback, useEffect, useRef, useState } from 'react';
import { UnauthorisedError, getProgress, hasPasscode, putProgress } from '../notes/syncApi';
import { mergeIntoState } from './storage';
import type { AppState } from '../types';

/**
 * Roadmap progress across devices, on the same passcode as the notes.
 *
 * localStorage stays the source of truth: the app reads it on start and renders
 * immediately, offline or not. This adds a pull shortly after load and a
 * debounced push after changes, so ticking a task on the laptop turns up on the
 * phone without exporting a file.
 *
 * Conflict handling is deliberately blunter than the notes': last write wins,
 * no prompt. Two devices ticking different tasks in the same minute is the only
 * way to lose anything, and what is lost is one checkbox, not a page of
 * writing. The notes prompt exists because there the cost is a paragraph you
 * cannot get back.
 */

const PUSH_DELAY_MS = 2000;
/** Wait past first paint so a sync never delays the app appearing. */
const PULL_DELAY_MS = 1200;

export type ProgressSyncState = 'idle' | 'syncing' | 'offline' | 'unauthorised' | 'error';

interface UseProgressSyncArgs {
  state: AppState;
  /** Applies progress pulled from the server. */
  onRemoteState: (state: AppState) => void;
}

export function useProgressSync({ state, onRemoteState }: UseProgressSyncArgs) {
  const [status, setStatus] = useState<ProgressSyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The state we last sent or received. Comparing against it stops the pull
  // from triggering a push of the very thing we just pulled.
  const lastSynced = useRef<string | null>(null);
  // Held in a ref so the debounced push always sends the latest state without
  // the timer being recreated on every keystroke.
  const latest = useRef(state);
  latest.current = state;

  const report = useCallback((error: unknown) => {
    if (error instanceof UnauthorisedError) setStatus('unauthorised');
    else if (!navigator.onLine) setStatus('offline');
    else setStatus('error');
  }, []);

  const pull = useCallback(async () => {
    try {
      setStatus('syncing');
      const { progress } = await getProgress<AppState>();
      if (progress?.state) {
        const remote = mergeIntoState(progress.state);
        const serialised = JSON.stringify(remote);
        // Only apply if it differs, so a pull does not cause a pointless
        // re-render and an immediate push back.
        if (serialised !== JSON.stringify(latest.current)) {
          lastSynced.current = serialised;
          onRemoteState(remote);
        } else {
          lastSynced.current = serialised;
        }
      }
      setLastSyncedAt(Date.now());
      setStatus('idle');
    } catch (error) {
      report(error);
    }
  }, [onRemoteState, report]);

  const push = useCallback(async () => {
    const serialised = JSON.stringify(latest.current);
    if (serialised === lastSynced.current) return; // nothing actually changed
    try {
      setStatus('syncing');
      const result = await putProgress(latest.current, Date.now());
      if (result.stale && result.progress?.state) {
        // Another device wrote something newer while this one was offline.
        const remote = mergeIntoState(result.progress.state);
        lastSynced.current = JSON.stringify(remote);
        onRemoteState(remote);
      } else {
        lastSynced.current = serialised;
      }
      setLastSyncedAt(Date.now());
      setStatus('idle');
    } catch (error) {
      report(error);
    }
  }, [onRemoteState, report]);

  // One pull shortly after the app settles, never on the critical path.
  useEffect(() => {
    if (!hasPasscode()) {
      setStatus('unauthorised');
      return;
    }
    const timer = setTimeout(() => void pull(), PULL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pull]);

  // Debounced push whenever progress changes. The cleanup cancels a pending
  // timer, so unmounting mid-edit cannot fire a write afterwards.
  useEffect(() => {
    if (!hasPasscode()) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void push(), PUSH_DELAY_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, push]);

  return { status, lastSyncedAt, syncNow: pull };
}
