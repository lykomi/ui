import { useEffect, useRef, useState } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import { ModelPartsTree } from "./model-parts-tree.tsx";
import { ModelRuntime } from "./model-runtime.ts";
import { disposeModel, parseModel, readModelResponse } from "./model-resources.ts";
import { connectModel } from "./model-types.ts";
import { registerModelClientTools } from "./model-tools.ts";

export interface ModelViewProps {
  url: string;
  modelId: string;
  title: string;
  fetchFn?: typeof fetch;
  active?: boolean;
}

/** Source-neutral surface; the file-viewer adapter owns authentication and window scope. */
export function ModelView({ url, modelId, title, fetchFn = fetch, active = true }: ModelViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<ModelRuntime | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, refresh] = useState(0);
  const changed = () => refresh((revision) => revision + 1);

  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    let disconnect: (() => void) | undefined;
    let loaded: ModelRuntime | undefined;
    setLoading(true);
    setError(null);
    registerModelClientTools();
    void (async () => {
      const response = await fetchFn(url, { signal: abort.signal });
      const bytes = await readModelResponse(response, abort.signal);
      const gltf = await parseModel(bytes);
      if (disposed) {
        disposeModel(gltf.scenes);
        return;
      }
      try {
        loaded = new ModelRuntime(
          host.current!,
          gltf,
          modelId,
          title,
          () => activeRef.current,
          () => {
            if (!disposed) changed();
          },
        );
      } catch (failure) {
        disposeModel(gltf.scenes);
        throw failure;
      }
      runtime.current = loaded;
      disconnect = connectModel(loaded, () => activeRef.current);
      setLoading(false);
      changed();
    })().catch((failure: unknown) => {
      if (!disposed) {
        setError(failure instanceof Error ? failure.message : String(failure));
        setLoading(false);
      }
    });
    return () => {
      disposed = true;
      abort.abort();
      disconnect?.();
      loaded?.dispose();
      if (runtime.current === loaded) runtime.current = null;
    };
  }, [url, modelId, title, fetchFn]);

  const model = runtime.current;
  const view = model?.getView();
  const selected = model?.getParts().find((part) => part.id === view?.selectedIds[0]);
  const act = (action: () => void) => {
    try {
      action();
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  return (
    <div
      className="relative flex h-full min-h-80 flex-col bg-background text-foreground"
      aria-label={`3D model: ${title}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!model}
          onClick={() => act(() => model!.reset())}
        >
          Reset view
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!model}
          onClick={() => act(() => model!.rotate("y", 45))}
        >
          Rotate 45°
        </Button>
        <label className="flex items-center gap-2 text-sm">
          Explode
          <input
            className="h-5 w-32 cursor-pointer accent-primary disabled:cursor-default disabled:opacity-50"
            aria-label="Explosion amount"
            type="range"
            min="0"
            max="2"
            step="0.05"
            disabled={!model}
            value={view?.explosion ?? 0}
            onChange={(event) => act(() => model!.explode(Number(event.target.value)))}
          />
        </label>
        <span className="text-xs text-muted-foreground">3D Preview</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {model ? `${model.getParts().length} parts and assemblies` : "GLB"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        {model && (
          <ModelPartsTree
            key={`${modelId}:${url}`}
            parts={model.getParts()}
            selectedIds={view?.selectedIds ?? []}
            onSelect={(id) => act(() => model.highlight([id], "#ff8800", "color"))}
          />
        )}
        <div className="relative min-h-64 min-w-0 flex-1">
          <div
            ref={host}
            className="absolute inset-0"
            role="img"
            aria-label="Interactive 3D model; use the structure tree for keyboard access"
          />
          {loading && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm"
            >
              Loading 3D model…
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="absolute left-3 right-3 top-3 rounded-lg border bg-background p-3 text-sm"
            >
              {error}
            </div>
          )}
        </div>
      </div>
      {model && (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!selected}
            onClick={() => act(() => model.focus([selected!.id]))}
          >
            Focus
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selected}
            onClick={() => act(() => model.highlight([selected!.id], "#ff8800", "arrow"))}
          >
            Mark with arrow
          </Button>
          {selected && (
            <span className="text-xs text-muted-foreground">
              {selected.name} · {selected.kind}
              {typeof selected.metadata.partNumber === "string"
                ? ` · ${selected.metadata.partNumber}`
                : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
