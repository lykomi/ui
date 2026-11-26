---
"@lykomi/agent": patch
"@lykomi/web-ui": patch
---

Client tools now learn which conversation called them: the runner passes
`{ threadId }` as a second argument to `execute` (`ClientToolCallContext`).
`ui_get_context` uses it to return the calling chat's `chatId` and the page
address `pageUrl`, so an agent can quote both in a support report.
