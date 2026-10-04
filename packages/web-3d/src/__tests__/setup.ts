/**
 * jsdom has no `matchMedia`, and importing anything from
 * `@iloveagents/foundry-web-ui` builds a theme store at module load that reads
 * it. That happens before any test body runs, so it cannot be stubbed inside
 * one — it belongs here.
 */
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
