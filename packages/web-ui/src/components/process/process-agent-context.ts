import { createStore } from "zustand/vanilla";
import { clientToolRegistry, type ClientToolEntry } from "@iloveagents/foundry-agent";
import type { ContextItem } from "../../lib/app-store.ts";
import type { ProcessStepStatus } from "./process-steps.tsx";

/** Opt in to shared chat context. Hosts disable this for inactive surfaces and previews. */
export interface ProcessAgentContext {
  /** Stable process instance ID, scoped by sourcePage. */
  id: string;
  label: string;
  sourcePage: string;
  active: boolean;
}
export interface ProcessContextSnapshot {
  id: string;
  label: string;
  sourcePage: string;
  currentStepId: string | null;
  selectedStepId: string | null;
  steps: Array<{
    id: string;
    label: string;
    title?: string;
    status: ProcessStepStatus;
    statusLabel: string;
    optional: boolean;
    selectable: boolean;
    description?: string;
    message?: string;
  }>;
}
interface ProcessEntry {
  snapshot: ProcessContextSnapshot;
  selectStep: { current: ((id: string) => void) | undefined };
}
export const processContextStore = createStore(() => ({
  entries: new Map<string, ProcessEntry>(),
  focusedKey: null as string | null,
}));
const names = ["ui_process_get_context", "ui_process_select_step"];

const tools: ClientToolEntry[] = [
  {
    name: names[0],
    description:
      "Read live process context: actual current step, inspected step, statuses and blockers. Inspection never advances or executes a process. Use this to refresh context after user navigation or an action.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => {
      const { entries, focusedKey } = processContextStore.getState();
      const focused = focusedKey ? entries.get(focusedKey)?.snapshot : undefined;
      return JSON.stringify({
        focusedProcess: focused ? { id: focused.id, sourcePage: focused.sourcePage } : null,
        processes: collectProcessSnapshots(),
      });
    },
  },
  {
    name: names[1],
    description:
      "Show a selectable step in an active process, using the same callback as the user. This only inspects guidance: it never runs, skips, approves, publishes or completes work. Read ui_process_get_context afterward to confirm the host's resulting selection.",
    parameters: {
      type: "object",
      properties: {
        processId: { type: "string" },
        sourcePage: { type: "string" },
        stepId: { type: "string" },
      },
      required: ["processId", "sourcePage", "stepId"],
      additionalProperties: false,
    },
    execute: async (json) => {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(json);
      } catch {
        return JSON.stringify({ status: "error", error: "Invalid arguments" });
      }
      if (!args || typeof args !== "object")
        return JSON.stringify({ status: "error", error: "Invalid arguments" });
      const entries = [...processContextStore.getState().entries].filter(
        ([, { snapshot }]) =>
          snapshot.id === args.processId && snapshot.sourcePage === args.sourcePage,
      );
      if (entries.length !== 1)
        return JSON.stringify({
          status: "error",
          error: "Process unavailable or ambiguous. Refresh process context.",
        });
      const [key, entry] = entries[0];
      const step = entry.snapshot.steps.find((step) => step.id === args.stepId);
      if (!step?.selectable || !entry.selectStep.current)
        return JSON.stringify({ status: "error", error: "This step cannot be selected." });
      focusProcess(key);
      entry.selectStep.current(step.id);
      return JSON.stringify({
        status: "requested",
        processId: args.processId,
        sourcePage: args.sourcePage,
        stepId: step.id,
      });
    },
  },
];

export function setProcessEntry(key: string, entry: ProcessEntry | null) {
  const previous = processContextStore.getState().entries.get(key);
  if (entry && previous && JSON.stringify(entry.snapshot) === JSON.stringify(previous.snapshot))
    return;
  if (!entry && !previous) return;
  const entries = new Map(processContextStore.getState().entries);
  if (entry) entries.set(key, entry);
  else entries.delete(key);
  const currentFocus = processContextStore.getState().focusedKey;
  const focusedKey =
    currentFocus && entries.has(currentFocus)
      ? currentFocus
      : entries.size === 1
        ? entries.keys().next().value!
        : null;
  processContextStore.setState({ entries, focusedKey });
}
export function focusProcess(key: string) {
  const state = processContextStore.getState();
  if (state.entries.has(key) && state.focusedKey !== key)
    processContextStore.setState({ focusedKey: key });
}
export function collectProcessSnapshots(): ProcessContextSnapshot[] {
  return [...processContextStore.getState().entries.values()].map(({ snapshot }) => snapshot);
}
export function collectProcessContextItems(): ContextItem[] {
  return [...processContextStore.getState().entries].map(([key, { snapshot }]) => {
    const step = snapshot.steps.find((step) => step.id === snapshot.selectedStepId);
    return {
      id: `process:${key}`,
      key: `process:${key}`,
      createdAt: 0,
      type: "ref",
      label: snapshot.label,
      payload: {
        kind: "ref",
        refType: "process",
        refId: snapshot.id,
        meta: {
          process: snapshot,
          processFocus: processContextStore.getState().focusedKey === key ? "active" : "visible",
          processLabel: snapshot.label,
          selectedStepLabel: step?.label ?? "",
        },
      },
      sourcePage: snapshot.sourcePage,
      persistence: "ephemeral",
    };
  });
}

// UI tools share the normal global AG-UI catalogue and resolve only active
// host registrations at execution time. They cannot execute process work.
for (const tool of tools) clientToolRegistry.getState().registerGlobal(tool);
