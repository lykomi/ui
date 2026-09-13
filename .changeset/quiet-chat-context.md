---
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": patch
---

Show current request context beside the composer and replace duplicated workbench history with an explicit conversation history view. Keep empty chat layouts bounded and preserve the conversation while browsing content.

Keep hidden list descendants in the navigation context model via `NavItem.childrenHidden`, selecting the visible list owner without rendering its rows. Show the last-location subline consistently for workspace and non-workspace conversations.

Add an optional `contextDetails` chat slot for grouped capabilities in the context flyout. Make conversation history discoverable from the chat home, default its filter to the current workspace, and support last-entity sublines.
