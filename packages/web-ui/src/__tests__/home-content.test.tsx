import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { BookOpen } from "lucide-react";
import { expect, it, vi } from "vitest";
import { HomeContent } from "../workbench/home-content.tsx";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

it("does not mount a duplicate home entry when the main conversation is open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <HomeContent
            chatOpen
            onOpenChat={vi.fn()}
            groups={[
              {
                label: "App",
                items: [
                  { to: "/", label: "Home", icon: BookOpen },
                  { to: "/guide", label: "Guide", icon: BookOpen, description: "Learn the app" },
                  { to: "/locked", label: "Unavailable", icon: BookOpen, disabled: true },
                ],
              },
            ]}
          />
        </MemoryRouter>,
      ),
    );
    expect(host.childElementCount).toBe(0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("keeps the draft input mounted until keyboard submission opens the conversation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const onOpenChat = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const runtime = useLocalRuntime({
      async *run() {
        yield { content: [{ type: "text" as const, text: "ok" }] };
      },
    });
    return (
      <AssistantRuntimeProvider runtime={runtime}>
        <MemoryRouter>
          <HomeContent groups={[]} chatOpen={false} onOpenChat={onOpenChat} />
        </MemoryRouter>
      </AssistantRuntimeProvider>
    );
  }
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );
    const input = host.querySelector("textarea")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    for (const text of ["h", "hello", "", "hello again"]) {
      await act(async () => {
        setter.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(input.value).toBe(text);
      expect(host.querySelector("textarea")).toBe(input);
      expect(onOpenChat).not.toHaveBeenCalled();
    }
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }),
      );
    });
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
