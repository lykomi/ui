/**
 * Runtime configuration reader.
 *
 * The web app ships as a SINGLE prebuilt container image that must boot
 * correctly for any customer / environment without a rebuild. Per-env values
 * (API base URL, MSAL client/authority/scopes) therefore arrive at RUNTIME —
 * the container entrypoint writes a small `/config.js` from env vars that sets
 * `window.__APP_CONFIG__`, loaded before the app bundle.
 *
 * `runtimeConfig(key)` resolves, in order:
 *   1. `window.__APP_CONFIG__[key]`  — runtime config injected by the container
 *   2. `import.meta.env[key]`        — build-time Vite env (local `pnpm dev`)
 *   3. `""`                          — absent
 *
 * Keeping `import.meta.env` as the fallback means local dev is unchanged: there
 * is no `/config.js` in dev, so `window.__APP_CONFIG__` is undefined and the
 * existing `VITE_*` values from `.env` are used exactly as before.
 *
 * The window cast is inline (no `declare global`) so this can be duplicated in
 * sibling packages without conflicting global augmentations.
 */
export function runtimeConfig(key: string): string {
  const fromWindow =
    typeof window !== "undefined"
      ? (window as { __APP_CONFIG__?: Record<string, string | undefined> }).__APP_CONFIG__?.[key]
      : undefined;
  const fromEnv = (import.meta.env as Record<string, string | undefined>)[key];
  return fromWindow ?? fromEnv ?? "";
}

const WORKBENCH_STORAGE_KEY = "foundry.workbench-preview";
/** Tab-local and development-only. Production always uses the standard shell. */
export function isWorkbenchPreviewEnabled() {
  if (!import.meta.env.DEV) return false;
  try {
    const choice = new URLSearchParams(window.location.search).get("ux");
    if (choice === "workbench") sessionStorage.setItem(WORKBENCH_STORAGE_KEY, "on");
    if (choice === "classic") sessionStorage.removeItem(WORKBENCH_STORAGE_KEY);
    return sessionStorage.getItem(WORKBENCH_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}
