/**
 * jsdom does not implement `window.matchMedia`, and importing anything from
 * `@lykomi/web-ui` evaluates its theme store, which reads it at
 * module scope. A `beforeAll` is too late — setup files run before the test
 * file's imports, which is the only point where this can be installed.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}
