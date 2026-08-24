/**
 * The end-call control has to stay reachable without a mouse.
 *
 * This badge exists because a call outlives the panel that started it — the
 * microphone keeps capturing after the bubble is closed. A control that only
 * a pointer can reach would leave keyboard and screen-reader users with a live
 * microphone and no way to stop it, which is a worse failure than the one the
 * badge was added to fix.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { VoiceLauncherBadge } from "../react/voice-launcher-badge.tsx";

const source = readFileSync(
  join(import.meta.dirname, "..", "react", "voice-launcher-badge.tsx"),
  "utf8",
);

describe("VoiceLauncherBadge reveal", () => {
  // Source-level, deliberately: the reveal is expressed in Tailwind classes and
  // jsdom loads no stylesheet, so a focus() assertion here would pass whether
  // the control were display-hidden or not. What can be checked is the rule.
  it("never hides the control with display:none", () => {
    // `hidden` (display:none) makes an element non-focusable, so it leaves the
    // tab order and any focus-visible rule on it becomes dead code.
    const classes = source.slice(source.indexOf("<button"));
    expect(classes).not.toMatch(/\bhidden\b/);
    expect(classes).not.toMatch(/display:\s*none/);
  });

  it("reveals on focus as well as hover", () => {
    expect(source).toContain("group-hover:opacity-100");
    expect(source).toContain("group-focus-within:opacity-100");
  });

  it("does not swallow clicks aimed at the launcher while invisible", () => {
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("group-hover:pointer-events-auto");
  });
});

const stubModel: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: "text", text: "ok" }] };
  },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let priorAct: boolean | undefined;

beforeAll(() => {
  priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("VoiceLauncherBadge rendering", () => {
  it("renders nothing when no call is running", async () => {
    // A chat without voice, and a chat between calls, must look untouched.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <Harness>
          <VoiceLauncherBadge />
        </Harness>,
      );
    });
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("");
  });
});

function Harness({ children }: { children: React.ReactNode }) {
  const runtime = useLocalRuntime(stubModel);
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
