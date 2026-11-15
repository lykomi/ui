---
name: lykomi-build-workbench
description: Compose LYKOMI UI tabs, panels, tables and guided processes with context that matches the visible work. Use when adding a workbench surface or connecting its selection to an agent.
---

Check the installed package declarations before using an API. Read the relevant
section of [the UX contract](references/form-ux.md) for lists or processes.

## Windows

Use `createWindowStore`, `useWindows` and `WindowWorkbench` from
`@lykomi/web-ui/windows`. The framework owns layout, selection, pinning and
ordering; the application owns the content and persistence. Use stable window
IDs, return active-window data through `getWindowContext`, and guard closing
dirty work. Keep the store outside the route if work must survive navigation.

## Tables

Compose `useDataTable`, `DataTable`, `DataTableToolbar` and the selection and
pagination components. Use stable row IDs. Do not build another table or filter
system. Agent context must reflect the filtered rows and selected IDs. Use
`DataTable.onRenderedColumnsChange` for the rendered columns: responsive column
gating is not equivalent to TanStack's visibility state.

App-owned context can use a keyed `useAppStore.setContextItem` with an ephemeral
source page. Remove it on unmount. Read live state inside tools and return
structured results. A filter tool should change the same table state as the UI.

## Processes

Use `ProcessGuide` with explicit statuses, `currentStepId`, `selectedStepId` and
an active `agentContext`. Inspecting a step does not complete it. Host actions
validate and advance the process; the shared agent tools only inspect guidance.
Explain blocked steps visibly. Disable context registrations for hidden previews.

Generated starters include examples in `src/showcase/`. Check tab/panel changes,
filtering, narrow layouts, route cleanup and the actual outgoing AG-UI state.
