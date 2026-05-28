---
"@iloveagents/foundry-web-ui": patch
---

web-ui: popover New Thread didn't actually start a new thread

When the user clicks the compose / SquarePen "New Thread" button in
the floating chat popover (`ChatBubble` on workspace/entity pages with
`navigateToChat: false`), the runtime was supposed to discard the
current thread and start fresh. In practice the popover header
subtitle flipped to "New conversation" but the message list stayed
populated with the prior chat's messages — the button looked like a
no-op.

Root cause: `useNewConversation` bumped the AGUIRuntime inner key to
remount, but the parent `RuntimeBody`'s `effectiveThreadId`
(`urlMatch ?? sticky ?? freshIdRef.current`) stayed pinned to the
sticky active-chat id. The history adapter on the fresh inner mount
immediately loaded the same chat's messages from the server →
nothing visibly changed.

The sidebar "New Thread" button avoided this only by side-effect —
it navigates to `/`, which triggers `useTrackActiveChatFromUrl` to
clear sticky. The popover preserves the user's workspace context and
doesn't navigate, so sticky never cleared.

Fix: add a tiny DI store `useChatLifecycleStore` exposing an
`onNewConversation` callback. `useNewConversation` invokes it BEFORE
`resetThread` so the host (spaces-web-ui in lastspace) can clear its
sticky id; the next render's `effectiveThreadId` has already advanced
to a freshly-minted UUID, and the history adapter binds to that
instead of re-hydrating the prior chat.

Customers that don't track sticky ids leave `onNewConversation`
unset; the call site no-ops gracefully.
