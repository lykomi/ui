/**
 * A theme has to reach portalled UI.
 *
 * ThemeScope put its variables on a div. Radix portals mount into
 * document.body, OUTSIDE that div, so every dropdown, popover, select and
 * tooltip fell back to :root — the base preset — while the page around
 * them wore the host app's theme: a brand-blue page with a violet facet
 * menu hanging off it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeRuntimeProvider, ThemeScope } from "../theme-runtime-provider.tsx";
import type { ThemeLayer } from "../../lib/theme-runtime.ts";

// jsdom has no matchMedia; the runtime asks it for the system colour scheme.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const BLUE = "#0075BE";
const layers: ThemeLayer[] = [{ id: "brand", definition: { light: { primary: BLUE } } as never }];

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  document.documentElement.removeAttribute("style");
});

function mount(node: React.ReactNode) {
  act(() => {
    root!.render(
      <ThemeRuntimeProvider layers={layers} mode="light">
        {node}
      </ThemeRuntimeProvider>,
    );
  });
}

describe("ThemeScope reaches portalled UI", () => {
  it("publishes its variables to the document, where portals inherit them", () => {
    mount(
      <ThemeScope className="shell">
        <span>page</span>
      </ThemeScope>,
    );
    // What a portal into document.body would resolve against.
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);
  });

  it("puts them on its own element too, so a subtree can be themed", () => {
    mount(
      <ThemeScope className="shell">
        <span>page</span>
      </ThemeScope>,
    );
    const scope = host!.querySelector(".shell") as HTMLElement;
    expect(scope.style.getPropertyValue("--primary")).toBe(BLUE);
  });

  it("restores what it found when it unmounts", () => {
    document.documentElement.style.setProperty("--primary", "rebeccapurple");
    mount(<ThemeScope>page</ThemeScope>);
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);
    act(() => root!.unmount());
    // Restored, not cleared: another provider may own these.
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("rebeccapurple");
  });

  it("a subtree theme mounting LATER does not repaint the document", () => {
    // The case that bites: a dialog (which nests a ThemeScope) opens after
    // the page is up. Its effect runs while the outer scope's does not
    // re-run, so without the nesting guard the innermost theme would take
    // over :root — every portal on the page would wear the dialog's
    // colours until it closed.
    //
    // Mounting both at once proves nothing: React runs child effects
    // BEFORE the parent, so the outer scope would overwrite the inner
    // one's write regardless. The inner scope has to arrive late.
    const GREEN = "#00A36C";
    const Page = ({ withDialog }: { withDialog: boolean }) => (
      <ThemeRuntimeProvider layers={layers} mode="light">
        <ThemeScope className="outer">
          {withDialog ? (
            <ThemeRuntimeProvider
              layers={[{ id: "inner", definition: { light: { primary: GREEN } } as never }]}
              mode="light"
            >
              <ThemeScope className="inner">dialog</ThemeScope>
            </ThemeRuntimeProvider>
          ) : null}
        </ThemeScope>
      </ThemeRuntimeProvider>
    );

    act(() => root!.render(<Page withDialog={false} />));
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);

    act(() => root!.render(<Page withDialog />));

    const inner = host!.querySelector(".inner") as HTMLElement;
    expect(inner.style.getPropertyValue("--primary")).toBe(GREEN);
    // The document still belongs to the OUTERMOST scope.
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);
  });
});

describe("two independently mounted outer scopes", () => {
  let hostA: HTMLDivElement;
  let hostB: HTMLDivElement;
  let rootA: Root;
  let rootB: Root;

  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    hostA = document.createElement("div");
    hostB = document.createElement("div");
    document.body.append(hostA, hostB);
    rootA = createRoot(hostA);
    rootB = createRoot(hostB);
  });

  afterEach(() => {
    // Unmount, don't just detach: the document-level theme is module state,
    // and a root left mounted keeps its place in the ownership stack for
    // every test that follows.
    act(() => {
      rootA.unmount();
      rootB.unmount();
    });
    hostA.remove();
    hostB.remove();
    document.documentElement.removeAttribute("style");
  });

  const GREEN = "#00A36C";
  const scope = (colour: string) => (
    <ThemeRuntimeProvider
      layers={[{ id: colour, definition: { light: { primary: colour } } as never }]}
      mode="light"
    >
      <ThemeScope>x</ThemeScope>
    </ThemeRuntimeProvider>
  );

  it("hands the document back to the base when the LAST one leaves, whatever the order", () => {
    // The case a per-effect snapshot cannot get right: A writes blue, B
    // snapshots blue and writes green, A unmounts FIRST. B's snapshot now
    // names a value whose owner is gone, so restoring it on B's unmount
    // leaves the document themed by nobody (review catch).
    act(() => rootA.render(scope(BLUE)));
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);

    act(() => rootB.render(scope(GREEN)));
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(GREEN);

    // Out of order: the FIRST one leaves first.
    act(() => rootA.unmount());
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
      "the live owner's theme was clobbered by a departing one",
    ).toBe(GREEN);

    act(() => rootB.unmount());
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
      "the document kept a theme whose owner had unmounted",
    ).toBe("");
  });

  it("a rerender of the first one does not take the theme back", () => {
    // Its place in the stack belongs to the scope, not to its latest write.
    // An inline `layers` array hands back a new `variables` object on every
    // render, so re-registering on each change would let A's ordinary
    // rerender jump over a B that mounted after it — newest WRITE winning
    // instead of newest OWNER (review catch).
    act(() => rootA.render(scope(BLUE)));
    act(() => rootB.render(scope(GREEN)));

    act(() => rootA.render(scope(BLUE)));

    expect(
      document.documentElement.style.getPropertyValue("--primary"),
      "a rerender re-ordered the scopes",
    ).toBe(GREEN);
  });

  it("leaves a name alone once something outside has written it", () => {
    // A host theme manager, a design-mode preview, a test: whoever wrote
    // after us has the newer word on that name. Restoring our snapshot over
    // it on unmount would silently undo them (review catch).
    act(() => rootA.render(scope(BLUE)));
    const HOST = "#123456";
    document.documentElement.style.setProperty("--primary", HOST);

    act(() => rootB.render(scope(GREEN)));
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
      "a later scope overwrote the host",
    ).toBe(HOST);

    act(() => rootA.unmount());
    act(() => rootB.unmount());
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
      "cleanup restored over the host's own value",
    ).toBe(HOST);
  });

  it("notices an outside write that only adds !important", () => {
    // The same value with a priority is still something new said about that
    // name, and a value-only comparison reads it as our own write — then
    // the next scope overwrites it without the flag (review catch).
    act(() => rootA.render(scope(BLUE)));
    document.documentElement.style.setProperty("--primary", BLUE, "important");

    act(() => rootB.render(scope(GREEN)));

    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);
    expect(
      document.documentElement.style.getPropertyPriority("--primary"),
      "the host's !important was dropped",
    ).toBe("important");
  });

  it("still restores correctly in LIFO order", () => {
    act(() => rootA.render(scope(BLUE)));
    act(() => rootB.render(scope(GREEN)));
    act(() => rootB.unmount());
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(BLUE);
    act(() => rootA.unmount());
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
  });
});
