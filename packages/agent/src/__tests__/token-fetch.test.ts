import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();

vi.mock("../msal/auth-store.ts", () => ({
  authStore: {
    getState: () => ({
      getAccessToken,
    }),
  },
}));

import { tokenFetch } from "../msal/token-fetch.ts";

describe("tokenFetch", () => {
  beforeEach(() => {
    getAccessToken.mockReset();
    vi.restoreAllMocks();
  });

  it("merges Request headers and lets init headers take precedence", async () => {
    getAccessToken.mockResolvedValue("test-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const request = new Request("https://example.com/api/items", {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Only": "request",
        "X-Override": "request",
      },
    });

    await tokenFetch(request, {
      headers: {
        "X-Init-Only": "init",
        "X-Override": "init",
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Request-Only")).toBe("request");
    expect(headers.get("X-Init-Only")).toBe("init");
    expect(headers.get("X-Override")).toBe("init");
  });

  it("falls through to native fetch when no token is available", async () => {
    getAccessToken.mockResolvedValue(null);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await tokenFetch("https://example.com/api/items");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init).toBeUndefined();
  });
});
