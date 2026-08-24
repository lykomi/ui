/**
 * Unit tests for the error-shape sniffing helpers in
 * ``tool-fallback.tsx``. The component itself renders a collapsible
 * card which is awkward to assert from node-land without
 * ``@testing-library/react`` (not a workspace dep); exercising the
 * pure helpers covers the interesting logic. The helpers are
 * exported with an underscore prefix specifically for this use.
 */

import { describe, expect, it } from "vitest";
import { _detectErrorResult, _extractErrorMessage } from "../components/tool-fallback.tsx";

describe("_detectErrorResult", () => {
  it("returns false for null / undefined", () => {
    expect(_detectErrorResult(null)).toBe(false);
    expect(_detectErrorResult(undefined)).toBe(false);
  });

  it("returns false for normal strings", () => {
    expect(_detectErrorResult("Found 3 documents.")).toBe(false);
    expect(_detectErrorResult("")).toBe(false);
  });

  it("detects the agent-framework `Error: ...` serialization", () => {
    expect(_detectErrorResult("Error: search backend 500")).toBe(true);
    expect(_detectErrorResult("  Error: with leading whitespace")).toBe(true);
  });

  it("does NOT false-positive on strings containing the word Error mid-text", () => {
    // This is the failure the anchored regex exists to prevent.
    expect(_detectErrorResult("A passage about Error Handling in Python")).toBe(false);
    expect(_detectErrorResult("Error Boundaries in React")).toBe(false);
  });

  it("detects MCP canonical `{isError: true, content: [...]}`", () => {
    expect(
      _detectErrorResult({
        isError: true,
        content: [{ type: "text", text: "forbidden" }],
      }),
    ).toBe(true);
  });

  it("returns false when isError is false/undefined", () => {
    expect(_detectErrorResult({ isError: false, content: [] })).toBe(false);
    expect(_detectErrorResult({ data: [] })).toBe(false);
  });

  it("detects structured `{error: 'msg'}`", () => {
    expect(_detectErrorResult({ error: "boom" })).toBe(true);
  });

  it("does not treat an empty `error` string as an error", () => {
    // Avoids false-positives where a tool echoes `error: ""` in a success
    // envelope. Narrow by design.
    expect(_detectErrorResult({ error: "" })).toBe(false);
  });

  it("detects `{error: {message: 'msg'}}`", () => {
    expect(_detectErrorResult({ error: { message: "timed out" } })).toBe(true);
  });
});

describe("_extractErrorMessage", () => {
  it("strips the `Error: ` prefix from string errors", () => {
    expect(_extractErrorMessage("Error: search backend 500")).toBe("search backend 500");
  });

  it("returns `Execution failed` when the string is just `Error:`", () => {
    expect(_extractErrorMessage("Error:")).toBe("Execution failed");
  });

  it("returns null for normal strings (so caller falls back)", () => {
    expect(_extractErrorMessage("All good")).toBeNull();
  });

  it("extracts `error: 'msg'` directly", () => {
    expect(_extractErrorMessage({ error: "timed out" })).toBe("timed out");
  });

  it("extracts nested `error.message`", () => {
    expect(_extractErrorMessage({ error: { message: "invalid token" } })).toBe("invalid token");
  });

  it("extracts the first text item from MCP content arrays", () => {
    expect(
      _extractErrorMessage({
        isError: true,
        content: [
          { type: "text", text: "forbidden" },
          { type: "text", text: "second" },
        ],
      }),
    ).toBe("forbidden");
  });

  it("returns null when no recognisable payload is present", () => {
    expect(_extractErrorMessage({ random: "shape" })).toBeNull();
  });
});
