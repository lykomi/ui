import { beforeEach, describe, expect, it } from "vitest";
import { streamingStatusStore } from "../store/streaming-status-store.ts";

const store = () => streamingStatusStore.getState();

describe("streamingStatusStore", () => {
  beforeEach(() => {
    streamingStatusStore.setState({ streamingStatus: { status: "idle" } });
  });

  it("starts with idle status", () => {
    expect(store().streamingStatus).toEqual({ status: "idle" });
  });

  it("updates streaming status", () => {
    store().setStreamingStatus({ status: "calling", toolName: "get_weather" });
    expect(store().streamingStatus).toEqual({
      status: "calling",
      toolName: "get_weather",
    });
  });
});
