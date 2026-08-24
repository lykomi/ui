/**
 * The registry is only useful if what it holds actually reaches the runtime.
 *
 * `registerVoiceAdapter` writes to a store, `AGUIRuntimeProvider` reads it,
 * and `useLocalRuntime` flips `capabilities.voice` from the presence of
 * `adapters.voice`. Three hops, each individually plausible and silently
 * skippable — a spread that drops the key leaves a registered adapter that
 * simply never runs, with nothing to see anywhere.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// `theme-store` reads `window.matchMedia` at module-evaluation time, and
// jsdom does not implement it. `vi.hoisted` runs before the imports below,
// which a `beforeAll` would not.
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    });
  }
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAuiState, type RealtimeVoiceAdapter } from "@assistant-ui/react";
import { MemoryRouter } from "react-router";
import { AGUIRuntimeProvider } from "../components/ag-ui-runtime-provider.tsx";
import {
  registerSpeechAdapter,
  registerVoiceAdapter,
  useVoiceAdapterStore,
} from "../lib/voice-adapter-registry.ts";

const noopVoiceAdapter: RealtimeVoiceAdapter = {
  connect: () => ({
    status: { type: "running" },
    isMuted: false,
    disconnect: () => {},
    mute: () => {},
    unmute: () => {},
    onStatusChange: () => () => {},
    onTranscript: () => () => {},
    onModeChange: () => () => {},
    onVolumeChange: () => () => {},
  }),
};

const capabilities = { voice: false, speech: false };

function Probe() {
  capabilities.voice = useAuiState((s) => s.optional.thread?.capabilities.voice ?? false);
  capabilities.speech = useAuiState((s) => s.optional.thread?.capabilities.speech ?? false);
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let priorActEnvironment: boolean | undefined;

beforeAll(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
});

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      // The provider mounts ClientToolExecutor, which calls useNavigate().
      <MemoryRouter>
        <AGUIRuntimeProvider>
          <Probe />
        </AGUIRuntimeProvider>
      </MemoryRouter>,
    );
  });
  // The capability flips in `__internal_setOptions`, a post-render effect.
  await act(async () => {});
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  useVoiceAdapterStore.setState({ voice: null, speech: null });
});

describe("voice adapter registry", () => {
  it("leaves the runtime without voice when nothing is registered", async () => {
    await mount();
    expect(capabilities.voice).toBe(false);
    expect(capabilities.speech).toBe(false);
  });

  it("reaches the runtime once an adapter is registered", async () => {
    registerVoiceAdapter(noopVoiceAdapter);
    await mount();
    expect(capabilities.voice).toBe(true);
  });

  it("keeps the two slots independent", async () => {
    // A host may want read-aloud without a live session, or the reverse.
    registerSpeechAdapter({
      speak: () => ({ status: { type: "running" }, cancel: () => {}, subscribe: () => () => {} }),
    });
    await mount();
    expect(capabilities.speech).toBe(true);
    expect(capabilities.voice).toBe(false);
  });

  it("clears with null", () => {
    registerVoiceAdapter(noopVoiceAdapter);
    expect(useVoiceAdapterStore.getState().voice).toBe(noopVoiceAdapter);
    registerVoiceAdapter(null);
    expect(useVoiceAdapterStore.getState().voice).toBeNull();
  });
});
