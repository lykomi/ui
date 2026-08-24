---
"@iloveagents/foundry-web-ui": minor
---

Add two host-injectable seams that nothing in this package uses on its own.

`registerVoiceAdapter()` / `registerSpeechAdapter()` (mirroring `registerAttachmentAdapter`) let a
host supply assistant-ui's `RealtimeVoiceAdapter` and `SpeechSynthesisAdapter`; the AG-UI runtime
provider passes them through to `useLocalRuntime` only when registered, so a runtime without them
is byte-for-byte the runtime that existed before and assistant-ui keeps reporting the capability as
unavailable.

`registerChatSlots({ composerActions })` adds a third chat slot, rendered in the trailing control
row of both the full composer and the floating bubble — for controls that are an alternative _way
to send_ rather than content about the thread.
