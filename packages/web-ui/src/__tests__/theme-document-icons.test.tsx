// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ThemeDocumentMetadata,
  ThemeRuntimeProvider,
} from "../components/theme-runtime-provider.tsx";

const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host);

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(async () => {
  await act(async () => root.render(null));
  document.querySelectorAll('link[data-theme-icon="true"]').forEach((link) => link.remove());
});

describe("theme document icons", () => {
  it("uses theme favicon and mobile bookmark icon, then cleans up", async () => {
    const layers = [
      {
        definition: {
          branding: {
            faviconUrl: "/brand-light.svg",
            darkFaviconUrl: "/brand-dark.svg",
            touchIconUrl: "/brand-touch.png",
          },
        },
      },
    ];
    await act(async () =>
      root.render(
        <ThemeRuntimeProvider layers={layers} mode="light">
          <ThemeDocumentMetadata />
        </ThemeRuntimeProvider>,
      ),
    );
    expect(
      document.querySelector('link[data-theme-icon="true"][rel="icon"]')?.getAttribute("href"),
    ).toBe("/brand-light.svg");
    expect(
      document
        .querySelector('link[data-theme-icon="true"][rel="apple-touch-icon"]')
        ?.getAttribute("href"),
    ).toBe("/brand-touch.png");

    await act(async () =>
      root.render(
        <ThemeRuntimeProvider layers={layers} mode="dark">
          <ThemeDocumentMetadata />
        </ThemeRuntimeProvider>,
      ),
    );
    expect(
      document.querySelector('link[data-theme-icon="true"][rel="icon"]')?.getAttribute("href"),
    ).toBe("/brand-dark.svg");
    expect(document.querySelectorAll('link[data-theme-icon="true"][rel="icon"]')).toHaveLength(1);
  });

  it("derives the favicon from the compact icon and rejects unsafe URLs", async () => {
    await act(async () =>
      root.render(
        <ThemeRuntimeProvider
          layers={[
            {
              definition: {
                branding: { iconUrl: "mark.svg", touchIconUrl: "javascript:alert(1)" },
              },
            },
          ]}
          mode="light"
        >
          <ThemeDocumentMetadata />
        </ThemeRuntimeProvider>,
      ),
    );
    expect(
      document.querySelector('link[data-theme-icon="true"][rel="icon"]')?.getAttribute("href"),
    ).toBe("mark.svg");
    expect(
      document.querySelector('link[data-theme-icon="true"][rel="apple-touch-icon"]'),
    ).toBeNull();
  });

  it("keeps icon links mounted when equivalent theme layers rerender", async () => {
    const render = () =>
      root.render(
        <ThemeRuntimeProvider
          layers={[{ definition: { branding: { faviconUrl: "icons/mark.svg" } } }]}
          mode="light"
        >
          <ThemeDocumentMetadata />
        </ThemeRuntimeProvider>,
      );
    await act(async () => render());
    const first = document.querySelector('link[data-theme-icon="true"][rel="icon"]');
    expect(first?.getAttribute("href")).toBe("icons/mark.svg");
    await act(async () => render());
    expect(document.querySelector('link[data-theme-icon="true"][rel="icon"]')).toBe(first);
  });
});
