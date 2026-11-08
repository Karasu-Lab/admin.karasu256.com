'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const LoadingReportContext = createContext<((key: string, loading: boolean) => void) | null>(null);
const LoadingStateContext = createContext<ReadonlySet<string>>(new Set());

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set());

  const report = useCallback((key: string, loading: boolean) => {
    setPendingKeys((prev) => {
      if (prev.has(key) === loading) return prev;
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  return (
    <LoadingReportContext.Provider value={report}>
      <LoadingStateContext.Provider value={pendingKeys}>{children}</LoadingStateContext.Provider>
    </LoadingReportContext.Provider>
  );
}

export function useReportLoading(key: string, loading: boolean) {
  const report = useContext(LoadingReportContext);
  useEffect(() => {
    report?.(key, loading);
    return () => {
      report?.(key, false);
    };
  }, [report, key, loading]);
}

export function useIsLoading(): boolean {
  return useContext(LoadingStateContext).size > 0;
}

export function useIsLoadingKey(key: string): boolean {
  return useContext(LoadingStateContext).has(key);
}

export function useLoadingPendingKeys(): ReadonlySet<string> {
  return useContext(LoadingStateContext);
}
