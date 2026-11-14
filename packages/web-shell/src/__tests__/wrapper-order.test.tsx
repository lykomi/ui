/**
 * Wrapper-order test.
 *
 * Asserts the contractual outer→inner ordering: BrowserRouter wraps
 * AuthProvider wraps [module wrappers] wraps AGUIRuntimeProvider wraps
 * Routes. Uses a depth-marker context — each layer increments the depth
 * via a Provider, and a probe component reads the depth at render time.
 */
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { useLocation } from "react-router";
import { defineChatModule, type ChatModule, type ShellPage } from "../types.ts";

const DepthContext = createContext<number>(-1);

function makeWrapper(label: string, expectedDepth: number) {
  return function Wrap({ children }: { children: ReactNode }) {
    const incoming = useContext(DepthContext);
    // Each wrapper asserts its own depth via the test contract.
    // Using a side-effect ref so the assertion runs even if children
    // never resolve (e.g. routing to a no-match path).
    seen[label] = incoming;
    return <DepthContext.Provider value={incoming + 1}>{children}</DepthContext.Provider>;
  };
}

const seen: Record<string, number> = {};

// Probe inside the route confirms BrowserRouter is reachable + reports the
// final inner depth.
function RouteProbe() {
  const depth = useContext(DepthContext);
  const location = useLocation();
  seen["route-probe"] = depth;
  seen["route-pathname"] = location.pathname.length;
  return <div data-testid="route-probe">probe</div>;
}

// Mock the web-ui surface the shell consumes. AuthProvider +
// AGUIRuntimeProvider are wrapped with the depth context so the test
// can probe their nesting order. Don't spread the real module — its
// stores call window.matchMedia at import time and jsdom doesn't have
// that.
vi.mock("@lykomi/web-ui", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => {
    const incoming = useContext(DepthContext);
    seen["auth-provider"] = incoming;
    return <DepthContext.Provider value={incoming + 1}>{children}</DepthContext.Provider>;
  },
  AGUIRuntimeProvider: ({ children }: { children: ReactNode }) => {
    const incoming = useContext(DepthContext);
    seen["agui-runtime"] = incoming;
    return <DepthContext.Provider value={incoming + 1}>{children}</DepthContext.Provider>;
  },
  Sidebar: () => null,
  ChatHeader: () => null,
  ChatBubble: () => null,
  ChatContent: () => null,
  ToolPanelLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeScope: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeDocumentMetadata: () => null,
  GlobalSelectionPopover: () => null,
  TooltipIconButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  findNavItem: () => undefined,
  useAppStore: (selector: (s: any) => unknown) =>
    selector({ setCurrentPage: () => undefined, setNavContext: () => undefined }),
  useNavStore: (selector: (s: any) => unknown) => selector({ config: [] }),
  useChatBubbleStore: Object.assign(
    (selector: (s: any) => unknown) =>
      selector({
        isExpanded: false,
        showPagePanel: false,
        togglePagePanel: () => undefined,
      }),
    { getState: () => ({ close: () => undefined }) },
  ),
  useThemeStore: (selector: (s: any) => unknown) => selector({ mode: "system" }),
}));

vi.mock("@lykomi/web-ui/workbench", () => ({
  WorkbenchPreview: ({ page }: { page: ReactNode }) => <>{page}</>,
}));

vi.mock("@lykomi/web-primitives", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@lykomi/agent", () => ({
  createServiceFetch: () => fetch,
  // load-chat-config imports this on shell boot; a set-only stub keeps the
  // mock honest without pulling zustand into the test graph.
  reasoningDefaultStore: { getState: () => ({ setResolved: () => {} }) },
  contextUsageStore: { getState: () => ({ setWindow: () => {} }) },
}));

vi.mock("@lykomi/agent/msal", () => ({
  authStore: { getState: () => ({ getAccessToken: () => Promise.resolve("") }) },
}));

import { ShellApp } from "../shell-app.tsx";
import type { AuthAdapter } from "../types.ts";
// Imported AFTER vi.mock so this resolves to the mocked AuthProvider.
import { AuthProvider as MockedAuthProvider } from "@lykomi/web-ui";

describe("Shell wrapper ordering contract", () => {
  it("nests BrowserRouter > AuthProvider > [module wrappers] > AGUIRuntimeProvider > Routes", async () => {
    Object.keys(seen).forEach((k) => delete seen[k]);

    const ModuleWrapperA = makeWrapper("module-a", 2);
    const ModuleWrapperB = makeWrapper("module-b", 3);

    const m: ChatModule = defineChatModule({
      name: "test",
      wrappers: [ModuleWrapperA, ModuleWrapperB],
    });

    const homePage: ShellPage = {
      path: "elsewhere",
      element: <RouteProbe />,
    };

    // The auth adapter under test wraps children with the mocked
    // AuthProvider from web-ui (which counts depth). In production
    // defaultAuthAdapter does the same — this just makes the contract
    // explicit for the test.
    const auth: AuthAdapter = {
      Provider: ({ children }: { children: ReactNode }) => (
        // The vi.mock factory above replaces this provider's runtime impl with one
        // that ignores `config`, but TypeScript only sees the real component's
        // signature. Cast to satisfy the prop requirement without a real config.
        <MockedAuthProvider config={{} as never}>{children}</MockedAuthProvider>
      ),
    };

    window.history.replaceState({}, "", "/elsewhere");
    render(
      <ShellApp
        modules={[m]}
        pages={[homePage]}
        baseThemeLayers={[]}
        authProvider={auth}
        agentFetch={fetch}
      />,
    );

    // Wait for the route probe to render.
    await waitFor(() => expect(seen["route-probe"]).toBeDefined());

    // Layer depths (each Provider sees the incoming depth, then adds 1).
    // BrowserRouter does not use DepthContext, so the first layer to bump
    // the depth is AuthProvider (sees depth -1, advances to 0).
    expect(seen["auth-provider"]).toBe(-1);
    // ProbeWrapper (the test mock around the AuthProvider mock) ran AFTER
    // AuthProvider — module wrappers nest INSIDE AuthProvider.
    expect(seen["module-a"]).toBe(0);
    expect(seen["module-b"]).toBe(1);
    // AGUIRuntimeProvider nests INSIDE module wrappers.
    expect(seen["agui-runtime"]).toBe(2);
    // RouteProbe nests INSIDE AGUIRuntimeProvider.
    expect(seen["route-probe"]).toBe(3);
  });
});
