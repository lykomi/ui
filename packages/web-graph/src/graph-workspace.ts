import { createStore } from "zustand/vanilla";
import { primaryLabel, resolveCaption, type GraphNode, type GraphPayload } from "./model.ts";
import type { GraphViewHandle } from "./graph-view.tsx";

/**
 * The live graph the user is looking at.
 *
 * This is what turns the panel from a picture into a workspace the agent and
 * the user share. The agent can ask what is on screen, drive the selection,
 * and replace the data in place; the user's own clicks land in the same state,
 * so the next question can be about "this node" without either side having to
 * restate it.
 *
 * Vanilla zustand (not the React entry) so the store itself has no renderer
 * dependency — the client tools that read it run outside React.
 */
export interface GraphWorkspaceState {
  /** Imperative handle of the mounted panel view, or null when none is open. */
  handle: GraphViewHandle | null;
  title: string | null;
  payload: GraphPayload | null;
  /** What the user (or the agent) currently has selected. */
  selection: GraphNode | null;
  /** The active search term, if any. */
  query: string;
  /**
   * Labels the user has switched OFF in the legend.
   *
   * Published because what the agent sees has to be what the user sees: a
   * hidden label's nodes and relationships are not drawn, and an account of
   * "the graph" that counts them describes a screen nobody is looking at.
   */
  hiddenLabels: readonly string[];

  connect: (handle: GraphViewHandle, title: string, payload: GraphPayload) => void;
  disconnect: (handle: GraphViewHandle) => void;
  setSelection: (node: GraphNode | null) => void;
  setQuery: (query: string) => void;
  setHiddenLabels: (labels: readonly string[]) => void;
}

/**
 * Every field of the workspace at rest, in one place.
 *
 * `disconnect` and the tests both need "nothing is open", and writing that out
 * twice is how a field added later gets left out of one of them — zustand's
 * `setState` MERGES, so a partial reset silently keeps the old value and the
 * tests become order-dependent. `hiddenLabels` had already drifted that way.
 */
const CLOSED = {
  handle: null,
  title: null,
  payload: null,
  selection: null,
  query: "",
  hiddenLabels: [] as readonly string[],
} satisfies Omit<
  GraphWorkspaceState,
  "connect" | "disconnect" | "setSelection" | "setQuery" | "setHiddenLabels"
>;

/** Test seam: put the workspace back to "nothing is open", every field of it. */
export const _resetGraphWorkspace = (): void => graphWorkspaceStore.setState({ ...CLOSED });

export const graphWorkspaceStore = createStore<GraphWorkspaceState>((set, get) => ({
  ...CLOSED,

  connect: (handle, title, payload) =>
    set((state) => {
      // A selection has to belong to the graph it is reported against.
      //
      // React mounts a replacement panel BEFORE unmounting the old one, and
      // `disconnect` deliberately no-ops once a newer panel has claimed the
      // workspace — so without this the previous graph's selection survives
      // into the new one, and `graph_get_view` tells the agent a node is
      // selected that is not on screen.
      //
      // Keeping it when it survives matters just as much: a merge changes
      // `payload` on the SAME panel, and clearing unconditionally would drop
      // the user's selection every time the agent expanded a node.
      // Both conditions, and the first is the one that was missing: ids come
      // from one database, so two panels showing overlapping results share
      // them, and "the id is in the new payload" was letting panel A's
      // selection arrive in panel B as something the user never clicked.
      const samePanel = state.handle === handle;
      const stillThere =
        state.selection !== null && payload.nodes.some((node) => node.id === state.selection?.id);
      return {
        handle,
        title,
        payload,
        selection: samePanel && stillThere ? state.selection : null,
        query: samePanel ? state.query : "",
        hiddenLabels: samePanel ? state.hiddenLabels : [],
      };
    }),
  disconnect: (handle) => {
    // Guard against a stale unmount clearing a workspace that a NEWER panel
    // has already claimed — React unmounts the old tree after mounting the
    // new one, so the order is not the intuitive one.
    if (get().handle !== handle) return;
    set({ ...CLOSED });
  },
  setSelection: (selection) => set({ selection }),
  setQuery: (query) => set({ query }),
  setHiddenLabels: (hiddenLabels) => set({ hiddenLabels }),
}));

/** Is a graph panel currently open? */
export const isGraphOpen = (): boolean => graphWorkspaceStore.getState().payload !== null;

/**
 * Find a node by id, or failing that by caption — case-insensitively, exact
 * before partial.
 *
 * The agent refers to nodes the way the user does ("select Metropolis"), not
 * by the database's element id, which it has usually never seen.
 */
export function findWorkspaceNode(needle: string): GraphNode | null {
  const { payload } = graphWorkspaceStore.getState();
  if (!payload) return null;
  const byId = payload.nodes.find((node) => node.id === needle);
  if (byId) return byId;

  const lower = needle.trim().toLowerCase();
  // Every caption `.includes("")`, so a blank selector would match the first
  // node and the tool would report a confident, arbitrary selection. A missing
  // argument has to fail, not pick.
  if (lower.length === 0) return null;
  // The SAME resolver the canvas paints with. A local approximation of it
  // (caption / name / title) left every other way a node gets its caption —
  // a producer's `legend.captionKey`, `displayName`, `label`, the first short
  // string property — visible on screen and unselectable by the text on it.
  const captionOf = (node: GraphNode) =>
    resolveCaption(node, payload.legend?.[primaryLabel(node)]?.captionKey).toLowerCase();

  return (
    payload.nodes.find((node) => captionOf(node) === lower) ??
    payload.nodes.find((node) => captionOf(node).includes(lower)) ??
    null
  );
}
