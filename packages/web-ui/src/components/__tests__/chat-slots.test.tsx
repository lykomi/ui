/**
 * Chat slot registry — the contract modules rely on to inject UI into
 * shell-owned chat chrome (composer banner + launcher badge).
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ChatComposerBannerSlot,
  ChatLauncherBadgeSlot,
  registerChatSlots,
  useChatSlotsStore,
} from "../chat-slots.tsx";

function Banner() {
  return <div data-testid="banner">tasks</div>;
}

function Badge() {
  return <span data-testid="badge" />;
}

describe("chat slots", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useChatSlotsStore.setState({ composerBanner: null, launcherBadge: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  const renderSlots = () =>
    act(() =>
      root.render(
        <>
          <ChatComposerBannerSlot />
          <ChatLauncherBadgeSlot />
        </>,
      ),
    );

  it("renders nothing while unregistered", () => {
    renderSlots();
    expect(container.innerHTML).toBe("");
  });

  it("renders registered components in their slots", () => {
    registerChatSlots({ composerBanner: Banner, launcherBadge: Badge });
    renderSlots();
    expect(container.querySelector('[data-testid="banner"]')?.textContent).toBe("tasks");
    expect(container.querySelector('[data-testid="badge"]')).not.toBeNull();
  });

  it("registration after mount re-renders the slot live", () => {
    renderSlots();
    expect(container.innerHTML).toBe("");
    act(() => registerChatSlots({ composerBanner: Banner }));
    expect(container.querySelector('[data-testid="banner"]')).not.toBeNull();
  });

  it("partial registration keeps the other slot untouched", () => {
    registerChatSlots({ composerBanner: Banner, launcherBadge: Badge });
    registerChatSlots({ composerBanner: null });
    expect(useChatSlotsStore.getState().composerBanner).toBeNull();
    expect(useChatSlotsStore.getState().launcherBadge).toBe(Badge);
  });

  it("ignores explicit undefined values instead of corrupting state", () => {
    registerChatSlots({ composerBanner: Banner });
    registerChatSlots({ composerBanner: undefined, launcherBadge: Badge });
    expect(useChatSlotsStore.getState().composerBanner).toBe(Banner);
    expect(useChatSlotsStore.getState().launcherBadge).toBe(Badge);
  });
});
