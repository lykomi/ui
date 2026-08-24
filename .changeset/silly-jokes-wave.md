---
"@iloveagents/foundry-web-voice": minor
---

A voice stage: while a call is live, the visualiser (or the avatar) takes the
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
