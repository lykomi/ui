import { describe, expect, it } from "vitest";
import type { ToolRegistry } from "@iloveagents/foundry-agent";
import { buildVoiceSession, toVoiceLiveTools } from "../adapter/session-config.ts";

function fakeRegistry(
  schemas: { name: string; description?: string; parameters?: Record<string, unknown> }[],
): ToolRegistry {
  return {
    isRegistered: (name) => schemas.some((s) => s.name === name),
    executeTool: async () => "{}",
    getActiveSchemas: () => schemas as ReturnType<ToolRegistry["getActiveSchemas"]>,
  };
}

describe("buildVoiceSession", () => {
  it("stops the Voice Live model answering in relay mode", () => {
    // The whole of relay mode rests on this one flag: with it true, both the
    // realtime model AND the app's agent would answer the same question.
    const session = buildVoiceSession({ mode: "relay" });
    expect(session.turnDetection).toMatchObject({ createResponse: false });
  });

  it("lets the Voice Live model answer in realtime mode", () => {
    const session = buildVoiceSession({ mode: "realtime" });
    expect(session.turnDetection).toMatchObject({ createResponse: true });
  });

  it("always enables input transcription", () => {
    // The SDK's DEFAULT_SESSION_CONFIG omits it. Without a user transcript
    // relay has nothing to submit and realtime shows only one side of the
    // conversation — and both failures are silent.
    for (const mode of ["relay", "realtime"] as const) {
      expect(buildVoiceSession({ mode }).inputAudioTranscription).toBeTruthy();
    }
  });

  it("enables barge-in and keeps the server transcript honest about it", () => {
    expect(buildVoiceSession({ mode: "relay" }).turnDetection).toMatchObject({
      interruptResponse: true,
      autoTruncate: true,
    });
  });

  it("sends no tools unless the host opted in", () => {
    const session = buildVoiceSession({ mode: "realtime" });
    // Absent is not the same as `[]`: an empty array asserts "there are no
    // tools", which is only true when the host actually said so.
    expect(session.tools).toBeUndefined();
    expect(session.toolChoice).toBeUndefined();
  });

  it("maps registered client tools onto Voice Live function tools", () => {
    const registry = fakeRegistry([
      { name: "ui_navigate", description: "Go somewhere", parameters: { type: "object" } },
    ]);
    const session = buildVoiceSession({ mode: "realtime", registry });
    expect(session.tools).toEqual([
      {
        type: "function",
        name: "ui_navigate",
        description: "Go somewhere",
        parameters: { type: "object" },
      },
    ]);
    expect(session.toolChoice).toBe("auto");
  });

  it("tolerates a schema with no description or parameters", () => {
    const tools = toVoiceLiveTools(fakeRegistry([{ name: "bare" }]));
    expect(tools).toEqual([{ type: "function", name: "bare", description: "", parameters: {} }]);
  });

  it("keeps the client tools when a host adds a server-side MCP tool", () => {
    // The shape a downstream app has: the browser owns ui_* / page_*, while
    // the corpus and graph live behind an MCP endpoint the service calls
    // itself. A plain spread would drop the client tools the moment MCP was
    // declared, and the model would lose the UI with nothing to explain why.
    const registry = fakeRegistry([{ name: "ui_navigate" }]);
    const session = buildVoiceSession({
      mode: "realtime",
      registry,
      overrides: {
        tools: [
          { type: "mcp", serverLabel: "example_server", serverUrl: "https://example.invalid/mcp" },
        ],
      },
    });

    expect(session.tools).toEqual([
      { type: "function", name: "ui_navigate", description: "", parameters: {} },
      { type: "mcp", serverLabel: "example_server", serverUrl: "https://example.invalid/mcp" },
    ]);
  });

  it("lets a host replace one client tool by name without losing the rest", () => {
    const registry = fakeRegistry([{ name: "ui_navigate" }, { name: "ui_set_theme" }]);
    const session = buildVoiceSession({
      mode: "realtime",
      registry,
      overrides: {
        tools: [{ type: "function", name: "ui_navigate", description: "Custom", parameters: {} }],
      },
    });

    expect(session.tools).toHaveLength(2);
    expect(session.tools).toContainEqual({
      type: "function",
      name: "ui_navigate",
      description: "Custom",
      parameters: {},
    });
  });

  it("lets a host retune VAD without silently re-enabling the model", () => {
    // The trap this guards: a host sets `turnDetection: { threshold: 0.8 }`,
    // a whole-object replace drops `createResponse: false`, and relay mode
    // quietly starts answering twice.
    const session = buildVoiceSession({
      mode: "relay",
      overrides: { turnDetection: { threshold: 0.8, removeFillerWords: true } },
    });
    expect(session.turnDetection).toMatchObject({
      threshold: 0.8,
      removeFillerWords: true,
      createResponse: false,
      interruptResponse: true,
    });
  });

  it("still lets a host override the mode's own choice deliberately", () => {
    const session = buildVoiceSession({
      mode: "relay",
      overrides: { turnDetection: { createResponse: true } },
    });
    expect(session.turnDetection).toMatchObject({ createResponse: true });
  });

  it("honours turn detection switched off entirely", () => {
    const session = buildVoiceSession({ mode: "relay", overrides: { turnDetection: null } });
    expect(session.turnDetection).toBeNull();
  });

  it("passes through unrelated host settings", () => {
    const session = buildVoiceSession({
      mode: "relay",
      overrides: { instructions: "Be brief.", voice: "en-US-AvaMultilingualNeural" },
    });
    expect(session.instructions).toBe("Be brief.");
    expect(session.voice).toBe("en-US-AvaMultilingualNeural");
    expect(session.turnDetection).toMatchObject({ createResponse: false });
  });
});
