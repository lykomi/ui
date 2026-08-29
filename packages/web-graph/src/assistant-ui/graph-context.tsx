import { useCallback } from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { useAppStore } from "@iloveagents/foundry-web-ui";
import { primaryLabel, resolveCaption, type GraphNode } from "../model.ts";

/**
 * The context key the graph's selection occupies.
 *
 * One key means one item: selecting a different node replaces the previous
 * one rather than stacking, and deselecting clears it. That is exactly what
 * `setContextItem` is for — "context that tracks a piece of UI rather than a
 * user's pin".
 */
export const GRAPH_SELECTION_CONTEXT_KEY = "graph.selection";

function contextItemFor(node: GraphNode, sourcePage: string) {
  const caption = resolveCaption(node);
  return {
    key: GRAPH_SELECTION_CONTEXT_KEY,
    type: "ref" as const,
    label: `${primaryLabel(node)} · ${caption}`,
    payload: {
      kind: "ref" as const,
      refType: "graph-node",
      refId: node.id,
      preview: caption,
      // The agent gets the node's own data, so it can answer about "this
      // node" without a round trip back through a tool.
      meta: { labels: node.labels ?? [], properties: node.properties ?? {} },
    },
    sourcePage,
    // Ephemeral: it follows the selection. Pinning promotes it, which drops
    // the key and makes it persist.
    persistence: "ephemeral" as const,
  };
}

/**
 * Keep the graph's selected node in the chat's context.
 *
 * Without this, "tell me about this node" means the agent has to guess, or
 * the user has to retype what they are already looking at. With it, whatever
 * is selected is simply part of the conversation — and because it is keyed,
 * selecting something else swaps it instead of piling up.
 */
export function syncGraphSelectionContext(node: GraphNode | null, sourcePage: string): void {
  const { setContextItem } = useAppStore.getState();
  setContextItem(GRAPH_SELECTION_CONTEXT_KEY, node ? contextItemFor(node, sourcePage) : null);
}

/**
 * Pin the selected node so it outlives the selection.
 *
 * Uses the shell's own pin vocabulary — same icons, same `text-primary` when
 * active — because it is the same idea: this stays in the conversation until
 * I remove it. `promoteContextItem` is what turns the keyed, selection-tracking
 * item into a persistent pin (it drops the key), so pinning and then selecting
 * elsewhere leaves the pin standing.
 */
export function GraphContextPinButton({ node }: { node: GraphNode }) {
  const items = useAppStore((s) => s.contextItems);
  const promoteContextItem = useAppStore((s) => s.promoteContextItem);
  const removeContextItem = useAppStore((s) => s.removeContextItem);

  const tracked = items.find((item) => item.key === GRAPH_SELECTION_CONTEXT_KEY);
  const pinned = items.find(
    (item) =>
      item.key === undefined &&
      item.payload.kind === "ref" &&
      item.payload.refType === "graph-node" &&
      item.payload.refId === node.id,
  );

  const toggle = useCallback(() => {
    if (pinned) {
      removeContextItem(pinned.id);
      return;
    }
    if (tracked) promoteContextItem(tracked.id);
  }, [pinned, tracked, promoteContextItem, removeContextItem]);

  return (
    <button
      type="button"
      onClick={toggle}
      title={pinned ? "Unpin from chat" : "Pin to chat"}
      aria-pressed={!!pinned}
      className={cn(
        "border-border hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1",
        pinned ? "text-primary" : "text-muted-foreground",
      )}
    >
      {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      {pinned ? "Pinned" : "Pin"}
    </button>
  );
}
