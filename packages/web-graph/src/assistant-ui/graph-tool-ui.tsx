import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Share2 } from "lucide-react";
import { ToolCallCard, useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { coerceGraphPayload, type GraphNode, type GraphPayload } from "../model.ts";
import { GraphView } from "../graph-view.tsx";
import { GraphProvenance } from "./graph-provenance.tsx";
import { graphPanelContent } from "./graph-panel-content.ts";
import { mergeIntoOpenGraph } from "./merge-into-panel.ts";

export interface MakeGraphToolUIOptions {
  /** The agent tool whose result this card renders. */
  toolName: string;
  title?: string;
  icon?: ReactNode;
  /**
   * Pull a payload out of the tool result. Defaults to {@link coerceGraphPayload},
   * which accepts the payload itself, a JSON string, or one nested under
   * `graph` / `result` / `data` / `payload`.
   */
  extract?: (result: unknown, args: unknown) => GraphPayload | null;
  /** Panel heading. Defaults to the card title. */
  panelTitle?: (payload: GraphPayload, args: unknown) => string;
  /** Open the side panel as soon as a graph arrives. Off by default. */
  autoOpenPanel?: boolean;

  /**
   * Expand the inline graph inside the card. Off by default.
   *
   * The card stays a compact summary and the full graph goes to the side
   * panel, where it has the room to be readable — a 280px graph wedged into a
   * chat column is a thumbnail, not an explorer. Turn this on for a surface
   * with no panel.
   */
  defaultExpanded?: boolean;
  inlineHeight?: number;
  onExpandNode?: (node: GraphNode) => void;
}

const summarize = (payload: GraphPayload): string => {
  const nodes = payload.nodes.length;
  const edges = payload.edges.length;
  return `${nodes} ${nodes === 1 ? "node" : "nodes"} · ${edges} ${
    edges === 1 ? "relationship" : "relationships"
  }`;
};

/**
 * Build a tool card that renders a graph-shaped result.
 *
 * A factory rather than a component because `makeAssistantToolUI` binds a
 * literal tool name at construction time — and hard-coding one would tie this
 * package to whatever the Neo4j starter happens to call its tools. Any agent
 * that emits the payload contract gets the same card:
 *
 * ```ts
 * const CypherToolUI = makeGraphToolUI({ toolName: "graph_read_cypher" });
 * ```
 *
 * A result that is not graph-shaped is not an error — the card renders the
 * usual summary and leaves the body empty rather than throwing inside a chat
 * message.
 */
export function makeGraphToolUI(options: MakeGraphToolUIOptions) {
  const {
    toolName,
    title = "Graph",
    icon = <Share2 className="size-3.5" />,
    extract = (result) => coerceGraphPayload(result),
    panelTitle,
    autoOpenPanel = false,
    defaultExpanded = false,
    inlineHeight = 280,
    onExpandNode,
  } = options;

  return makeAssistantToolUI<Record<string, unknown>, unknown>({
    toolName,
    render: ({ args, result, status, toolCallId }) => {
      const openPanel = useToolPanelStore((state) => state.openPanel);
      const [expanded, setExpanded] = useState(defaultExpanded);

      const payload = status.type === "complete" ? extract(result, args) : null;

      const open = useCallback(() => {
        if (!payload) return;
        openPanel(graphPanelContent(panelTitle?.(payload, args) ?? title, payload) as never);
      }, [payload, openPanel, args]);

      /**
       * Everything the arrival of a result should DO, in an effect.
       *
       * The obvious shape — check a ref during render and `queueMicrotask` the
       * work — reads as if deferring the write makes it safe, and it does not:
       * scheduling from render is still a side effect in render, so it can run
       * before the commit it belongs to, or twice.
       *
       * The dependencies are the tool call and whether it has produced a
       * payload yet, NOT the payload itself: `extract` builds a new object
       * every render, so keying on it would re-run on every keystroke in the
       * composer — re-opening the panel each time, which is the behaviour the
       * old ref-guards existed to prevent. The value is read through a ref so
       * the effect always sees the latest one without depending on it.
       */
      const latestPayload = useRef(payload);
      latestPayload.current = payload;
      const hasPayload = payload !== null;

      useEffect(() => {
        const current = latestPayload.current;
        if (!current) return;
        // Fold the result into the graph already open, when it is about the
        // same part of the graph. This is what makes expanding a node — and
        // watching the agent write one — read as the workspace growing rather
        // than as a series of unrelated pictures.
        mergeIntoOpenGraph(current);
        if (autoOpenPanel) {
          openPanel(graphPanelContent(panelTitle?.(current, args) ?? title, current) as never);
        }
        // `args` is deliberately absent: the effect must fire once when the
        // result lands, and re-running it because a re-render produced a new
        // args object would re-open the panel.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [toolCallId, hasPayload, autoOpenPanel, openPanel]);

      let description: string;
      if (status.type === "running") description = "Querying the graph…";
      else if (status.type === "requires-action") description = "Waiting for approval";
      else if (payload) description = summarize(payload);
      else if (status.type === "complete") description = "No graph in this result";
      else description = "Graph query did not complete";

      return (
        <ToolCallCard
          icon={icon}
          title={title}
          description={description}
          status={status}
          className="w-full"
          open={expanded}
          onOpenChange={setExpanded}
          action={payload ? { label: "Open in panel", onClick: open } : undefined}
        >
          {/* Passed unconditionally: ToolCallCard only renders its expand
              chevron when it has children, so gating this on `expanded` would
              leave a collapsed card with no way to reopen it. Radix unmounts
              closed CollapsibleContent, so nothing here costs anything until
              someone opens it. */}
          {payload &&
            (defaultExpanded ? (
              <GraphView
                data={payload}
                variant="inline"
                height={inlineHeight}
                onExpandNode={onExpandNode}
              />
            ) : (
              <GraphProvenance payload={payload} args={args} />
            ))}
        </ToolCallCard>
      );
    },
  });
}

/**
 * The generic "show me this as a graph" card, bound to a `show_graph` tool.
 *
 * Mirrors `ShowDocumentToolUI` in `@iloveagents/foundry-web-ui`: an agent that
 * wants to put a graph in front of the user calls `show_graph` with the payload
 * and the panel opens itself.
 */
export const GraphToolUI = makeGraphToolUI({
  toolName: "show_graph",
  autoOpenPanel: true,
});
