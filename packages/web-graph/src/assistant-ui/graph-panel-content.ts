import { coerceGraphPayload, type GraphPayload } from "../model.ts";

/**
 * The `ToolPanelContent` fields a graph panel needs. Declared structurally so
 * this module does not have to import the store's type — it only ever reads
 * these two fields, and a structural shape keeps the dependency one-way.
 */
export interface GraphPanelContentLike {
  title: string;
  content: string;
  type: string;
  data?: unknown;
}

/** The `ToolPanelContent.type` a graph panel matches on. */
export const GRAPH_PANEL_TYPE = "graph";

/**
 * Build the panel payload for a graph.
 *
 * `data` carries the parsed payload so the renderer never re-parses, and
 * `content` carries the serialization so the panel header's Copy button and the
 * built-in text fallback still do something useful if no renderer matched.
 */
export function graphPanelContent(title: string, payload: GraphPayload): GraphPanelContentLike {
  return {
    title,
    type: GRAPH_PANEL_TYPE,
    content: JSON.stringify(payload, null, 2),
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
