---
name: lykomi-build-agent-forms
description: Build forms in a LYKOMI UI app with automatic field context, explicit editing, validation and guarded agent tools. Use when adding or changing forms or field-level agent interactions.
---

Read [the shared form contract](references/form-ux.md) before changing the form.
Inspect the installed `@lykomi/web-primitives` and `@lykomi/web-ui` declarations;
use the project's pinned API rather than an unreleased example.

## Compose the form

- Use `FormLayout`, `FormHeader`, `Field` and the shared inputs. Open existing
  records in view mode; Edit replaces values with controls in the same slots.
- A `Field` around a named control, or `ReadOnlyField`, automatically supplies
  the selected field's label, current value and text selection to AG-UI.
  Do not add page-specific focus listeners or a second field-context store.
- Give controls semantic `name` values and associate labels with IDs. An
  unwrapped `Input` is deliberately not an agent field (search and chat also
  use inputs).
- Use `agentContext={false}` for sensitive fields. Passwords are excluded by
  the built-in collector. Custom context projections must also omit secrets.

## Keep updates app-owned

Register edit tools with `usePageTools` only while the form can be edited.
Validate arguments at execution time, restrict writable field names, and compare
the expected value with the current draft before replacing it. A stale tool call
must return a conflict instead of overwriting a newer user edit.

Agent changes should enter the same unsaved draft as manual edits. Save, Cancel,
permissions and persistence belong to the application. Preserve dirty input on
validation or network failure. Label in-memory demo saving honestly.

In a generated starter, inspect `src/showcase/form-example.tsx` and
`src/pages/use-draft-tools.ts` for working examples. Verify the outgoing AG-UI
request after selecting text and entering chat, including on a narrow viewport.
