Optional spoken-conversation tier. Published as `@iloveagents/foundry-web-voice`. Wraps the Azure Voice Live SDK (`@iloveagents/foundry-voice-live-react`, from npm) in assistant-ui's `RealtimeVoiceAdapter` contract.

# Architecture

```
src/
  adapter/   ← the protocol layer. No React, no chat surface.
    types.ts          public config; connection/session shapes re-used from the SDK
    session-config.ts mode → Voice Live session; clientToolRegistry → function tools
    speech-queue.ts   markdown → speakable text → coalesced utterances → a strict FIFO
    tool-bridge.ts    a ToolExecutor that dispatches into clientToolRegistry
    half-duplex.ts    HalfDuplexGate: when the mic closes/opens around assistant speech
    voice-bridge.ts   VoiceBridge: the RealtimeVoiceAdapter, both mode policies, user-mute intent
  react/     ← everything that needs a tree
    voice-surface.tsx       render-less host; owns useVoiceLive, attaches controls,
                            registers the stage as threadSurface while a call is live
    relay-answer-watcher.tsx render-less; relay only; feeds the streaming answer to the bridge
    voice-stage.tsx         replaces the thread during a call (visualiser or avatar + caption)
    voice-visualizer.tsx    theme-token canvas rings; observes theme changes on every
                            ancestor (ThemeScope is not <html>) and repaints when static
    voice-launcher-badge.tsx live-call indicator + end control on the collapsed launcher
    use-direct-audio-output.ts plays decoded PCM via Web Audio (analyser → destination)
    voice-audio-sink.tsx    <audio> element for remote (WebRTC) tracks only
    voice-mic-button.tsx    composer control — pure assistant-ui state
    voice-status-strip.tsx  composer banner
    voice-avatar.tsx        avatar surface; soft chroma-key default, no card around a cut-out
    voice-ui-store.ts       session facts for OUR components (incl. reset between sessions)
    install.tsx             installVoice() + <FoundryVoice/> (installs in an effect, never render)
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

- **Locally-decoded PCM goes out through Web Audio, remote tracks through an element.** Attaching
  the SDK's `audioStream` to an `<audio>` element routes it through the element's playout jitter
  buffer, whose rate-adaptation is audible on the first reply of every session. The analyser is
  already in the signal path, so `useDirectAudioOutput` connects it to the destination instead —
  but ONLY for PCM the browser decoded itself. WebRTC and avatar audio are remote tracks an
  element must play; connecting the analyser there too plays the assistant twice (guarded by
  `direct-audio-output.test.tsx`).

- **Half-duplex is a pure gate, not a pair of booleans.** `HalfDuplexGate` closes the mic while
  the assistant speaks (speakers-mode echo protection) with two rules that inline state got
  wrong: release only what the gate took — never a mute the USER holds, or the mic ends up hot
  behind a UI that says muted — and engage only on the transition into speaking, so a mid-answer
  unmute (a barge-in decision) stands. The user's intent comes from the bridge (`isUserMuted`),
  recorded where the runtime's mute controls land.

- **The stage takeover is the registration itself.** While a call is live the surface registers
  `VoiceStage` as web-ui's `threadSurface` slot; clearing it hands the thread back. The stage
  reads everything from `voice-ui-store` so it can be registered as a bare component reference —
  and that store is RESET on disconnect (`resetVoiceSessionState`), or the next call opens on the
  previous call's caption and a dead analyser.

- **A configured avatar must ask Azure for a keyable background.** `VoiceLiveAvatar` chroma-keys
  by default, but only the session can request the green screen — without it the service
  composites onto opaque white and the key has nothing to remove. `session-config` injects it
  unless the host chose a background; the panel applies a softer-than-SDK key
  (`smoothness 0.25`) because the stock edge left a green fringe in live runs; hosts tune via
  `VoiceConfig.chromaKey`.

- **Page tools change on navigation.** The session's tool catalogue is re-sent on every
  `clientToolRegistry` change, or the model is left calling tools that no longer exist. What is
  re-sent is the MERGED catalogue (`sessionTools`), never the registry's half: `session.update`
  REPLACES the list, so sending client tools alone withdraws every MCP and Foundry agent tool the
  host configured.

- **Both composers, or neither.** A module registers into the chat slots once, and `ChatContent`
  and `ChatBubble` are separate trees that must both honour them. The bubble gaining
  `composerActions` without `threadSurface` meant a call could be started there and then ran with
  the transcript still showing. Guarded by `composer-surface-parity.test.ts` in web-ui.

- **A call outlives the panel that started it.** `VoiceSurface` is a layout extra, so closing the
  bubble takes every control away while the microphone stays open. `VoiceLauncherBadge` fills the
  `launcherBadge` slot so the collapsed launcher shows the call and can end it — and web-ui mounts
  `ComposerSubmitBridge` for the whole life of `ChatBubble`, not just the open panel, or a relay
  turn spoken while collapsed lands in the pending store and is never sent. Several bridges can
  therefore be mounted at once, which is why the store hands out an atomic `claim()`.

- **Normalisation must never SHORTEN as the answer grows.** `toSpeakableText` strips an unclosed
  bracket and an unmatched backtick as well as their completed forms, so the arrival of the closing
  character changes nothing. Without that, text already voiced had to be re-read when a citation
  closed. Growth is harmless; only shrinkage forces a rewind.

- **Every route out of a call must free the speech queue.** The bridge is installed once for the
  life of the app, so its state outlives a call. The queue releases on `response.done`, which a
  dead transport never sends — left `speaking` it swallows every utterance of every LATER call.
  `endCall()` is the one definition, used by `disconnect()`, `handleError()` and `handleClosed()`.

- **Audio routing follows the SESSION, not the display choice.** A host may configure an avatar and
  hide its panel (`avatar: false`); the voice still arrives as a remote track that only an element
  can play, so `needsElement` derives from `session.avatar`, and an audio-only `VoiceAudioSink`
  mounts when the panel is off. Deriving it from `showAvatar` makes the assistant silent with no
  error anywhere. Sink ownership then keys off `avatarPanels` — a count the panels keep — because
  the stage is a chat slot and the surrounding surface decides whether it is rendered at all.

# Boundaries

- `src/adapter/` MUST NOT import `react`, `react-dom`, or `@iloveagents/foundry-web-ui`. It MAY
  import `@assistant-ui/react` for the voice contract itself. Enforced by `layering.test.ts`.
- Store writes NEVER happen during render. `installVoice` mutates zustand stores, so
  `<FoundryVoice/>` installs in an effect — a `useState` initializer runs twice under StrictMode
  and leaves the discarded bridge's adapter registered while the mounted host owns the other
  (guarded by `install.test.tsx`).
- Nothing in this repo may import **this** package — that is what "optional" means, and
  `OPEN_CORE_GRAPH` in `packages/web-ui/src/__tests__/open-core-guards.test.ts` enforces it.
- **Not** in the changesets `fixed` group — it versions independently of the coordinated four.
- The `create-foundry-ui-app` template DOES depend on this package and import `createVoiceModule`;
  it is gated at runtime on `VITE_VOICE_PROXY_URL`, so with the variable unset the call is
  unreachable and the bundler drops the package. "Optional" here is a runtime property enforced by
  tree-shaking, not an absence from the scaffold.
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
