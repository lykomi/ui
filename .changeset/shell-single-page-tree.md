---
"@iloveagents/foundry-web-shell": patch
"@iloveagents/foundry-web-ui": patch
---

Shell: render the page in ONE tree so expanding chat can't remount it

`ShellLayout` rendered `{page}` in two different JSX branches
(`isExpanded ? … : …`), so every chat expand/collapse unmounted the
entire page subtree and mounted a fresh one. Pages holding live state
lost it — the embedded Office editor tore down its WOPI session and the
user's text selection vanished on the very gesture (expanding chat) used
to ask the agent about that selection.

The page column now renders at one fixed slot; only its classes change
between layouts, and the conditional siblings collapse to `false` in
fixed JSX slots so the page's fiber identity survives.

Also: the chat launcher now carries the sparkles (AI) mark instead of a
speech bubble, and its accessible name is "Ask the AI".
