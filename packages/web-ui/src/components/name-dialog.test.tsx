import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NameDialog } from "./name-dialog.tsx";

describe("NameDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    originalMatchMedia = window.matchMedia;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value:
        originalMatchMedia ||
        ((query: string) =>
          ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          }) as MediaQueryList),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    Reflect.deleteProperty(globalThis, "React");
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it("disables editing and submit while pending", () => {
    const onSubmit = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <NameDialog
          open
          onOpenChange={() => {}}
          title="New workspace"
          placeholder="Workspace name"
          initialValue="Pending workspace"
          pending
          onSubmit={onSubmit}
        />,
      );
    });

    const input = document.querySelector<HTMLInputElement>('input[placeholder="Workspace name"]');
    const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]');

    expect(input?.disabled).toBe(true);
    expect(submit?.disabled).toBe(true);
    expect(submit?.textContent).toBe("Create...");

    act(() => {
      submit?.click();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
