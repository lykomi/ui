import { create } from "zustand";

interface PendingComposerSubmit {
  id: number;
  text: string;
}

interface ComposerSubmitState {
  pending: PendingComposerSubmit | null;
  submit: (text: string) => void;
  consume: (id: number) => void;
}

let nextSubmitId = 1;

export const useComposerSubmitStore = create<ComposerSubmitState>((set) => ({
  pending: null,
  submit: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({ pending: { id: nextSubmitId++, text: trimmed } });
  },
  consume: (id) =>
    set((state) => ({
      pending: state.pending?.id === id ? null : state.pending,
    })),
}));

export function submitComposerText(text: string): void {
  useComposerSubmitStore.getState().submit(text);
}

