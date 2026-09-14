import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
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

  it("omits its starter slot when another empty-home presentation owns it", () => {
    const { container, root } = renderEmptyState(false);

    expect(container.querySelector('[data-testid="home-starters"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("renders starters by default for compact and focused chat", () => {
    const { container, root } = renderEmptyState();

    expect(container.querySelector('[data-testid="home-starters"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
