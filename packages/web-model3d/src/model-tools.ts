import { clientToolRegistry, type ClientToolEntry } from "@iloveagents/foundry-agent";
import { activeModel, type ModelHandle } from "./model-types.ts";

type Args = Record<string, unknown>;
function numberArg(args: Args, name: string, min: number, max: number, fallback?: number): number {
  const value = args[name] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}
function idsArg(args: Args): string[] {
  if (
    !Array.isArray(args.ids) ||
    args.ids.length > 100 ||
    args.ids.some((id) => typeof id !== "string")
  ) {
    throw new Error("ids must contain at most 100 exact part IDs from model3d_list_parts.");
  }
  return [...new Set(args.ids as string[])];
}
const modelProperty = {
  modelId: {
    type: "string",
    description: "Optional entity/model ID. Only the focused viewer can be controlled.",
  },
};
function tool(
  name: string,
  description: string,
  properties: Args,
  required: string[],
  run: (model: ModelHandle, args: Args) => unknown,
): ClientToolEntry {
  return {
    name,
    description,
    parameters: { type: "object", properties: { ...modelProperty, ...properties }, required },
    execute: async (input) => {
      try {
        const parsed: unknown = JSON.parse(input || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("Expected an argument object.");
        const args = parsed as Args;
        if (args.modelId !== undefined && typeof args.modelId !== "string")
          throw new Error("modelId must be a string.");
        return JSON.stringify(run(activeModel(args.modelId as string | undefined), args));
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  };
}
const idsProperty = {
  ids: {
    type: "array",
    items: { type: "string" },
    maxItems: 100,
    description: "Exact GLB node IDs. An empty array clears marks or frames the entire model.",
  },
};

export const MODEL_CLIENT_TOOLS: ClientToolEntry[] = [
  tool(
    "model3d_get_view",
    "Read the focused 3D model, selected parts, highlights, model rotation, explosion. Read this before answering about 'this part'.",
    {},
    [],
    (model) => ({ ...model.getView(), partCount: model.getParts().length }),
  ),
  tool(
    "model3d_list_parts",
    "Find addressable GLB parts and assemblies by name or metadata. Returns exact IDs, parent IDs and exported extras. These are export nodes, not necessarily a complete CAD bill of materials. IDs apply only to this model revision.",
    {
      query: { type: "string" },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    [],
    (model, args) => {
      if (args.query !== undefined && typeof args.query !== "string")
        throw new Error("query must be a string.");
      const query = ((args.query as string | undefined) ?? "").toLowerCase();
      const matches = model
        .getParts()
        .filter((part) =>
          `${part.name} ${JSON.stringify(part.metadata)}`.toLowerCase().includes(query),
        );
      const offset = numberArg(args, "offset", 0, 1000000, 0);
      const limit = numberArg(args, "limit", 1, 100, 50);
      if (!Number.isInteger(offset) || !Number.isInteger(limit))
        throw new Error("offset and limit must be integers.");
      return {
        modelId: model.getView().modelId,
        total: matches.length,
        parts: matches.slice(offset, offset + limit),
        nextOffset: offset + limit < matches.length ? offset + limit : null,
      };
    },
  ),
  tool(
    "model3d_highlight",
    "Mark parts or whole assemblies in the focused model with a color or pointing arrows. Search parts first; never invent an ID. Empty ids clears marks.",
    {
      ...idsProperty,
      color: {
        type: "string",
        pattern: "^#[0-9a-fA-F]{6}$",
        description: "Hex color, e.g. #ff8800.",
      },
      style: { type: "string", enum: ["color", "arrow"] },
    },
    ["ids"],
    (model, args) => {
      const color = args.color ?? "#ff8800";
      const style = args.style ?? "color";
      if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))
        throw new Error("color must be a six-digit hex color.");
      if (style !== "color" && style !== "arrow") throw new Error("style must be color or arrow.");
      model.highlight(idsArg(args), color, style);
      return model.getView();
    },
  ),
  tool(
    "model3d_focus",
    "Frame specific parts in the 3D viewer. Empty ids frames the entire model.",
    idsProperty,
    ["ids"],
    (model, args) => {
      model.focus(idsArg(args));
      return model.getView();
    },
  ),
  tool(
    "model3d_rotate",
    "Rotate the displayed model around an axis by degrees, relative to its current orientation. This changes the view, not the saved file.",
    {
      axis: { type: "string", enum: ["x", "y", "z"] },
      degrees: { type: "number", minimum: -360, maximum: 360 },
    },
    ["axis", "degrees"],
    (model, args) => {
      if (args.axis !== "x" && args.axis !== "y" && args.axis !== "z")
        throw new Error("axis must be x, y or z.");
      model.rotate(args.axis, numberArg(args, "degrees", -360, 360));
      return model.getView();
    },
  ),
  tool(
    "model3d_explode",
    "Separate the exported mesh parts radially to inspect the assembly. This is a visual exploded view, not a physically validated disassembly. amount 0 restores original positions; 1 moves by roughly a model radius.",
    {
      amount: { type: "number", minimum: 0, maximum: 2 },
    },
    ["amount"],
    (model, args) => {
      model.explode(numberArg(args, "amount", 0, 2));
      return model.getView();
    },
  ),
  tool(
    "model3d_reset",
    "Restore the model's original rotation and part positions, clear marks and frame the model. Leaves the saved GLB unchanged.",
    {},
    [],
    (model) => {
      model.reset();
      return model.getView();
    },
  ),
];

export function registerModelClientTools(): void {
  for (const entry of MODEL_CLIENT_TOOLS) {
    const registry = clientToolRegistry.getState();
    if (registry.globalTools.get(entry.name) !== entry) registry.registerGlobal(entry);
  }
}
