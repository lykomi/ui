import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ModelPartsTree } from "./model-parts-tree.tsx";
import type { ModelPart } from "./model-types.ts";

const parts: ModelPart[] = [
  { id: "node:0", name: "Assembly", kind: "assembly", parentId: null, metadata: {} },
  {
    id: "node:1",
    name: "Bearing",
    kind: "part",
    parentId: "node:0",
    metadata: { partNumber: "B-101" },
  },
  { id: "node:2", name: "Shaft", kind: "part", parentId: "node:0", metadata: {} },
];
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
function mount(selectedIds: string[] = []) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const select = vi.fn();
  const render = (ids: string[]) =>
    act(() => root.render(<ModelPartsTree parts={parts} selectedIds={ids} onSelect={select} />));
  render(selectedIds);
  cleanup = () => {
    act(() => root.unmount());
    element.remove();
  };
  return { element, select, render };
}
it("filters metadata without losing ancestors or selecting unrelated occurrences", () => {
  const { element, select } = mount();
  const input = element.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "B-101");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const rows = [...element.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Assembly");
  act(() => rows[1].click());
  expect(select).toHaveBeenCalledWith("node:1");
});
it("navigates by keyboard and opens an agent-selected part's collapsed ancestors", () => {
  const { element, render, select } = mount();
  let rows = [...element.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  act(() => {
    rows[0].focus();
    rows[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  });
  expect(document.activeElement).toBe(rows[1]);
  act(() => rows[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(select).toHaveBeenCalledWith("node:1");
  act(() =>
    element.querySelector<HTMLButtonElement>('button[aria-label="Collapse Assembly"]')!.click(),
  );
  expect(element.querySelectorAll('[role="treeitem"]')).toHaveLength(1);
  render(["node:2"]);
  rows = [...element.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  expect(rows).toHaveLength(3);
  expect(rows[2].getAttribute("aria-selected")).toBe("true");
});
