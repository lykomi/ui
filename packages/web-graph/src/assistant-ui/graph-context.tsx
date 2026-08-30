import { useCallback } from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { useAppStore } from "@iloveagents/foundry-web-ui";
import { jsonSafe, primaryLabel, resolveCaption, type GraphNode } from "../model.ts";

/**
 * The context key the graph's selection occupies.
 *
 * One key means one item: selecting a different node replaces the previous
 * one rather than stacking, and deselecting clears it. That is exactly what
 * `setContextItem` is for — "context that tracks a piece of UI rather than a
 * user's pin".
 */
export const GRAPH_SELECTION_CONTEXT_KEY = "graph.selection";

function contextItemFor(node: GraphNode, sourcePage: string, captionKey?: string) {
  // Captioned with the payload\'s own `legend.captionKey`, like the canvas,
  // the expansion prompt and the client tools. Without it the chip the user
  // reads — and the `preview` the agent reads — can name the selected node
  // something that appears nowhere on screen.
  const caption = resolveCaption(node, captionKey);
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
      //
      // A JSON-SAFE copy, not the live object. This item is attached to every
      // subsequent turn and serialized by the HTTP agent, so a single native
      // `bigint` in `properties` — which is what the Neo4j driver returns
      // under `useBigInt` — throws inside someone else's `JSON.stringify`.
      // That does not lose a property, it stops the user sending any message
      // at all for as long as the node stays selected. Copying also detaches
      // it from a node object the simulation keeps mutating.
      meta: jsonSafe({ labels: node.labels ?? [], properties: node.properties ?? {} }),
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
export function syncGraphSelectionContext(
  node: GraphNode | null,
  sourcePage: string,
  captionKey?: string,
): void {
  const { setContextItem, contextItems } = useAppStore.getState();
  if (!node) {
    setContextItem(GRAPH_SELECTION_CONTEXT_KEY, null);
    return;
  }
  // Already pinned? Then the node is in the conversation once, deliberately,
  // and the tracking item would make it twice. `promoteContextItem` drops the
  // key to pin, so nothing stops this from re-adding a keyed copy on the next
  // republish — a route change or a merge — and the agent would be handed the
  // same node under two entries whose properties can disagree after a merge.
  if (contextItems.some((item) => isPinnedGraphNode(item, node.id))) {
    setContextItem(GRAPH_SELECTION_CONTEXT_KEY, null);
    return;
  }
  setContextItem(GRAPH_SELECTION_CONTEXT_KEY, contextItemFor(node, sourcePage, captionKey));
}

/** A user\'s pin of this exact node: promoted, so it carries no key. */
function isPinnedGraphNode(item: { key?: string; payload: unknown }, nodeId: string): boolean {
  const payload = item.payload as { kind?: string; refType?: string; refId?: string };
  return (
    item.key === undefined &&
    payload?.kind === "ref" &&
    payload.refType === "graph-node" &&
    payload.refId === nodeId
  );
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
export function GraphContextPinButton({
  node,
  captionKey,
}: {
  node: GraphNode;
  /**
   * The payload's caption key for this node's label — the same one the canvas
   * paints with. Unpinning rebuilds the tracking item, and without it the chip
   * the user reads (and the `preview` the agent reads) reverts to a default
   * caption that may appear nowhere on screen.
   */
  captionKey?: string;
}) {
  const items = useAppStore((s) => s.contextItems);
  const promoteContextItem = useAppStore((s) => s.promoteContextItem);
  const removeContextItem = useAppStore((s) => s.removeContextItem);

  const tracked = items.find((item) => item.key === GRAPH_SELECTION_CONTEXT_KEY);
  const pinned = items.find((item) => isPinnedGraphNode(item, node.id));

  const toggle = useCallback(() => {
    if (pinned) {
      removeContextItem(pinned.id);
      // Pinning PROMOTED the keyed item, which is how it survives selecting
      // elsewhere — so removing the pin removes the only copy, and the node
      // the user is still looking at drops out of the conversation entirely
      // until they select something else. Unpinning means "stop keeping this
      // one", not "forget what I have selected", so the tracking item comes
      // back.
      syncGraphSelectionContext(node, pinned.sourcePage ?? "", captionKey);
      return;
    }
    if (tracked) promoteContextItem(tracked.id);
  }, [node, captionKey, pinned, tracked, promoteContextItem, removeContextItem]);

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
