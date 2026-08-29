import { describe, expect, it } from "vitest";
import { resolvePreset } from "../presets.js";

describe("resolvePreset", () => {
  it("resolves the default preset to the bundled template dir", async () => {
    const r = await resolvePreset("default");
    expect(r.name).toBe("default");
    expect(r.templateDir).toMatch(/template$/);
    expect(r.overlayDir).toBeUndefined();
    expect(r.envVars).toBeUndefined();
  });

  it("resolves the foundry-iq preset to the bundled overlay", async () => {
    const r = await resolvePreset("foundry-iq");
    expect(r.name).toBe("foundry-iq");
    expect(r.templateDir).toMatch(/template$/);
    expect(r.overlayDir).toMatch(/presets\/foundry-iq\/files$/);
    expect(r.envVars?.map((envVar) => envVar.name)).toEqual([
      "AZURE_AI_SEARCH_ENDPOINT",
      "FOUNDRY_IQ_KNOWLEDGE_BASE",
      "FOUNDRY_IQ_QUERY_SOURCE_AUTHORIZATION",
    ]);
  });

  it("resolves the neo4j preset to the bundled overlay", async () => {
    const r = await resolvePreset("neo4j");
    expect(r.name).toBe("neo4j");
    expect(r.templateDir).toMatch(/template$/);
    expect(r.overlayDir).toMatch(/presets\/neo4j\/files$/);
    expect(r.envVars?.map((envVar) => envVar.name)).toEqual([
      "NEO4J_URI",
      "NEO4J_USERNAME",
      "NEO4J_PASSWORD",
      "NEO4J_DATABASE",
      "NEO4J_ALLOW_WRITES",
      "NEO4J_VECTOR_INDEX",
      "FOUNDRY_EMBEDDING_MODEL",
      "FOUNDRY_MODELS_ENDPOINT",
    ]);
    expect(r.envVars?.find((v) => v.name === "NEO4J_PASSWORD")?.secret).toBe(true);
  });

  it("carries the neo4j preset's extra dependency and scripts", async () => {
    // The graph package is the preset's whole point; the scripts are what make
    // `pnpm graph:up && pnpm graph:seed` a one-liner instead of a README step.
    const r = await resolvePreset("neo4j");
    expect(r.extraDependencies).toHaveProperty("@iloveagents/foundry-web-graph");
    expect(Object.keys(r.extraScripts ?? {})).toEqual([
      "graph:up",
      "graph:down",
      "graph:seed",
      "graph:reset",
    ]);
  });

  it("rejects unknown presets with a clear error", async () => {
    await expect(resolvePreset("does-not-exist")).rejects.toThrow(/Unknown preset/);
  });
});
