import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  Bone,
  Box3,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from "three";
import { parseModel, inspectGlb, disposeModel } from "./model-resources.ts";
import { ModelArrow } from "./model-arrow.ts";
import { ModelScene } from "./model-scene.ts";

const bytes = () => {
  const file = readFileSync(resolve(process.cwd(), "fixtures/agent-assembly.glb"));
  return Uint8Array.from(file).buffer;
};
const fixture = async () => {
  const gltf = await parseModel(bytes());
  return new ModelScene(gltf.scene, gltf);
};

describe("GLB model scene", () => {
  it("preserves source node names, extras, assembly parents and repeated part occurrences", async () => {
    const model = await fixture();
    expect(model.parts).toHaveLength(5);
    expect(model.parts.find((part) => part.id === "node:0")).toMatchObject({
      kind: "assembly",
      name: "Drive assembly",
    });
    expect(model.parts.find((part) => part.id === "node:3")).toMatchObject({
      name: "Bearing front",
      parentId: "node:0",
      kind: "part",
      metadata: { partNumber: "B-300", occurrence: 1 },
    });
    expect(model.parts.find((part) => part.id === "node:4")?.metadata.occurrence).toBe(2);
    disposeModel(model.root);
  });

  it("highlights just one occurrence even when material and geometry are shared, then restores it", async () => {
    const model = await fixture();
    const front = model.objects.get("node:3") as Mesh;
    const rear = model.objects.get("node:4") as Mesh;
    const original = front.material;
    expect(front.material).toBe(rear.material);
    model.highlight(["node:3"], "#ff0000", "color");
    expect((front.material as MeshStandardMaterial).color).toEqual(new Color("#ff0000"));
    expect(rear.material).toBe(original);
    model.highlight([], "#ff0000", "color");
    expect(front.material).toBe(original);
    model.dispose();
    disposeModel(model.root);
  });

  it("rejects an unknown ID atomically and can mark a whole assembly", async () => {
    const model = await fixture();
    const front = model.objects.get("node:3") as Mesh;
    const original = front.material;
    expect(() => model.highlight(["node:3", "missing"], "#ff0000", "color")).toThrow(
      "Unknown part ID",
    );
    expect(front.material).toBe(original);
    model.highlight(["node:0"], "#ff0000", "color");
    expect(front.material).not.toBe(original);
    model.dispose();
    disposeModel(model.root);
  });

  it("explodes from original positions without drift and restores the exact transforms", async () => {
    const model = await fixture();
    const front = model.objects.get("node:3")!;
    const origin = front.position.clone();
    model.explode(1);
    const exploded = front.position.clone();
    expect(exploded.distanceTo(origin)).toBeGreaterThan(0);
    model.explode(1);
    expect(front.position).toEqual(exploded);
    model.explode(0);
    expect(front.position).toEqual(origin);
    expect(model.root.getWorldPosition(new Vector3())).toEqual(new Vector3());
    disposeModel(model.root);
  });
});

describe("self-contained GLB boundary", () => {
  it("rejects non-GLB content and malformed chunk lengths", () => {
    expect(() => inspectGlb(new ArrayBuffer(40))).toThrow("valid glTF");
    const file = bytes();
    new DataView(file).setUint32(12, file.byteLength, true);
    expect(() => inspectGlb(file)).toThrow("Truncated");
  });
  it("rejects external texture or buffer URLs before GLTFLoader can fetch them", () => {
    const text = JSON.stringify({
      asset: { version: "2.0" },
      images: [{ uri: "https://example.com/private.png" }],
    });
    const chunk = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4, " "));
    const file = new ArrayBuffer(20 + chunk.length),
      header = new DataView(file);
    header.setUint32(0, 0x46546c67, true);
    header.setUint32(4, 2, true);
    header.setUint32(8, file.byteLength, true);
    header.setUint32(12, chunk.length, true);
    header.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(file, 20).set(chunk);
    expect(() => inspectGlb(file)).toThrow("external files");
  });
});

it("disposes a shared skin skeleton and its bone texture once", () => {
  const skeleton = new Skeleton([new Bone()]);
  skeleton.computeBoneTexture();
  const dispose = vi.spyOn(skeleton, "dispose");
  const textureDispose = vi.spyOn(skeleton.boneTexture!, "dispose");
  const root = new Group();
  for (let index = 0; index < 2; index++) {
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.bind(skeleton);
    root.add(mesh);
  }
  disposeModel(root);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(textureDispose).toHaveBeenCalledTimes(1);
});

it.each(["x", "z"] as const)("points toward the target after %s rotation", async (axis) => {
  const model = await fixture();
  const parent = new Group();
  parent.rotation[axis] = Math.PI / 3;
  parent.add(model.root);
  parent.updateMatrixWorld(true);
  model.highlight(["node:3"], "#ff8800", "arrow");
  model.root.updateMatrixWorld(true);
  const arrow = model.root.children.find((child) => child instanceof ModelArrow)!;
  const direction = new Vector3(0, -1, 0).applyQuaternion(
    arrow.getWorldQuaternion(new Quaternion()),
  );
  expect(direction.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-6);
  model.dispose();
  disposeModel(model.root);
});

it("explodes nested mesh nodes by their own world displacement only", () => {
  const root = new Group();
  const parent = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  parent.position.set(2, 0, 0);
  parent.rotation.z = Math.PI / 4;
  parent.scale.set(2, 1, 1);
  const child = new Mesh(new BoxGeometry(), parent.material);
  child.position.set(0, 2, 0);
  parent.add(child);
  root.add(parent);
  const model = new ModelScene(root, {
    parser: {
      associations: new Map([
        [parent, { nodes: 0 }],
        [child, { nodes: 1 }],
      ]),
      json: { nodes: [{ name: "Parent" }, { name: "Child" }] },
    },
  } as ConstructorParameters<typeof ModelScene>[1]);
  const before = child.getWorldPosition(new Vector3());
  const center = new Box3().setFromObject(child).getCenter(new Vector3());
  const expected = center
    .sub(model.bounds.getCenter(new Vector3()))
    .normalize()
    .multiplyScalar(model.radius);
  model.explode(1);
  expect(child.getWorldPosition(new Vector3()).sub(before).distanceTo(expected)).toBeLessThan(1e-6);
  model.explode(0);
  expect(child.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-6);
  disposeModel(root);
});

it("disposes alternate scenes and shared resources exactly once", () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const alternateGeometry = new BoxGeometry();
  const first = new Group(),
    alternate = new Group();
  first.add(new Mesh(geometry, material));
  alternate.add(new Mesh(geometry, material), new Mesh(alternateGeometry, material));
  const sharedDispose = vi.spyOn(geometry, "dispose");
  const alternateDispose = vi.spyOn(alternateGeometry, "dispose");
  const materialDispose = vi.spyOn(material, "dispose");
  disposeModel([first, alternate]);
  expect(sharedDispose).toHaveBeenCalledTimes(1);
  expect(alternateDispose).toHaveBeenCalledTimes(1);
  expect(materialDispose).toHaveBeenCalledTimes(1);
});
