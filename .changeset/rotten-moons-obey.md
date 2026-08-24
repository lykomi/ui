---
"@iloveagents/foundry-web-voice": patch
---

Two remaining edge cases, both refinements of the previous round's fixes.

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
