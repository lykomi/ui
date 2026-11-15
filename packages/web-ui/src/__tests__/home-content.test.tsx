import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { BookOpen } from "lucide-react";
import { expect, it, vi } from "vitest";
import { HomeContent } from "../workbench/home-content.tsx";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

it("does not mount a duplicate home entry when the main conversation is open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <HomeContent
            chatOpen
            onOpenChat={vi.fn()}
            groups={[
              {
                label: "App",
                items: [
                  { to: "/", label: "Home", icon: BookOpen },
                  { to: "/guide", label: "Guide", icon: BookOpen, description: "Learn the app" },
                  { to: "/locked", label: "Unavailable", icon: BookOpen, disabled: true },
                ],
              },
            ]}
          />
        </MemoryRouter>,
      ),
    );
    expect(host.childElementCount).toBe(0);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
