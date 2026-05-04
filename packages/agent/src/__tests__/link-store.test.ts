import { describe, expect, it, beforeEach, vi } from "vitest";
import { linkStore, resolveLinkHandler, type LinkHandler } from "../store/link-store.ts";

describe("linkStore", () => {
  beforeEach(() => {
    linkStore.getState().clear();
  });

  it("registers and clears a markdown link handler", () => {
    const handler: LinkHandler = {
      canHandle: (href) => href.startsWith("/spaces/"),
      openLink: vi.fn(),
    };

    linkStore.getState().setHandler(handler);
    expect(linkStore.getState().handler).toBe(handler);
    expect(linkStore.getState().handlers).toEqual([handler]);

    linkStore.getState().clear();
    expect(linkStore.getState().handler).toBeNull();
    expect(linkStore.getState().handlers).toEqual([]);
  });

  it("keeps multiple handlers and resolves the matching namespace", () => {
    const spacesHandler: LinkHandler = {
      canHandle: (href) => href.startsWith("/spaces/"),
      openLink: vi.fn(),
    };
    const docsHandler: LinkHandler = {
      normalizeHref: (href) => (href.startsWith("docs:") ? `/docs/${href.slice(5)}` : href),
      canHandle: (href) => href.startsWith("/docs/"),
      openLink: vi.fn(),
    };

    linkStore.getState().setHandler(spacesHandler);
    linkStore.getState().setHandler(docsHandler);

    expect(resolveLinkHandler("/spaces/page-1")).toEqual({
      handler: spacesHandler,
      href: "/spaces/page-1",
    });
    expect(resolveLinkHandler("docs:setup")).toEqual({
      handler: docsHandler,
      href: "/docs/setup",
    });
    expect(resolveLinkHandler("/unknown")).toBeNull();
  });
});
