---
"@iloveagents/foundry-web-voice": patch
---

Guard the avatar's keyable background, which nothing was checking.

Only the session can ask the service for a green screen, and `VoiceLiveAvatar`
chroma-keys by default — so without that request the service composites onto
opaque white, the key has nothing to remove, and the avatar renders as a white
box. That was fixed during development and then had no test at all, on either
of the two paths that build a session.
