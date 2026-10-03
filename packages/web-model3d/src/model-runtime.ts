import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ModelScene } from "./model-scene.ts";
import { disposeModel } from "./model-resources.ts";
import type { ModelHandle, ModelViewState } from "./model-types.ts";

export class ModelRuntime implements ModelHandle {
  readonly model: ModelScene;
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private placement = new Group();
  private pivot = new Group();
  private camera = new PerspectiveCamera(45, 1, 0.001, 1000);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private state: ModelViewState;
  private pointer = new Vector2();
  private stopPicking: () => void;
  private active: () => boolean;
  private changed: () => void;

  constructor(
    element: HTMLElement,
    private readonly gltf: GLTF,
    modelId: string,
    title: string,
    active: () => boolean,
    changed: () => void,
  ) {
    this.active = active;
    this.changed = changed;
    this.state = {
      modelId,
      title,
      selectedIds: [],
      highlights: null,
      explosion: 0,
      rotation: [0, 0, 0],
    };
    const center = new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
    gltf.scene.position.sub(center);
    this.pivot.add(gltf.scene);
    this.placement.add(this.pivot);
    this.scene.add(this.placement);
    this.model = new ModelScene(gltf.scene, gltf);
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const viewport = element.getBoundingClientRect();
    // The structure tree commits after loading and changes the canvas width.
    // Frame at the first observed visible layout, then preserve user framing.
    let needsVisibleFrame = true;
    this.renderer.setSize(Math.max(viewport.width, 1), Math.max(viewport.height, 1));
    this.camera.aspect = Math.max(viewport.width, 1) / Math.max(viewport.height, 1);
    element.append(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new HemisphereLight(0xffffff, 0x64748b, 2));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    this.scene.add(light);
    this.observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (needsVisibleFrame) {
        needsVisibleFrame = false;
        this.fit();
      }
    });
    this.observer.observe(element);
    this.stopPicking = this.installPicking();
    this.fit();
    this.renderer.setAnimationLoop(() => {
      if (!this.active()) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  getParts() {
    return this.model.parts;
  }
  getView(): ModelViewState {
    const camera = this.camera;
    return {
      ...structuredClone(this.state),
      camera: {
        position: camera.position.toArray(),
        target: this.controls.target.toArray(),
      },
    };
  }

  highlight(ids: string[], color: string, style: "color" | "arrow"): void {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Use a hex color, for example #ff8800.");
    this.model.highlight(ids, color, style);
    this.state.selectedIds = [...ids];
    this.state.highlights = ids.length ? { ids: [...ids], color, style } : null;
    this.changed();
  }

  focus(ids: string[]): void {
    const targets = this.model.resolve(ids);
    if (!targets.length) {
      this.fit();
      return;
    }
    const bounds = new Box3();
    for (const target of targets) bounds.union(new Box3().setFromObject(target));
    this.frameBounds(bounds);
    this.state.selectedIds = [...ids];
    this.changed();
  }

  rotate(axis: "x" | "y" | "z", degrees: number): void {
    this.pivot.rotation[axis] += (degrees * Math.PI) / 180;
    this.state.rotation = [this.pivot.rotation.x, this.pivot.rotation.y, this.pivot.rotation.z].map(
      (radians) => (radians * 180) / Math.PI,
    ) as [number, number, number];
    this.pivot.updateMatrixWorld(true);
    const mark = this.state.highlights;
    if (mark?.style === "arrow") this.model.highlight(mark.ids, mark.color, mark.style);
    this.changed();
  }

  explode(amount: number): void {
    this.model.explode(amount);
    this.state.explosion = amount;
    const mark = this.state.highlights;
    if (mark) this.model.highlight(mark.ids, mark.color, mark.style);
    this.fit();
    this.changed();
  }

  reset(): void {
    this.pivot.rotation.set(0, 0, 0);
    this.model.explode(0);
    this.model.highlight([], "#ff8800", "color");
    this.state = {
      ...this.state,
      selectedIds: [],
      highlights: null,
      rotation: [0, 0, 0],
      explosion: 0,
    };
    this.fit();
    this.changed();
  }

  private fit(): void {
    this.frameBounds(new Box3().setFromObject(this.pivot));
  }
  private frameBounds(bounds: Box3): void {
    const center = bounds.getCenter(new Vector3());
    const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.001);
    const vertical = (this.camera.fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.15;
    this.camera.near = Math.max(radius / 10000, 0.00001);
    this.camera.far = Math.max(distance * 100, this.model.radius * 100);
    this.camera.position
      .copy(center)
      .add(new Vector3(1, 0.7, 1).normalize().multiplyScalar(distance));
    this.controls.target.copy(center);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private installPicking(): () => void {
    const canvas = this.renderer.domElement;
    const down = (event: PointerEvent) => {
      this.pointer.set(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        this.pointer.distanceTo(new Vector2(event.clientX, event.clientY)) > 5
      )
        return;
      const rect = canvas.getBoundingClientRect();
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new Raycaster();
      ray.setFromCamera(ndc, this.camera);
      let object = ray
        .intersectObject(this.model.root, true)
        .find((hit) => hit.object instanceof Mesh)?.object;
      while (object) {
        const part = this.model.parts.find((part) => this.model.objects.get(part.id) === object);
        if (part) {
          this.highlight([part.id], "#ff8800", "color");
          break;
        }
        object = object.parent ?? undefined;
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
    };
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.stopPicking();
    this.controls.dispose();
    this.model.dispose();
    disposeModel(this.gltf.scenes);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
