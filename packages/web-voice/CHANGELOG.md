# @iloveagents/foundry-web-voice

## 0.1.3

### Patch Changes

- Updated dependencies [c580d35]
  - @iloveagents/foundry-web-ui@0.23.0
  - @iloveagents/foundry-agent@0.23.0

## 0.1.2

### Patch Changes

- Updated dependencies [9c434f3]
- Updated dependencies [9c434f3]
  - @iloveagents/foundry-web-ui@0.22.0
  - @iloveagents/foundry-agent@0.22.0

## 0.1.1

### Patch Changes

- 90aaa7d: Republish with resolvable dependency ranges.

  `0.1.0` went to npm carrying `workspace:^` for its two sibling dependencies
  instead of the real ranges, so every install of it fails with
  `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` and a scaffolded app cannot install at all.

  The cause was the publish route, not the package: `pnpm publish` rewrites the
  workspace protocol into a concrete range, `npm publish` uploads it verbatim,
  and this first release was pushed by hand because the package did not exist
  yet and OIDC cannot create one. Going back through the release workflow fixes
  it, because that is the path where the rewrite — and `pack:check`, which
  already refuses workspace ranges in a packed tarball — actually run.

## 0.1.0

### Minor Changes

- 8132205: New optional package: spoken conversation, backed by Microsoft Foundry Voice Live.

  `createVoiceModule({ connection: { proxyUrl } })` in `bootstrapShell` adds a mic to the composer and
  lets the user talk to the agent they were already typing to. Implemented as an assistant-ui
  `RealtimeVoiceAdapter`, so the thread, mute, status and level meter are the framework's own.

  Two modes. `relay` (default) uses Voice Live for speech only — the transcript goes through the
  composer, so the app's AG-UI agent answers with its full retrieval and tool surface and the turn
  persists like any other, and the reply is spoken back sentence by sentence (with avatar lip-sync).
  `realtime` hands the conversation to the Voice Live model for sub-second latency, with the app's
  `clientToolRegistry` exposed as session tools.

  Optional by construction: no other package imports it, and it versions outside the coordinated
  `fixed` group. The scaffold template depends on it but only calls `createVoiceModule` when
  `VITE_VOICE_PROXY_URL` is set, so an app that never configures voice drops the package at build
  time.

- eaecd13: A voice stage: while a call is live, the visualiser (or the avatar) takes the
  place of the chat, and the conversation comes straight back when it ends.

  `VoiceVisualizer` is a canvas of concentric rings breathing with the audio
  level. It reads its colours from the app's CSS custom properties rather than
  baking them in — opacity comes from `globalAlpha`, not from assembling
  `rgba()` strings, so `oklch`, `hsl` and hex all work untouched. It sizes its
  backing store in device pixels so the strokes are not soft on a retina
  display, and it stops animating entirely when there is no analyser, the tab is
  hidden, or the user prefers reduced motion.

  `VoiceStage` composes that with the session status and the current line of
  transcript, and registers itself as the `threadSurface` for the duration of a
  call. Pass `stage: false` to keep the transcript visible instead.

  A configured avatar now also asks Azure for a green-screen background.
  `VoiceLiveAvatar` chroma-keys by default, but only the session can request a
  keyable background — without it the service composites onto opaque white, the
  key finds no green, and the result is a white rectangle pasted over the page.
  The panel around it is gone for the same reason: a card behind a cut-out
  redraws exactly the rectangle the keying removed.

### Patch Changes

- 8d36442: Stop both ways a voice session could talk to itself, and stop server tools
  evicting the browser's.

  A finished answer was spoken on a loop. The relay watcher re-reports an answer
  that is already complete — the thread's message array gets a new identity on
  any notification, not only on new text — and clearing the tracked id on
  completion made each of those look like a brand-new answer, reset the sentence
  stream and speak the whole reply again, forever. Answers now carry a "spoken to
  the end" marker, and barge-in retires the interrupted answer rather than
  forgetting which one it was.

  In `realtime`, the assistant on laptop speakers hears itself: its own voice
  trips the service's VAD, which commits a turn, which produces another reply.
  New `halfDuplex` option holds the microphone closed while the assistant speaks.
  Off by default, because it costs barge-in — worth it on speakers, wrong with a
  headset. A VAD misfire's empty transcript no longer becomes a blank user turn
  either.

  Host-declared tools now MERGE with the client tool registry instead of
  replacing it. Declaring an MCP server or a Foundry agent tool adds server-side
  capability; a plain spread silently dropped every `ui_*` and `page_*` tool the
  moment one was declared, leaving the model unable to touch the UI with nothing
  to explain why. Function tools merge by name, so a deliberate override still
  works.

  Utterances are also coalesced to ~140 characters before being spoken. Each one
  is a separate synthesis and every boundary is an audible seam; speaking each
  short sentence the instant it landed turned one answer into four of them.

