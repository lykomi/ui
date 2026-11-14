import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { domToJpeg } from "modern-screenshot";
import { captureAppView, captureAppViewTool } from "../capture-app-view.ts";
import { useChatRuns } from "../chat-runs-store.ts";

vi.mock("modern-screenshot", () => ({ domToJpeg: vi.fn() }));
beforeEach(() => {
  useChatRuns.setState({ foregroundId: "chat-a" });
  vi.mocked(domToJpeg).mockResolvedValue("data:image/jpeg;base64,aW1hZ2U=");
});
afterEach(() => {
  vi.clearAllMocks();
  useChatRuns.setState({ foregroundId: null });
});

it("captures the app viewport as binary input and excludes private surfaces", async () => {
  const result = await captureAppViewTool.execute("{}");
  expect(typeof result).toBe("object");
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result)).toMatchObject({
    status: "captured",
    scope: "visible_app_viewport",
  });
  expect(result.result).not.toContain("aW1hZ2U=");
  expect(result.inputContent).toEqual([
    expect.objectContaining({ type: "binary", mimeType: "image/jpeg", data: "aW1hZ2U=" }),
  ]);
  const [root, options] = vi.mocked(domToJpeg).mock.calls[0];
  expect(root).toBe(document.documentElement);
  expect(options?.width).toBe(window.innerWidth);
  expect(options?.height).toBe(window.innerHeight);
  expect(options?.features).toEqual({ restoreScrollPosition: true });
  const privateField = document.createElement("div");
  privateField.dataset.agentContext = "off";
  expect(options?.filter?.(privateField)).toBe(false);
  const password = document.createElement("input");
  password.type = "password";
  expect(options?.filter?.(password)).toBe(false);
});

it("discards an image if the conversation changes while it is rendered", async () => {
  vi.mocked(domToJpeg).mockImplementation(async () => {
    useChatRuns.setState({ foregroundId: "chat-b" });
    return "data:image/jpeg;base64,aW1hZ2U=";
  });
  await expect(captureAppView()).rejects.toThrow("conversation changed");
});

it("returns an actionable error rather than claiming the agent saw an image", async () => {
  vi.mocked(domToJpeg).mockRejectedValue(new Error("Canvas unavailable"));
  expect(await captureAppViewTool.execute("{}")).toBe(
    JSON.stringify({ status: "capture_failed", message: "Canvas unavailable" }),
  );
});
