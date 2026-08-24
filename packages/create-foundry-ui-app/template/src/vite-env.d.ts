/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID?: string;
  readonly VITE_MSAL_AUTHORITY?: string;
  readonly VITE_MSAL_API_SCOPE?: string;
  /**
   * WebSocket URL of a Voice Live proxy. Setting it turns voice on; leaving
   * it unset leaves the app exactly as it was.
   */
  readonly VITE_VOICE_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
