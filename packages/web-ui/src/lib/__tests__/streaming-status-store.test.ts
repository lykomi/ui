import { beforeEach, describe, expect, it } from "vitest";
import { useStreamingStatusStore } from "../streaming-status-store";

const store = () => useStreamingStatusStore.getState();

describe("streaming-status-store", () => {
  beforeEach(() => {
    useStreamingStatusStore.setState({ streamingStatus: { status: "idle" } });
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
