import { createContext, useContext } from "react";

/**
 * Shared app state provided by the root App component.
 * Consumed by page components that need student auth state or test-engine handlers.
 * Populated in Phase 5+ when test-engine state is extracted.
 */
export const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppContext.Provider");
  return ctx;
}
