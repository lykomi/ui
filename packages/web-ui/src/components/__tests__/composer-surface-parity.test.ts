/**
 * The two composers must stay in step.
 *
 * `ChatContent` (expanded) and `ChatBubble` (floating) are separate trees that
 * both render the composer slots. A module registers into those slots once and
 * reasonably expects both surfaces to honour them — so a capability added to
 * one and forgotten in the other is a silent hole, not a cosmetic difference.
 *
 * That is exactly how voice broke: the bubble gained `composerActions`, so a
 * call could be STARTED there, but never read `threadSurface`, so the call ran
 * with the ordinary transcript on screen and no visualiser — while the voice
 * surface, seeing the stage registered, correctly suppressed its own floating
 * panel. Neither half was wrong on its own.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMPOSERS = ["assistant-chat.tsx", "chat-bubble.tsx"];

function source(file: string): string {
  return readFileSync(join(import.meta.dirname, "..", file), "utf8");
}

describe("composer surface parity", () => {
  it.each(COMPOSERS)("%s offers the composer actions slot", (file) => {
    expect(source(file)).toContain("ChatComposerActionsSlot");
  });

  it.each(COMPOSERS)("%s can hand its viewport to a thread surface", (file) => {
    // If a call can start from this composer, the stage has to be able to
    // take the thread's place in it.
    const text = source(file);
    expect(text).toContain("useChatThreadSurface");
    expect(text).toContain("<ThreadSurface />");
  });

  it.each(COMPOSERS)("%s hides the transcript while a surface owns the view", (file) => {
    // Rendering the surface on top is not enough: an unhidden viewport keeps
    // the transcript reachable to assistive tech and can scroll behind it.
    const text = source(file);
    expect(text).toContain('ThreadSurface && "invisible"');
    expect(text).toContain("aria-hidden={ThreadSurface ? true : undefined}");
  });

  it("keeps a submit consumer mounted in the bubble even when the panel is closed", () => {
    // A voice call outlives the panel that started it: the launcher badge
    // exists because the microphone keeps running while collapsed. If the only
    // ComposerSubmitBridge lives inside the open-panel branch, a spoken turn on
    // a non-root page lands in the pending store and is never sent, and each
    // further turn overwrites it. Structural, because the failure is *where*
    // the element sits rather than what it renders.
    const text = source("chat-bubble.tsx");
    const bridge = text.indexOf("<ComposerSubmitBridge />");
    const panel = text.indexOf("{isOpen && (");
    expect(bridge, "chat-bubble.tsx must mount ComposerSubmitBridge").toBeGreaterThan(-1);
    expect(panel, "expected an isOpen panel branch to exist").toBeGreaterThan(-1);
    expect(bridge, "the bridge must be mounted outside the open-panel branch").toBeLessThan(panel);
  });

  it.each(COMPOSERS)("%s hides its scroll control while a surface owns the view", (file) => {
    // The transcript keeps its scroll position under the surface — deliberate,
    // it comes back untouched — but its scroll button must not float over the
    // surface. Both carry z-10 and the button renders later, so DOM order puts
    // a chevron on top of the visualiser that scrolls something invisible.
    expect(source(file)).toMatch(/\{!ThreadSurface &&/);
  });
});
