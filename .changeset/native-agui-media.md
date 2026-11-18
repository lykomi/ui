---
"@lykomi/agent": minor
"@lykomi/web-ui": minor
"@lykomi/web-shell": minor
"create-lykomi-app": patch
---

Upgrade AG-UI client and protocol peers to 1.0.5. Send attachments and captured app images as native media parts, retain media in tool results, and declare the client's Zod peer in generated apps. Consumers must upgrade their AG-UI dependencies together.

Add an optional `cancelRun(threadId, runId)` callback for explicit server cancellation of detached runs. Wait for the callback before ending local cancellation, report failures, and prevent new browser tool dispatch once Stop is requested.
