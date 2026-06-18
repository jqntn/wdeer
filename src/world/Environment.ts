import type { Scene } from "@babylonjs/core/scene";
import { Scene as SceneClass } from "@babylonjs/core/scene";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";

import { Config } from "../core/Config";
import type { GameSystem } from "../core/Game";

const DAY_FOG = new Color3(0.62, 0.69, 0.72);
const NIGHT_FOG = new Color3(0.04, 0.05, 0.08);
const NOON_SUN = new Color3(1, 0.98, 0.92);
const DUSK_SUN = new Color3(1.0, 0.55, 0.28);

/**
 * Sky, sun, ambient, fog, and the day-night cycle.
 * NOTE: dynamic cast shadows (CascadedShadowGenerator) are disabled — on WebGPU
 * the shadow-texture bind group fails ("GPUBindGroupEntry resource undefined"),
 * aborting the terrain draw and blanking the screen. Revisit as a polish item.
 */
export class Environment implements GameSystem {
  readonly sun: DirectionalLight;
  private readonly ambient: HemisphericLight;
  private readonly scene: Scene;
  private readonly skyMat: SkyMaterial;
  private timeOfDay: number = Config.env.startTimeOfDay;

  constructor(scene: Scene) {
    this.scene = scene;

    this.sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
    this.sun.intensity = 2.2;

    this.ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    this.ambient.diffuse = new Color3(0.7, 0.78, 0.9);
    this.ambient.groundColor = new Color3(0.25, 0.27, 0.2);

    // Procedural sky dome that follows the camera.
    this.skyMat = new SkyMaterial("skyMat", scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.useSunPosition = true;
    this.skyMat.turbidity = 6;
    this.skyMat.luminance = 1;
    this.skyMat.rayleigh = 2;
    const skybox = MeshBuilder.CreateBox("sky", { size: 1500 }, scene);
    skybox.material = this.skyMat;
    skybox.infiniteDistance = true;
    skybox.isPickable = false;

    scene.fogMode = SceneClass.FOGMODE_LINEAR;
    scene.fogStart = Config.render.fogStart;
    scene.fogEnd = Config.render.fogEnd;

    this.applyTimeOfDay();
  }

  /** No-op while cast shadows are disabled (kept so callers stay unchanged). */
  addShadowCaster(_mesh: AbstractMesh): void {
    /* shadows disabled — see class note */
  }

  update(dt: number): void {
    if (Config.env.paused) return;
    this.timeOfDay = (this.timeOfDay + dt / Config.env.dayLengthSeconds) % 1;
    this.applyTimeOfDay();
  }

  /** Drive sun direction, light colour/intensity, sky, ambient, and fog from timeOfDay. */
  private applyTimeOfDay(): void {
    const phase = (this.timeOfDay - 0.25) * Math.PI * 2; // 0 at sunrise, π at sunset
    const az = this.timeOfDay * Math.PI * 2;
    const elev = Math.sin(phase); // -1 night .. 1 noon
    const horiz = Math.cos(phase);

    const sunDir = new Vector3(horiz * Math.sin(az), elev, horiz * Math.cos(az)).normalize();
    this.sun.direction = sunDir.scale(-1);
    this.skyMat.sunPosition = sunDir.scale(1000);

    const day = Math.max(0, elev); // 0 below horizon, →1 at noon
    const lowSun = Math.max(0, 1 - Math.abs(elev) * 3); // warm band near horizon

    this.sun.intensity = 0.05 + day * 2.6;
    this.sun.diffuse = Color3.Lerp(NOON_SUN, DUSK_SUN, lowSun);
    this.ambient.intensity = 0.18 + day * 0.55;

    const fog = Color3.Lerp(NIGHT_FOG, DAY_FOG, Math.min(1, day * 1.5 + 0.1));
    this.scene.fogColor = fog;
    this.scene.clearColor.set(fog.r, fog.g, fog.b, 1);
  }

  get currentTimeOfDay(): number {
    return this.timeOfDay;
  }
}
