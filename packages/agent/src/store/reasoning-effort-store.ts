import { createStore } from "zustand/vanilla";

/**
 * How hard the model should think before answering.
 *
 * `"default"` is a deferral, not a level: it sends nothing, so whatever the
 * backend is configured for applies. Every other member maps to a real
 * AG-UI/Responses reasoning effort and is sent verbatim.
 *
 * A deferral is only honest if the user can see what it currently resolves
 * to — otherwise you believe you are on Extra High and are quietly running
 * Instant, and the control silently decides cost and latency. That is what
 * {@link reasoningDefaultStore} is for.
 */
export type ReasoningEffort = "default" | "low" | "medium" | "high" | "xhigh";

/** A real effort level — everything except the deferral. */
export type ResolvedReasoningEffort = Exclude<ReasoningEffort, "default">;

/**
 * Level names follow the convention users already know from other assistants
 * (Instant / Medium / High / Extra High) rather than inventing a private
 * vocabulary. `Auto` is ours, for the case the protocol enum has no member
 * for: follow whatever the app is configured for.
 */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  default: "Auto",
  low: "Instant",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
};

interface ReasoningDefaultState {
  /**
   * What `"default"` resolves to right now, or `null` while unknown.
   *
   * `null` also covers a backend with reasoning switched off entirely, where
   * there is no level to name.
   */
  resolved: ResolvedReasoningEffort | null;
  /**
   * Where that came from, for the picker's hint — e.g. `"this workspace"`.
   * `null` means unattributed, and the hint stays generic.
   */
  scope: string | null;
  setResolved: (resolved: ResolvedReasoningEffort | null, scope?: string | null) => void;
}

/**
 * What the backend will actually do when the client sends no effort.
 *
 * Populated by the host app, never derived here. Re-deriving the backend's
 * fallback chain client-side is exactly how a label goes stale and starts
 * lying: the backend changes its default and the UI keeps claiming the old
 * one. The app fetches this from the server and sets it, and updates it
 * when the context it depends on changes — switching workspace, say — so
 * `Auto` always names the level that will really be used.
 *
 * Left unset, the picker says it does not know rather than guessing.
 *
 * Vanilla store — this package stays zero-React.
 */
export const reasoningDefaultStore = createStore<ReasoningDefaultState>((set) => ({
  resolved: null,
  scope: null,
  setResolved: (resolved, scope) => set({ resolved, scope: scope ?? null }),
}));

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
 *
 * An explicit level is a pin: nothing moves it, including a change of
 * context. Only `"default"` follows.
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
