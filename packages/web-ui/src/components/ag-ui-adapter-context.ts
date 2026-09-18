import { createContext, useContext } from "react";

import type { AGUIAdapterSDK } from "../lib/ag-ui-adapter.ts";

/**
 * The AG-UI runtime a component is rendered in.
 *
 * Its own module, importing nothing at runtime but React, so a composer
 * control can ask which thread it belongs to without pulling in the
 * provider — and with it the tool UIs, adapters and theme it mounts.
 */
export interface AGUIContextValue {
  adapter: AGUIAdapterSDK;
  resetThread: () => void;
  selectRetainedThread: (threadId: string) => boolean;
}

export const AGUIAdapterContext = createContext<AGUIContextValue | null>(null);

/** The thread this component is rendered for, or `null` outside a runtime. */
export function useCurrentThreadId(): string | null {
  return useContext(AGUIAdapterContext)?.adapter.threadId ?? null;
}
