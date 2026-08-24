---
"@iloveagents/foundry-web-ui": patch
---

Don't send the user's draft with a submitted turn.

`ComposerSubmitBridge` sends through the ordinary composer, and the composer
stays editable while a module is using it. A voice call is the case: the
transcript replaced a half-written message and sent it. The text is saved and
restored around the send.

Attachments are deliberately NOT preserved. There is no way to send without
them, so preserving them means lifting them out and adding them back —
asynchronous work through a host adapter, which produced four distinct defects
in short order (a cancellation check that dropped them, two turns interleaving
their save/restore, a stalled upload wedging every later turn, and a timed-out
operation landing on a later turn). Keeping this synchronous is what makes it
easy to be sure about, so a file attached but not yet sent still goes with the
spoken turn, as it did before. Worth revisiting if the composer grows a way to
send without attachments.
