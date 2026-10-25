---
"@iloveagents/foundry-web-ui": patch
---

Keep visible navigation branches stationary during refresh. Preserve row DOM
and focus, report busy state accessibly, and retain disabled pagination without
inserting a loading row above already loaded children.

Align initial loading and retry messages with the branch's child rows, using
the same indentation ladder, icon size, typography and vertical spacing.
