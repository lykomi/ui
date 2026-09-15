import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { citationStore, linkStore } from "@iloveagents/foundry-agent";
import { injectCitations, markdownComponents } from "./markdown-text.tsx";

describe("injectCitations", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    citationStore.getState().selectThread("test");
    citationStore.getState().clear("test");
    linkStore.getState().clear();
    citationStore.getState().setResults(
      [
        {
          chunk_id: "chunk-1",
          entity_id: "entity-1",
          entity_name: "Document One",
          content: "One",
          page_number: 1,
          bounding_regions: "[]",
          score: 1,
        },
        {
          chunk_id: "chunk-2",
          entity_id: "entity-2",
          entity_name: "Document Two",
          content: "Two",
          page_number: 2,
          bounding_regions: "[]",
          score: 1,
        },
      ],
      "test",
    );
    citationStore.getState().setHandler({ openCitation: vi.fn() });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    citationStore.getState().selectThread("test");
    citationStore.getState().clear("test");
    linkStore.getState().clear();
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it("turns citation markers into clickable refs inside plain and nested text", async () => {
    await act(async () => {
      root.render(
        <p>
          {injectCitations(["Plain claim [1]. ", <strong key="nested">Nested claim [2].</strong>])}
        </p>,
      );
    });

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(2);
    expect(container.querySelector("strong sup")?.textContent).toBe("[2]");
  });

  it("turns handled raw deep links into clickable anchors", async () => {
    const openLink = vi.fn();
    linkStore.getState().setHandler({
      normalizeHref: (href) => href,
      canHandle: (href) => href.startsWith("/spaces/"),
      openLink,
    });

    await act(async () => {
      root.render(<p>{injectCitations("Created /spaces/entity-1#block-b1.")}</p>);
    });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/spaces/entity-1#block-b1");
    expect(link?.textContent).toBe("/spaces/entity-1#block-b1");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(openLink).toHaveBeenCalledWith("/spaces/entity-1#block-b1");
  });

  it("renders handled inline-code deep links as links", async () => {
    linkStore.getState().setHandler({
      normalizeHref: (href) => href,
      canHandle: (href) => href.startsWith("/spaces/"),
      openLink: vi.fn(),
    });
    const Code = markdownComponents.code;

    await act(async () => {
      root.render(<p>{Code ? <Code>/spaces/entity-1</Code> : null}</p>);
    });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/spaces/entity-1");
    expect(link?.className).toContain("font-mono");
  });
});
