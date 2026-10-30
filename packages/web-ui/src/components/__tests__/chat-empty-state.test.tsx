import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useNavStore } from "../../lib/nav-store.ts";
import { ChatEmptyState } from "../chat-empty-state.tsx";

vi.mock("../chat-slots.tsx", () => ({
  ChatHomeStartersSlot: () => <div data-testid="home-starters" />,
}));

describe("ChatEmptyState", () => {
  const renderEmptyState = (showHomeStarters?: boolean) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<ChatEmptyState showHomeStarters={showHomeStarters} />));
    return { container, root };
  };

  it("shows a context skeleton only while the initial location is unknown", () => {
    useNavStore.setState({ navLoading: true });
    const { container, root } = renderEmptyState(false);
    expect(container.querySelector('[aria-label="Loading chat context"]')).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toContain("What would you like");
    act(() => root.render(<ChatEmptyState pageLabel="Known item" showHomeStarters={false} />));
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.textContent).toContain("Known item");
    act(() => root.unmount());
    useNavStore.setState({ navLoading: false });
    container.remove();
  });

  it("omits its starter slot when another empty-home presentation owns it", () => {
    const { container, root } = renderEmptyState(false);

    expect(container.querySelector('[data-testid="home-starters"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("renders starters by default for the primary compact chat", () => {
    const { container, root } = renderEmptyState();

    expect(container.querySelector('[data-testid="home-starters"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
