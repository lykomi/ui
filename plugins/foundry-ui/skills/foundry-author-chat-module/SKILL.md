---
name: foundry-author-chat-module
description: Author a Foundry UI ChatModule — the unit of composition for bootstrapShell() apps. Use when adding a feature module to an app built on @iloveagents/foundry-web-shell (new pages, tool UIs, theme layers, providers, nav items, or chat persistence), or when wiring an existing feature into the shell instead of hardcoding it.
---

A `ChatModule` is how features plug into a Foundry UI app. The shell stays
generic; modules contribute everything feature-specific. Never hardcode
feature wiring into the shell — compose it as a module.

## The contract (from `@iloveagents/foundry-web-shell`)

```ts
import { defineChatModule, type ChatModule } from "@iloveagents/foundry-web-shell";

export const myModule = defineChatModule({
  name: "my-feature",
  useInit, // hook body run inside the layout — cross-store sync, nav registration
  toolUIs, // ReactNode inside <AGUIRuntimeProvider> — makeAssistantToolUI instances
  layoutExtras, // ReactNode inside the layout — banners, dialogs, popovers
  wrappers, // ComponentType[] applied outer→inner — context providers
  useThemeLayers, // hook returning ThemeLayer[] — stacked on the static theme
  pages, // { path, element }[] — appended to Routes (host app wins on collision)
  fetchInterceptor, // zero-arg installer called before createRoot
  chatConversation, // URL-driven chat persistence (below)
});
```

Then: `bootstrapShell({ modules: [myModule], pages, theme })`.

## Rules that keep modules composable

- `useInit` is a React hook body — rules of hooks apply (no conditionals around it).
- Sidebar nav is mutated from `useInit` via `useNavStore.getState().setConfig(...)` — there is no declarative nav field.
- `wrappers` order is outer→inner from the array; the shell renders
  `BrowserRouter → AuthProvider → wrappers → AGUIRuntimeProvider → toolUIs → Routes`.
- Host-app `pages` beat module `pages` on path collision — never rely on a module owning `/`.
- Chat persistence: provide `chatConversation` with `pathPattern` (regex capturing the conversation id), optional `useStickyConversationId()` (keeps the runtime alive across non-chat navigation), and `buildHistoryAdapter({ urlMatch, aguiThreadId })` returning an assistant-ui `ThreadHistoryAdapter`. Selection: URL match → first registered config → in-memory.
- Tool UIs use `makeAssistantToolUI(...)` (assistant-ui 0.15.x) and are registered by rendering them inside `toolUIs`.

## Verify before writing

Check the current types in `@iloveagents/foundry-web-shell` (the package's
`.d.ts` or [`packages/web-shell/AGENTS.md`](https://github.com/iLoveAgents/foundry-ui/blob/main/packages/web-shell/AGENTS.md))
— the module contract is pre-1.0 and evolves. If your change also touches
`@assistant-ui/*` or `@ag-ui/*` APIs, run the `foundry-verify-agent-apis`
skill first.
