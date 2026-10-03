/** IDs address nodes in this particular GLB revision, not CAD parts across revisions. */
export interface ModelPart {
  id: string;
  name: string;
  parentId: string | null;
  kind: "part" | "assembly";
  metadata: Record<string, unknown>;
}

export interface ModelViewState {
  modelId: string;
  title: string;
  selectedIds: string[];
  highlights: { ids: string[]; color: string; style: "color" | "arrow" } | null;
  explosion: number;
  rotation: [number, number, number];
  camera?: { position: number[]; target: number[] };
}

export interface ModelHandle {
  getParts(): ModelPart[];
  getView(): ModelViewState;
  highlight(ids: string[], color: string, style: "color" | "arrow"): void;
  focus(ids: string[]): void;
  rotate(axis: "x" | "y" | "z", degrees: number): void;
  explode(amount: number): void;
  reset(): void;
}

/** Each surface supplies a live visibility check; hidden tabs never answer tools. */
const surfaces = new Map<ModelHandle, () => boolean>();
export function connectModel(handle: ModelHandle, active: () => boolean): () => void {
  surfaces.set(handle, active);
  return () => {
    surfaces.delete(handle);
  };
}

export function activeModel(modelId?: string): ModelHandle {
  const candidates = [...surfaces].filter(
    ([handle, visible]) => visible() && (!modelId || handle.getView().modelId === modelId),
  );
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length
        ? "Several 3D viewers are active. Focus the intended model window first."
        : "No matching 3D model is active. Open a GLB file and focus its window first.",
    );
  }
  return candidates[0][0];
}
