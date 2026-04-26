import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { useAppStore } from "./app-store.ts";
import { citationStore } from "@iloveagents/foundry-agent";
import { useSidebarStore } from "./sidebar-store.ts";
import { useToolPanelStore } from "./tool-panel-store.ts";
import { useNewConversation } from "./use-new-conversation.ts";

const switchToNewThread = vi.fn();
const resetThread = vi.fn();

vi.mock("@assistant-ui/react", () => ({
  useAui: () => ({
    threads: () => ({
      switchToNewThread,
    }),
  }),
}));

vi.mock("../components/ag-ui-runtime-provider.tsx", () => ({
  useAGUIAdapter: () => ({
    resetThread,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function Trigger() {
  const handleNewConversation = useNewConversation();
  return (
    <button type="button" onClick={handleNewConversation}>
      New Thread
    </button>
  );
}

describe("useNewConversation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    switchToNewThread.mockReset();
    resetThread.mockReset();
    useToolPanelStore.setState({ isOpen: true });
    useSidebarStore.setState({ isMobileOpen: true });
    citationStore.setState({
      results: [
        {
          chunk_id: "chunk-1",
          entity_id: "file-1",
          entity_name: "Test File",
          content: "Excerpt",
          page_number: 1,
          bounding_regions: "[]",
          score: 1,
        },
      ],
      handler: { openCitation: vi.fn() },
    });
    useAppStore.setState({
      threadActive: true,
      currentPage: "/spaces/demo",
      navContext: {
        group: "Workspaces",
        groupDescription: null,
        groupMeta: {},
        label: "Demo",
        description: null,
        meta: {},
        contextInstructions: null,
      },
      selectedItemId: "entity-1",
      content: { title: "Draft" },
      highlights: [{ entityId: "entity-1", blockId: "block-1" }],
      contextItems: [],
      sentContext: {},
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it("navigates to chat and resets thread state", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <Trigger />
          <LocationProbe />
        </MemoryRouter>,
      );
    });

    const button = container.querySelector("button");
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe("/");
    expect(switchToNewThread).toHaveBeenCalledTimes(1);
    expect(resetThread).toHaveBeenCalledTimes(1);
    expect(useToolPanelStore.getState().isOpen).toBe(false);
    expect(useSidebarStore.getState().isMobileOpen).toBe(false);
    expect(citationStore.getState().results).toEqual([]);
    expect(citationStore.getState().handler).toBeNull();
  });
});
