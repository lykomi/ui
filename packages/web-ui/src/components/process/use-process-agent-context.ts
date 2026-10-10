import { useEffect, useId, useRef } from "react";
import { processStatusLabels } from "./process-steps.tsx";
import type { GuidedProcessStep } from "./process-guide.tsx";
import {
  setProcessEntry,
  focusProcess,
  type ProcessAgentContext,
  type ProcessContextSnapshot,
} from "./process-agent-context.ts";

export function useProcessAgentContext(
  context: ProcessAgentContext | undefined,
  steps: readonly GuidedProcessStep[],
  currentStepId: string | undefined,
  selectedStepId: string | undefined,
  selectStep: ((id: string) => void) | undefined,
) {
  const key = useId();
  const selectStepRef = useRef(selectStep);
  const active = !!context && context.active && steps.length > 0;
  const snapshot: ProcessContextSnapshot | null = context
    ? {
        id: context.id,
        label: context.label,
        sourcePage: context.sourcePage,
        currentStepId: steps.some((step) => step.id === currentStepId) ? currentStepId! : null,
        selectedStepId: selectedStepId ?? null,
        steps: steps.map((step) => ({
          id: step.id,
          label: step.label,
          title: step.title,
          status: step.status,
          statusLabel: step.statusLabel ?? processStatusLabels[step.status],
          optional: !!step.optional,
          selectable: !!selectStep && !!step.selectable,
          ...((step.contextText?.description ??
            (typeof step.description === "string" ? step.description : undefined)) !== undefined
            ? { description: step.contextText?.description ?? (step.description as string) }
            : {}),
          ...((step.contextText?.message ??
            (typeof step.message === "string" ? step.message : undefined)) !== undefined
            ? { message: step.contextText?.message ?? (step.message as string) }
            : {}),
        })),
      }
    : null;
  // Update after each committed host render. No React nodes, handlers or inferred
  // execution state enter the snapshot; the rendered props are the source of truth.
  useEffect(() => {
    selectStepRef.current = selectStep;
    setProcessEntry(key, active && snapshot ? { snapshot, selectStep: selectStepRef } : null);
  });
  useEffect(() => () => setProcessEntry(key, null), [key]);
  return () => focusProcess(key);
}
