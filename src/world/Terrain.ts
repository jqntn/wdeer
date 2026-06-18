import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

import { Config } from "../core/Config";
import { Noise } from "./Noise";

const GRASS = new Color3(0.26, 0.36, 0.17);
const DRY = new Color3(0.45, 0.43, 0.26);
const ROCK = new Color3(0.34, 0.32, 0.30);

/** Procedural heightmap terrain: rendered mesh + static physics collider + analytic height query. */
export class Terrain {
  readonly mesh: Mesh;
  private readonly noise: Noise;
  private readonly size = Config.world.size;
  private readonly maxHeight = Config.world.maxHeight;
  private readonly noiseScale = Config.world.noiseScale;

  constructor(scene: Scene) {
    this.noise = new Noise(Config.world.seed);

    const mesh = MeshBuilder.CreateGround(
      "terrain",
      {
        width: this.size * 2,
        height: this.size * 2,
        subdivisions: Config.world.subdivisions,
        updatable: true,
      },
      scene,
    );

    this.displace(mesh);
    mesh.createNormals(true);
    this.colorByTerrain(mesh);

    const mat = new StandardMaterial("terrainMat", scene);
    mat.diffuseColor = Color3.White(); // let vertex colours show through
    mat.specularColor = Color3.Black();
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.checkCollisions = false; // physics handles collision

    new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0 }, scene);

    this.mesh = mesh;
  }

  /** Analytic terrain height at world (x, z). Matches the mesh exactly. */
  getHeightAt(x: number, z: number): number {
    return this.noise.fbm(x * this.noiseScale, z * this.noiseScale) * this.maxHeight;
  }

  private displace(mesh: Mesh): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = this.getHeightAt(positions[i], positions[i + 2]);
    }
    mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
  }

  private colorByTerrain(mesh: Mesh): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const colors = new Float32Array((positions.length / 3) * 4);

    for (let v = 0, c = 0; v < positions.length; v += 3, c += 4) {
      const height = positions[v + 1] / this.maxHeight; // 0..1
      const slope = 1 - normals[v + 1]; // 0 flat .. ~1 vertical

      // Steep slopes → rock; otherwise blend grass→dry with height.
      const base = Color3.Lerp(GRASS, DRY, Math.min(1, height * 1.2));
      const col = Color3.Lerp(base, ROCK, Math.min(1, slope * 2.5));

      colors[c] = col.r;
      colors[c + 1] = col.g;
      colors[c + 2] = col.b;
      colors[c + 3] = 1;
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, true);
  }
}
