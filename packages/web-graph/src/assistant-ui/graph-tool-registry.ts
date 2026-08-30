import type { GraphPayload } from "../model.ts";

/**
 * What every graph-shaped tool in the app is called, and how to read it.
 *
 * `makeGraphToolUI` fills this in as a side effect of binding a card, so the
 * headless `GraphResultSeeder` can act on a result without the card having
 * rendered — which it may never do, since it lives inside a collapsed
 * disclosure. Binding a card is therefore what makes a tool's result reach the
 * panel; there is no second registration to forget.
 */
export interface GraphToolBinding {
  toolName: string;
  title: string;
  extract: (result: unknown, args: unknown) => GraphPayload | null;
  panelTitle?: (payload: GraphPayload, args: unknown) => string;
  autoOpenPanel: boolean;
}

const bindings = new Map<string, GraphToolBinding>();

/**
 * Idempotent by tool name: a module re-registering on a hot reload replaces
 * its binding rather than stacking a second one.
 */
export function registerGraphTool(binding: GraphToolBinding): void {
  bindings.set(binding.toolName, binding);
}

export function graphToolBindings(): ReadonlyMap<string, GraphToolBinding> {
  return bindings;
}

/** Test seam. Not exported from the package. */
export function _resetGraphToolBindings(): void {
  bindings.clear();
}
