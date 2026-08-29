import { createStore } from "zustand/vanilla";
import type { GraphNode, GraphPayload } from "./model.ts";
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

  connect: (handle: GraphViewHandle, title: string, payload: GraphPayload) => void;
  disconnect: (handle: GraphViewHandle) => void;
  setSelection: (node: GraphNode | null) => void;
  setQuery: (query: string) => void;
}

export const graphWorkspaceStore = createStore<GraphWorkspaceState>((set, get) => ({
  handle: null,
  title: null,
  payload: null,
  selection: null,
  query: "",

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
      const samePanel = state.handle === handle;
      const stillThere =
        state.selection !== null && payload.nodes.some((node) => node.id === state.selection?.id);
      return {
        handle,
        title,
        payload,
        selection: stillThere ? state.selection : null,
        query: samePanel ? state.query : "",
      };
    }),
  disconnect: (handle) => {
    // Guard against a stale unmount clearing a workspace that a NEWER panel
    // has already claimed — React unmounts the old tree after mounting the
    // new one, so the order is not the intuitive one.
    if (get().handle !== handle) return;
    set({ handle: null, title: null, payload: null, selection: null, query: "" });
  },
  setSelection: (selection) => set({ selection }),
  setQuery: (query) => set({ query }),
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
  const captionOf = (node: GraphNode) =>
    (node.caption ?? String(node.properties?.name ?? node.properties?.title ?? "")).toLowerCase();

  return (
    payload.nodes.find((node) => captionOf(node) === lower) ??
    payload.nodes.find((node) => captionOf(node).includes(lower)) ??
    null
  );
}
