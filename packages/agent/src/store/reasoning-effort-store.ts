import { createStore } from "zustand/vanilla";

/**
 * How hard the model should think before answering.
 *
 * `"default"` sends nothing and leaves the backend's configured level
 * alone — the user hasn't expressed a preference, so we don't override
 * one. The remaining levels map to the AG-UI/Responses reasoning effort.
 */
export type ReasoningEffort = "default" | "low" | "medium" | "high" | "xhigh";

/**
 * Level names follow the convention users already know from other assistants
 * (Instant / Medium / High / Extra High) rather than inventing a private
 * vocabulary. `Auto` is ours: it means "no preference — use whatever the app
 * is configured for", which the protocol enum has no member for.
 */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  default: "Auto",
  low: "Instant",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
};

interface ReasoningEffortState {
  effort: ReasoningEffort;
  setEffort: (effort: ReasoningEffort) => void;
}

const STORAGE_KEY = "foundry:reasoning-effort";

function readPersisted(): ReasoningEffort {
  if (typeof localStorage === "undefined") return "default";
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "default"
    ? raw
    : "default";
}

/**
 * The user's chosen reasoning effort, persisted across reloads.
 *
 * Vanilla store (this package is zero-React); the runner reads it when
 * building each request so the choice applies per turn — change it
 * mid-conversation and the next message uses the new level.
 */
export const reasoningEffortStore = createStore<ReasoningEffortState>((set) => ({
  effort: readPersisted(),
  setEffort: (effort) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, effort);
    }
    set({ effort });
  },
}));
