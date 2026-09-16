/**
 * Chat slot registry — the contract modules rely on to inject UI into
 * shell-owned chat chrome (composer banner, launcher badge, composer
 * actions).
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ChatComposerActionsSlot,
  ChatComposerBannerSlot,
  ChatHomeStartersSlot,
  ChatContextDetailsSlot,
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

function Actions() {
  return <button data-testid="actions">mic</button>;
}

describe("chat slots", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useChatSlotsStore.setState({
      composerBanner: null,
      homeStarters: null,
      contextDetails: null,
      launcherBadge: null,
      composerActions: null,
      threadSurface: null,
      threadSurfaceHidesComposer: false,
    });
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
          <ChatHomeStartersSlot />
          <ChatContextDetailsSlot onDismiss={() => {}} />
          <ChatLauncherBadgeSlot />
          <ChatComposerActionsSlot />
        </>,
      ),
    );

  it("registers and clears chat home starters independently of the composer", () => {
    registerChatSlots({
      homeStarters: () => <span>Review instructions</span>,
      composerBanner: Banner,
    });
    renderSlots();
    expect(container.textContent).toContain("Review instructions");
    act(() => registerChatSlots({ homeStarters: null }));
    expect(container.textContent).not.toContain("Review instructions");
    expect(container.querySelector('[data-testid="banner"]')).not.toBeNull();
  });

  it("mounts home starters once in the highest-priority visible host", () => {
    registerChatSlots({ homeStarters: () => <span data-testid="starter">Review</span> });
    const Hosts = ({ focus }: { focus: boolean }) => (
      <>
        <div data-testid="primary-host">
          <ChatHomeStartersSlot />
        </div>
        {focus && (
          <div data-testid="focus-host">
            <ChatHomeStartersSlot priority={20} />
          </div>
        )}
      </>
    );

    act(() => root.render(<Hosts focus />));
    expect(container.querySelectorAll('[data-testid="starter"]')).toHaveLength(1);
    expect(
      container.querySelector('[data-testid="focus-host"] [data-testid="starter"]'),
    ).not.toBeNull();

    act(() => root.render(<Hosts focus={false} />));
    expect(container.querySelectorAll('[data-testid="starter"]')).toHaveLength(1);
    expect(
      container.querySelector('[data-testid="primary-host"] [data-testid="starter"]'),
    ).not.toBeNull();
  });

  it("does not transfer composer takeover to a replacement surface", () => {
    registerChatSlots({ threadSurface: Banner, threadSurfaceHidesComposer: true });
    registerChatSlots({ launcherBadge: Badge });
    expect(useChatSlotsStore.getState().threadSurfaceHidesComposer).toBe(true);
    registerChatSlots({ threadSurface: Actions });
    expect(useChatSlotsStore.getState().threadSurfaceHidesComposer).toBe(false);
    registerChatSlots({ threadSurface: Banner, threadSurfaceHidesComposer: true });
    registerChatSlots({ threadSurface: null });
    expect(useChatSlotsStore.getState().threadSurfaceHidesComposer).toBe(false);
  });

  it("renders nothing while unregistered", () => {
    renderSlots();
    expect(container.innerHTML).toBe("");
  });

  it("renders registered components in their slots", () => {
    registerChatSlots({ composerBanner: Banner, launcherBadge: Badge, composerActions: Actions });
    renderSlots();
    expect(container.querySelector('[data-testid="banner"]')?.textContent).toBe("tasks");
    expect(container.querySelector('[data-testid="badge"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="actions"]')?.textContent).toBe("mic");
  });

  it("registration after mount re-renders the slot live", () => {
    renderSlots();
    expect(container.innerHTML).toBe("");
    act(() => registerChatSlots({ composerBanner: Banner }));
    expect(container.querySelector('[data-testid="banner"]')).not.toBeNull();
  });

  it("partial registration keeps the other slots untouched", () => {
    registerChatSlots({ composerBanner: Banner, launcherBadge: Badge, composerActions: Actions });
    registerChatSlots({ composerBanner: null });
    expect(useChatSlotsStore.getState().composerBanner).toBeNull();
    expect(useChatSlotsStore.getState().launcherBadge).toBe(Badge);
    expect(useChatSlotsStore.getState().composerActions).toBe(Actions);
  });

  it("ignores explicit undefined values instead of corrupting state", () => {
    registerChatSlots({ composerBanner: Banner });
    registerChatSlots({ composerBanner: undefined, launcherBadge: Badge });
    expect(useChatSlotsStore.getState().composerBanner).toBe(Banner);
    expect(useChatSlotsStore.getState().launcherBadge).toBe(Badge);
  });

  it("adds context capabilities without replacing composer actions or the banner", () => {
    const Details = ({ onDismiss }: { onDismiss: () => void }) => (
      <button onClick={onDismiss}>Context action</button>
    );
    registerChatSlots({
      composerBanner: Banner,
      composerActions: Actions,
      contextDetails: Details,
    });
    renderSlots();
    expect(container.textContent).toContain("Context action");
    expect(container.querySelector('[data-testid="banner"]')).not.toBeNull();
    act(() => registerChatSlots({ contextDetails: null }));
    expect(container.textContent).not.toContain("Context action");
    expect(useChatSlotsStore.getState().composerActions).toBe(Actions);
  });

  it("threadSurface is set and cleared at runtime, unlike the other slots", () => {
    // Registering the component IS the takeover and clearing it hands the
    // thread back, so there is no second "is it active" flag to keep in step.
    expect(useChatSlotsStore.getState().threadSurface).toBeNull();

    registerChatSlots({ threadSurface: Banner });
    expect(useChatSlotsStore.getState().threadSurface).toBe(Banner);

    registerChatSlots({ threadSurface: null });
    expect(useChatSlotsStore.getState().threadSurface).toBeNull();
  });

  it("taking the thread leaves the other slots alone", () => {
    registerChatSlots({ composerActions: Actions, composerBanner: Banner });
    registerChatSlots({ threadSurface: Badge });
    expect(useChatSlotsStore.getState().composerActions).toBe(Actions);
    expect(useChatSlotsStore.getState().composerBanner).toBe(Banner);
  });
});
