import { coerceGraphPayload, safeStringify, type GraphPayload } from "../model.ts";

/** The `ToolPanelContent.type` a graph panel matches on. */
export const GRAPH_PANEL_TYPE = "graph";

/**
 * ANY panel content, for the renderer that has to decide whether it is a graph.
 *
 * Declared structurally so this module does not import the store's type — it
 * only ever reads these fields, and a structural shape keeps the dependency
 * one-way. `type` is deliberately wide here: the whole job of
 * `graphPanelPayload` is to be handed something that might not be a graph.
 */
export interface GraphPanelContentLike {
  title: string;
  content: string;
  type: string;
  data?: unknown;
}

/**
 * Content this module BUILT, which is a graph by construction.
 *
 * Separate from the wide shape above so `type` can be the literal, which is
 * what makes it assignable to the host's `ToolPanelContent` union. One type
 * serving both directions forced an `as never` at every `openPanel` and
 * `setContent` call — casts that switch checking off exactly where a shape
 * mismatch with the host would otherwise be caught.
 */
export interface GraphPanelContent extends GraphPanelContentLike {
  type: typeof GRAPH_PANEL_TYPE;
}

/**
 * Build the panel payload for a graph.
 *
 * `data` carries the parsed payload so the renderer never re-parses, and
 * `content` carries the serialization so the panel header's Copy button and the
 * built-in text fallback still do something useful if no renderer matched.
 */
export function graphPanelContent(title: string, payload: GraphPayload): GraphPanelContent {
  return {
    title,
    type: GRAPH_PANEL_TYPE,
    content: safeStringify(payload, 2),
    data: payload,
  };
}

/**
 * Recover the payload from panel content.
 *
 * Prefers `data`; falls back to parsing `content` so a panel opened by a
 * generic client tool (`ui_open_panel`, which only knows how to set strings)
 * still renders as a graph.
 */
export function graphPanelPayload(content: GraphPanelContentLike): GraphPayload | null {
  return coerceGraphPayload(content.data) ?? coerceGraphPayload(content.content);
}
