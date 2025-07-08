"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface RefreshContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue | undefined>(undefined);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshContext() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefreshContext must be used within a RefreshProvider');
  return ctx;
} 