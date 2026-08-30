import { useCallback, useState, type ReactNode } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Share2 } from "lucide-react";
import { ToolCallCard, useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { coerceGraphPayload, type GraphNode, type GraphPayload } from "../model.ts";
import { GraphView } from "../graph-view.tsx";
import { GraphProvenance } from "./graph-provenance.tsx";
import { graphPanelContent } from "./graph-panel-content.ts";
import { registerGraphTool } from "./graph-tool-registry.ts";

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

  // Registering the BINDING, not just the card. `GraphResultSeeder` reads this
  // to fold a result into the open graph, because the card itself may never
  // mount — it lives inside the turn's collapsed activity strip. Binding a
  // card is therefore all a new graph tool needs; there is no second
  // registration to forget.
  registerGraphTool({ toolName, title, extract, panelTitle, autoOpenPanel });

  return makeAssistantToolUI<Record<string, unknown>, unknown>({
    toolName,
    render: ({ args, result, status }) => {
      const openPanel = useToolPanelStore((state) => state.openPanel);
      const [expanded, setExpanded] = useState(defaultExpanded);

      const payload = status.type === "complete" ? extract(result, args) : null;

      const open = useCallback(() => {
        if (!payload) return;
        openPanel(graphPanelContent(panelTitle?.(payload, args) ?? title, payload));
      }, [payload, openPanel, args]);

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
