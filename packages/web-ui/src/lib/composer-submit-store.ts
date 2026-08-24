import { create } from "zustand";

interface PendingComposerSubmit {
  id: number;
  text: string;
}

interface ComposerSubmitState {
  pending: PendingComposerSubmit | null;
  submit: (text: string) => void;
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
  submit: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({ pending: { id: nextSubmitId++, text: trimmed } });
  },
  claim: (id) => {
    if (get().pending?.id !== id) return false;
    set({ pending: null });
    return true;
  },
}));

export function submitComposerText(text: string): void {
  useComposerSubmitStore.getState().submit(text);
}
