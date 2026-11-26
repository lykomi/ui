import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { domToCanvas } from "modern-screenshot";
import { captureAppView, captureAppViewTool } from "../capture-app-view.ts";
import { readCapturePlan } from "../capture-marks.ts";
import { useChatRuns } from "../chat-runs-store.ts";

vi.mock("modern-screenshot", () => ({ domToCanvas: vi.fn() }));

type Call = [string, ...unknown[]];
let calls: Call[];

function fakeCanvas(): HTMLCanvasElement {
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, key: string) =>
        (...args: unknown[]) =>
          calls.push([key, ...args]),
      set: (_target, key: string, value) => (calls.push([`set:${key}`, value]), true),
    },
  );
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    getContext: () => ctx,
    toDataURL: () => "data:image/jpeg;base64,aW1hZ2U=",
  } as unknown as HTMLCanvasElement;
}

const rect = (x: number, y: number, width: number, height: number) =>
  ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }) as DOMRect;

// jsdom has no layout: every text range stands at `textAt`, every element at
// (10, 10).
let textAt = rect(100, 50, 60, 16);
const realRangeRects = Range.prototype.getClientRects;
const realElementRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  calls = [];
  useChatRuns.setState({ foregroundId: "chat-a" });
  vi.mocked(domToCanvas).mockImplementation(async () => fakeCanvas());
  Range.prototype.getClientRects = function (this: Range) {
    return (this.toString() ? [textAt] : []) as unknown as DOMRectList;
  };
  Element.prototype.getBoundingClientRect = () => rect(10, 10, 80, 24);
});
afterEach(() => {
  vi.clearAllMocks();
  useChatRuns.setState({ foregroundId: null });
  document.body.innerHTML = "";
  textAt = rect(100, 50, 60, 16);
  Range.prototype.getClientRects = realRangeRects;
  Element.prototype.getBoundingClientRect = realElementRect;
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
    expect.objectContaining({
      type: "image",
      source: { type: "data", mimeType: "image/jpeg", value: "aW1hZ2U=" },
    }),
  ]);
  const [root, options] = vi.mocked(domToCanvas).mock.calls[0];
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
  // Nothing asked for, nothing painted.
  expect(calls).toEqual([]);
});

it("blacks out a text everywhere the page shows it, and says how often", async () => {
  document.body.innerHTML = `<p>Contract with Northwind, signed</p><p>northwind again</p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 2 }]);
  const black = calls.findIndex(([key, value]) => key === "set:fillStyle" && value === "#000000");
  expect(black).toBeGreaterThan(-1);
  const boxes = calls.slice(black).filter(([key]) => key === "fillRect");
  expect(boxes).toHaveLength(2);
  expect(boxes[0]).toEqual(["fillRect", 98, 48, 64, 20]);
});

it("blacks out what a form field shows", async () => {
  document.body.innerHTML = `<input value="Budget 1.2 Mio" />`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["1.2 Mio"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "1.2 Mio", places: 1 }]);
  expect(calls.filter(([key]) => key === "fillRect").at(-1)).toEqual(["fillRect", 8, 8, 84, 28]);
});

it("frames a button by its label, numbered, and paints black boxes last", async () => {
  document.body.innerHTML = `<button>Save</button><p>Northwind</p>`;
  const result = await captureAppViewTool.execute(
    JSON.stringify({ mark: [{ text: "Save", label: "Does nothing" }], redact: ["Northwind"] }),
  );
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).marks).toEqual([
    { number: 1, text: "Save", label: "Does nothing", found: true },
  ]);
  const frame = calls.findIndex(([key]) => key === "strokeRect");
  const black = calls.findIndex(([key, value]) => key === "set:fillStyle" && value === "#000000");
  expect(calls[frame]).toEqual(["strokeRect", 6, 6, 88, 32]);
  expect(calls.find(([key]) => key === "fillText")).toEqual(["fillText", "1", 6, 6]);
  expect(black).toBeGreaterThan(frame);
});

it("reports a mark it could not find instead of drawing it somewhere", async () => {
  const result = await captureAppViewTool.execute(JSON.stringify({ mark: [{ text: "Export" }] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).marks).toEqual([{ number: 1, text: "Export", found: false }]);
  expect(calls.some(([key]) => key === "strokeRect")).toBe(false);
});

it("gives no image when the page moved while it was drawn", async () => {
  document.body.innerHTML = `<p>Northwind</p>`;
  vi.mocked(domToCanvas).mockImplementation(async () => {
    textAt = rect(100, 300, 60, 16);
    return fakeCanvas();
  });
  await expect(captureAppView(readCapturePlan({ redact: ["Northwind"] }))).rejects.toThrow(
    "changed during capture",
  );
});

it("refuses a text so short it would black out the page", async () => {
  expect(await captureAppViewTool.execute(JSON.stringify({ redact: ["a"] }))).toContain(
    "capture_failed",
  );
  expect(domToCanvas).not.toHaveBeenCalled();
});

it("discards an image if the conversation changes while it is rendered", async () => {
  vi.mocked(domToCanvas).mockImplementation(async () => {
    useChatRuns.setState({ foregroundId: "chat-b" });
    return fakeCanvas();
  });
  await expect(captureAppView()).rejects.toThrow("conversation changed");
});

it("returns an actionable error rather than claiming the agent saw an image", async () => {
  vi.mocked(domToCanvas).mockRejectedValue(new Error("Canvas unavailable"));
  expect(await captureAppViewTool.execute("{}")).toBe(
    JSON.stringify({ status: "capture_failed", message: "Canvas unavailable" }),
  );
});
