/**
 * Repro: after the 0.15 upgrade the live composer stopped accepting input
 * (typed characters no-op, controlled value stays ""). Minimal harness:
 * useLocalRuntime + AssistantRuntimeProvider + ComposerPrimitive.Input,
 * fire a change event, assert the composer state received the text.
 */
import { describe, expect, it } from "vitest";
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { FileAttachmentAdapter } from "../lib/attachment-adapter.ts";

const stubAdapter: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: "text", text: "ok" }] };
  },
};

const stubHistory: ThreadHistoryAdapter = {
  async load() {
    return { messages: [] };
  },
  async append() {},
};

function Harness({ withAdapters }: { withAdapters: boolean }) {
  const runtime = useLocalRuntime(
    stubAdapter,
    withAdapters
      ? { adapters: { attachments: new FileAttachmentAdapter(), history: stubHistory } }
      : undefined,
  );
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input placeholder="type here" />
      </ComposerPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

async function typeAndRead(withAdapters: boolean, strict = false): Promise<string> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const tree = <Harness withAdapters={withAdapters} />;
  await act(async () => {
    root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
  // let history load() settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  const input = container.querySelector("textarea") as HTMLTextAreaElement;
  expect(input).toBeTruthy();

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(input, "hello world");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const value = input.value;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return value;
}

describe("composer input under assistant-ui 0.15 legacy runtime", () => {
  it("accepts typed text (bare runtime)", async () => {
    expect(await typeAndRead(false)).toBe("hello world");
  });

  it("accepts typed text (attachments + history adapters — mirrors AGUIRuntimeProvider)", async () => {
    expect(await typeAndRead(true)).toBe("hello world");
  });

  // bootstrapShell mounts in <StrictMode> by default; store 0.3.2's compiled
  // NotificationManager (useMemo erased by React Compiler) builds a second
  // manager on the StrictMode replay — subscribers bind the dead one and the
  // composer silently ignores all typing (upstream #5422, fixed in #5411).
  it("accepts typed text under StrictMode (upstream store NotificationManager bug)", async () => {
    expect(await typeAndRead(true, true)).toBe("hello world");
  });
});
