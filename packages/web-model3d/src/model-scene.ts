import { Box3, Mesh, Quaternion, Vector3, type Material, type Object3D } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { ModelPart } from "./model-types.ts";
import { ModelArrow } from "./model-arrow.ts";

export class ModelScene {
  readonly root: Object3D;
  readonly parts: ModelPart[] = [];
  readonly objects = new Map<string, Object3D>();
  readonly bounds: Box3;
  readonly radius: number;
  private origins = new Map<Object3D, Vector3>();
  private offsets = new Map<Object3D, Vector3>();
  private originals = new Map<Mesh, Material | Material[]>();
  private arrows: ModelArrow[] = [];

  constructor(root: Object3D, gltf: Pick<GLTF, "parser">) {
    this.root = root;
    root.updateMatrixWorld(true);
    this.bounds = new Box3().setFromObject(root);
    if (this.bounds.isEmpty()) throw new Error("This model has no visible geometry.");
    this.radius = Math.max(this.bounds.getSize(new Vector3()).length() / 2, 0.001);
    const ids = new Map<Object3D, string>();
    // GLTFLoader sanitises names; the source node index remains an unambiguous ID.
    root.traverse((object) => {
      const index = gltf.parser.associations.get(object)?.nodes;
      if (index !== undefined) {
        ids.set(object, `node:${index}`);
        this.objects.set(`node:${index}`, object);
      }
    });
    const worldOffsets = new Map<Object3D, Vector3>();
    for (const [id, object] of this.objects) {
      let parent = object.parent;
      while (parent && !ids.has(parent)) parent = parent.parent;
      let hasMesh = false;
      object.traverse((child) => {
        if (child instanceof Mesh) hasMesh = true;
      });
      if (!hasMesh) continue;
      const ownMeshes =
        object instanceof Mesh ||
        object.children.some((child) => child instanceof Mesh && !ids.has(child));
      const index = Number(id.slice(5));
      const source = gltf.parser.json.nodes?.[index] as
        | { name?: string; extras?: Record<string, unknown> }
        | undefined;
      this.parts.push({
        id,
        name: source?.name || object.name || `Part ${index + 1}`,
        parentId: parent ? ids.get(parent)! : null,
        kind: ownMeshes ? "part" : "assembly",
        metadata:
          source?.extras && typeof source.extras === "object" && !Array.isArray(source.extras)
            ? source.extras
            : {},
      });
      if (ownMeshes) {
        this.origins.set(object, object.position.clone());
        const center = new Box3().setFromObject(object).getCenter(new Vector3());
        const delta = center.sub(this.bounds.getCenter(new Vector3()));
        if (delta.lengthSq() < 1e-10) delta.set(0, 1, 0);
        delta.normalize().multiplyScalar(this.radius);
        worldOffsets.set(object, delta);
      }
    }
    for (const [object, displacement] of worldOffsets) {
      let ancestor = object.parent;
      while (ancestor && !worldOffsets.has(ancestor)) ancestor = ancestor.parent;
      const delta = displacement.clone();
      if (ancestor) delta.sub(worldOffsets.get(ancestor)!);
      // Ancestor motion already contributes its displacement to descendants.
      // Convert only the remainder into this parent's local coordinates.
      const worldOrigin = object.parent!.getWorldPosition(new Vector3());
      this.offsets.set(
        object,
        object
          .parent!.worldToLocal(worldOrigin.clone().add(delta))
          .sub(object.parent!.worldToLocal(worldOrigin)),
      );
    }
    if (!this.parts.length) throw new Error("No addressable glTF nodes were found.");
  }

  resolve(ids: string[]): Object3D[] {
    return ids.map((id) => {
      const object = this.parts.some((part) => part.id === id) && this.objects.get(id);
      if (!object) throw new Error(`Unknown part ID: ${id}. Read model3d_list_parts first.`);
      return object;
    });
  }

  highlight(ids: string[], color: string, style: "color" | "arrow"): void {
    const targets = this.resolve(ids); // validate ALL before changing anything
    this.clearHighlights();
    const meshes = new Set<Mesh>();
    if (style === "color") {
      for (const target of targets)
        target.traverse((object) => {
          if (object instanceof Mesh) meshes.add(object);
        });
      for (const mesh of meshes) {
        this.originals.set(mesh, mesh.material);
        const clone = (material: Material) => {
          const copy = material.clone();
          if (
            "color" in copy &&
            copy.color &&
            typeof copy.color === "object" &&
            "set" in copy.color
          ) {
            (copy.color as { set(value: string): void }).set(color);
          }
          return copy;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(clone)
          : clone(mesh.material);
      }
    } else {
      for (const target of targets) {
        const bounds = new Box3().setFromObject(target);
        const tip = bounds.getCenter(new Vector3());
        tip.y = bounds.max.y;
        this.root.worldToLocal(tip);
        const arrow = new ModelArrow(this.radius, color);
        arrow.position.copy(tip);
        arrow.quaternion.copy(this.root.getWorldQuaternion(new Quaternion()).invert());
        this.root.add(arrow);
        this.arrows.push(arrow);
      }
    }
  }

  explode(amount: number): void {
    for (const [object, origin] of this.origins) {
      object.position.copy(origin).addScaledVector(this.offsets.get(object)!, amount);
    }
    this.root.updateMatrixWorld(true);
  }

  private clearHighlights(): void {
    for (const [mesh, original] of this.originals) {
      const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of current) material.dispose();
      mesh.material = original;
    }
    this.originals.clear();
    for (const arrow of this.arrows) {
      arrow.removeFromParent();
      arrow.dispose();
    }
    this.arrows = [];
  }

  dispose(): void {
    this.clearHighlights();
  }
}
