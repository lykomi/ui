# Voice

LYKOMI UI can be talked to. Voice is a separate, optional package —
[`@lykomi/web-voice`](../packages/web-voice/README.md) — so an app that does not want
it carries none of it.

This document is the _why_: which mode to choose, what each one costs, and the two constraints that
are properties of the platform rather than of this code.

## Where voice actually lives

Not here. `@assistant-ui/react` 0.15 already models a realtime voice session:

| Piece                                             | What it does                                      |
| ------------------------------------------------- | ------------------------------------------------- |
| `useLocalRuntime(model, { adapters: { voice } })` | takes a `RealtimeVoiceAdapter`                    |
| `BaseThreadRuntimeCore`                           | merges emitted transcripts into `thread.messages` |
| `useVoiceControls()`                              | `connect` / `disconnect` / `mute` / `unmute`      |
| `useVoiceState()` / `useVoiceVolume()`            | status, muted, listening-vs-speaking, level       |

So the integration is: implement `RealtimeVoiceAdapter` over Azure Voice Live. `web-ui`
contributes two seams and no voice knowledge — `registerVoiceAdapter()` and a `composerActions`
chat slot. Any other voice backend registers the same way and gets the same mic button.

## Choosing a mode

### `relay` (the default)

Voice Live is the ears and the mouth; **your agent stays the brain**.

```
speech ──► Voice Live (STT) ──► composer ──► your AG-UI agent ──► answer
                                                                   │
speaker ◄── Voice Live (TTS, avatar) ◄── sentence by sentence ◄─────┘
```

The transcript is submitted through the composer, so the turn is an ordinary turn: retrieval,
tools, citations, the tool cards, and persistence through whatever `ThreadHistoryAdapter` the host
configured. Nothing about the answer path changes because the question arrived by microphone.

Two documented Voice Live features carry it:

- `turn_detection.create_response: false` — the Voice Live model never answers.
- `response.create` with `pre_generated_assistant_message` — speak exactly this text, no inference.
  The avatar lip-syncs it like any other reply.

Cost: first audio waits for your agent's first sentence. The answer is spoken sentence by sentence
as it streams, so that is the _first sentence_, not the whole answer.

### `realtime`

The Voice Live model holds the conversation. Sub-second, genuinely conversational, and it can call
your client-side tools — the schemas in `clientToolRegistry` are sent with the session and calls
dispatch through the same registry the typed chat uses.

Cost: it answers from its instructions and its tools. It has no access to your retrieval stack
unless a tool gives it one.

### The honest comparison

|                          | `relay`             | `realtime`          |
| ------------------------ | ------------------- | ------------------- |
| Grounded in your corpus  | yes, via your agent | only via tools      |
| Tool cards in the thread | yes                 | tools run, no cards |
| Persisted to history     | yes                 | **no** — see below  |
| Latency to first word    | your agent's        | sub-second          |
| Barge-in                 | yes                 | yes                 |

## Two platform constraints

**Realtime turns are session-scoped.** `disconnectVoice()` clears `_voiceMessages`; they never
reach a `ThreadHistoryAdapter`. That is assistant-ui's design for realtime voice. `relay` has no
such limit, which is the main reason it is the default. Pass `onTranscript` to persist realtime
turns yourself.

**You need a proxy.** A browser cannot set an `Authorization` header on a WebSocket, so the
credential cannot live in the bundle. Run
[`@iloveagents/foundry-voice-live-proxy-node`](https://www.npmjs.com/package/@iloveagents/foundry-voice-live-proxy-node)
(a container is published) and point `connection.proxyUrl` at it. Per-user MSAL tokens and Foundry
Agent Service both work through it. An `apiKey` in the browser is a local-development shortcut and
nothing else.

## What we did not use, and why

The Voice Live SDK also ships
[`@iloveagents/foundry-voice-live-agui`](https://www.npmjs.com/package/@iloveagents/foundry-voice-live-agui),
which maps a Voice Live session onto AG-UI runs (`VoiceLiveAgent extends AbstractAgent`). It is the
right choice for a CopilotKit-style consumer that renders `agent.messages` directly.

It is not the right choice here. assistant-ui's `LocalRuntime` is pull-driven — an assistant
message only exists in response to a user append — while a voice turn is server-initiated, and the
voice contract it exposes consumes _transcripts_, not runs. Routing through the AG-UI mapper would
mean flattening its runs straight back into transcripts, and would pull the workspace's `@ag-ui/*`
singletons from `^0.0.52` to `>=0.0.58` plus an `rxjs` peer for no behaviour gained. Worth
revisiting if assistant-ui ever grows a run-shaped voice surface.

## While the call is live

The conversation is replaced by the voice stage — a theme-aware visualiser, or the avatar
chroma-keyed straight onto the page — and comes back the moment the call ends. The thread is
hidden, not unmounted, so nothing about it is lost. `stage: false` opts out.

Two options earn their keep in a real room: `halfDuplex` mutes the microphone while the assistant
speaks so laptop speakers cannot make it answer its own voice (it never overrides a mute the user
set, and an explicit mid-answer unmute stands — barge-in is a decision), and `chromaKey` tunes the
avatar's green-screen edge.

## Trying it

`packages/web-voice` is fully unit-tested against a fake transport — mode policies, barge-in, the
speech queue, the tool round-trip — so `pnpm test` covers the logic without Azure. A live session
needs a Foundry resource and a proxy; the SDK repo's `examples/` app is the quickest way to stand
both up.
