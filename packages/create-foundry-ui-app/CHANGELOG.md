# create-foundry-ui-app

## 0.6.0

### Minor Changes

- 8f2c829: Scaffolded apps can talk, switched on by configuration rather than a flag.

  `VITE_VOICE_PROXY_URL` is the switch: set it and a microphone appears in the
  composer; leave it unset and `createVoiceModule` is never referenced, so the
  whole voice tier — and the Voice Live SDK behind it — is tree-shaken out of
  the build. Verified: no Voice Live code appears in a default scaffold's
  bundle.

  That is why there is no `--voice` flag. A flag makes you choose at scaffold
  time, before you know whether you want it, and choosing wrong means editing
  the app later. Configuration means the decision is reversible, costs nothing
  until made, and cannot produce a first run where clicking a microphone errors
  because no proxy exists.

  The default is `relay`, so a spoken turn is an ordinary turn answered by the
  app's own agent, with its tools and history intact.

### Patch Changes

- 6fe3159: Check the default scaffold bundle before the second build overwrites it.

  `smoke:starter` builds twice — once as generated, once with voice enabled — and
  was reading `dist` only after the second. The assertion that voice is absent
  from a default build was therefore inspecting the voice-ENABLED bundle, and
  would have passed however badly tree-shaking regressed.

- 0d58a1a: Scan the voice package for Tailwind classes.

  Voice is optional at runtime, not at build time — the package is always a
  dependency — so a scaffolded app that sets `VITE_VOICE_PROXY_URL` rendered a
  microphone, stage and launcher badge whose utilities Tailwind had never been
  told to look for, and they came out unstyled. Scanning it costs nothing when
  voice is off, since Tailwind emits only what something references.

  `smoke:starter` now builds the scaffold twice — once as generated, and once
  with voice switched on — and checks the CSS actually carries those utilities.
  The single default build could only ever exercise the half of the template
  where voice does not exist, which is how this got through.

## 0.5.2

### Patch Changes

- d9e66ea: fix(template): scaffold the assistant-ui version the packages actually require

  The generated app asked for `@assistant-ui/react ^0.12.25` while
  `@iloveagents/foundry-web-ui` declares `^0.15.1` as a peer. pnpm warns about an
  unmet peer and installs anyway, so every scaffolded app carried an
  assistant-ui two minor lines behind the packages it was scaffolding — a latent
  break that stayed invisible until web-ui used a 0.15-only export and the
  starter build died on `"groupPartByType" is not exported`.

  The template now tracks the peer range, and no longer pins
  `@assistant-ui/store` / `tap` at all: those pins had to move in lock-step with
  `@assistant-ui/react` and nothing made that happen, which is precisely how the
  drift accumulated. assistant-ui's own dependency ranges resolve a consistent
  graph without help. A unit test now fails when the template's range and the
  peer disagree, so the next drift is caught at the range, not at a build.

## 0.5.1

### Patch Changes

