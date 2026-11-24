import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ChatLeaveGuard } from "../chat-leave-guard.tsx";
import { beginChatRun, disposeChatRuns } from "../../lib/chat-runs-store.ts";

it("names the background chat on same-tab external links and lets the user stay", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  try {
    beginChatRun({ threadId: "background", title: "Review the draft", stop: () => {} });
    await act(async () =>
      root.render(
        <>
          <ChatLeaveGuard />
          <a href="https://example.org/report">
            <span>Report</span>
          </a>
        </>,
      ),
    );
    const link = host.querySelector("a")!;
    const follow = async (opts?: MouseEventInit) => {
      const e = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        ...opts,
      });
      // Observe the guard without letting jsdom perform navigation.
      let warned = false;
      window.addEventListener(
        "click",
        (ev) => {
          warned = ev.defaultPrevented;
          ev.preventDefault();
        },
        { once: true },
      );
      await act(async () => {
        link.firstChild!.dispatchEvent(e);
      });
      return warned;
    };
    expect(await follow({ ctrlKey: true })).toBe(false);
    link.target = "_blank";
    expect(await follow()).toBe(false);
    link.target = "_parent";
    expect(await follow()).toBe(true);
    link.target = "_top";
    expect(await follow()).toBe(true);
    link.target = "_self";
    expect(await follow()).toBe(true);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Review the draft");
    expect(dialog.textContent).toContain("example.org");
    await act(async () =>
      [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Stay here")!.click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => disposeChatRuns());
    expect(await follow()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    disposeChatRuns();
  }
});
