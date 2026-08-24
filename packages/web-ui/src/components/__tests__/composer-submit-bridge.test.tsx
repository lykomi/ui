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
  clearAttachments: async () => {
    attachments = [];
  },
  addAttachment: async (file: File) => {
    attachments = [...attachments, { id: file.name, file }];
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

  it("does not send the user's attachment with a spoken turn", async () => {
    // The damaging half: text can be retyped, a file cannot be un-sent.
    await mount(<ComposerSubmitBridge />);
    const file = new File(["x"], "contract.pdf", { type: "application/pdf" });
    attachments = [{ id: "contract.pdf", file }];

    await act(async () => submitComposerText("what is the notice period?"));
    await settle();

    expect(sentWith).toHaveLength(1);
    expect(sentWith[0]!.text).toBe("what is the notice period?");
    expect(sentWith[0]!.attachments, "the user's file rode along").toEqual([]);
  });

  it("puts the attachment back afterwards", async () => {
    await mount(<ComposerSubmitBridge />);
    const file = new File(["x"], "contract.pdf", { type: "application/pdf" });
    attachments = [{ id: "contract.pdf", file }];

    await act(async () => submitComposerText("spoken turn"));
    await settle();

    expect(attachments.map((a) => a.id)).toEqual(["contract.pdf"]);
  });

  it("sends rather than destroys an attachment it cannot put back", async () => {
    // Re-adding needs the original File, and an attachment that has been
    // through an adapter may not have one. The choice is then between sending
    // it with the wrong message and losing it outright — and losing it is
    // worse, so it is left in place and goes with the turn, exactly as before
    // this change. Written down because it is a deliberate limit, not an
    // oversight: the composer clears on send, so "still there afterwards" is
    // not an outcome available here.
    await mount(<ComposerSubmitBridge />);
    attachments = [{ id: "already-uploaded" }];

    await act(async () => submitComposerText("spoken turn"));
    await settle();

    expect(sentWith).toHaveLength(1);
    expect(sentWith[0]!.attachments, "it was silently dropped rather than sent").toEqual([
      "already-uploaded",
    ]);
  });
});
