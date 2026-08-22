React UI core for the AG-UI protocol starter — hooks, stores, extension-point registries, assistant-ui adapter shim, ChatPanel, sidebar, layout components. Published as `@iloveagents/foundry-web-ui`.

Depends on `@iloveagents/foundry-web-primitives` (leaf primitives) and `@iloveagents/foundry-agent` (cross-runtime agent transport: AG-UI runner, vanilla stores, MSAL subpath, service-fetch factory).

# Architecture

Relative imports only (no `@/` alias). Cross-package consumers use `@iloveagents/foundry-web-ui`.

```
src/
  components/   ← UI components (sidebar, chat, tool-panel, markdown, etc.)
  lib/          ← React-coupled stores, the assistant-ui adapter shim,
                  the React MSAL provider, hooks, utilities.
  ui/           ← shadcn/radix primitives (tooltip, collapsible, dropdown, dialog, popover, select)
  index.ts      ← barrel export (all public API)
```

# Import Boundary (enforced by guard test)

- MUST NOT import from `@ltwlf/spaces-web-ui` (or any commercial downstream package)
- MUST NOT use `@/` path aliases (relative imports only)
- MUST NOT import from `features/` or `pages/` (those are app-level)
- Cross-runtime transport (AG-UI runner, registry, vanilla stores, MSAL token store) lives in `@iloveagents/foundry-agent`. Re-exporting it from this package is forbidden by the no-shim rule.

# Lists (the DataTable family)

One family under `components/data-table/`, TanStack Table underneath. The
split that matters:

- **`facets.ts` owns the semantics** — how a cell becomes facet keys, OR
  within a facet, AND across facets, counts from the faceted row model, and
  the `ColumnMeta` declaration merge every other file reads. Change meaning
  here, nowhere else.
- **`data-table.tsx` owns what is drawn** — TanStack visibility, then the
  width (`meta.breakpoint`, measured on the table via `useElementWidth`) and
  mode (`meta.showIn`) gates. That gating is NOT TanStack visibility: user
  column choices ride in the URL, and mixing the two would let a narrow pane
  persist a hidden column. Anything that must agree with the screen (the chat
  agent's view of the list) reads `onRenderedColumnsChange`. Gating removes
  the cell from the tree, so a stateful cell loses its state when the list
  narrows past its breakpoint — keep cell state in the row, not the cell.
- **`styles.css` carries what a host's CSS scanner cannot infer** — frozen
  columns, their opaque row tints, the scrolled-x seam, capped menus. Hosts
  import the stylesheet; components stay class-only. A frozen cell must stay
  _under_ the sticky header (`z-index` 1 vs the header row's 10) — there is a
  source-reading guard test for exactly that regression.
- **`use-pinned-offsets.ts`** measures rendered header widths (a column's
  `size` is a hint, not the used width) and hands back one stable ref callback
  per column, so React does not detach on every render.

# Extension Points

SPACES and other feature modules plug in via these registries:

- **NavItem.dnd** (`nav-config.ts`): drag-and-drop behavior on sidebar items
- **NavItem.dimmed / NavItem.badge** (`nav-config.ts`): visual modifiers on sidebar items
- **NavGroupCreateAction** (`nav-config.ts`): "+ New" actions on nav group headers
- **NavGroup.collapsedRail** (`nav-config.ts`): module-supplied renderer for the collapsed sidebar rail. Used when a group's collapsed view isn't a flat icon list — e.g. Spaces' "header link + active workspace's root".
- **NavFooterAction** (`nav-store.ts`): action buttons in the sidebar footer
- **Panel renderer registry** (`tool-panel-store.ts`): custom content renderers for the side panel (PDF, entity pages)
- **Citation handler** (`citationStore` in `@iloveagents/foundry-agent`): handles `[n]` citation clicks in markdown
- **Tool UI** (via `makeAssistantToolUI` from `@assistant-ui/react`): custom rendering for agent tools

# Adding Extension Points

1. Define interface in the relevant store (e.g., `PanelRendererEntry`)
2. Add registry array + register function to the store
3. Component reads from registry and delegates rendering
4. Feature module calls `registerX()` at init time

# AG-UI Adapter

- This package ships an `AGUIAdapterSDK` shim (`src/lib/ag-ui-adapter.ts`) that implements assistant-ui's `ChatModelAdapter` by wrapping `AGUIRunner` from `@iloveagents/foundry-agent`. The runner does the protocol; the shim translates `RunnerEvent`s into cumulative `ChatModelRunResult` yields.
- `@assistant-ui/react` is pinned to **0.15.x**. We do not use the official `@assistant-ui/react-ag-ui` provider — see the root `AGENTS.md` for the blockers (it drops CUSTOM/RAW events, so heartbeats and citations vanish).
- Tool UIs use `makeAssistantToolUI(...)`. The legacy `useAssistantToolUI` hook is no longer used.
- Runtime state is read through the `aui` client: `useAui()`, `useAuiState()`, `useAuiEvent()`. The per-scope runtime hooks (`useComposerRuntime`, `useThreadRuntime`, `useMessageRuntime`, …) were **removed in 0.15** — reach the composer via `useAui().composer` (`setText`, `send`, `addAttachment`).

# Client-Side Tools

Tools live in `clientToolRegistry` (vanilla zustand store in `@iloveagents/foundry-agent`). The runner sends schemas to the backend, intercepts `TOOL_CALL_END` for any client-side tool, executes it locally, and replays the assistant + tool messages on the next turn with the same `toolCallId`.

- **`ui_*`** — global tools registered at app init in `lib/client-tools.ts` (`ui_navigate`, `ui_set_theme`, `ui_open_panel`, `ui_select_item`, `ui_update_content`, `ui_highlight`, `ui_get_context`, `ui_confirm`).
- **`page_*`** — page-specific tools registered via `usePageTools([{ name, description, parameters, execute }])`.

Custom tool UIs are top-level `makeAssistantToolUI(...)` constants rendered as children inside the `AssistantRuntimeProvider` tree (see `client-tool-executor.tsx`).

# Attachments

`FileAttachmentAdapter` (`src/lib/attachment-adapter.ts`) base64-encodes **both images and documents** (PDF/DOCX) and emits file parts, which the AG-UI adapter converts to `binary` message parts (`mimeType` + `data` + `filename`). Documents used to degrade to a `[Attached file: …]` text stub; that silently discarded the bytes, so the model received a filename it could not read. Pass `{ documentMode: "metadata" }` to restore the stub for models that genuinely cannot accept file input.

Hosts must bound persistence: the bytes ride along on every turn of the live conversation and reach whatever stores chat history. Elide them server-side (lastspace does this in `chat_message_store.py::_elide_inline_media`) or a single attached PDF can breach a document-size ceiling and wedge the thread.
