---
"@iloveagents/foundry-web-ui": patch
---

Keep components and handlers out of the agent state projection. A nav group's `meta` may hold what a panel renders (items with icon components and action handlers); once such a group was active, the adapter's `structuredClone` of the projection threw and every message in that chat failed in the browser before a request was made. `getAgentState()` now projects nav meta, page meta and content to plain data: an object holding a component or a handler is left out whole, and anything a clone already accepted passes through unchanged.
