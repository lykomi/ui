/**
 * The rule: locally-decoded PCM goes out through Web Audio; a remote track
 * does not. Get the second half wrong and a WebRTC session plays twice.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDirectAudioOutput } from "../react/use-direct-audio-output.ts";

function fakeGraph() {
  const destination = { id: "speakers" } as unknown as AudioDestinationNode;
  const context = { destination } as unknown as AudioContext;
  const connect = vi.fn();
  const disconnect = vi.fn();
  const analyser = { connect, disconnect } as unknown as AnalyserNode;
  return { context, analyser, destination, connect, disconnect };
}

function Harness({
  enabled,
  context,
  analyser,
}: {
  enabled: boolean;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
}) {
  useDirectAudioOutput(enabled, context, analyser);
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let prior: boolean | undefined;

beforeAll(() => {
  prior = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = prior;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(node: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(node));
}

describe("useDirectAudioOutput", () => {
  it("routes decoded PCM to the speakers", async () => {
    const g = fakeGraph();
    await mount(<Harness enabled context={g.context} analyser={g.analyser} />);
    expect(g.connect).toHaveBeenCalledWith(g.destination);
  });

  it("stays out of the way for a remote track", async () => {
    // WebRTC and avatar audio are played by an element; connecting here too
    // would play the assistant twice.
    const g = fakeGraph();
    await mount(<Harness enabled={false} context={g.context} analyser={g.analyser} />);
    expect(g.connect).not.toHaveBeenCalled();
  });

  it("disconnects on unmount, so a reconnect cannot stack outputs", async () => {
    const g = fakeGraph();
    await mount(<Harness enabled context={g.context} analyser={g.analyser} />);
    await act(async () => root?.unmount());
    root = null;
    expect(g.disconnect).toHaveBeenCalledWith(g.destination);
  });

  it("survives a closed context", async () => {
    const g = fakeGraph();
    (g.connect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("context closed");
    });
    await expect(
      mount(<Harness enabled context={g.context} analyser={g.analyser} />),
    ).resolves.not.toThrow();
  });

  it("does nothing without a graph", async () => {
    await expect(mount(<Harness enabled context={null} analyser={null} />)).resolves.not.toThrow();
  });
});
