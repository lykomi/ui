import { describe, expect, it } from "vitest";
import {
  LabelTier,
  captionRect,
  createCaptionMeasurer,
  edgeLabelRect,
  nodeRect,
  placeLabels,
  type LabelCandidate,
} from "../caption-placement.ts";

/** A node caption 60px wide, under a node of radius 6 at (x, y). */
const caption = (id: string, x: number, y: number, over: Partial<LabelCandidate> = {}) => ({
  id,
  rect: captionRect(x, y, 6, 60),
  tier: LabelTier.Caption,
  weight: 1,
  exempt: [id],
  ...over,
});

describe("placeLabels", () => {
  it("keeps both labels when they do not overlap", () => {
    const placed = placeLabels([caption("a", 100, 100), caption("b", 400, 100)]);
    expect([...placed].sort()).toEqual(["a", "b"]);
  });

  it("drops the loser of an overlap, keeping the heavier node", () => {
    const placed = placeLabels([
      caption("small", 100, 100, { weight: 1 }),
      caption("hub", 100, 100, { weight: 9 }),
    ]);
    expect([...placed]).toEqual(["hub"]);
  });

  it("gives the selected node its caption even against a bigger neighbour", () => {
    // The node the user is pointing at is the answer to a question they just
    // asked — losing its name to a hub is the wrong trade.
    const placed = placeLabels([
      caption("hub", 100, 100, { weight: 99 }),
      caption("selected", 100, 100, { weight: 1, tier: LabelTier.Pinned }),
    ]);
    expect([...placed]).toEqual(["selected"]);
  });

  it("ranks a search hit above an ordinary caption, and a caption above an edge", () => {
    const matchWins = placeLabels([
      caption("ordinary", 100, 100, { weight: 99 }),
      caption("match", 100, 100, { weight: 1, tier: LabelTier.Match }),
    ]);
    expect([...matchWins]).toEqual(["match"]);

    const captionWins = placeLabels([
      caption("edge", 100, 100, { weight: 99, tier: LabelTier.Edge }),
      caption("node", 100, 100, { weight: 1 }),
    ]);
    expect([...captionWins]).toEqual(["node"]);
  });

  it("separates by the label box, not the node — captions sit below the node", () => {
    // Clear: a's label occupies y 109..123, b's starts at 209.
    expect(placeLabels([caption("a", 100, 100), caption("b", 100, 200)]).size).toBe(2);
    // Overlapping: b's label starts at 114, inside a's 109..123.
    expect(placeLabels([caption("a", 100, 100), caption("b", 100, 105)]).size).toBe(1);
  });

  it("will not print a label across a node's disc", () => {
    const placed = placeLabels([caption("hub", 100, 100, { weight: 9 })], {
      obstacles: [{ id: "other", rect: nodeRect(100, 118, 10) }],
    });
    expect(placed.size).toBe(0);
  });

  it("lets a label overlap the obstacles it names", () => {
    const placed = placeLabels([caption("solo", 100, 100)], {
      obstacles: [{ id: "solo", rect: nodeRect(100, 110, 20) }],
    });
    expect([...placed]).toEqual(["solo"]);
  });

  it("ignores candidates outside the viewport, so they cannot suppress visible ones", () => {
    const viewport = { width: 800, height: 600 };
    expect(placeLabels([caption("offscreen", -500, 100)], { viewport }).size).toBe(0);
    expect(placeLabels([caption("inside", 400, 300)], { viewport }).size).toBe(1);
  });

  it("is stable for equal weights, so a label cannot flicker between two names", () => {
    const input = [
      caption("zebra", 100, 100, { weight: 5 }),
      caption("alpha", 100, 100, { weight: 5 }),
    ];
    expect([...placeLabels(input)]).toEqual([...placeLabels([...input].reverse())]);
  });

  it("does not mutate the caller's array", () => {
    const input = [caption("b", 100, 100, { weight: 1 }), caption("a", 400, 100, { weight: 9 })];
    placeLabels(input);
    expect(input.map((candidate) => candidate.id)).toEqual(["b", "a"]);
  });

  it("stops at the limit rather than scanning a huge graph", () => {
    const many = Array.from({ length: 500 }, (_, i) => caption(`n${i}`, i * 200, 100));
    expect(placeLabels(many, { limit: 10 }).size).toBe(10);
  });
});

describe("edgeLabelRect", () => {
  it("centres on the edge's midpoint", () => {
    const rect = edgeLabelRect(0, 0, 200, 0, 60);
    expect((rect.left + rect.right) / 2).toBe(100);
    expect((rect.top + rect.bottom) / 2).toBe(0);
  });

  it("swaps width for height as the edge turns vertical", () => {
    const horizontal = edgeLabelRect(0, 0, 200, 0, 60);
    const vertical = edgeLabelRect(0, 0, 0, 200, 60);
    expect(horizontal.right - horizontal.left).toBeCloseTo(60);
    expect(vertical.bottom - vertical.top).toBeCloseTo(60);
  });
});

describe("createCaptionMeasurer", () => {
  it("returns a width and caches by string", () => {
    const measure = createCaptionMeasurer();
    const first = measure("Metropolis");
    expect(first).toBeGreaterThan(0);
    expect(measure("Metropolis")).toBe(first);
    expect(measure("Metropolis and the workers below")).toBeGreaterThan(first);
  });
});
