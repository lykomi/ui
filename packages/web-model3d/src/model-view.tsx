import { lazy, Suspense } from "react";
import type { ModelViewProps } from "./model-view-surface.tsx";
const Surface = lazy(() =>
  import("./model-view-surface.tsx").then((module) => ({ default: module.ModelView })),
);
/** Heavy rendering code loads only when a model surface is mounted. */
export function ModelView(props: ModelViewProps) {
  return (
    <Suspense fallback={<div role="status">Loading 3D preview…</div>}>
      <Surface {...props} />
    </Suspense>
  );
}
export type { ModelViewProps } from "./model-view-surface.tsx";
