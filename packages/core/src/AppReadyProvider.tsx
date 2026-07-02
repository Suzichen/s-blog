import React, { createContext, useContext, useCallback, useRef, useLayoutEffect } from 'react';

/**
 * Context to signal that the app's first meaningful content is ready.
 * Pages use the `useSignalReady(ready)` hook to declare readiness.
 * This triggers: hide HTML skeleton + fade in #app.
 */
const AppReadyContext = createContext<() => void>(() => {});

/**
 * Hook for page components to signal that first meaningful content is ready.
 * Call with `true` when data has loaded (triggers reveal on first true).
 * Uses useLayoutEffect to ensure skeleton removal happens before browser paint.
 */
export function useSignalReady(ready: boolean): void {
  const signalReady = useContext(AppReadyContext);
  useLayoutEffect(() => {
    if (ready) {
      signalReady();
    }
  }, [ready, signalReady]);
}

/**
 * Removes the HTML skeleton and fades in the React app.
 * Should only execute once (first page data load).
 */
function revealApp() {
  const skeleton = document.getElementById('spage-skeleton');
  if (skeleton) skeleton.remove();
  const skeletonStyle = document.getElementById('spage-skeleton-style');
  if (skeletonStyle) skeletonStyle.remove();
  const app = document.getElementById('app');
  if (app) {
    app.style.opacity = '1';
  }
}

export const AppReadyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const revealedRef = useRef(false);

  const signalReady = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    revealApp();
  }, []);

  return (
    <AppReadyContext.Provider value={signalReady}>
      {children}
    </AppReadyContext.Provider>
  );
};
