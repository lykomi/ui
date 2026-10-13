import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { citationStore, linkStore } from "@iloveagents/foundry-agent";
const message = vi.hoisted(() => ({ text: "" }));
vi.mock("@assistant-ui/react", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useMessagePartText: () => ({ text: message.text, status: { type: "complete" } }),
}));

import { MarkdownText, injectCitations, markdownComponents } from "./markdown-text.tsx";

describe("injectCitations", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;

  beforeEach(() => {
    message.text = "";
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

  it("preserves a registered document scheme and opens its exact citation target inside the app", async () => {
    const openLink = vi.fn();
    const href = "document://source-1#page=315&find=Key%20Milestones";
    linkStore.getState().setHandler({
      normalizeHref: (value) => value,
      canHandle: (value) => value.startsWith("document://"),
      openLink,
    });
    message.text = `[Open that table](${href})`;
    await act(async () => root.render(<MarkdownText />));
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe(href);
    expect(anchor?.getAttribute("target")).toBeNull();
    await act(async () =>
      anchor?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    );
    expect(openLink).toHaveBeenCalledWith(href);
  });

  it("opens a scheme normalized into a route without normalizing the route again", async () => {
    const openLink = vi.fn();
    linkStore.getState().setHandler({
      normalizeHref: (href) =>
        href.startsWith("document://") ? href.replace("document://", "/docs/") : null,
      canHandle: (href) => href.startsWith("/docs/"),
      openLink,
    });
    message.text = "[Source](document://source-1#page=315)";
    await act(async () => root.render(<MarkdownText />));
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/docs/source-1#page=315");
    expect(anchor?.getAttribute("target")).toBeNull();
    await act(async () =>
      anchor?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    );
    expect(openLink).toHaveBeenCalledWith("/docs/source-1#page=315");
  });

  it("recognizes a document handler registered after a historical message renders", async () => {
    const href = "document://source-1#page=12";
    message.text = `[Source](${href})`;
    await act(async () => root.render(<MarkdownText />));
    await act(async () =>
      linkStore.getState().setHandler({
        normalizeHref: (value) => value,
        canHandle: (value) => value.startsWith("document://"),
        openLink: vi.fn(),
      }),
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(href);
    expect(container.querySelector("a")?.getAttribute("target")).toBeNull();
  });

  it("keeps unsafe schemes blocked and ordinary external URLs unchanged", async () => {
    message.text =
      "[Unsafe](javascript:alert%281%29) [External](https://example.com/docs) ![Image](document://source-1)";
    linkStore.getState().setHandler({
      normalizeHref: (value) => value,
      canHandle: (value) => value.startsWith("document://"),
      openLink: vi.fn(),
    });
    await act(async () => root.render(<MarkdownText />));
    const anchors = container.querySelectorAll("a");
    expect(anchors[0]?.getAttribute("href")).toBe("");
    expect(anchors[1]?.getAttribute("href")).toBe("https://example.com/docs");
    expect(anchors[1]?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("img")?.getAttribute("src") ?? "").not.toContain("document:");
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
