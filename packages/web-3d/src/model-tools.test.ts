import { afterEach, describe, expect, it, vi } from "vitest";
import { clientToolRegistry } from "@lykomi/agent";
import { connectModel, type ModelHandle } from "./model-types.ts";
import { registerModelClientTools } from "./model-tools.ts";

const disconnects: (() => void)[] = [];
afterEach(() => {
  disconnects.splice(0).forEach((stop) => stop());
});
const handle = (modelId: string): ModelHandle => ({
  getParts: () => [
    {
      id: "node:3",
      name: "Bearing",
      parentId: "node:0",
      kind: "part",
      metadata: { partNumber: "B-300" },
    },
  ],
  getView: () => ({
    modelId,
    title: "Assembly",
    selectedIds: [],
    highlights: null,
    explosion: 0,
    rotation: [0, 0, 0],
  }),
  highlight: vi.fn(),
  focus: vi.fn(),
  rotate: vi.fn(),
  explode: vi.fn(),
  reset: vi.fn(),
});
const execute = async (name: string, args: unknown = {}) => {
  registerModelClientTools();
  return JSON.parse(await clientToolRegistry.getState().executeTool(name, JSON.stringify(args)));
};

describe("model AG-UI tools", () => {
  it("controls only the focused surface; hidden tabs do not answer, and stale cleanup cannot disconnect a replacement", async () => {
    const hidden = handle("hidden"),
      active = handle("active");
    disconnects.push(
      connectModel(hidden, () => false),
      connectModel(active, () => true),
    );
    expect(await execute("model3d_get_view")).toMatchObject({ modelId: "active", partCount: 1 });
    expect(await execute("model3d_rotate", { axis: "y", degrees: 90 })).not.toHaveProperty("error");
    expect(active.rotate).toHaveBeenCalledWith("y", 90);
    expect(hidden.rotate).not.toHaveBeenCalled();
    expect(await execute("model3d_get_view", { modelId: "hidden" })).toHaveProperty("error");
    disconnects[0]();
    expect(await execute("model3d_get_view")).toHaveProperty("modelId", "active");
  });

  it("refuses ambiguous or unavailable surfaces", async () => {
    expect(await execute("model3d_get_view")).toHaveProperty("error");
    disconnects.push(
      connectModel(handle("a"), () => true),
      connectModel(handle("b"), () => true),
    );
    expect(await execute("model3d_reset")).toHaveProperty("error");
    expect(await execute("model3d_get_view", { modelId: "b" })).toHaveProperty("modelId", "b");
  });

  it("finds metadata and validates commands without silently applying defaults", async () => {
    const model = handle("a");
    disconnects.push(connectModel(model, () => true));
    expect((await execute("model3d_list_parts", { query: "B-300" })).parts[0].id).toBe("node:3");
    expect(await execute("model3d_explode", { amount: 3 })).toHaveProperty("error");
    expect(await execute("model3d_explode", { amount: "1" })).toHaveProperty("error");
    expect(await execute("model3d_rotate", { axis: "invalid", degrees: 90 })).toHaveProperty(
      "error",
    );
    expect(await execute("model3d_highlight", { ids: ["node:3"], color: "red" })).toHaveProperty(
      "error",
    );
    expect(model.explode).not.toHaveBeenCalled();
    expect(
      await execute("model3d_highlight", { ids: ["node:3"], style: "arrow", color: "#00ff00" }),
    ).not.toHaveProperty("error");
    expect(model.highlight).toHaveBeenCalledWith(["node:3"], "#00ff00", "arrow");
    expect(
      clientToolRegistry
        .getState()
        .getActiveSchemas()
        .map((tool) => tool.name),
    ).toContain("model3d_highlight");
  });
});

it("never applies an explicit empty model ID to another active model", async () => {
  const other = handle("other");
  disconnects.push(connectModel(other, () => true));
  expect(await execute("model3d_reset", { modelId: "" })).toHaveProperty("error");
  expect(other.reset).not.toHaveBeenCalled();
});

it("finds ASCII part codes with Turkish default casing", async () => {
  const original = String.prototype.toLocaleLowerCase;
  vi.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(function (this: string) {
    return original.call(this, "tr");
  });
  try {
    const model = handle("a");
    model.getParts = () => [
      { id: "node:0", name: "PIN", parentId: null, kind: "part", metadata: {} },
    ];
    disconnects.push(connectModel(model, () => true));
    expect((await execute("model3d_list_parts", { query: "pin" })).parts).toHaveLength(1);
  } finally {
    vi.restoreAllMocks();
  }
});
