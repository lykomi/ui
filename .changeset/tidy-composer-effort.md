---
"@iloveagents/foundry-web-ui": patch
---

Composer: the reasoning-effort picker stops crowding the message input in
narrow composers. The trigger keeps the level ("High") and drops the mode
prefix ("Auto · ") when its container is narrow, via a container query —
the full label stays in `aria-label` and `title`. Also gives the running
status ("Thinking") bottom padding in the chat bubble, where it sat on the
composer's border.
