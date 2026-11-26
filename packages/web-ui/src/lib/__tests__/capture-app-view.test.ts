import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { domToCanvas } from "modern-screenshot";
import { captureAppView, captureAppViewTool, describeCaptureResult } from "../capture-app-view.ts";
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
  // Private surfaces stay in the copy, invisible, so nothing after them moves.
  expect(options?.filter).toBeUndefined();
  const privateField = document.createElement("div");
  privateField.dataset.agentContext = "off";
  options?.onCloneEachNode?.(privateField);
  expect(privateField.style.visibility).toBe("hidden");
  const password = document.createElement("input");
  password.type = "password";
  options?.onCloneEachNode?.(password);
  expect(password.style.visibility).toBe("hidden");
  const panel = document.createElement("section");
  panel.dataset.capture = "off";
  panel.innerHTML = `<div style="visibility: visible">Escapes the box</div>`;
  options?.onCloneEachNode?.(panel);
  expect((panel.firstElementChild as HTMLElement).style.visibility).toBe("hidden");
  const plain = document.createElement("p");
  options?.onCloneEachNode?.(plain);
  expect(plain.style.visibility).toBe("");
  // Nothing asked for and nothing private: nothing painted.
  expect(calls).toEqual([]);
});

it("paints a private surface black where it stands, keeping the layout", async () => {
  document.body.innerHTML = `<p><span data-capture="off">Private prefix</span>Northwind</p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  // The private text is not counted as a redaction, but its box is painted.
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
  const black = calls.findIndex(([key, value]) => key === "set:fillStyle" && value === "#000000");
  const boxes = calls.slice(black).filter(([key]) => key === "fillRect");
  expect(boxes).toEqual([
    ["fillRect", 98, 48, 64, 20],
    ["fillRect", 8, 8, 84, 28],
  ]);
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

it("blacks out a text split over inline elements as it reads on screen", async () => {
  document.body.innerHTML = `<p>Contract with North<strong>wind</strong></p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("reads a line break or a new block as a space between words", async () => {
  document.body.innerHTML = `<p>Northwind<br>Traders</p><div><span>Acme</span><p>Corp</p></div>`;
  const result = await captureAppViewTool.execute(
    JSON.stringify({ redact: ["Northwind Traders", "Acme Corp"] }),
  );
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([
    { text: "Northwind Traders", places: 1 },
    { text: "Acme Corp", places: 1 },
  ]);
});

it("ignores hidden text between the visible pieces of a word", async () => {
  document.body.innerHTML = `<p>North<span style="display:none">internal</span>wind</p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("blacks out any option a list box shows, chosen or not", async () => {
  document.body.innerHTML = `<select multiple><option selected>Other</option><option>Northwind</option></select>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("frames a select only by the option it shows", async () => {
  document.body.innerHTML = `<select><option selected>View</option><option>Delete</option></select>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ mark: [{ text: "Delete" }] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).marks).toEqual([{ number: 1, text: "Delete", found: false }]);
});

it("ignores a line break that is not drawn", async () => {
  document.body.innerHTML = `<p>North<br style="display:none">wind</p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("reads inline-block pieces as one word", async () => {
  document.body.innerHTML = `<p>North<span style="display:inline-block">wind</span></p>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("blacks out the label a select shows, not only its value", async () => {
  document.body.innerHTML = `<select><option value="42" label="Northwind" selected>Customer</option></select>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ redact: ["Northwind"] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).redacted).toEqual([{ text: "Northwind", places: 1 }]);
});

it("never frames a hidden element, even one matching more tightly", async () => {
  document.body.innerHTML = `<div style="opacity: 0"><button>Save</button></div>`;
  const result = await captureAppViewTool.execute(JSON.stringify({ mark: [{ text: "Save" }] }));
  if (typeof result === "string") throw new Error(result);
  expect(JSON.parse(result.result).marks).toEqual([{ number: 1, text: "Save", found: false }]);
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
  // The frame's corner is at (6, 6); its number is kept inside the picture.
  expect(calls.find(([key]) => key === "fillText")).toEqual(["fillText", "1", 9, 9]);
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

describe("describeCaptureResult", () => {
  it("reads the JSON string a client tool returns", () => {
    expect(describeCaptureResult(JSON.stringify({ status: "captured" }))).toBe(
      "Current app view captured",
    );
  });

  it("says how many texts were blacked out and which were not found", () => {
    const result = JSON.stringify({
      status: "captured",
      redacted: [
        { text: "Acme", places: 2 },
        { text: "Paris", places: 0 },
      ],
    });
    expect(describeCaptureResult(result)).toBe(
      "Current app view captured · 1 text blacked out, 1 not found",
    );
  });

  it("shows the failure message", () => {
    const result = JSON.stringify({ status: "capture_failed", message: "No view to capture." });
    expect(describeCaptureResult(result)).toBe("No view to capture.");
    expect(describeCaptureResult("not json")).toBe("View unavailable");
  });
});
