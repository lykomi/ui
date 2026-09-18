/**
 * Module-bootstrap test.
 *
 * Asserts that every ChatModule extension point fires when ShellApp is
 * rendered. Bypasses bootstrap-shell.tsx (which calls createRoot) and
 * renders ShellApp directly so we can probe React's tree.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { defineChatModule, type ChatModule, type ShellPage } from "../types.ts";

// Mock the web-ui surface the shell consumes. Don't spread the real
// module — its top-level zustand stores call window.matchMedia at import
// time, which jsdom doesn't provide. We only need the symbols ShellApp
// + ShellLayout import directly.
vi.mock("@iloveagents/foundry-web-ui", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  AGUIRuntimeProvider: ({
    children,
    headlessChildren,
  }: {
    children: ReactNode;
    headlessChildren?: ReactNode;
  }) => (
    <>
      {headlessChildren}
      {children}
    </>
  ),
  Sidebar: () => <div data-testid="sidebar" />,
  ChatHeader: () => <div data-testid="chat-header" />,
  ChatBubble: () => <div data-testid="chat-bubble" />,
  ChatContent: () => <div data-testid="chat-content" />,
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

vi.mock("@iloveagents/foundry-web-primitives", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@iloveagents/foundry-agent", () => ({
  createServiceFetch: () => fetch,
  // load-chat-config imports this on shell boot; a set-only stub keeps the
  // mock honest without pulling zustand into the test graph.
  reasoningDefaultStore: { getState: () => ({ setResolved: () => {} }) },
  contextUsageStore: { getState: () => ({ setWindow: () => {} }) },
}));

vi.mock("@iloveagents/foundry-agent/msal", () => ({
  authStore: { getState: () => ({ getAccessToken: () => Promise.resolve("") }) },
}));

import { ShellApp } from "../shell-app.tsx";
import type { AuthAdapter } from "../types.ts";

const noopAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

describe("ChatModule bootstrap composition", () => {
  it("calls every extension point when ShellApp renders", async () => {
    const useInit = vi.fn();
    const useThemeLayers = vi.fn(() => []);
    const wrapperRendered = vi.fn();

    function ProbeWrapper({ children }: { children: ReactNode }) {
      wrapperRendered();
      return <div data-testid="probe-wrapper">{children}</div>;
    }

    const homePage: ShellPage = {
      path: "/",
      element: <div data-testid="home-page">home</div>,
    };

    const moduleHome: ShellPage = {
      path: "/",
      element: <div data-testid="module-home">module home</div>,
    };

    const modulePage: ShellPage = {
      path: "elsewhere",
      element: <div data-testid="module-page">module elsewhere</div>,
    };

    const m: ChatModule = defineChatModule({
      name: "test",
      useInit,
      useThemeLayers,
      toolUIs: <div data-testid="tool-ui-marker" />,
      layoutExtras: <div data-testid="layout-extra-marker" />,
      wrappers: [ProbeWrapper],
      pages: [moduleHome, modulePage],
    });

    render(
      <ShellApp
        modules={[m]}
        pages={[homePage]}
        baseThemeLayers={[]}
        authProvider={noopAuth}
        agentFetch={fetch}
      />,
    );

    // useInit hook fired.
    await waitFor(() => expect(useInit).toHaveBeenCalled());

    // useThemeLayers hook fired.
    expect(useThemeLayers).toHaveBeenCalled();

    // Module wrapper rendered.
    expect(screen.getByTestId("probe-wrapper")).toBeTruthy();
    expect(wrapperRendered).toHaveBeenCalled();

    // Tool UI rendered.
    expect(screen.getByTestId("tool-ui-marker")).toBeTruthy();

    // Layout extra rendered.
    expect(screen.getByTestId("layout-extra-marker")).toBeTruthy();

    // Customer page wins on path collision (/ resolves to home-page, not module-home).
    expect(screen.getByTestId("home-page")).toBeTruthy();
    expect(screen.queryByTestId("module-home")).toBeNull();
  });

  it("invokes fetchInterceptor (verified by bootstrap-shell test)", () => {
    // bootstrap-shell.tsx wraps installSpacesFetchInterceptor BEFORE createRoot.
    // The contract is that ShellApp itself does not invoke it — bootstrap-shell does.
    // This test just guards the type marker (`defineChatModule` is identity-typed).
    const interceptor = vi.fn();
    const m = defineChatModule({ name: "x", fetchInterceptor: interceptor });
    expect(m.fetchInterceptor).toBe(interceptor);
    expect(interceptor).not.toHaveBeenCalled();
  });
});
