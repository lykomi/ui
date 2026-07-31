import { createStore } from "zustand/vanilla";

export interface LinkHandler {
  canHandle: (href: string) => boolean;
  normalizeHref?: (href: string) => string | null;
  openLink: (href: string) => void;
}

export interface ResolvedLinkHandler {
  handler: LinkHandler;
  href: string;
}

interface LinkState {
  /**
   * Latest registered handler kept for backwards-compatible consumers.
   * New code should use `handlers` or `resolveLinkHandler`.
   */
  handler: LinkHandler | null;
  handlers: LinkHandler[];
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
  handlers: [],
  setHandler: (handler) =>
    set((state) => ({
      handler,
      handlers: [...state.handlers.filter((item) => item !== handler), handler],
    })),
  clear: () => set({ handler: null, handlers: [] }),
}));

export function resolveLinkHandler(rawHref: string): ResolvedLinkHandler | null {
  const handlers = linkStore.getState().handlers;
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    const handler = handlers[i];
    const href = handler.normalizeHref ? handler.normalizeHref(rawHref) : rawHref;
    if (href && handler.canHandle(href)) {
      return { handler, href };
    }
  }
  return null;
}
