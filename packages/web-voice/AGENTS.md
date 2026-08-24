Optional spoken-conversation tier. Published as `@iloveagents/foundry-web-voice`. Wraps the Azure Voice Live SDK (`@iloveagents/foundry-voice-live-react`, from npm) in assistant-ui's `RealtimeVoiceAdapter` contract.

# Architecture

```
src/
  adapter/   ← the protocol layer. No React, no chat surface.
    types.ts          public config; connection/session shapes re-used from the SDK
    session-config.ts mode → Voice Live session; clientToolRegistry → function tools
    speech-queue.ts   markdown → speakable text → sentences → a strict FIFO
    tool-bridge.ts    a ToolExecutor that dispatches into clientToolRegistry
    voice-bridge.ts   VoiceBridge: the RealtimeVoiceAdapter, and both mode policies
  react/     ← everything that needs a tree
    voice-surface.tsx       render-less host; owns useVoiceLive, attaches controls
    relay-answer-watcher.tsx render-less; relay only; feeds the streaming answer to the bridge
    voice-audio-sink.tsx    plays `audioStream` when no avatar is doing it
    voice-mic-button.tsx    composer control — pure assistant-ui state
    voice-status-strip.tsx  composer banner
    voice-avatar.tsx        avatar panel
    install.tsx             installVoice() + <FoundryVoice/>
    voice-module.tsx        createVoiceModule() → a ChatModule
```

# The load-bearing ideas

- **assistant-ui already models realtime voice.** `useLocalRuntime` takes `adapters.voice`;
  `BaseThreadRuntimeCore` merges emitted transcripts into `thread.messages`, owns mute/disconnect,
  and drives `useVoiceControls()` / `useVoiceState()` / `useVoiceVolume()`. We implement one
  interface. Do not build a parallel transcript UI or a thread-injection path — there is nothing to
  inject through, and that is the framework's answer, not a limitation to route around.

- **The hook/imperative mismatch is solved by `createVoiceSession`'s async `setup`.** `connect()`
  returns a `starting` session immediately; the setup awaits the render-less host's `attach()`.
  That is why there is no framework-free session class here and no fork of the SDK. `connect()`
  before the host mounts is a supported ordering (covered by a test); after 10s it ends with an
  actionable error rather than hanging.

- **The two modes differ only in what the bridge emits.**
  - `relay` emits **no transcripts**. `_handleVoiceTranscript` only materialises a message on a
    final transcript, so silence is exactly what stops the user's question appearing twice — once
    as a voice message and once as the real composer turn. The final user transcript goes to
    `submitComposerText` (injected, never imported by `adapter/`), and the answer is spoken with
    `pre_generated_assistant_message`.
  - `realtime` republishes both roles and exposes `clientToolRegistry` as session tools.

- **`turn_detection.create_response` is the whole of relay mode.** If it is ever true in relay,
  both the Voice Live model and the app's agent answer the same question. Host `turnDetection`
  overrides merge key-by-key for exactly this reason — a host retuning `threshold` must not
  silently drop it. Guarded by `session-config.test.ts`.

- **`input_audio_transcription` must be forced on.** The SDK's `DEFAULT_SESSION_CONFIG` omits it,
  and without it relay has nothing to submit and realtime shows only the assistant's side. Both
  failures are silent.

- **The SDK's `ResponseGate` collapses everything queued during one response into a single
  follow-up.** Correct for turns, fatal for a sentence queue — three pending sentences would become
  one. `SpeechQueue` therefore keeps its own FIFO and releases on `response.done`. `cancel()` must
  clear `speaking` too: a cancelled response may never produce the `response.done` that would
  otherwise release the queue, and the session would go silent for good.

- **Something must attach `audioStream`.** The SDK's playback graph terminates in a
  `MediaStreamAudioDestinationNode`, not the speakers. `VoiceLiveAvatar` attaches it; in voice-only
  mode `VoiceAudioSink` does. Remove it and the session is connected, transcribing, and inaudible.

- **Page tools change on navigation.** The session's tool catalogue is re-sent on every
  `clientToolRegistry` change, or the model is left calling tools that no longer exist.

# Boundaries

- `src/adapter/` MUST NOT import `react`, `react-dom`, or `@iloveagents/foundry-web-ui`. It MAY
  import `@assistant-ui/react` for the voice contract itself. Enforced by `layering.test.ts`.
- Nothing in this repo may import **this** package — that is what "optional" means, and
  `OPEN_CORE_GRAPH` in `packages/web-ui/src/__tests__/open-core-guards.test.ts` enforces it.
- Not in the `create-foundry-ui-app` default template, and **not** in the changesets `fixed` group
  — it versions independently of the coordinated four.
- `ChatModule` is typed locally in `voice-module.tsx` rather than imported from
  `@iloveagents/foundry-web-shell`: the shell composes modules, so importing it would invert the
  dependency and force every voice consumer to install the shell.

# What `foundry-web-ui` contributes

Three seams, none of which name Voice Live:

- `lib/voice-adapter-registry.ts` — `registerVoiceAdapter()` / `registerSpeechAdapter()`, mirroring
  `attachment-registry.ts`.
- `ag-ui-runtime-provider.tsx` — passes `adapters.voice` / `adapters.speech` when registered.
  `useLocalRuntime` re-applies its options every render, so a later registration is picked up and
  `capabilities.voice` flips.
- `chat-slots.tsx` — a `composerActions` slot in the trailing control row of both composers.

# Verifying

```bash
pnpm --filter @iloveagents/foundry-web-voice test:unit
pnpm --filter @iloveagents/foundry-web-voice typecheck
```

`adapter/` is driven by a fake `VoiceTransportControls`, so the mode policies, barge-in, the speech
queue and the tool round-trip are all covered without a browser or an Azure resource. A live check
needs a proxy and a Foundry resource — the SDK repo's `examples/` app is the fastest way to get
one.
