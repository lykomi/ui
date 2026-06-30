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

  it("rejects unknown presets with a clear error", async () => {
    await expect(resolvePreset("does-not-exist")).rejects.toThrow(/Unknown preset/);
  });
});
