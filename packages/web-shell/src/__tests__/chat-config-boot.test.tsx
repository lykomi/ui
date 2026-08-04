/**
 * The chat-config load must happen INSIDE the auth boundary.
 *
 * ShellAuth is ShellApp's CHILD, so an effect in ShellApp's own body runs
 * before sign-in. The agent fetch would 401, exhaust its refresh retry and
 * trigger recoverFromHardAuthFailure -> loginRedirect -> remount -> repeat:
 * an infinite login loop for anyone without a cached session. This test
 * pins the ordering by refusing to let the fetch fire until the auth
 * provider has rendered its children.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The real ShellAuth withholds its children until sign-in completes. The
// mock below does the same (children appear only after a tick), which is
// what makes this test able to fail: an effect in ShellApp's own body runs
// while children are still absent.
let authGateOpen = false;
const fetchCalledWhileUnauthenticated = { value: false };

vi.mock("@iloveagents/foundry-web-ui", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  AGUIRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Sidebar: () => null,
  ChatHeader: () => null,
  ChatBubble: () => null,
  ChatContent: () => null,
  ToolPanelLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeScope: ({ children }: { children: ReactNode }) => <>{children}</>,
  ThemeDocumentMetadata: () => null,
  GlobalSelectionPopover: () => null,
  ContextPins: () => null,
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
  cn: (...c: unknown[]) => c.filter(Boolean).join(" "),
}));

vi.mock("@iloveagents/foundry-agent", () => ({
  createServiceFetch: () => fetch,
  reasoningDefaultStore: { getState: () => ({ setResolved: () => {} }) },
}));

vi.mock("@iloveagents/foundry-agent/msal", () => ({
  authStore: { getState: () => ({ getAccessToken: () => Promise.resolve("") }) },
}));

import { ShellApp } from "../shell-app.tsx";
import type { AuthAdapter, ShellPage } from "../types.ts";

describe("chat config boot", () => {
  it("does not fetch until the auth gate opens", async () => {
    authGateOpen = false;
    fetchCalledWhileUnauthenticated.value = false;

    const trackingFetch = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/chat/config") && !authGateOpen) {
        fetchCalledWhileUnauthenticated.value = true;
      }
      return { ok: true, json: async () => ({ reasoning: { defaultEffort: "medium" } }) };
    }) as unknown as typeof fetch;

    // Gate that mirrors ShellAuth: nothing below it exists until signed in.
    const auth: AuthAdapter = {
      Provider: ({ children }: { children: ReactNode }) => {
        const [ready, setReady] = useState(false);
        useEffect(() => {
          const t = setTimeout(() => {
            authGateOpen = true;
            setReady(true);
          }, 10);
          return () => clearTimeout(t);
        }, []);
        return ready ? <>{children}</> : null;
      },
    };
    const page: ShellPage = { path: "/", element: <div>home</div> };

    render(
      <ShellApp
        modules={[]}
        pages={[page]}
        baseThemeLayers={[]}
        authProvider={auth}
        agentFetch={trackingFetch}
      />,
    );

    await waitFor(() => expect(trackingFetch).toHaveBeenCalled());
    expect(fetchCalledWhileUnauthenticated.value).toBe(false);
  });
});
