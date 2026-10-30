import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { WorkbenchStyles } from "./workbench-styles.tsx";

it("keeps chat and item header geometry unchanged when workspace navigation and breadcrumbs arrive", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  host.className = "workbench-preview";
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <>
          <WorkbenchStyles />
          <div data-chat-empty-state style={{ paddingTop: 12 }}>
            Chat
          </div>
          <header data-preview-entity-header>
            <div data-entity-header-row>
              <div data-entity-header-identity>Title</div>
            </div>
          </header>
        </>,
      ),
    );
    const geometry = () =>
      ["[data-chat-empty-state]", "[data-entity-header-row]", "[data-entity-header-identity]"].map(
        (selector) => {
          const style = getComputedStyle(host.querySelector(selector)!);
          return [style.paddingTop, style.paddingBottom, style.minHeight];
        },
      );
    const before = geometry();
    host.setAttribute("data-workspace-navigation", "true");
    expect(geometry()).toEqual(before);
    const breadcrumb = document.createElement("nav");
    breadcrumb.setAttribute("aria-label", "Page location");
    host.querySelector("[data-entity-header-identity]")!.prepend(breadcrumb);
    expect(geometry()).toEqual(before);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
