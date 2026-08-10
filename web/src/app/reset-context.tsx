"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ResetContextValue {
  // Bump this to force <UploadForm key={resetKey} /> to remount, which
  // clears all of its internal state back to the blank starting point.
  resetKey: number;
  triggerReset: () => void;
}

const ResetContext = createContext<ResetContextValue | null>(null);

export function ResetProvider({ children }: { children: ReactNode }) {
  const [resetKey, setResetKey] = useState(0);
  const triggerReset = useCallback(() => setResetKey((key) => key + 1), []);

  return <ResetContext.Provider value={{ resetKey, triggerReset }}>{children}</ResetContext.Provider>;
}

export function useReset() {
  const context = useContext(ResetContext);
  if (!context) {
    throw new Error("useReset must be used within a ResetProvider");
  }
  return context;
}