- 0d4f73b: Docs + packaging polish: restore the `__PROJECT_NAME__` sentinel in the scaffold template README (Prettier had normalized it to `**PROJECT_NAME**`, breaking every generated app's title) and guard it with a test + `.prettierignore`; bump template foundry pins to the current release and enforce parity in `pack:check`; add npm metadata (description, keywords, repository, homepage, bugs) to the four runtime packages; extend the open-core guard to ban `@ltwlf/*` downstream imports; sync web-shell/agent AGENTS.md with the actual public API; add CONTRIBUTING.md + SECURITY.md and README badges/prerequisites.
- 0efb5c1: Scaffold the current package line: template pins move to the versions the workspace publishes, and `pnpm changeset:version` now syncs them automatically (`scripts/sync-template-versions.mjs`). The template isn't a workspace member, so Changesets can't bump it — previously it silently fell a release behind and new apps scaffolded stale packages.

## 0.5.0

### Minor Changes

- 4d62cfd: Add a bundled `foundry-iq` preset for Azure AI Search Foundry IQ knowledge bases and remove the stale private preset path from the public CLI surface.

## 0.4.1

### Patch Changes

- ab0b38d: Stamp generated apps with the template's pinned Foundry UI package version so new scaffolds install a consistent package set.

## 0.4.0

### Minor Changes

- 9be8b3d: Add a default FastAPI + Microsoft Agent Framework AG-UI agent service scaffold to the starter, including a hello tool, a weather tool, current Foundry env examples, and a demo-grade Hello Agent page with one-click AG-UI prompts. Expose `agentFetch` through `bootstrapShell` so generated apps can use a local unauthenticated agent transport for demos before swapping to the MSAL-backed default.

  Ship the Foundry UI Tailwind v4 theme resource through `@iloveagents/foundry-web-ui/styles.css` and import it from the starter so panels and other source-shipped components render correctly without app-local theme copies. Default shared app branding and browser titles to `Foundry UI`, and document starter theming through `bootstrapShell({ theme })`.

  Hide the composer page-pin button by default, while keeping it available through `ChatContent` and `ContextPins` opt-in props. Make non-image document attachments degrade to model-visible metadata instead of malformed binary payloads so starter uploads do not break AG-UI streaming.

  Reserve user-message action-row height while the agent is running so the chat no longer jumps when the post-run edit button appears.

  Tighten the starter documentation around a single quick-start path, add generated-app `AGENTS.md` plus `CLAUDE.md` import support, and remove default-template product clutter so coding agents and humans both have one clear place to add tools.

  Document the two supported adoption modes: package-backed apps for central Foundry UI updates, and full-copy/GitHub-template apps for complete customization.

  Harden preview packaging by replacing internal `workspace:*` dependencies with installable semver ranges, adding package-level MIT licenses, publishing runtime packages as built ESM JavaScript plus `.d.ts` declarations, filtering runtime package tarballs to dist/README/LICENSE only, and adding missing package READMEs/typecheck coverage.

## 0.3.1

### Patch Changes

- 733f3d6: Doc cleanup: remove dangling `FOUNDRY_UI_TOKEN` references in README/AGENTS/template/help-text. They were left over from the era when the lastspace preset was fetched from GitHub Packages with that token; that fetch path was replaced with a no-auth npmjs registry fetch in the previous release.

  The customer-side env var is now consistently named `LASTSPACE_TOKEN` (authenticates lastspace-private resources: Docker image, npm @lastspace scope, Python packages). No code-path changes — purely documentation alignment.

- 7c22e6a: Preserve Python dunder files (`__init__.py`, `__main__.py`) during scaffold copy. The previous underscore-prefix-→-dotfile rename rule was too aggressive — it transformed `__init__.py` into `._init__.py`, breaking any preset that ships Python source. Now only single-underscore prefixes (e.g. `_gitignore`, `_npmrc`) get rewritten; double-underscore names pass through unchanged. Surfaced by the lastspace preset's `apps/web-api/` overlay.

## 0.3.0

### Minor Changes

- 2b5f9da: Wire `--preset lastspace` end-to-end. The CLI now fetches `@lastspace/preset` from npmjs (public, no auth — the preset itself ships zero proprietary code; the customer-PAT auth boundary is `pnpm install` of `@lastspace/spaces-web-ui` which is gated separately), reads the manifest, and overlays its `files/` on top of the default scaffold. Resulting `package.json` gets `extraDependencies` merged in (sorted), required env vars are reported on completion, and underscore-prefixed dotfiles like `_npmrc` are renamed to `.npmrc` automatically.

  Dev escape hatch: set `FOUNDRY_UI_PRESET_LASTSPACE_PATH=<local-path>` to skip the fetch and use a filesystem checkout of the preset (used by lastspace-meta cross-repo dev + integration tests).

  Also fixes the default template's Tailwind `@source` paths — they pointed at `../../node_modules` (two levels up) but a scaffolded app's `src/index.css` is one level under the project root, so utilities from `@iloveagents/foundry-*` source-shipping packages were silently purged.

## 0.2.0

### Minor Changes

- 0755b14: Initial release of `create-foundry-ui-app` — npm scaffolding CLI for Foundry UI.

  ```bash
  npx create-foundry-ui-app my-app
  cd my-app && pnpm install && pnpm dev
  ```

  Scaffolds a React shell that consumes `@iloveagents/foundry-{agent,web-primitives,web-ui,web-shell}` from npm at `^0.1.0`. Bundled `default` preset includes Vite + Tailwind v4 + TypeScript strict + ESLint, with `bootstrapShell({ modules: [], pages: customerPages })` wiring and a stub home page.

  The `lastspace` preset is reserved for #100-F (lastspace#100-F) and currently throws "not yet available". Other presets follow the same fetch-via-PAT pattern.

  Implementation: plain TS + tsdown bundler + @clack/prompts (no UnJS). Templates bundled inside the package via `package.json#files`. Single-sentinel `__PROJECT_NAME__` substitution in text files; root package.json uses parse-edit-stringify.
