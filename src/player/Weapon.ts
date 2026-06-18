import type { Scene } from "@babylonjs/core/scene";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import { Config } from "../core/Config";
import type { GameSystem } from "../core/Game";
import type { InputManager } from "./InputManager";

const HIP_POS = new Vector3(0.16, -0.17, 0.45);
const ADS_POS = new Vector3(0, -0.052, 0.3);
const DEFAULT_FOV = (Config.camera.fovDeg * Math.PI) / 180;
const ADS_FOV = (Config.weapon.adsFovDeg * Math.PI) / 180;

/** First-person rifle: ADS transition, FOV zoom, and breath-damped sway. */
export class Weapon implements GameSystem {
  private readonly root: TransformNode;
  private adsT = 0; // 0 hip .. 1 aimed
  private t = 0;

  constructor(scene: Scene, private readonly camera: UniversalCamera, private readonly input: InputManager) {
    this.root = new TransformNode("weaponRoot", scene);
    this.root.parent = camera;
    this.root.position.copyFrom(HIP_POS);

    const mat = new StandardMaterial("rifleMat", scene);
    mat.diffuseColor = new Color3(0.12, 0.1, 0.09);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);

    const body = MeshBuilder.CreateBox("rifleBody", { width: 0.07, height: 0.1, depth: 0.62 }, scene);
    const barrel = MeshBuilder.CreateCylinder("rifleBarrel", { height: 0.6, diameter: 0.028 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.55);
    const stock = MeshBuilder.CreateBox("rifleStock", { width: 0.06, height: 0.12, depth: 0.26 }, scene);
    stock.position.set(0, -0.04, -0.42);
    const scope = MeshBuilder.CreateCylinder("rifleScope", { height: 0.22, diameter: 0.045 }, scene);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, 0.05);

    for (const m of [body, barrel, stock, scope]) {
      m.material = mat;
      m.parent = this.root;
      m.isPickable = false;
      m.renderingGroupId = 1; // draw on top, never clipped by world
    }
  }

  get isAimed(): boolean {
    return this.adsT > 0.6;
  }

  update(dt: number): void {
    this.t += dt;

    // Approach hip/aim target.
    const target = this.input.aiming ? 1 : 0;
    const k = Math.min(1, Config.weapon.adsLerpPerSec * dt);
    this.adsT += (target - this.adsT) * k;

    const basePos = Vector3.Lerp(HIP_POS, ADS_POS, this.adsT);

    // Breath-damped sway; less when aiming, much less when holding breath.
    const amp = (Config.weapon.swayHip + (Config.weapon.swayAds - Config.weapon.swayHip) * this.adsT) *
      (this.input.holdBreath ? Config.weapon.breathSwayMult : 1);
    const swayX = Math.sin(this.t * 1.3) * amp;
    const swayY = Math.sin(this.t * 1.9 + 1.0) * amp * 0.7;

    this.root.position.copyFrom(basePos);
    this.root.rotation.set(swayY, swayX, 0);

    // FOV zoom toward scope when aiming.
    const targetFov = DEFAULT_FOV + (ADS_FOV - DEFAULT_FOV) * this.adsT;
    this.camera.fov += (targetFov - this.camera.fov) * k;
  }
}
