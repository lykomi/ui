# @iloveagents/foundry-web-shell

Browser bootstrap and layout package for Foundry UI apps.

`web-shell` mounts the SPA with `bootstrapShell`, wires routes/modules, applies
theme layers, chooses auth, and hosts `@iloveagents/foundry-web-ui`.

## Usage

```tsx
import { bootstrapShell } from "@iloveagents/foundry-web-shell";

bootstrapShell({
  pages,
  modules,
  theme,
});
```

The default auth adapter is MSAL-backed and reads `VITE_MSAL_CLIENT_ID`,
`VITE_MSAL_AUTHORITY`, and `VITE_MSAL_API_SCOPE`. Starter/demo apps can pass a
custom `authProvider` and `agentFetch` for local unauthenticated development.

The workbench is the standard layout for every route. The root page renders in
the chat pane. Mark other chat pages with `chatOnly: true` so they render there
even without a chat persistence module; other routes render in the content pane.

This package publishes built ESM JavaScript and `.d.ts` declarations.

### Side chat initial state

The desktop side chat starts as a collapsed rail on content pages. Set
`defaultSideChatCollapsed: false` to start it expanded instead:

```tsx
bootstrapShell({ modules, pages, defaultSideChatCollapsed: false });
```

The default is `true`. Chat-only routes always show the conversation. Returning
from a chat-only route restores the configured side-chat default; manual toggles
remain in effect while browsing content pages. Compact layouts keep their
content/chat pane switcher. Opening the rail preserves the mounted conversation
and composer draft.
