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
