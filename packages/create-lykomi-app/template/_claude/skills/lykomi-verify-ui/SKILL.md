---
name: lykomi-verify-ui
description: Verify a LYKOMI UI app in a real browser, including responsive layout, keyboard interaction and actual agent context. Use after meaningful UI changes or when debugging interaction failures.
---

Read the project's scripts and environment instructions first. Use its existing
browser tooling; do not assume a particular MCP server or browser CLI is installed.
Start with `pnpm typecheck`, `pnpm build` and `pnpm lint` when those scripts exist.

For a generated starter, `pnpm dev:web` opens the UI without an agent service.
The showcase is interactive offline. A real assistant response requires the
configured `agent/` service; do not describe an offline or mocked response as AI.

## Verify the changed journey

- Exercise the actual controls with the keyboard and pointer. Include focus
  restoration, validation, cancellation, empty states and long values as relevant.
- Inspect screenshots at desktop and narrow widths, in light and dark themes.
  Check clipping, horizontal page overflow and read/edit layout stability.
- For agent context, select a field or row, move into chat and inspect the posted
  `/api/agent` request. Verify live values, selected text, active window and tools.
  The showcase's context inspector previews the same `getAgentState()` projection;
  a preview alone does not prove transport or backend behavior.
- Verify stale context and page tools disappear on navigation. Check opt-outs
  without entering real credentials or private data in a demo.
- If a backend is available, run one real tool interaction and inspect its visible
  result. Otherwise report the unverified backend portion explicitly.

Keep evidence outside application source. Report the tested version, relevant
checks and material limits. Publishing or deployment follows the user's request
and the repository's release workflow; this skill does not authorize either.