- 88004d2: Six edge cases from the last review round, mostly about who owns what when a
  call ends or changes hands.

  A response cancelled by barge-in still reports `response.done`, usually after
  the next answer has begun — released then, it freed an utterance while one was
  still being spoken and the two ran together. Completions are matched to the
  response they belong to by id.

  A host removed mid-call (a conditional `<FoundryVoice/>`, a module torn down)
  left assistant-ui holding a running voice session and the speech queue wedged
  for whatever mounted next; losing the host now ends the call. A fatal error
  published together with the disconnect was reported as a clean hang-up, because
  the disconnect effect runs first and `end()` is once-only. And the bare audio
  sink no longer briefly co-owns the stream with an avatar panel that is mounting
  in the same commit.

  Normalisation covers one more construct: a markdown link whose target is still
  arriving. The bracket is already closed so the unclosed-bracket rule does not
  apply, and `LINK` needs the `)` before it can reduce to the label, so the raw
  URL entered the speakable text and then vanished — a shrink, and a shrink after
  the span has been voiced is a re-read.

- b26ca80: Guard the avatar's keyable background, which nothing was checking.

  Only the session can ask the service for a green screen, and `VoiceLiveAvatar`
  chroma-keys by default — so without that request the service composites onto
  opaque white, the key has nothing to remove, and the avatar renders as a white
  box. That was fixed during development and then had no test at all, on either
  of the two paths that build a session.

- 7dbd091: Two bugs a live session found, both in relay mode's speech path.

  Speech could be queued before the transport was up: `helpers` exists from the
  first line of the adapter's `setup`, well before `connect()` resolves, so an
  answer arriving in that window was sent into a socket that was not open yet.
  The utterance was lost, and because the queue then believed it was speaking,
  the `response.done` that would release it never came — the session went silent
  for the rest of its life. Liveness now means connected.

  Connecting voice also read the last answer on screen back to the user. The
  relay watcher is mounted for the whole app lifetime and sees a completed
  answer the moment a session goes live; it now marks whatever is already there
  as delivered, so voice starts by listening rather than reciting.

- 8998af9: A quality pass with two real bugs in it, both found by re-reading, both now
  impossible to reintroduce silently.

  **The microphone can no longer end up hot behind a UI that says muted.**
  Half-duplex used to release its auto-mute whenever the assistant stopped
  speaking — including when the _user_ had asked for mute in the meantime, in
  which case the release reopened a microphone the button said was closed. The
  decision now lives in `HalfDuplexGate`, a pure machine that releases only what
  it took (the user's intent is recorded on the bridge, where the runtime's mute
  controls land) and engages only on the transition into speaking, so an
  explicit mid-answer unmute stands — barge-in is a decision, not a glitch.

  **`<FoundryVoice/>` no longer installs during render.** `installVoice` writes
  to zustand stores, and doing that in a `useState` initializer meant
  StrictMode's double invocation built two bridges and left the discarded one's
  adapter registered while the mounted host owned the other — the first connect
  then waited on a bridge nobody attached to until the 10s timeout. Installation
  is an effect now, with a StrictMode test that reads the store during render
  and asserts it is untouched.

  Also in this pass: a finished session resets the stage's state, so the next
  call cannot open on the previous call's caption and a dead analyser; the
  visualiser observes theme changes itself (root-element attributes and the OS
  scheme) instead of relying on a prop, so it recolours when "system" flips;
  and the avatar's chroma key is tunable via `chromaKey`, with a softer default
  edge than the SDK's, which left a green fringe on the silhouette in live runs.

