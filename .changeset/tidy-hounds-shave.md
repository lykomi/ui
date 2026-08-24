---
"@iloveagents/foundry-web-voice": patch
---

Close the last frame in which two elements could play the assistant at once.

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
