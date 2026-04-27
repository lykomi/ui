import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
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

  // Mocks the npmjs registry fetch path. Builds a real tar.gz on the fly so the
  // tar extraction step in fetchNpmRegistryPreset is exercised end-to-end.
  describe("lastspace preset (npm registry fetch)", () => {
    let originalLocal: string | undefined;
    let stagingDir: string;
    let tarballPath: string;

    beforeEach(() => {
      // Force the registry path: clear any local override and any in-process
      // FOUNDRY_UI_PRESET_LASTSPACE_PATH so resolvePreset doesn't short-circuit.
      originalLocal = process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      delete process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;

      // Build a fake @lastspace/preset tarball. npm tarballs extract to a
      // top-level `package/` directory, so stage one and `tar -czf` it.
      stagingDir = mkdtempSync(join(tmpdir(), "cf-preset-stage-"));
      const pkgRoot = join(stagingDir, "package");
      mkdirSync(join(pkgRoot, "files"), { recursive: true });
      writeFileSync(
        join(pkgRoot, "manifest.json"),
        JSON.stringify({
          name: "lastspace",
          version: "0.1.0",
          extends: "default",
          filesDir: "files",
          extraDependencies: { "@lastspace/spaces-web-ui": "^0.1.0" },
        }),
      );
      writeFileSync(join(pkgRoot, "files", "marker"), "from-tarball");

      tarballPath = join(stagingDir, "preset.tgz");
      const tar = spawnSync("tar", ["-czf", tarballPath, "-C", stagingDir, "package"], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      if (tar.status !== 0) {
        throw new Error(`tar fixture build failed: ${tar.stderr?.toString()}`);
      }
    });

    afterEach(() => {
      vi.restoreAllMocks();
      rmSync(stagingDir, { recursive: true, force: true });
      if (originalLocal === undefined) delete process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
      else process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH = originalLocal;
    });

    function mockFetch(implementation: (url: string) => Promise<Response>): void {
      vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
        implementation(typeof input === "string" ? input : input.toString()),
      );
    }

    it("fetches metadata + tarball from npmjs and resolves the preset", async () => {
      const tarballUrl = "https://registry.npmjs.org/@lastspace/preset/-/preset-0.1.0.tgz";
      mockFetch(async (url) => {
        if (url.endsWith("preset-0.1.0.tgz")) {
          // Return the fixture tarball as the "registry" response.
          const buf = await import("node:fs").then((fs) =>
            fs.promises.readFile(tarballPath),
          );
          return new Response(buf, { status: 200 });
        }
        // Metadata response — `dist-tags.latest` + `versions['0.1.0'].dist.tarball`.
        return new Response(
          JSON.stringify({
            "dist-tags": { latest: "0.1.0" },
            versions: { "0.1.0": { dist: { tarball: tarballUrl } } },
          }),
          { status: 200 },
        );
      });

      const r = await resolvePreset("lastspace");
      expect(r.name).toBe("lastspace");
      expect(r.templateDir).toMatch(/template$/);
      expect(r.overlayDir).toMatch(/files$/);
      expect(r.extraDependencies).toEqual({ "@lastspace/spaces-web-ui": "^0.1.0" });
    });

    it("surfaces a clear error when the metadata fetch fails", async () => {
      mockFetch(async () => new Response("Not Found", { status: 404, statusText: "Not Found" }));
      await expect(resolvePreset("lastspace")).rejects.toThrow(
        /npm registry metadata fetch failed.*404/,
      );
    });

    it("surfaces a clear error when the registry has no latest version", async () => {
      mockFetch(
        async () =>
          new Response(JSON.stringify({ "dist-tags": {}, versions: {} }), { status: 200 }),
      );
      await expect(resolvePreset("lastspace")).rejects.toThrow(/No latest version or tarball URL/);
    });

    it("surfaces a clear error when the tarball download fails", async () => {
      const tarballUrl = "https://registry.npmjs.org/@lastspace/preset/-/preset-0.1.0.tgz";
      mockFetch(async (url) => {
        if (url.endsWith("preset-0.1.0.tgz")) {
          return new Response("Forbidden", { status: 403, statusText: "Forbidden" });
        }
        return new Response(
          JSON.stringify({
            "dist-tags": { latest: "0.1.0" },
            versions: { "0.1.0": { dist: { tarball: tarballUrl } } },
          }),
          { status: 200 },
        );
      });
      await expect(resolvePreset("lastspace")).rejects.toThrow(
        /Failed to download preset tarball.*403/,
      );
    });
  });
});
