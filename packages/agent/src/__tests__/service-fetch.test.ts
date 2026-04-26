import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceFetch } from "../client/service-fetch.ts";

describe("createServiceFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches Bearer token from acquireToken", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/spaces/entities");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("skips token attachment when acquireToken returns null", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("skips token attachment when Authorization header already present", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities", {
      headers: { Authorization: "Bearer pre-existing" },
    });

    expect(acquireToken).not.toHaveBeenCalled();
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer pre-existing");
  });

  it("rewrites local-relative URLs to baseUrl when configured", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com",
    });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("strips origin prefix before applying baseUrl", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com",
      originResolver: () => "https://app.example.com",
    });

    await serviceFetch("https://app.example.com/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("leaves URL untouched when baseUrl is empty (dev mode)", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/spaces/entities");
  });

  it("strips trailing slashes from baseUrl", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com//",
    });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("passes URL objects through correctly", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch(new URL("https://example.com/api/items"));

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/api/items");
  });

  it("preserves Request method/body/headers when input is a Request", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Custom": "from-request" },
      body: JSON.stringify({ ok: true }),
    });

    await serviceFetch(req);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/api/items");
    expect(init?.method).toBe("POST");

    // Body is preserved (as a stream or buffer in the runtime).
    expect(init?.body).toBeDefined();

    const merged = new Headers(init?.headers);
    expect(merged.get("Authorization")).toBe("Bearer test-token");
    expect(merged.get("X-Custom")).toBe("from-request");
    expect(merged.get("Content-Type")).toBe("application/json");
  });

  it("does not attach a body for GET Requests", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      method: "GET",
      headers: { "X-Custom": "from-request" },
    });

    await serviceFetch(req);

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("init headers override Request headers when both supplied", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      headers: { "X-Override": "from-request", "X-Request-Only": "req" },
    });

    await serviceFetch(req, { headers: { "X-Override": "from-init", "X-Init-Only": "init" } });

    const [, init] = fetchSpy.mock.calls[0]!;
    const merged = new Headers(init?.headers);
    expect(merged.get("X-Override")).toBe("from-init");
    expect(merged.get("X-Request-Only")).toBe("req");
    expect(merged.get("X-Init-Only")).toBe("init");
  });

  it("recovers when acquireToken throws", async () => {
    const acquireToken = vi.fn().mockRejectedValue(new Error("token boom"));
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});