- 328c174: Two remaining edge cases, both refinements of the previous round's fixes.

  The bare audio sink no longer overlaps a mounting avatar. Deciding this from a
  count the panels keep cannot work on the commit where an avatar appears — the
  count is still zero while `VoiceLiveAvatar` mounts its own audio element — and
  the settled flag added last round only delayed the reverse handoff, leaving
  that case exactly as it was. A panel renders precisely when there is a video
  stream to draw, so an incoming element is now predicted synchronously and the
  sink stands down before it arrives; if nothing registers, the prediction is
  abandoned and the sink takes the audio back, which is what keeps a call audible
  when the surface drawing the avatar is not on screen.

  Normalisation also covers a streaming markdown image. `IMAGE` reduces the
  finished `![alt](url)` to its label, so an incomplete one keeping its `!`
  shrank by that one character when the `)` arrived — and one character is
  enough, because the rewind is by utterance.

- 6fe3159: Six from the final review round, two of them things the user would have heard.

  **An answer ending in bracketed prose lost it.** "…and then choose [yes/no]"
  was spoken without the options. Holding a trailing bracket back is right while
  streaming — one more character could make it a link — but once the answer has
  settled nothing more can arrive, so holding it no longer defers the words, it
  deletes them. Settled text keeps them (and drops the brackets, which a voice
  would otherwise read aloud).

  **A typed draft was destroyed by a spoken turn.** The composer stays editable
  during a call, so the transcript replaced a half-written message and sent it.
  The text is saved and restored around the send.

  A pending ATTACHMENT still goes with the spoken turn — a known limitation
  rather than an oversight, described in the `@iloveagents/foundry-web-ui` entry
  alongside this one.

  Also: a host unmounting while the transport was still connecting could still
  produce a live session with nothing to control it (`connected` is false both
  before a call and during setup, so the earlier guard could not tell them
  apart); the thread surface was cleared without checking it was still ours; and
  `VoiceStage` treated an explicit `null` stream override as an omission and
  handed back the live stream.

- 27c6414: Everything the bot-review loop turned up, most of it about a call that outlives
  what started it.

  **Speech no longer repeats itself.** Two separate paths could re-read text the
  user had already heard. `toSpeakableText` kept a half-arrived citation ("[2,")
  and stripped the completed one, so the speakable text got SHORTER as the answer
  grew; anything voiced across that had to be said again. Normalisation now
  strips the unclosed forms too, which makes the closing bracket a no-op. And the
  sentence stream no longer re-decides what it has already spoken: the
  `MAX_UTTERANCE_CHARS` cut is speculative — it fires only because no sentence
  end is in sight — so re-segmenting the whole answer once the period arrives
  regrouped that span and re-emitted everything after it. A watermark now makes a
  cut permanent the moment it is voiced, as it must be with the audio gone. A
  randomised streaming test asserts no utterance is ever spoken twice.

  **A dead transport no longer silences every later call.** The speech queue
  releases on `response.done`, which a closed socket never sends. `disconnect()`
  freed it; an error or a remote close did not — and since the bridge is
  installed once for the life of the app, the queue stayed `speaking` and
  swallowed every utterance of every subsequent session. One `endCall()` is now
  used by all three routes.

  **A call that outlives its panel stays usable.** The floating bubble can be
  closed while a call continues, so the collapsed launcher shows that it is
  running and can end it, the thread surface takes over in the bubble as it does
  in the expanded chat, and a spoken turn still reaches the agent — the submit
  bridge previously lived inside the open panel and the transcript was dropped.
  Audio keeps playing too: sink ownership follows whether an avatar element is
  actually mounted rather than whether one was configured.

  **The avatar looks like a person again.** The chroma key was tuned by eye to
  soften a green fringe and put `similarity + smoothness` at 0.67 — past the
  subject, which sits at a UV distance of about 0.53. Every colour came out
  semi-transparent (grey 46%, white 43%, skin ~70%): a washed-out ghost. Widening
  the band never helped the fringe anyway, since fringe pixels sit below
  `similarity` and were already cut. `0.44 / 0.08` removes the fringe more
  thoroughly and leaves the subject fully opaque.

  Also: cancelling while the transport is still connecting can no longer leave a
  live microphone; the end-call control is reachable by keyboard; the visualiser
  honours a reduced-motion change made during a call, repaints after a resize,
  follows theme layers applied below `<html>`, and no longer forces layout on
  every animation frame.

