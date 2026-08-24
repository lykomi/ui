---
"@iloveagents/foundry-web-voice": patch
---

Play locally-decoded audio through Web Audio instead of a MediaStream.

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
