import { act } from "react";
import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useChatLifecycleStore } from "@lykomi/web-ui";
import { useFreshConversationId } from "../use-fresh-conversation-id.ts";

vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  })) as typeof window.matchMedia;
});

it("starts a distinct in-place conversation without a sticky hook", () => {
  const { result, rerender, unmount } = renderHook(() => useFreshConversationId(null));
  const previous = result.current;
  rerender();
  expect(result.current).toBe(previous);
  act(() => useChatLifecycleStore.getState().startNewConversation());
  expect(result.current).not.toBe(previous);
  const fresh = result.current;
  rerender();
  expect(result.current).toBe(fresh);
  unmount();
});
