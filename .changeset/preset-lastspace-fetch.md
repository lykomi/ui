---
"create-foundry-ui-app": minor
---

Wire `--preset lastspace` end-to-end. The CLI now fetches `@lastspace/preset` from npmjs (public, no auth — the preset itself ships zero proprietary code; the customer-PAT auth boundary is `pnpm install` of `@lastspace/spaces-web-ui` which is gated separately), reads the manifest, and overlays its `files/` on top of the default scaffold. Resulting `package.json` gets `extraDependencies` merged in (sorted), required env vars are reported on completion, and underscore-prefixed dotfiles like `_npmrc` are renamed to `.npmrc` automatically.

Dev escape hatch: set `FOUNDRY_UI_PRESET_LASTSPACE_PATH=<local-path>` to skip the fetch and use a filesystem checkout of the preset (used by lastspace-meta cross-repo dev + integration tests).

Also fixes the default template's Tailwind `@source` paths — they pointed at `../../node_modules` (two levels up) but a scaffolded app's `src/index.css` is one level under the project root, so utilities from `@iloveagents/foundry-*` source-shipping packages were silently purged.
