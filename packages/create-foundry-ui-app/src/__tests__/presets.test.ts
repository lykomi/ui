import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolvePreset } from "../presets.js";

describe("resolvePreset", () => {
  it("resolves the default preset to the bundled template dir", async () => {
    const r = await resolvePreset("default");
    expect(r.name).toBe("default");
    expect(r.templateDir).toMatch(/template$/);
    expect(r.overlayDir).toBeUndefined();
  });

  it("rejects unknown presets with a clear error", async () => {
    await expect(resolvePreset("does-not-exist")).rejects.toThrow(/Unknown preset/);
  });

  describe("lastspace preset (no token)", () => {
    let originalToken: string | undefined;
    let originalLocal: string | undefined;

    beforeEach(() => {
      originalToken = process.env.FOUNDRY_UI_TOKEN;
      originalLocal = process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      delete process.env.FOUNDRY_UI_TOKEN;
      delete process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
    });

    afterEach(() => {
      if (originalToken === undefined) delete process.env.FOUNDRY_UI_TOKEN;
      else process.env.FOUNDRY_UI_TOKEN = originalToken;
      if (originalLocal === undefined) delete process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      else process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH = originalLocal;
    });

    it("throws a clear error mentioning FOUNDRY_UI_TOKEN", async () => {
      await expect(resolvePreset("lastspace")).rejects.toThrow(/FOUNDRY_UI_TOKEN/);
    });
  });

  describe("lastspace preset (local override path)", () => {
    let presetRoot: string;
    let originalLocal: string | undefined;

    beforeEach(() => {
      originalLocal = process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      presetRoot = mkdtempSync(join(tmpdir(), "cf-local-preset-"));
      writeFileSync(
        join(presetRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.0.0-test",
          extends: "default",
          filesDir: "files",
          extraDependencies: { "@lastspace/spaces-web-ui": "^0.1.0" },
          envVars: [
            {
              name: "FOUNDRY_UI_TOKEN",
              description: "PAT",
              required: true,
              secret: true,
            },
          ],
        }),
      );
      mkdirSync(join(presetRoot, "files"));
      writeFileSync(join(presetRoot, "files", "marker"), "overlay-present");
      process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH = presetRoot;
    });

    afterEach(() => {
      rmSync(presetRoot, { recursive: true, force: true });
      if (originalLocal === undefined) delete process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      else process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH = originalLocal;
    });

    it("uses the local preset path when FOUNDRY_UI_PRESET_LASTSPACE_PATH is set", async () => {
      const r = await resolvePreset("lastspace");
      expect(r.name).toBe("lastspace");
      expect(r.templateDir).toMatch(/template$/);
      expect(r.overlayDir).toMatch(/files$/);
      expect(r.extraDependencies).toEqual({ "@lastspace/spaces-web-ui": "^0.1.0" });
      expect(r.envVars?.[0].name).toBe("FOUNDRY_UI_TOKEN");
    });

    it("rejects manifests that extend something other than 'default'", async () => {
      writeFileSync(
        join(presetRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.0.0-test",
          extends: "something-else",
          filesDir: "files",
        }),
      );
      await expect(resolvePreset("lastspace")).rejects.toThrow(/extends 'something-else'/);
    });

    it("rejects manifests whose filesDir does not exist", async () => {
      writeFileSync(
        join(presetRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.0.0-test",
          extends: "default",
          filesDir: "missing",
        }),
      );
      await expect(resolvePreset("lastspace")).rejects.toThrow(/filesDir='missing'/);
    });
  });
});
