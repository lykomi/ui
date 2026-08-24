---
"@iloveagents/foundry-web-voice": minor
---

New optional package: spoken conversation, backed by Microsoft Foundry Voice Live.

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
