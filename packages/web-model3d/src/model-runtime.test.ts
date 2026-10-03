import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  Vector3,
} from "three";
import { ModelArrow } from "./model-arrow.ts";
import { ModelRuntime } from "./model-runtime.ts";
import { parseModel } from "./model-resources.ts";

vi.mock("three", async (original) => {
  const actual = await original<typeof import("three")>();
  class Renderer {
    domElement = document.createElement("canvas");
    setPixelRatio() {}
    setSize() {}
    setAnimationLoop() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: Renderer };
});
it("reframes a zero-size mount on first reveal without resetting later user views", async () => {
  const file = readFileSync(resolve(process.cwd(), "fixtures/agent-assembly.glb"));
  const gltf = await parseModel(Uint8Array.from(file).buffer);
  const host = document.createElement("div");
  document.body.append(host);
  let size = { width: 0, height: 0 };
  vi.spyOn(host, "getBoundingClientRect").mockImplementation(() => size as DOMRect);
  let resize!: () => void;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const runtime = new ModelRuntime(
    host,
    gltf,
    "model",
    "Demo",
    () => true,
    () => {},
  );
  const distance = () => Math.hypot(...runtime.getView().camera!.position);
  const initial = distance();
  size = { width: 200, height: 800 };
  resize();
  expect(distance()).toBeGreaterThan(initial * 2);
  runtime.highlight(["node:3"], "#ff8800", "arrow");
  runtime.rotate("x", 45);
  runtime.rotate("z", 30);
  gltf.scene.updateMatrixWorld(true);
  const arrow = gltf.scene.children.find((object) => object instanceof ModelArrow)!;
  const direction = new Vector3(0, -1, 0).applyQuaternion(
    arrow.getWorldQuaternion(new Quaternion()),
  );
  expect(direction.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-6);
  const framed = runtime.getView().camera!.position;
  size = { width: 220, height: 800 };
  resize();
  expect(runtime.getView().camera!.position).toEqual(framed);
  runtime.dispose();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("frames an initially visible canvas after the structure tree reduces its width", async () => {
  const file = readFileSync(resolve(process.cwd(), "fixtures/agent-assembly.glb"));
  const gltf = await parseModel(Uint8Array.from(file).buffer);
  const host = document.createElement("div");
  document.body.append(host);
  let size = { width: 600, height: 600 };
  vi.spyOn(host, "getBoundingClientRect").mockImplementation(() => size as DOMRect);
  let resize!: () => void;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const runtime = new ModelRuntime(
    host,
    gltf,
    "model",
    "Demo",
    () => true,
    () => {},
  );
  const initial = Math.hypot(...runtime.getView().camera!.position);
  size = { width: 200, height: 600 };
  resize();
  expect(Math.hypot(...runtime.getView().camera!.position)).toBeGreaterThan(initial * 2);
  const position = runtime.getView().camera!.position;
  size = { width: 250, height: 600 };
  resize();
  expect(runtime.getView().camera!.position).toEqual(position);
  runtime.dispose();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["line", "points"])("selects a rendered %s on canvas tap", (kind) => {
  const root = new Group();
  const part =
    kind === "line"
      ? new Line(new BoxGeometry(), new LineBasicMaterial())
      : new Points(new BoxGeometry(), new PointsMaterial());
  root.add(part);
  const gltf = {
    scene: root,
    scenes: [root],
    parser: { associations: new Map([[part, { nodes: 0 }]]), json: { nodes: [{ name: "Part" }] } },
  } as ConstructorParameters<typeof ModelRuntime>[1];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  document.body.append(host);
  vi.spyOn(Raycaster.prototype, "intersectObject").mockReturnValue([{ object: part }] as ReturnType<
    Raycaster["intersectObject"]
  >);
  const runtime = new ModelRuntime(
    host,
    gltf,
    "model",
    "Demo",
    () => true,
    () => {},
  );
  const canvas = runtime.renderer.domElement;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 10, button: 0 }));
  canvas.dispatchEvent(new MouseEvent("pointerup", { clientX: 10, clientY: 10, button: 0 }));
  expect(runtime.getView().selectedIds).toEqual(["node:0"]);
  runtime.dispose();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
