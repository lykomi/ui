/**
 * usePageTools — hook for pages to register client tools with the agent.
 *
 * Call this in any page component to declare tools available on that page.
 * Tools are registered on mount and removed on unmount, so the agent
 * only sees tools relevant to the current page.
 *
 * @example
 * ```tsx
 * function WorkspacePage() {
 *   usePageTools([
 *     {
 *       name: "submit_draft",
 *       description: "Submit the current draft for review",
 *       parameters: { type: "object", properties: {}, required: [] },
 *       execute: async () => {
 *         // ... submit logic
 *         return JSON.stringify({ status: "success" });
 *       },
 *     },
 *   ]);
 *   return <div>...</div>;
 * }
 * ```
 */

import { useEffect } from "react";
import { useClientToolRegistry, type ClientToolEntry } from "./client-tool-registry.ts";

export function usePageTools(tools: ClientToolEntry[]) {
  useEffect(() => {
    useClientToolRegistry.getState().registerPageTools(tools);
    return () => {
      useClientToolRegistry.getState().clearPageTools();
    };
    // Registers once on mount, clears on unmount.
    // Tools array should be stable (defined outside the component or memoized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
