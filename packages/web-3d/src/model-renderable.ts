import { Line, Mesh, Points, type Object3D } from "three";

export type ModelRenderable = Mesh | Line | Points;

export function isModelRenderable(object: Object3D): object is ModelRenderable {
  return object instanceof Mesh || object instanceof Line || object instanceof Points;
}
