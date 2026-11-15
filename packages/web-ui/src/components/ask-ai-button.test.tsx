import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskAIButton } from "./ask-ai-button.tsx";
import { OperationProgress } from "./operation-progress.tsx";
import { ComposerSubmitBridge } from "./composer-submit-bridge.tsx";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";
import { ASSISTANT_CONTEXT_KEY } from "../lib/assistant-context.ts";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";

const composer = vi.hoisted(() => {
  const state = {
    text: "",
    attachments: [] as string[],
    quote: "",
    sent: [] as string[],
    runConfig: {} as { custom?: Record<string, unknown> },
    sentConfigs: [] as { custom?: Record<string, unknown> }[],
  };
  return {
    state,
    getState: () => ({ ...state }),
    setRunConfig: (config: typeof state.runConfig) => {
      state.runConfig = config;
    },
    setText: (text: string) => {
      state.text = text;
    },
    send: () => {
      state.sent.push(state.text);
      state.sentConfigs.push(state.runConfig);
      state.text = "";
      state.attachments = [];
      state.quote = "";
    },
  };
});
vi.mock("@assistant-ui/react", () => ({
  useAui: () => ({
    composer,
    thread: {
      append: (message: {
        content: { text: string }[];
        runConfig: typeof composer.state.runConfig;
      }) => {
        composer.state.sent.push(message.content[0].text);
        composer.state.sentConfigs.push(message.runConfig);
      },
    },
  }),
}));
let root: Root | undefined;
let host: HTMLDivElement;
async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  useComposerSubmitStore.setState({ pending: null });
  useChatBubbleStore.getState().close();
  composer.state.text = "";
  composer.state.attachments = [];
  composer.state.quote = "";
  composer.state.sent.length = 0;
  composer.state.sentConfigs.length = 0;
  composer.state.runConfig = {};
});

describe("AI help through the host composer", () => {
  it("binds compact context to the submitted message and preserves the user's draft config", async () => {
    const snapshot = { state: "failed", issue: "Permission required" };
    composer.state.text = "My draft";
    composer.state.runConfig = { custom: { effort: "low" } };
    await mount(<AskAIButton prompt="What should I do next?" context={snapshot} />);
    await act(async () => host.querySelector("button")!.click());
    snapshot.state = "changed after click";
    await act(async () =>
      root!.render(
        <>
          <ComposerSubmitBridge />
          <ComposerSubmitBridge />
        </>,
      ),
    );
    expect(composer.state.sent).toEqual(["What should I do next?"]);
    expect(composer.state.sentConfigs).toEqual([
      {
        custom: {
          effort: "low",
          [ASSISTANT_CONTEXT_KEY]: JSON.stringify({
            state: "failed",
            issue: "Permission required",
          }),
        },
      },
    ]);
    expect(composer.state.text).toBe("My draft");
    expect(composer.state.runConfig).toEqual({ custom: { effort: "low" } });
    // The next ordinary message does not inherit the help snapshot.
    composer.send();
    expect(composer.state.sentConfigs[1]).toEqual({ custom: { effort: "low" } });
  });

  it.each(["warning", "error"] as const)(
    "sends %s help once on click, preserving the draft",
    async (status) => {
      composer.state.text = "My unfinished question";
      composer.state.attachments = ["draft.pdf"];
      composer.state.quote = "A selected passage";
      await mount(
        <StrictMode>
          <ComposerSubmitBridge />
          <ComposerSubmitBridge />
          <OperationProgress
            title="Import needs attention"
            status={status}
            assistantPrompt="Explain the failure for job-42. Check its current status."
          />
        </StrictMode>,
      );
      expect(composer.state.sent).toEqual([]);
      expect(useChatBubbleStore.getState().isOpen).toBe(false);
      await act(async () => host.querySelector("button")!.click());
      expect(useChatBubbleStore.getState().isOpen).toBe(true);
      expect(composer.state.sent).toEqual([
        "Explain the failure for job-42. Check its current status.",
      ]);
      expect(composer.state.text).toBe("My unfinished question");
      expect(composer.state.attachments).toEqual(["draft.pdf"]);
      expect(composer.state.quote).toBe("A selected passage");
    },
  );
  it("keeps expanded chat in place and rejects a second click while delivery is pending", async () => {
    useChatBubbleStore.getState().expand();
    await mount(<AskAIButton prompt="Investigate job-42" label="Ask Komi" />);
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Ask Komi");
    await act(async () => {
      button.click();
      button.click();
    });
    const first = useComposerSubmitStore.getState().pending;
    expect(first?.text).toBe("Investigate job-42");
    expect(useChatBubbleStore.getState()).toMatchObject({ isOpen: false, isExpanded: true });
    expect(button.disabled).toBe(true);
    await act(async () => button.click());
    expect(useComposerSubmitStore.getState().pending).toBe(first);
    await act(async () =>
      root!.render(
        <>
          <ComposerSubmitBridge />
          <AskAIButton prompt="Investigate job-42" />
        </>,
      ),
    );
    expect(composer.state.sent).toEqual(["Investigate job-42"]);
  });
  it.each(["running", "pending", "success", "cancelled"] as const)(
    "does not show error help for %s",
    async (status) => {
      await mount(
        <OperationProgress title="Import" status={status} assistantPrompt="Explain the failure" />,
      );
      expect(host.querySelector("button")).toBeNull();
      expect(useComposerSubmitStore.getState().pending).toBeNull();
    },
  );
  it("does not submit an empty or disabled action", async () => {
    await mount(
      <>
        <AskAIButton prompt="   " />
        <AskAIButton prompt="Investigate" disabled />
      </>,
    );
    for (const button of host.querySelectorAll("button")) {
      expect(button.disabled).toBe(true);
      await act(async () => button.click());
    }
    expect(useComposerSubmitStore.getState().pending).toBeNull();
    expect(useChatBubbleStore.getState().isOpen).toBe(false);
  });
});
