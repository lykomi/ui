import { describe, expect, it, beforeEach, vi } from "vitest";
import { linkStore, type LinkHandler } from "../store/link-store.ts";

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

    linkStore.getState().clear();
    expect(linkStore.getState().handler).toBeNull();
  });
});
