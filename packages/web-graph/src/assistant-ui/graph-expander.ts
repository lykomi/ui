import type { GraphNode, GraphPayload } from "../model.ts";

/** How far out an expansion reaches. */
export interface GraphExpandOptions {
  hops: 1 | 2;
}

/**
 * Loads a node's neighbourhood straight from the host's backend.
 *
 * Returns the payload to fold into the graph on screen, or `null` when the
 * host cannot expand this node itself — the panel then asks the agent, as it
 * does with no expander at all.
 */
export type GraphExpander = (
  node: GraphNode,
  options: GraphExpandOptions,
) => Promise<GraphPayload | null>;

let current: GraphExpander | null = null;

/**
 * Expand without the agent.
 *
 * By default "Expand" is a question to the agent in the chat — the turn is
 * visible and the agent picks the traversal. A host that can read the graph
 * itself registers an expander: "Expand" then loads the neighbours directly
 * and merges them in, and asking the agent stays one click away ("Ask AI").
 *
 * @returns a function that removes this expander again.
 */
export function registerGraphExpander(expander: GraphExpander): () => void {
  current = expander;
  return () => {
    if (current === expander) current = null;
  };
}

/** The registered expander, if any. */
export function graphExpander(): GraphExpander | null {
  return current;
}
