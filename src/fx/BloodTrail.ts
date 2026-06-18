import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

/** Ground blood splats left by a wounded deer — the trail the player follows. */
export class BloodTrail {
  private readonly disc: Mesh;

  constructor(scene: Scene) {
    this.disc = MeshBuilder.CreateDisc("bloodDisc", { radius: 0.25, tessellation: 8 }, scene);
    this.disc.rotation.x = Math.PI / 2; // lie flat
    this.disc.bakeCurrentTransformIntoVertices();
    const mat = new StandardMaterial("bloodMat", scene);
    mat.diffuseColor = new Color3(0.32, 0.02, 0.02);
    mat.emissiveColor = new Color3(0.12, 0.0, 0.0);
    mat.specularColor = Color3.Black();
    this.disc.material = mat;
    this.disc.isPickable = false;
    this.disc.alwaysSelectAsActiveMesh = true;
  }

  /** Drop a blood splat on the ground at (x, z), sitting just above height y. */
  addDrop(x: number, y: number, z: number): void {
    const s = 0.6 + Math.random() * 0.9;
    const m = Matrix.Compose(
      new Vector3(s, s, s),
      Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2),
      new Vector3(x, y + 0.04, z),
    );
    this.disc.thinInstanceAdd(m, true);
  }
}
