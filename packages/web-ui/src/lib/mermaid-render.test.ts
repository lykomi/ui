import { expect, it, vi } from "vitest";
import { MAX_MERMAID_LENGTH, mermaidDocument, renderMermaid } from "./mermaid-render.ts";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
  mermaidAPI: {
    getDiagramFromText: vi.fn(async () => ({
      type: "flowchart-v2",
      db: { getVertices: () => new Map() },
    })),
    defaultConfig: { sequence: {}, flowchart: {}, fontFamily: "", securityLevel: "strict" },
  },
}));
vi.mock("mermaid", () => ({ default: mermaid }));
it("sanitizes SVG and isolates preview CSS from network access", async () => {
  mermaid.render.mockResolvedValue({
    svg: '<svg viewBox="0 0 100 100"><script>alert(1)</script><foreignObject><div>HTML</div></foreignObject><image href="https://example.com/x"/><a href="javascript:alert(1)"><text>link</text></a><text onclick="alert(1)">safe</text></svg>',
  });
  const svg = await renderMermaid("flowchart TD\nA-->B", {});
  expect(svg).toContain("safe");
  expect(svg).not.toMatch(/script|foreignObject|image|href|onclick/);
  expect(mermaidDocument(svg)).toContain("default-src 'none'");
  expect(mermaid.initialize.mock.calls.at(-1)?.[0].secure).toEqual(
    expect.arrayContaining([
      "sequence",
      "flowchart",
      "fontFamily",
      "themeCSS",
      "themeVariables",
      "secure",
    ]),
  );
  expect(document.querySelector('[id^="foundry-mermaid-"]')).toBeNull();
});
it("rejects resource-fetching source and bounded oversize input before rendering", async () => {
  const before = mermaid.render.mock.calls.length;
  mermaid.mermaidAPI.getDiagramFromText.mockResolvedValueOnce({
    type: "flowchart-v2",
    db: { getVertices: () => new Map([["A", { img: "https://example.com/x" }]]) },
  });
  for (const source of [
    "x".repeat(MAX_MERMAID_LENGTH + 1),
    "flowchart TD\nclassDef x fill:url(https://example.com)",
    'flowchart TD\nA@{ img: "https://example.com/x" }',
    String.raw`---
config:
  fontFamily: x; background-image:u\72l(https://example.invalid/pixel)
---
flowchart TD
A-->B`,
    String.raw`flowchart TD
A-->B
classDef x fill:\75\72\6c(https://example.invalid/pixel)`,
  ]) {
    await expect(renderMermaid(source, {})).rejects.toThrow();
  }
  expect(mermaid.render.mock.calls.length).toBe(before);
});
it("serializes initialization with each render and recovers after a failure", async () => {
  const order: string[] = [];
  mermaid.initialize.mockImplementation((config) => order.push(config.themeVariables.name));
  mermaid.render.mockImplementation(async (_id, source) => {
    order.push(source);
    if (source === "bad") throw new Error("invalid");
    return { svg: "<svg/>" };
  });
  const first = renderMermaid("bad", { name: "one" });
  const second = renderMermaid("good", { name: "two" });
  await expect(first).rejects.toThrow("invalid");
  await second;
  expect(order).toEqual(["one", "bad", "two", "good"]);
});

it("renders ordinary icon/image labels and rejects resource attributes parsed from escaped keys", async () => {
  mermaid.render.mockResolvedValue({ svg: "<svg/>" });
  await expect(renderMermaid('flowchart TD\nA["Icon: settings"]', {})).resolves.toContain("svg");
  await expect(renderMermaid('flowchart TD\nA["img: thumbnail"]', {})).resolves.toContain("svg");
  const before = mermaid.render.mock.calls.length;
  mermaid.mermaidAPI.getDiagramFromText.mockResolvedValueOnce({
    type: "flowchart-v2",
    db: { getVertices: () => new Map([["A", { img: "https://example.invalid/image" }]]) },
  });
  await expect(
    renderMermaid(
      String.raw`flowchart TD
A@{"\u0069mg":"https://example.invalid/image"}`,
      {},
    ),
  ).rejects.toThrow("External resources");
  expect(mermaid.render.mock.calls.length).toBe(before);
});
