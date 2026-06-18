import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
// Side effect: registers the real Mesh.prototype.thinInstance* methods.
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

import { Config } from "../core/Config";
import type { Terrain } from "./Terrain";
import type { Environment } from "./Environment";

export interface TreeCollider {
  x: number;
  z: number;
  radius: number;
}

/** Cheap seeded PRNG (mulberry32) so the forest layout is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Thin-instanced trees + bushes scattered over the terrain. */
export class Foliage {
  readonly treeColliders: TreeCollider[] = [];
  private readonly rand = mulberry32(Config.world.seed ^ 0x9e3779b9);

  constructor(scene: Scene, terrain: Terrain, env: Environment) {
    const trunk = this.makeTrunk(scene);
    const canopy = this.makeCanopy(scene);
    const bush = this.makeBush(scene);

    const treeMatrices: number[] = [];
    let placed = 0;
    for (let i = 0; i < Config.foliage.treeCount * 3 && placed < Config.foliage.treeCount; i++) {
      const p = this.pick(terrain);
      if (!p) continue;
      const scale = 1.4 + this.rand() * 2.2;
      const m = Matrix.Compose(
        new Vector3(scale, scale * (0.85 + this.rand() * 0.4), scale),
        Quaternion.RotationAxis(Vector3.Up(), this.rand() * Math.PI * 2),
        new Vector3(p.x, p.y, p.z),
      );
      m.copyToArray(treeMatrices, placed * 16);
      this.treeColliders.push({ x: p.x, z: p.z, radius: 0.35 * scale });
      placed++;
    }
    this.commit(trunk, treeMatrices, placed, env);
    this.commit(canopy, treeMatrices, placed, env);

    const bushMatrices: number[] = [];
    let bplaced = 0;
    for (let i = 0; i < Config.foliage.bushCount * 3 && bplaced < Config.foliage.bushCount; i++) {
      const p = this.pick(terrain);
      if (!p) continue;
      const s = 0.6 + this.rand() * 1.0;
      const m = Matrix.Compose(
        new Vector3(s, s * 0.7, s),
        Quaternion.RotationAxis(Vector3.Up(), this.rand() * Math.PI * 2),
        new Vector3(p.x, p.y, p.z),
      );
      m.copyToArray(bushMatrices, bplaced * 16);
      bplaced++;
    }
    this.commit(bush, bushMatrices, bplaced, env);
  }

  /** Pick a valid placement (in bounds, outside clearing, not too steep). */
  private pick(terrain: Terrain): { x: number; y: number; z: number } | null {
    const s = Config.world.size * 0.97;
    const x = (this.rand() * 2 - 1) * s;
    const z = (this.rand() * 2 - 1) * s;
    if (Math.hypot(x, z) < Config.foliage.clearingRadius) return null;

    const e = 1.5;
    const hx = (terrain.getHeightAt(x + e, z) - terrain.getHeightAt(x - e, z)) / (2 * e);
    const hz = (terrain.getHeightAt(x, z + e) - terrain.getHeightAt(x, z - e)) / (2 * e);
    const slope = 1 - 1 / Math.sqrt(1 + hx * hx + hz * hz);
    if (slope > Config.foliage.maxSlope) return null;

    return { x, y: terrain.getHeightAt(x, z), z };
  }

  private commit(mesh: Mesh, matrices: number[], count: number, env: Environment): void {
    if (count === 0) {
      mesh.dispose();
      return;
    }
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(matrices.slice(0, count * 16)), 16, true);
    mesh.thinInstanceRefreshBoundingInfo(true);
    mesh.receiveShadows = true;
    env.addShadowCaster(mesh);
  }

  private makeTrunk(scene: Scene): Mesh {
    const trunk = MeshBuilder.CreateCylinder("trunk", { height: 3.2, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 6 }, scene);
    trunk.position.y = 1.6;
    trunk.bakeCurrentTransformIntoVertices();
    this.paint(trunk, new Color3(0.32, 0.22, 0.13));
    const mat = new StandardMaterial("trunkMat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = Color3.Black();
    trunk.material = mat;
    return trunk;
  }

  private makeCanopy(scene: Scene): Mesh {
    const canopy = MeshBuilder.CreateCylinder("canopy", { height: 5, diameterTop: 0, diameterBottom: 3.4, tessellation: 7 }, scene);
    canopy.position.y = 3.2 + 2.2;
    canopy.bakeCurrentTransformIntoVertices();
    this.paint(canopy, new Color3(0.16, 0.3, 0.14));
    const mat = new StandardMaterial("canopyMat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = Color3.Black();
    canopy.material = mat;
    return canopy;
  }

  private makeBush(scene: Scene): Mesh {
    const bush = MeshBuilder.CreateSphere("bush", { diameter: 1.6, segments: 5 }, scene);
    bush.position.y = 0.5;
    bush.scaling.y = 0.7;
    bush.bakeCurrentTransformIntoVertices();
    this.paint(bush, new Color3(0.2, 0.33, 0.16));
    const mat = new StandardMaterial("bushMat", scene);
    mat.diffuseColor = Color3.White();
    mat.specularColor = Color3.Black();
    bush.material = mat;
    return bush;
  }

  /** Flat vertex colour so each prototype reads as its material under one shader. */
  private paint(mesh: Mesh, color: Color3): void {
    const count = mesh.getTotalVertices();
    const colors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      colors[i * 4] = color.r;
      colors[i * 4 + 1] = color.g;
      colors[i * 4 + 2] = color.b;
      colors[i * 4 + 3] = 1;
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  }
}
