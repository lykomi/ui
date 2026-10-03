import { LoadingManager, Mesh, Texture, type Material, type Object3D } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

export const MAX_MODEL_BYTES = 64 * 1024 * 1024;

/** The first viewer accepts self-contained GLB only. No external resource fetches. */
export function inspectGlb(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_MODEL_BYTES) {
    throw new Error("Expected a GLB file smaller than 64 MiB.");
  }
  const header = new DataView(bytes);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== bytes.byteLength ||
    header.getUint32(16, true) !== 0x4e4f534a
  ) {
    throw new Error("This is not a valid glTF 2.0 binary (GLB) file.");
  }
  const length = header.getUint32(12, true);
  if (length > bytes.byteLength - 20) throw new Error("Truncated GLB JSON chunk.");
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))) as {
    buffers?: { uri?: unknown }[];
    images?: { uri?: unknown }[];
  };
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (
      resource.uri !== undefined &&
      (typeof resource.uri !== "string" || !resource.uri.startsWith("data:"))
    ) {
      throw new Error("This GLB references external files. Export a self-contained GLB first.");
    }
  }
}

export async function readModelResponse(
  response: Response,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
  if (Number(response.headers.get("content-length")) > MAX_MODEL_BYTES) {
    await response.body?.cancel();
    throw new Error("The model exceeds the 64 MiB preview limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    inspectGlb(bytes);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MODEL_BYTES) throw new Error("The model exceeds the 64 MiB preview limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  inspectGlb(bytes.buffer);
  return bytes.buffer;
}

export function parseModel(bytes: ArrayBuffer): Promise<GLTF> {
  inspectGlb(bytes);
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith("data:") && !url.startsWith("blob:")) {
      throw new Error("External model resources are not supported.");
    }
    return url;
  });
  return new GLTFLoader(manager).parseAsync(bytes, "");
}

/** GPU resources and decoded image bitmaps outlive the object tree unless disposed. */
export function disposeModel(root: Object3D): void {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
    texture.dispose();
  }
  for (const material of materials) material.dispose();
}
