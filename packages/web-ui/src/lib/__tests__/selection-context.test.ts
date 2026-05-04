import { afterEach, describe, expect, it } from "vitest";
import {
  registerSelectionContextResolver,
  resolveSelectionContext,
  type SelectionContextResolver,
} from "../selection-context.ts";

const unregisters: Array<() => void> = [];

function register(resolver: SelectionContextResolver) {
  const unregister = registerSelectionContextResolver(resolver);
  unregisters.push(unregister);
  return unregister;
}

function input(text = "selected text") {
  const node = document.createElement("span");
  const range = document.createRange();
  range.selectNodeContents(node);
  return {
    text,
    anchorNode: node,
    focusNode: node,
    range,
    sourcePage: "Current page",
  };
}

describe("selection-context", () => {
  afterEach(() => {
    for (const unregister of unregisters.splice(0)) unregister();
    document.body.innerHTML = "";
  });

  it("falls back to a plain text selection context", () => {
    const resolved = resolveSelectionContext(input("hello"));

    expect(resolved.item).toMatchObject({
      type: "selection",
      label: "hello",
      payload: { kind: "text", text: "hello" },
      persistence: "ephemeral",
    });
    expect(resolved.supportsModify).toBeUndefined();
  });

  it("lets modules resolve richer selection context and opt into Modify", () => {
    register({
      id: "test-rich-selection",
      resolve: (selection) => ({
        item: {
          type: "ref",
          label: `Field · ${selection.text}`,
          payload: {
            kind: "ref",
            refType: "block",
            refId: "entity:block",
            preview: selection.text,
            meta: { selectionScope: "atom", targetPath: "$.blocks[0].field" },
          },
          sourcePage: "/spaces/entity#block-block",
          persistence: "ephemeral",
        },
        supportsModify: true,
      }),
    });

    const resolved = resolveSelectionContext(input("cell"));

    expect(resolved.item).toMatchObject({
      type: "ref",
      label: "Field · cell",
      payload: {
        kind: "ref",
        refType: "block",
        refId: "entity:block",
        meta: { targetPath: "$.blocks[0].field" },
      },
    });
    expect(resolved.supportsModify).toBe(true);
  });

  it("uses resolver priority before falling through to lower priority resolvers", () => {
    register({
      id: "low",
      priority: 1,
      resolve: (selection) => ({
        item: {
          type: "selection",
          label: `low ${selection.text}`,
          payload: { kind: "text", text: selection.text },
          sourcePage: selection.sourcePage,
          persistence: "ephemeral",
        },
      }),
    });
    register({
      id: "high",
      priority: 100,
      resolve: (selection) => ({
        item: {
          type: "selection",
          label: `high ${selection.text}`,
          payload: { kind: "text", text: selection.text },
          sourcePage: selection.sourcePage,
          persistence: "ephemeral",
        },
      }),
    });

    expect(resolveSelectionContext(input("x")).item.label).toBe("high x");
  });
});

