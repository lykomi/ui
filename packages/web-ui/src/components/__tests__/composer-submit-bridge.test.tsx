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
vi.mock("@assistant-ui/react", () => ({
  useAui: () => ({
    composer: {
      getState: () => ({ text: draft }),
      setText: (t: string) => {
        draft = t;
        sent.push(t);
      },
      // The real composer clears itself on send.
      send: () => {
        draft = "";
      },
    },
  }),
}));

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
  draft = "";
  useComposerSubmitStore.setState({ pending: null });
});

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
    expect(sent).toEqual(["spoken turn"]);
  });

  it("does not resend a submission that was already taken", async () => {
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("first"));
    // A late-mounting bridge must not replay what is already gone.
    await act(async () => root!.render(<ComposerSubmitBridge key="second" />));
    expect(sent).toEqual(["first"]);
  });

  it("delivers each of several turns in order", async () => {
    // Spoken turns arrive one after another while the panel stays closed.
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("one"));
    await act(async () => submitComposerText("two"));
    await act(async () => submitComposerText("three"));
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

    expect(sent).toContain("what is the notice period?");
    expect(draft, "the draft was eaten by the spoken turn").toBe(
      "a half-written question about clause 9",
    );
  });

  it("leaves the composer empty when there was no draft", async () => {
    await mount(<ComposerSubmitBridge />);
    await act(async () => submitComposerText("spoken turn"));
    expect(draft).toBe("");
  });
});
