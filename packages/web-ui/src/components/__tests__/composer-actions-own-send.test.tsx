/**
 * When a module claims the send corner, Send has to actually stand aside —
 * and come straight back the moment there is something to send. Get either
 * half wrong and the composer has two primary buttons, or none.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useAui,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { registerChatSlots, useChatSlotsStore, useComposerActionsOwnSend } from "../chat-slots.tsx";

const stubModel: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: "text", text: "ok" }] };
  },
};

function Actions() {
  return <button>mic</button>;
}

const seen = { ownsSend: false, setText: (_: string) => {} };

function Probe() {
  seen.ownsSend = useComposerActionsOwnSend();
  const aui = useAui();
  seen.setText = (t: string) => aui.composer.setText(t);
  return null;
}

function Harness() {
  const runtime = useLocalRuntime(stubModel);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Probe />
    </AssistantRuntimeProvider>
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let priorActEnvironment: boolean | undefined;

beforeAll(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
});

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<Harness />));
  await act(async () => {});
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  useChatSlotsStore.setState({ composerActions: null, composerActionsReplaceSend: false });
});

describe("useComposerActionsOwnSend", () => {
  it("is false when nothing is registered", async () => {
    await mount();
    expect(seen.ownsSend).toBe(false);
  });

  it("is false for a slot that did not ask for the send position", async () => {
    // A progress strip in the slot must not make Send vanish.
    registerChatSlots({ composerActions: Actions });
    await mount();
    expect(seen.ownsSend).toBe(false);
  });

  it("is false when the flag is set but no slot component is registered", async () => {
    registerChatSlots({ composerActionsReplaceSend: true });
    await mount();
    expect(seen.ownsSend).toBe(false);
  });

  it("hands over the corner while empty, and takes it back on the first keystroke", async () => {
    registerChatSlots({ composerActions: Actions, composerActionsReplaceSend: true });
    await mount();
    expect(seen.ownsSend).toBe(true);

    await act(async () => seen.setText("hello"));
    expect(seen.ownsSend).toBe(false);

    await act(async () => seen.setText(""));
    expect(seen.ownsSend).toBe(true);
  });
});
