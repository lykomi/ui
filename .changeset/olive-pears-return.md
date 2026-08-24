---
"create-foundry-ui-app": patch
---

Stop the scaffold pinning an `@assistant-ui` transitive, which stopped generated
apps building.

`pnpm-workspace.yaml` in the template pinned `@assistant-ui/store` to `0.2.10`
and `@assistant-ui/tap` to `0.5.16`. Pinning one node of a graph the rest of
which keeps moving is what broke it: `@assistant-ui/react` floated under its
caret to a build whose `core` peer-requires `store@^0.3.0`, the pin held `store`
at `0.2.10`, and every generated app died on a missing
`@assistant-ui/store/client` specifier — `pnpm build` failing immediately after
a clean `pnpm install`.

The pins are gone. assistant-ui's own ranges resolve a consistent graph, which
is what the template's package.json comment already said; the workspace file
had been contradicting it.

`smoke:starter` could never have caught this: it writes a `pnpm.overrides` block
into the generated package.json, and pnpm then uses that INSTEAD of the
workspace file — neutralising the very pin that was breaking real users. It now
asserts the template is free of those pins before it does so.
