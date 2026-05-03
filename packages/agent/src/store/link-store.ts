import { createStore } from "zustand/vanilla";

export interface LinkHandler {
  canHandle: (href: string) => boolean;
  normalizeHref?: (href: string) => string | null;
  openLink: (href: string) => void;
}

interface LinkState {
  handler: LinkHandler | null;
  setHandler: (handler: LinkHandler) => void;
  clear: () => void;
}

/**
 * Generic markdown-link extension point.
 *
 * Feature modules register a handler for their own deep-link namespace
 * (for example Spaces handles `/spaces/...`). The chat renderer stays
 * module-agnostic while still letting app-local links navigate in-place.
 */
export const linkStore = createStore<LinkState>((set) => ({
  handler: null,
  setHandler: (handler) => set({ handler }),
  clear: () => set({ handler: null }),
}));
