import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useAui,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { expect, it } from "vitest";
import { ComposerSubmitBridge } from "../composer-submit-bridge.tsx";
import { AskAIButton } from "../ask-ai-button.tsx";
import { ASSISTANT_CONTEXT_KEY } from "../../lib/assistant-context.ts";
import { useComposerSubmitStore } from "../../lib/composer-submit-store.ts";

// Deliberately use the installed runtime: send() captures runConfig AFTER an
// await. A synchronous composer mock cannot detect a lost per-message context.
it.each([undefined, { step: "review", issue: null }])(
  "delivers help with snapshot %j through the real runtime without consuming the user's draft",
  async (context) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const runs: Parameters<ChatModelAdapter["run"]>[0][] = [];
    const adapter: ChatModelAdapter = {
      async *run(input) {
        runs.push(input);
        yield { content: [{ type: "text", text: "Ready" }] };
      },
    };
    let aui: ReturnType<typeof useAui>;
    function Capture() {
      aui = useAui();
      return null;
    }
    function Host() {
      const runtime = useLocalRuntime(adapter);
      return (
        <AssistantRuntimeProvider runtime={runtime}>
          <Capture />
          <ComposerSubmitBridge />
          <ComposerSubmitBridge />
          <AskAIButton prompt="What should I do next?" context={context} />
        </AssistantRuntimeProvider>
      );
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <StrictMode>
            <Host />
          </StrictMode>,
        ),
      );
      await act(async () => {
        aui!.composer.setText("My unsent question");
        aui!.composer.setRunConfig({ custom: { effort: "low" } });
      });
      await act(async () => host.querySelector("button")!.click());
      expect(runs).toHaveLength(1);
      expect(runs[0].runConfig.custom).toEqual({
        effort: "low",
        ...(context ? { [ASSISTANT_CONTEXT_KEY]: JSON.stringify(context) } : {}),
      });
      expect(runs[0].messages.filter((m) => m.role === "user")[0].content).toEqual([
        { type: "text", text: "What should I do next?" },
      ]);
      expect(aui!.composer.getState().text).toBe("My unsent question");
      expect(aui!.composer.getState().runConfig).toEqual({ custom: { effort: "low" } });
      await act(async () => aui!.composer.send());
      expect(runs).toHaveLength(2);
      expect(runs[1].runConfig.custom).toEqual({ effort: "low" });
    } finally {
      await act(async () => root.unmount());
      host.remove();
      useComposerSubmitStore.setState({ pending: null });
    }
  },
);
