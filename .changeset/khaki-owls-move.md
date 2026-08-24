---
"@iloveagents/foundry-web-ui": patch
---

Don't send the user's draft — or their attachment — with a submitted turn.

`ComposerSubmitBridge` sends through the ordinary composer, and the composer
stays editable while a module is using it. A voice call is the case: the
transcript took the composer as it stood, replacing a half-written message and
carrying whatever was attached along with a sentence it had nothing to do with.

Text is saved and restored around the send. Attachments are lifted out first
and put back after, but only when every one of them can be put back — re-adding
needs the original `File`, and lifting out a set that cannot be fully restored
would turn "sent with the wrong message" into "lost".
