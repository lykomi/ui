import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();

vi.mock("../auth-store", () => ({
  useAuthStore: {
    getState: () => ({
      getAccessToken,
    }),
  },
}));

import { tokenFetch } from "../token-fetch";

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
});
