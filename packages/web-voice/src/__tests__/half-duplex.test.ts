import { describe, expect, it } from "vitest";
import { HalfDuplexGate, type HalfDuplexInputs } from "../adapter/half-duplex.ts";

const base: HalfDuplexInputs = {
  enabled: true,
  speaking: false,
  sdkMuted: false,
  userMuted: false,
};

describe("HalfDuplexGate", () => {
  it("closes the mic when the assistant starts speaking, opens it after", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base })).toBe("none");
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    expect(gate.next({ ...base, speaking: true, sdkMuted: true })).toBe("none");
    expect(gate.next({ ...base, sdkMuted: true })).toBe("unmute");
    expect(gate.next({ ...base })).toBe("none");
  });

  it("does nothing while disabled", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, enabled: false, speaking: true })).toBe("none");
    expect(gate.next({ ...base, enabled: false })).toBe("none");
  });

  it("never unmutes over the user's own mute — the mic-hot regression", () => {
    // Assistant speaks, gate auto-mutes. The user then asks for mute
    // themselves (runtime shows muted; SDK already is). When the assistant
    // stops, releasing the auto-mute would reopen a microphone the UI says
    // is closed — the user gets recorded while the button says otherwise.
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    // user clicks mute while auto-mute is engaged
    expect(gate.next({ ...base, speaking: true, sdkMuted: true, userMuted: true })).toBe("none");
    // assistant stops speaking — the mute MUST stand
    expect(gate.next({ ...base, sdkMuted: true, userMuted: true })).toBe("none");
    // and stays standing on later ticks
    expect(gate.next({ ...base, sdkMuted: true, userMuted: true })).toBe("none");
  });

  it("does not engage over a mute the user already holds", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true, sdkMuted: true, userMuted: true })).toBe("none");
    // ...and therefore has nothing to release either.
    expect(gate.next({ ...base, sdkMuted: true, userMuted: true })).toBe("none");
  });

  it("lets a mid-answer unmute stand — barge-in is a decision", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    // The user unmutes while the assistant is still talking: they are
    // choosing interruption over echo protection. Re-muting on the next
    // tick would make barge-in impossible.
    expect(gate.next({ ...base, speaking: true })).toBe("none");
    expect(gate.next({ ...base, speaking: true })).toBe("none");
    // The next assistant turn re-engages as normal.
    expect(gate.next({ ...base })).toBe("none");
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
  });

  it("releases an outstanding auto-mute when the feature is switched off", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    expect(gate.next({ ...base, enabled: false, speaking: true, sdkMuted: true })).toBe("unmute");
  });

  it("keeps the user's mute when switched off mid-auto-mute", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    expect(
      gate.next({ ...base, enabled: false, speaking: true, sdkMuted: true, userMuted: true }),
    ).toBe("none");
  });

  it("forgets everything on reset, so a new session starts clean", () => {
    const gate = new HalfDuplexGate();
    expect(gate.next({ ...base, speaking: true })).toBe("mute");
    gate.reset();
    // No outstanding auto-mute to release...
    expect(gate.next({ ...base, sdkMuted: true })).toBe("none");
    // ...and the speaking edge re-arms.
    const gate2 = new HalfDuplexGate();
    gate2.next({ ...base, speaking: true });
    gate2.reset();
    expect(gate2.next({ ...base, speaking: true })).toBe("mute");
  });
});
