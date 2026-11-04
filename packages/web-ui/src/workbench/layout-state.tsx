import { createContext, useContext, useState, type ReactNode } from "react";

const LayoutStateContext = createContext<ReturnType<typeof useLayoutState> | null>(null);

function useLayoutState() {
  return useState<boolean | undefined>(undefined);
}

/** Keep shell layout preferences outside the keyed conversation runtimes. */
export function WorkbenchLayoutProvider({ children }: { children: ReactNode }) {
  const state = useLayoutState();
  return <LayoutStateContext.Provider value={state}>{children}</LayoutStateContext.Provider>;
}

export function useWorkbenchCollapsed(defaultCollapsed: boolean) {
  const shared = useContext(LayoutStateContext);
  const local = useLayoutState();
  const [collapsed, setCollapsed] = shared ?? local;
  return [collapsed ?? defaultCollapsed, setCollapsed] as const;
}
