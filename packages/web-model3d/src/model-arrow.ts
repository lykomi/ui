import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial } from "three";

/** A mesh shaft has real thickness; WebGL line width is usually fixed at one pixel. */
export class ModelArrow extends Group {
  private material: MeshBasicMaterial;
  private shaft: Mesh<CylinderGeometry>;
  private head: Mesh<ConeGeometry>;

  constructor(radius: number, color: string) {
    super();
    const length = radius * 0.6;
    const headLength = length * 0.3;
    const shaftLength = length - headLength;
    this.material = new MeshBasicMaterial({ color, toneMapped: false });
    this.shaft = new Mesh(
      new CylinderGeometry(radius * 0.018, radius * 0.018, shaftLength, 16),
      this.material,
    );
    this.shaft.position.y = headLength + shaftLength / 2;
    this.head = new Mesh(new ConeGeometry(radius * 0.07, headLength, 24), this.material);
    this.head.rotation.z = Math.PI;
    this.head.position.y = headLength / 2;
    this.add(this.shaft, this.head);
  }

  dispose(): void {
    this.shaft.geometry.dispose();
    this.head.geometry.dispose();
    this.material.dispose();
  }
}
