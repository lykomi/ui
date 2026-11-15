import { create } from "zustand";
import { serializeAssistantContext, type AssistantContext } from "./assistant-context.ts";

interface PendingComposerSubmit {
  id: number;
  text: string;
  kind: "text" | "help";
  /** Serialized at submission: later renders cannot change this turn’s context. */
  context?: string;
}

interface ComposerSubmitState {
  pending: PendingComposerSubmit | null;
  submit: (text: string, context?: AssistantContext, kind?: "text" | "help") => void;
  /**
   * Take ownership of a pending submission. True for exactly one caller.
   *
   * More than one bridge can legitimately be mounted — the expanded chat and
   * the floating bubble can both exist, and voice needs a consumer alive even
   * while the bubble is closed. Reading `pending` and clearing it afterwards
   * let every mounted bridge see the same value and send it, so the claim and
   * the clear happen together here instead.
   */
  claim: (id: number) => boolean;
}

let nextSubmitId = 1;

export const useComposerSubmitStore = create<ComposerSubmitState>((set, get) => ({
  pending: null,
  submit: (text, context, kind = context ? "help" : "text") => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({
      pending: {
        id: nextSubmitId++,
        text: trimmed,
        kind,
        ...(context ? { context: serializeAssistantContext(context) } : {}),
      },
    });
  },
  claim: (id) => {
    if (get().pending?.id !== id) return false;
    set({ pending: null });
    return true;
  },
}));

export function submitComposerText(text: string, context?: AssistantContext): void {
  useComposerSubmitStore.getState().submit(text, context);
}

/** Help is a separate turn even when the caller has no UI snapshot. */
export function submitAssistantHelp(text: string, context?: AssistantContext): void {
  useComposerSubmitStore.getState().submit(text, context, "help");
}
