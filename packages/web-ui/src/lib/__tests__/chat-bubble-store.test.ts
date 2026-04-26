import { beforeEach, describe, expect, it } from "vitest";
import { useChatBubbleStore } from "../chat-bubble-store";

const reset = () =>
  useChatBubbleStore.setState({ isOpen: false, isExpanded: false, showPagePanel: true });
const store = () => useChatBubbleStore.getState();

describe("chat-bubble-store", () => {
  beforeEach(reset);

  it("starts closed", () => {
    expect(store().isOpen).toBe(false);
    expect(store().isExpanded).toBe(false);
  });

  it("open sets isOpen to true", () => {
    store().open();
    expect(store().isOpen).toBe(true);
    expect(store().isExpanded).toBe(false);
  });

  it("close resets both states", () => {
    store().expand();
    store().close();
    expect(store().isOpen).toBe(false);
    expect(store().isExpanded).toBe(false);
  });

  it("toggle flips isOpen", () => {
    store().toggle();
    expect(store().isOpen).toBe(true);
    store().toggle();
    expect(store().isOpen).toBe(false);
  });

  it("expand hides bubble and shows expanded layout", () => {
    store().open();
    store().expand();
    expect(store().isOpen).toBe(false);
    expect(store().isExpanded).toBe(true);
  });

  it("collapse returns to bubble mode", () => {
    store().expand();
    store().collapse();
    expect(store().isOpen).toBe(true);
    expect(store().isExpanded).toBe(false);
  });

  it("expand defaults to showing page panel", () => {
    store().expand();
    expect(store().showPagePanel).toBe(true);
    store().togglePagePanel();
    expect(store().showPagePanel).toBe(false);
    store().collapse();
    store().expand();
    expect(store().showPagePanel).toBe(true);
  });

  it("togglePagePanel flips showPagePanel", () => {
    expect(store().showPagePanel).toBe(true);
    store().togglePagePanel();
    expect(store().showPagePanel).toBe(false);
    store().togglePagePanel();
    expect(store().showPagePanel).toBe(true);
  });
});