- 961ba66: Fix a tool-catalogue update that could be dropped for the life of a session
  (found in review).

  Page tools are registered and cleared on navigation, so the catalogue can
  change between mount and `session.created`. The subscriber returned early
  while the session was not ready — and nothing replayed it once it was, so a
  navigation during connect left the model unable to act on the page the user
  was looking at, or calling a tool that no longer existed, until the next
  registry change happened to arrive.

  The sync now runs on the ready edge as well as on registry changes. Making
  that safe needed the second half: `clientToolRegistry` is a zustand store, so
  subscribers fire on _any_ write, and re-syncing on every one would put a
  `session.update` on a live socket for changes that are not tool changes.
  `ToolSync` compares the serialized catalogue and stays quiet when it matches —
  which also makes the extra ready-edge call free.

  Also: the visualiser re-reads its theme tokens periodically while animating.
  Watching the root element for class / `data-theme` changes catches a light-dark
  toggle, but foundry applies theme _layers_ as inline style on a `ThemeScope`
  element — invisible from the root — so a custom theme swap mid-call left the
  canvas painted in the old palette.

- 0e42af5: Close the last frame in which two elements could play the assistant at once.

  `needsAudioOnlySink` keeps the sink and an avatar apart in every state it can
  observe, but it cannot see the commit in which a panel mounts: the panel
  registers itself in an effect, and the sink is already playing by then. On a
  first mount that is predictable from the arriving video stream and the sink
  stands down early — but when the stage is torn down and rebuilt mid-call, which
  is what closing and reopening the floating chat does, the prediction is already
  spent. One frame of the same stream through two elements is that audio at
  double amplitude: a click, not an echo.

  `VoiceAudioSink` now subscribes to the panel count and pauses itself
  imperatively, in the same effect flush that registers the panel. A re-render
  would land a frame later, which is exactly the frame being closed.

- aafce51: Play locally-decoded audio through Web Audio instead of a MediaStream.

  The SDK's WebSocket path decodes PCM in an AudioWorklet and routes it
  `gain → MediaStreamDestination`, exposing the result as `audioStream`.
  Attaching that to an `<audio>` element works, but it hands the audio to the
  element's playout path — a jitter buffer that rate-adapts to keep itself from
  draining. At the start of a stream the buffer is empty and still converging,
  which is audible on the first reply of a session as a crackle or a slight
  pitch bend, and then never again because the element stays converged.

  The analyser is already in the signal path and passes audio through untouched,
  so it is connected to the context destination instead: same signal, one
  resampling stage and one buffer fewer between the worklet and the speakers.
  Remote tracks (WebRTC transport, and the avatar's WebRTC audio) still play
  through an element, because that is the only thing that can play them —
  connecting the analyser there would play the assistant twice.

- 0d58a1a: Four from review, the sharpest of them about giving up on a connection.

  Cancelling now races the transport instead of waiting it out.
  `controls.connect()` takes no abort signal and is unbounded — a permission
  prompt left open, a transport that never settles — and until it resolved,
  nothing existed that could disconnect it. A cancelled call could therefore hang
  as "connecting" indefinitely and still come up later, with the runtime holding
  no control over it.

  Disposal clears only what the installation still owns. Both registries are
  last-registration-wins, so unmounting an older host stripped a newer one that
  was still mounted, leaving it with no adapter and a composer with no controls.
  Ownership is a token rather than component identity, because two installations
  register the very same components.

  And one more normalisation boundary: a finished `[label]` at the end of the
  text is not finished if the next character is `(`, which makes it a link four
  characters shorter. It waits for the next delta now, which costs nothing —
  `flush()` speaks it regardless at the end of an answer.

- Updated dependencies [8132205]
- Updated dependencies [eaecd13]
- Updated dependencies [c1fa592]
- Updated dependencies [88004d2]
- Updated dependencies [908023d]
- Updated dependencies [27c6414]
  - @iloveagents/foundry-web-ui@0.21.0
  - @iloveagents/foundry-agent@0.21.0
