/**
 * Unit tests for ``getNavigablePath`` — the function powering
 * click-to-navigate on pinned context chips. Two shapes the framework
 * supports: page (uses payload.path) and ref (uses sourcePage as the
 * deep-link URL set by the source module).
 */

import { describe, expect, it } from "vitest";
import { getNavigablePath } from "../context-bar.tsx";
import type { ContextItem } from "../../lib/app-store.ts";

function pageItem(path: string): ContextItem {
  return {
    id: "i-1",
    type: "page",
    label: "Workspace",
    payload: { kind: "page", path, label: "Workspace" },
    sourcePage: path,
    persistence: "persistent",
    createdAt: 0,
  };
}

function refItem(refId: string, sourcePage: string): ContextItem {
  return {
    id: "i-2",
    type: "ref",
    label: "Field · cell",
    payload: { kind: "ref", refType: "block", refId },
    sourcePage,
    persistence: "persistent",
    createdAt: 0,
  };
}

describe("getNavigablePath", () => {
  it("returns the page payload path for page items", () => {
    expect(getNavigablePath(pageItem("/spaces/abc"))).toBe("/spaces/abc");
  });

  it("returns the ref's sourcePage URL (incl. hash) for ref items", () => {
    // The source module places the deep-link in sourcePage when it
    // creates the ref; the framework surfaces it without knowing
    // anything about the ref shape.
    expect(
      getNavigablePath(refItem("abc:b1", "/spaces/abc#block-b1")),
    ).toBe("/spaces/abc#block-b1");
  });

  it("returns null when a ref has no sourcePage", () => {
    const item = refItem("abc:b1", "");
    expect(getNavigablePath(item)).toBeNull();
  });

  it("returns null for selection items (excerpts are not anchors)", () => {
    const item: ContextItem = {
      id: "i-3",
      type: "selection",
      label: "x",
      payload: { kind: "text", text: "x" },
      sourcePage: "/spaces/abc",
      persistence: "ephemeral",
      createdAt: 0,
    };
    expect(getNavigablePath(item)).toBeNull();
  });

  it("returns null for note items", () => {
    const item: ContextItem = {
      id: "i-4",
      type: "note",
      label: "n",
      payload: { kind: "note", text: "n" },
      sourcePage: "/spaces/abc",
      persistence: "ephemeral",
      createdAt: 0,
    };
    expect(getNavigablePath(item)).toBeNull();
  });
});
