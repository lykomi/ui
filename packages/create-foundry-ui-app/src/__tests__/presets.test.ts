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

    it("rejects manifests whose declared filesDir directory does not exist", async () => {
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

    it("defaults filesDir to 'files' when the manifest omits it", async () => {
      writeFileSync(
        join(presetRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.0.0-test",
          extends: "default",
          // filesDir omitted on purpose
        }),
      );
      const r = await resolvePreset("lastspace");
      expect(r.overlayDir).toMatch(/files$/);
    });

    it("rejects manifests omitting filesDir when no 'files/' dir exists either", async () => {
      writeFileSync(
        join(presetRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.0.0-test",
          extends: "default",
        }),
      );
      // Remove the files/ dir created in beforeEach so the default lookup fails.
      rmSync(join(presetRoot, "files"), { recursive: true, force: true });
      await expect(resolvePreset("lastspace")).rejects.toThrow(/no 'files\/' directory/);
    });
  });
});
