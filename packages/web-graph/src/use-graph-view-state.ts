import { useCallback, useEffect, useMemo, useState } from "react";
import { deepEqual, type GraphEdge, type GraphNode, type GraphPayload } from "./model.ts";

/** What the user currently has selected. `null` when nothing is selected. */
export interface GraphSelection {
  node: GraphNode | null;
  edge: GraphEdge | null;
}

const EMPTY_SELECTION: GraphSelection = { node: null, edge: null };

export interface GraphViewState {
  selection: GraphSelection;
  selectNode: (node: GraphNode | null) => void;
  selectEdge: (edge: GraphEdge | null) => void;
  clearSelection: () => void;

  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;

  /** Lowercased search term. Empty string = no search active. */
  query: string;
  setQuery: (value: string) => void;
  /** Ids matching the current query. Empty set when the query is empty. */
  matchedIds: Set<string>;

  /** Labels the user has hidden by clicking the legend. */
  hiddenLabels: Set<string>;
  toggleLabel: (label: string) => void;
  showAllLabels: () => void;

  /** Ids the user pinned by dragging. Pinned nodes hold their position. */
  pinnedIds: Set<string>;
  togglePinned: (id: string) => void;
  unpinAll: () => void;
}

/**
 * Search across caption AND every property value.
 *
 * Matching only the caption looks broken the moment someone searches for an
 * id, an email, or a status that the caption rule did not pick — which is most
 * of what people actually search a graph for.
 */
function matchNodes(
  nodes: GraphNode[],
  query: string,
  captionOf: (n: GraphNode) => string,
  nameForLabel: (label: string) => string = (label) => label,
): Set<string> {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return new Set();
  const out = new Set<string>();
  for (const node of nodes) {
    if (captionOf(node).toLowerCase().includes(needle)) {
      out.add(node.id);
      continue;
    }
    if (
      node.labels?.some(
        (l) => l.toLowerCase().includes(needle) || nameForLabel(l).toLowerCase().includes(needle),
      )
    ) {
      out.add(node.id);
      continue;
    }
    // What the inspector shows first is what a person searches for.
    if (
      node.details?.some(
        (d) => d.label.toLowerCase().includes(needle) || d.value.toLowerCase().includes(needle),
      )
    ) {
      out.add(node.id);
      continue;
    }
    for (const value of Object.values(node.properties ?? {})) {
      if (value == null) continue;
      if (String(value).toLowerCase().includes(needle)) {
        out.add(node.id);
        break;
      }
    }
  }
  return out;
}

/**
 * All the interaction state a graph view carries: selection, hover, search,
 * legend filtering and pinning. Kept out of the view component so the view
 * stays a renderer and this stays unit-testable without a canvas.
 */
export function useGraphViewState(
  payload: GraphPayload,
  captionOf: (node: GraphNode) => string,
  nameForLabel?: (label: string) => string,
): GraphViewState {
  const [selection, setSelection] = useState<GraphSelection>(EMPTY_SELECTION);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(() => new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());

  const matchedIds = useMemo(
    () => matchNodes(payload.nodes, query, captionOf, nameForLabel),
    [payload.nodes, query, captionOf, nameForLabel],
  );

  /**
   * A selection outlives its node otherwise.
   *
   * `graph_show` replacing an open graph reuses the renderer deliberately —
   * that is what makes a refined query read as a change — but the drawer would
   * go on describing a node the canvas no longer contains, with an Expand
   * button that queries something nobody can see.
   *
   * Only DROPS; it never swaps in the equivalent node from the new payload.
   * Hosts pass `data` as a fresh object on many renders, and replacing the
   * selection with an equal-but-different object every time is a render loop.
   */
  useEffect(() => {
    setSelection((prev) => {
      if (prev.node && !payload.nodes.some((node) => node.id === prev.node?.id)) {
        return EMPTY_SELECTION;
      }
      if (prev.edge) {
        const fresh = payload.edges.find((edge) => edge.id === prev.edge?.id);
        if (!fresh) return EMPTY_SELECTION;
        // Edges, unlike nodes, are REBUILT on every payload —
        // `reconcileGraphModel` reuses node objects to keep their positions
        // but has no such reason for links. So a merge that rewrote this
        // relationship's type or properties left the drawer describing the
        // version before the write, with no way to notice short of
        // reselecting it. Swapped only when the content actually differs, so
        // a host handing us a fresh `data` object on every render cannot turn
        // this into a loop.
        if (!deepEqual(fresh, prev.edge)) {
          return { node: null, edge: fresh };
        }
      }
      return prev;
    });

    // Pins are ids, and an id outlives the node it named. `graph_show`
    // replacing the graph left the pin in the set: the toolbar counted a pin nothing shows, Unpin
    // All had something to clear that was not there, and — the part that is
    // not merely cosmetic — a LATER graph containing the same id got that
    // node frozen on arrival, by a pin the user made for a different graph.
    setPinnedIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(payload.nodes.map((node) => node.id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      // Same set, same object: this runs on every payload, and a fresh Set
      // each time would re-run every consumer that depends on it.
      return next.size === prev.size ? prev : next;
    });
  }, [payload]);

  const selectNode = useCallback((node: GraphNode | null) => {
    setSelection({ node, edge: null });
  }, []);
  const selectEdge = useCallback((edge: GraphEdge | null) => {
    setSelection({ node: null, edge });
  }, []);
  const clearSelection = useCallback(() => setSelection(EMPTY_SELECTION), []);

  const toggleLabel = useCallback((label: string) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);
  const showAllLabels = useCallback(() => setHiddenLabels(new Set()), []);

  const togglePinned = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const unpinAll = useCallback(() => setPinnedIds(new Set()), []);

  return {
    selection,
    selectNode,
    selectEdge,
    clearSelection,
    hoveredId,
    setHoveredId,
    query,
    setQuery,
    matchedIds,
    hiddenLabels,
    toggleLabel,
    showAllLabels,
    pinnedIds,
    togglePinned,
    unpinAll,
  };
}

export { matchNodes as __matchNodesForTest };
