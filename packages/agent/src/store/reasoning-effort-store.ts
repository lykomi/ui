import { createStore } from "zustand/vanilla";

/**
 * How hard the model should think before answering.
 *
 * Every level maps to a real AG-UI/Responses reasoning effort and is always
 * sent. There is deliberately no "let the app decide" member: it read as
 * "the model picks per request" while actually meaning "send nothing", and
 * a level the user cannot reason about is worse than no choice at all.
 * `MEDIUM` below is what a user who has never opened the picker gets.
 */
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

/**
 * What an unset preference resolves to.
 *
 * Matches the backend's own fallback (`CHAT_REASONING_EFFORT`, itself
 * defaulting to `medium`), so removing the deferral option changed no
 * behaviour for anyone who never touched the picker. Below `medium` the
 * model often does not reason enough to produce a summary, so the panel
 * flickers between text and nothing — see the measurements in the
 * web-api `_reasoning_options` docstring.
 */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

/**
 * Level names follow the convention users already know from other assistants
 * rather than inventing a private vocabulary.
 */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
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
  if (typeof localStorage === "undefined") return DEFAULT_REASONING_EFFORT;
  const raw = localStorage.getItem(STORAGE_KEY);
  // `"default"` is the retired deferral option. Anyone still carrying it in
  // localStorage lands on the level it used to resolve to, so the migration
  // is invisible rather than a silent jump to some other effort.
  return raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh"
    ? raw
    : DEFAULT_REASONING_EFFORT;
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
