/**
 * A submission must be sent exactly once, by whichever bridge is mounted.
 *
 * Two separate failures meet here. A voice call outlives the floating panel
 * that started it — the launcher badge exists because the microphone keeps
 * running while collapsed — so a spoken turn needs a consumer that outlives
 * the panel too; with the bridge scoped to the open panel, the transcript
 * landed in the pending store and stayed there, and each further turn
 * overwrote it. But making the consumer outlive the panel means more than one
 * bridge can be mounted at once, and a read-then-clear consumer lets every one
 * of them send the same text.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ComposerSubmitBridge } from "../composer-submit-bridge.tsx";
import { submitComposerText, useComposerSubmitStore } from "../../lib/composer-submit-store.ts";

const sent: string[] = [];

let draft = "";
let attachments: { id: string; file?: File }[] = [];
const sentWith: { text: string; attachments: string[] }[] = [];

const composer = {
  getState: () => ({ text: draft, attachments }),
  setText: (t: string) => {
    draft = t;
    sent.push(t);
  },
  // The real composer clears text AND attachments on send.
  send: () => {
    sentWith.push({ text: draft, attachments: attachments.map((a) => a.id) });
    draft = "";
    attachments = [];
  },
};
// Stable, as the real client is: a fresh object per render would re-run the
// bridge's effect on every render.
vi.mock("@assistant-ui/react", () => ({ useAui: () => ({ composer }) }));

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
  sent.length = 0;
  sentWith.length = 0;
  draft = "";
  attachments = [];
  useComposerSubmitStore.setState({ pending: null });
});

/** The bridge lifts attachments out asynchronously, so its work spans ticks. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(node: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(node));
}

describe("ComposerSubmitBridge", () => {
  it("sends a queued submission once", async () => {
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("what is the notice period?"));
    await settle();
    expect(sent).toEqual(["what is the notice period?"]);
  });

  it("sends only once when several bridges are mounted", async () => {
    // The expanded chat and the floating bubble can both be on screen.
    await mount(
      <>
        <ComposerSubmitBridge />
        <ComposerSubmitBridge />
        <ComposerSubmitBridge />
      </>,
    );
    await act(async () => submitComposerText("spoken turn"));
    await settle();
    expect(sent).toEqual(["spoken turn"]);
  });

  it("does not resend a submission that was already taken", async () => {
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("first"));
    await settle();
    // A late-mounting bridge must not replay what is already gone.
    await act(async () => root!.render(<ComposerSubmitBridge key="second" />));
    expect(sent).toEqual(["first"]);
  });

  it("delivers each of several turns in order", async () => {
    // Spoken turns arrive one after another while the panel stays closed.
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("one"));
    await settle();
    await act(async () => submitComposerText("two"));
    await settle();
    await act(async () => submitComposerText("three"));
    await settle();
    expect(sent).toEqual(["one", "two", "three"]);
  });
});

describe("composer submit store", () => {
  it("grants a claim to exactly one caller", () => {
    submitComposerText("only once");
    const id = useComposerSubmitStore.getState().pending!.id;
    const claim = () => useComposerSubmitStore.getState().claim(id);
    expect([claim(), claim(), claim()]).toEqual([true, false, false]);
  });

  it("puts the user's draft back after sending a spoken turn", async () => {
    // The composer stays editable during a call. Overwriting a half-written
    // message with the transcript and sending posts the transcript AND takes
    // the draft — and any attachment — with it.
    await mount(<ComposerSubmitBridge />);
    draft = "a half-written question about clause 9";

    await act(async () => submitComposerText("what is the notice period?"));
    await settle();

    expect(sent).toContain("what is the notice period?");
    expect(draft, "the draft was eaten by the spoken turn").toBe(
      "a half-written question about clause 9",
    );
  });

  it("leaves the composer empty when there was no draft", async () => {
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("spoken turn"));
    await settle();
    expect(draft).toBe("");
  });

  it("sends the user's pending attachment with the turn — a known limitation", () => {
    // Not preserving attachments is a decision, recorded here so it cannot be
    // mistaken for an oversight. There is no way to send without them
    // (`SendOptions` is `{ startRun, steer }`), so preserving them means
    // lifting them out and adding them back — asynchronous work through a host
    // adapter that produced four separate defects in short order. Keeping this
    // synchronous is what makes it easy to be sure about.
    return (async () => {
      await mount(<ComposerSubmitBridge />);
      const file = new File(["x"], "contract.pdf", { type: "application/pdf" });
      attachments = [{ id: "contract.pdf", file }];
      draft = "half a thought";

      await act(async () => submitComposerText("spoken turn"));

      expect(sentWith).toHaveLength(1);
      expect(sentWith[0]!.attachments).toEqual(["contract.pdf"]);
      // The text half IS preserved, and that is the common case.
      expect(draft).toBe("half a thought");
    })();
  });
});
