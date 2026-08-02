---
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-ui": minor
---

Fix two chat defects, both pre-existing:

- **Client-side tool results looked unanswered.** The AG-UI client folds the
  streamed assistant message (tool calls included) into its own history, and
  the runner appended a second copy — so the follow-up carried the same
  `toolCallId` twice against one tool result. The model saw an unanswered call,
  re-issued the tool (duplicate card in the UI) and then reported that it
  "didn't complete", even though the tool had succeeded. The runner now only
  synthesizes what the client hasn't already recorded.
- **Attached documents lost their contents.** `FileAttachmentAdapter` sent
  PDFs/DOCX as a `[Attached file: ...]` text stub, so the model got a filename
  and no bytes — it would then hunt for the document in the backend and report
  that it couldn't read it. Documents are now sent as file parts like images.
  Pass `{ documentMode: "metadata" }` to restore the old behaviour for models
  that cannot accept file input.
