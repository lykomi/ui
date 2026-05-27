---
"@iloveagents/foundry-web-shell": patch
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-primitives": patch
---

shell: URL is authoritative for the runtime threadId — fixes
resume-creates-new-conversation race

`ChatConversationAwareRuntime` previously computed
`effectiveThreadId = sticky ?? urlMatch ?? freshIdRef.current`.
When the user navigated from one chat to another via a Recents
click, the synchronous render that followed the URL change had:

- `urlMatch = B` (read from the now-updated `useLocation`)
- `sticky = A` (the active-chat-store hadn't been updated by
  `useTrackActiveChatFromUrl`'s `useEffect` yet — effects run
  AFTER the commit phase)

`sticky ?? urlMatch` picked `A` (the previous chat). The AG-UI
adapter was constructed with `threadId = A`. The first message the
user sent went to `/api/agent` with `thread_id = A`, the middleware
created a new row keyed by `A`... wait actually no, here's what
happens — the runtime mints a fresh runner UUID when given a
mismatched threadId; that fresh UUID became a new conversation row,
appearing as "Untitled chat" at the top of the sidebar while the
URL still said `/chat/B`. Two active-looking dots: one for `B`
(NavLink URL match), one for the new row (statusDot from the
updated active-chat-store after the lazy ensure ran).

Swap the priority: `urlMatch ?? sticky ?? freshIdRef.current`. The
URL is authoritative whenever it's set (i.e. on `/chat/<id>`
routes), eliminating the stale-sticky race entirely. `sticky` is
still consulted as the second-priority fallback for non-chat
routes (`/spaces`, `/tasks`) so the popout chat stays "live" while
the user browses workspaces — that's the original purpose of
`useStickyConversationId` and it's preserved.
