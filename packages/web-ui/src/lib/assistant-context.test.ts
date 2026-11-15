import { describe, expect, it } from "vitest";
import { serializeAssistantContext, MAX_ASSISTANT_CONTEXT_LENGTH } from "./assistant-context.ts";
describe("bounded assistant context", () => {
  it("rejects payloads that would flood a help turn", () => {
    expect(() =>
      serializeAssistantContext({ transcript: "x".repeat(MAX_ASSISTANT_CONTEXT_LENGTH) }),
    ).toThrow("too large");
  });
  it("accepts a compact JSON snapshot, never functions or cycles", () => {
    expect(serializeAssistantContext({ pending: null, status: "loading" })).toBe(
      '{"pending":null,"status":"loading"}',
    );
    expect(() => serializeAssistantContext({ execute: () => 1 })).toThrow("JSON data");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => serializeAssistantContext(circular)).toThrow();
  });
});
