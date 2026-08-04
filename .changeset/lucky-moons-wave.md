---
"@iloveagents/foundry-web-shell": patch
---

Fix an infinite login loop: load the chat config inside the auth boundary

`ShellAuth` is `ShellApp`'s child, so the boot-time `loadChatConfig` effect added in 0.11.0 ran *before* sign-in. With no cached session the agent fetch 401s, exhausts its refresh retry, and calls `recoverFromHardAuthFailure` → `loginRedirect` → remount → repeat. The load now happens in a component rendered inside `ShellAuth`, so a token exists by the time it runs.
