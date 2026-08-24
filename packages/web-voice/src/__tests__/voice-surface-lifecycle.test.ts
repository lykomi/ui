/**
 * Two orderings the surface has to get right, both source-level because they
 * are about WHERE code sits relative to other effects and cleanups.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "..", "react", "voice-surface.tsx"), "utf8");

describe("voice surface lifecycle", () => {
  it("ends the call when the host unmounts", () => {
    // The disconnected-state effect cannot run after unmount, so a host
    // removed mid-call — a conditional <FoundryVoice/>, a module torn down —
    // would leave assistant-ui holding a running voice session and the speech
    // queue wedged for whatever mounts next. Retracting the controls is not
    // enough; the call has to be ended.
    const attach = source.indexOf("bridge.attach(controls)");
    expect(attach).toBeGreaterThan(-1);
    const cleanup = source.slice(attach, attach + 600);
    expect(cleanup).toContain("bridge.handleClosed()");
  });

  it("reports a fatal error before calling the close clean", () => {
    // A fatal error and the disconnect can be published together. The
    // disconnect effect is declared first, so it would end the session as
    // "finished" before the error effect ran — and assistant-ui's end() is
    // once-only, so the reason could never be corrected afterwards. A consumer
    // would see a clean hang-up where the call had actually failed.
    const disconnectEffect = source.indexOf('live.connectionState === "disconnected"');
    const block = source.slice(
      disconnectEffect,
      source.indexOf("handleClosed()", disconnectEffect),
    );
    expect(block).toContain("bridge.handleError(live.error)");
  });
});
