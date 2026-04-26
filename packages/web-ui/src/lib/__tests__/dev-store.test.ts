import { describe, it, expect, beforeEach } from "vitest";
import { useDevStore } from "../dev-store.ts";
import type { DevToolCall } from "../dev-store.ts";

function makeToolCall(id: string): DevToolCall {
  return {
    id,
    name: `tool_${id}`,
    args: "{}",
    isClientSide: false,
    timestamp: Date.now(),
  };
}

describe("useDevStore", () => {
  beforeEach(() => {
    useDevStore.setState({
      lastRequest: null,
      lastRequestAt: null,
      toolCalls: [],
      events: [],
    });
  });

  describe("captureRequest", () => {
    it("stores request payload and timestamp", () => {
      useDevStore.getState().captureRequest({ thread_id: "t1" });
      expect(useDevStore.getState().lastRequest).toEqual({ thread_id: "t1" });
      expect(useDevStore.getState().lastRequestAt).toBeTypeOf("number");
    });

    it("resets tool calls and events on fresh turn", () => {
      useDevStore.getState().logEvent("TEXT_DELTA");
      useDevStore.getState().captureRequest({ thread_id: "t1" });
      expect(useDevStore.getState().toolCalls).toEqual([]);
      expect(useDevStore.getState().events).toEqual([]);
    });

    it("preserves tool calls on follow-up (multi-turn)", () => {
      useDevStore.getState().addToolCall(makeToolCall("tc1"));
      useDevStore.getState().captureRequest({ thread_id: "t1" });
      expect(useDevStore.getState().toolCalls.length).toBe(1);
    });
  });

  describe("addToolCall", () => {
    it("appends tool call", () => {
      useDevStore.getState().addToolCall(makeToolCall("tc1"));
      useDevStore.getState().addToolCall(makeToolCall("tc2"));
      expect(useDevStore.getState().toolCalls.length).toBe(2);
    });
  });

  describe("updateToolCall", () => {
    it("updates args and result by id", () => {
      useDevStore.getState().addToolCall(makeToolCall("tc1"));
      useDevStore.getState().updateToolCall("tc1", { result: { temp: 22 } });
      expect(useDevStore.getState().toolCalls[0].result).toEqual({ temp: 22 });
    });
  });

  describe("logEvent", () => {
    it("appends events", () => {
      useDevStore.getState().logEvent("TEXT_DELTA", "hello");
      expect(useDevStore.getState().events.length).toBe(1);
      expect(useDevStore.getState().events[0].type).toBe("TEXT_DELTA");
    });

    it("caps at MAX_EVENTS (50)", () => {
      for (let i = 0; i < 60; i++) {
        useDevStore.getState().logEvent(`EVENT_${i}`);
      }
      expect(useDevStore.getState().events.length).toBe(50);
      // Should keep the last 50 (events 10-59)
      expect(useDevStore.getState().events[0].type).toBe("EVENT_10");
    });
  });
});
