import { useContext } from 'react';
import { AppStateContext } from './AppStateContext';
import type { AppStateContextValue } from './AppStateContext';

/**
 * The only way components reach progress state.
 *
 * The null check turns "someone rendered this outside the provider" into a
 * clear error at the call site instead of an undefined read three frames later.
 */
export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
