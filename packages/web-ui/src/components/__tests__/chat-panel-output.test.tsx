import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useToolPanelStore } from "../../lib/tool-panel-store.ts";
import { ChatMessageParts } from "../chat-message-parts.tsx";
import { ClientToolExecutor } from "../client-tool-executor.tsx";

vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

function Transcript({ message, isRunning }: { message: ThreadMessageLike; isRunning: boolean }) {
  const runtime = useExternalStoreRuntime({
    messages: [message],
    convertMessage: (message) => message,
    isRunning,
    onNew: async () => {},
  });
  return (
    <MemoryRouter>
      <AssistantRuntimeProvider runtime={runtime}>
        <ClientToolExecutor />
        <ThreadPrimitive.Messages components={{ AssistantMessage: ChatMessageParts }} />
      </AssistantRuntimeProvider>
    </MemoryRouter>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useToolPanelStore.setState({ isOpen: false, content: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(content: ThreadMessageLike["content"], isRunning = false) {
  await act(async () =>
    root.render(
      <Transcript message={{ id: "answer", role: "assistant", content }} isRunning={isRunning} />,
    ),
  );
}

function panelButtons() {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Open panel"]'),
  );
}

function panelCall(toolCallId: string, args: Record<string, string>, result?: unknown) {
  return { type: "tool-call" as const, toolName: "ui_open_panel", toolCallId, args, result };
}

it("reopens saved panel outputs while the original tool traces stay in the activity disclosure", async () => {
  await render([
    {
      type: "tool-call",
      toolName: "ui_set_theme",
      args: { mode: "dark" },
      result: { status: "success" },
    },
    panelCall("report", { title: "Project summary", content: "# Summary" }, '{"status":"success"}'),
    { type: "text", text: "Here is the workspace as well." },
    panelCall("workspace", { title: "Workspace", path: "/workspace" }, { status: "success" }),
  ]);

  const disclosure = container.querySelector<HTMLButtonElement>("[data-disclosure-trigger]")!;
  expect(disclosure.getAttribute("aria-expanded")).toBe("false");
  expect(disclosure.textContent).toContain("2 tools");
  expect(container.textContent).not.toContain("Set Theme");
  expect(useToolPanelStore.getState().isOpen).toBe(false);

  const buttons = panelButtons();
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "Open panel — Project summary",
    "Open panel — Workspace",
  ]);
  await act(async () => buttons[0]!.click());
  expect(useToolPanelStore.getState()).toMatchObject({
    isOpen: true,
    content: { title: "Project summary", content: "# Summary", type: "markdown" },
  });

  useToolPanelStore.getState().closePanel();
  await act(async () => buttons[1]!.click());
  expect(useToolPanelStore.getState()).toMatchObject({
    isOpen: true,
    content: { title: "Workspace", content: "/workspace", type: "page" },
  });

  await act(async () => disclosure.click());
  expect(container.textContent).toContain("Set Theme");
  expect(container.textContent).toContain("Open Panel");
  expect(panelButtons()).toHaveLength(2);
});

it("shows an output when its live tool call succeeds", async () => {
  const args = { title: "Notes", content: "Plain text notes.", type: "text" };
  const failed = panelCall("failed", args, { status: "error" });
  await render([failed, panelCall("live", args)], true);
  expect(panelButtons()).toHaveLength(0);

  await render([failed, panelCall("live", args, { status: "success" })], true);
  const buttons = panelButtons();
  expect(buttons).toHaveLength(1);
  await act(async () => buttons[0]!.click());
  expect(useToolPanelStore.getState().content).toMatchObject({
    title: "Notes",
    content: "Plain text notes.",
    type: "text",
  });
});
