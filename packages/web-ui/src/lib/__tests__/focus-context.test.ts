import { afterEach, expect, it } from "vitest";
import { collectFocusContext } from "../focus-context.ts";
import { useAppStore } from "../app-store.ts";
let host: HTMLDivElement;
afterEach(() => host?.remove());
it("projects the focused table into agent navigation and clears it on exit", () => {
  host = document.createElement("div");
  host.innerHTML = `<div data-focused data-focus-title="Components"><div data-block-id="b1" data-entity-id="e1"><table><thead><tr><th>Component</th></tr></thead><tbody><tr><td>Appendix 1</td></tr></tbody></table></div></div>`;
  document.body.append(host);
  expect(collectFocusContext()).toMatchObject({
    title: "Components",
    entityId: "e1",
    blockId: "b1",
    table: { headers: ["Component"], rows: [["Appendix 1"]] },
  });
  expect(useAppStore.getState().getAgentState().navigation.meta.focusedSurface).toBeTruthy();
  expect(useAppStore.getState().getAgentState().navigation.contextInstructions).toContain(
    "focus mode",
  );
  host.firstElementChild!.removeAttribute("data-focused");
  expect(collectFocusContext()).toBeNull();
  expect(useAppStore.getState().getAgentState().navigation.meta.focusedSurface).toBeUndefined();
});
it("bounds large tables and reports truncation", () => {
  host = document.createElement("div");
  host.innerHTML = `<div data-focused><table><tbody>${"<tr><td>row</td></tr>".repeat(100)}</tbody></table></div>`;
  document.body.append(host);
  expect(collectFocusContext()?.table).toMatchObject({ renderedRowCount: 100, truncated: true });
  expect(collectFocusContext()?.table?.rows).toHaveLength(40);
});

it("keeps whole-page focus distinct from a table within the page", () => {
  host = document.createElement("div");
  host.innerHTML = `<div data-focused data-focus-kind="document" data-entity-id="page" data-focus-title="Briefing"><div data-document-prose><h1>Overview</h1><div data-block-id="b1"><table><tbody><tr><td>Appendix</td></tr></tbody></table></div><p>Conclusion</p></div></div>`;
  document.body.append(host);
  const context = collectFocusContext();
  expect(context).toMatchObject({ kind: "document", entityId: "page", blockId: null });
  expect(context?.content).toContain("Conclusion");
  expect(context).not.toHaveProperty("table");
});
