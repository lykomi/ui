---
"@iloveagents/foundry-web-shell": minor
---

Add runtime configuration support so the web app can ship as a single prebuilt
container image that boots for any environment without a rebuild. New
`runtimeConfig(key)` helper resolves `window.__APP_CONFIG__[key]` (injected by
the container at startup) before `import.meta.env[key]` (build-time Vite env,
the local-dev fallback). The default MSAL auth adapter and agent fetch client
now read `VITE_MSAL_*` / `VITE_API_BASE_URL` through it. Local `pnpm dev` is
unchanged (no `/config.js` → falls back to `import.meta.env`).
