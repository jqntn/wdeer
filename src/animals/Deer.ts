import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import { Config } from "../core/Config";
import type { GameSystem } from "../core/Game";
import type { Terrain } from "../world/Terrain";
import type { Wind } from "../world/Wind";
import type { Environment } from "../world/Environment";
import type { Player } from "../player/Player";
import type { BloodTrail } from "../fx/BloodTrail";
import { DeerBrain, type DeerAnim } from "./DeerBrain";

export interface DeerStats {
  gender: "male" | "female";
  weightKg: number;
  trophy: number; // antler/body score; 0 for females
}

export interface HarvestResult {
  gender: "male" | "female";
  weightKg: number;
  trophy: number;
  clean: boolean;
  distance: number;
  score: number;
}

/** One deer: instantiated glTF model driven by a DeerBrain + the sensory sim. */
export class Deer implements GameSystem {
  readonly root: TransformNode;
  readonly brain = new DeerBrain();
  readonly pos = new Vector3();
  readonly stats: DeerStats;

  dead = false;
  wounded = false;
  private bleedTimer = 0;
  private bloodAccum = 0;
  private shot: { clean: boolean; distance: number } | null = null;

  private yaw = 0;
  private readonly anims = new Map<DeerAnim, AnimationGroup>();
  private currentAnim: DeerAnim | null = null;
  /** Invisible body collider for reliable bullet picking (skinned-mesh bounds are unreliable). */
  private readonly hitProxy: Mesh;

  constructor(
    container: AssetContainer,
    spawn: { x: number; z: number },
    private readonly player: Player,
    private readonly wind: Wind,
    private readonly env: Environment,
    private readonly terrain: Terrain,
    private readonly blood: BloodTrail,
  ) {
    const inst = container.instantiateModelsToScene((n) => n, false);
    this.root = inst.rootNodes[0] as TransformNode;
    this.root.scaling.setAll(Config.assets.deerScale);
    this.stats = Deer.rollStats();

    for (const mesh of this.root.getChildMeshes(false)) {
      mesh.receiveShadows = true;
      env.addShadowCaster(mesh);
      mesh.isPickable = false; // bullets hit the proxy instead
    }

    this.hitProxy = MeshBuilder.CreateBox("deerHit", { width: 0.6, height: 1.4, depth: 2.4 }, this.root.getScene());
    this.hitProxy.isVisible = false;
    this.hitProxy.isPickable = true;
    this.hitProxy.metadata = { deer: this };

    const clips = Config.assets.deerClips;
    for (const g of inst.animationGroups) {
      g.stop();
      if (g.name.includes(clips.idle)) this.anims.set("idle", g);
      else if (g.name.includes(clips.walk)) this.anims.set("walk", g);
      else if (g.name.includes(clips.run)) this.anims.set("run", g);
    }

    this.pos.set(spawn.x, this.terrain.getHeightAt(spawn.x, spawn.z), spawn.z);
    this.yaw = Math.random() * Math.PI * 2;
    this.syncTransform();
    this.playAnim("idle");
  }

  update(dt: number): void {
    if (this.dead) return;

    if (this.wounded) {
      this.bleedTimer -= dt;
      this.bloodAccum += dt;
      if (this.bloodAccum >= Config.hunt.bloodDropInterval) {
        this.bloodAccum = 0;
        this.blood.addDrop(this.pos.x, this.pos.y, this.pos.z);
      }
      if (this.bleedTimer <= 0) {
        this.die(false); // collapsed at the end of the blood trail
        return;
      }
    }

    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const cam = this.player.eyePosition;

    const intent = this.brain.think(dt, {
      deerX: this.pos.x,
      deerZ: this.pos.z,
      forwardX,
      forwardZ,
      playerX: cam.x,
      playerZ: cam.z,
      playerVisibility: this.player.visibility,
      playerMoving: this.player.isMoving,
      playerNoiseRadius: this.player.noiseRadius,
      windX: this.wind.direction.x,
      windZ: this.wind.direction.z,
      windStrength: this.wind.strength,
      timeOfDay: this.env.currentTimeOfDay,
      rand: Math.random,
    });

    if (intent.moving && intent.faceX !== null && intent.faceZ !== null) {
      this.pos.x += intent.faceX * intent.speed * dt;
      this.pos.z += intent.faceZ * intent.speed * dt;
      this.clampBounds();
    }
    if (intent.faceX !== null && intent.faceZ !== null) {
      this.turnToward(intent.faceX, intent.faceZ);
    }
    this.playAnim(intent.anim);
    this.syncTransform();
  }

  /** Lets the gunshot alarm nearby deer. */
  alarm(amount: number): void {
    this.brain.alarm(amount);
  }

  /** World-space vitals point (chest). A hit inside its radius is a clean kill. */
  vitalsPoint(): Vector3 {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return new Vector3(
      this.pos.x + fx * Config.hunt.vitalsForward,
      this.pos.y + Config.hunt.vitalsHeight,
      this.pos.z + fz * Config.hunt.vitalsForward,
    );
  }

  /**
   * Resolve a bullet hit. `lineOrigin`/`lineDir` describe the bullet's path; the
   * shot is a clean kill if that path passes within the vitals radius (i.e. it
   * went through the heart/lungs), regardless of where it entered the body.
   */
  applyHit(lineOrigin: Vector3, lineDir: Vector3, distance: number): boolean {
    if (this.dead) return false;
    const vitals = this.vitalsPoint();
    const t = Vector3.Dot(vitals.subtract(lineOrigin), lineDir);
    const closest = lineOrigin.add(lineDir.scale(t));
    const clean = Vector3.Distance(closest, vitals) <= Config.hunt.vitalsRadius;
    this.shot = { clean, distance };
    if (clean) {
      this.die(true);
    } else {
      this.wound();
    }
    return clean;
  }

  private wound(): void {
    if (this.wounded || this.dead) return;
    this.wounded = true;
    this.bleedTimer = Config.hunt.bleedOutTime;
    this.brain.alarm(1); // bolt
  }

  private die(clean: boolean): void {
    if (this.dead) return;
    this.dead = true;
    this.wounded = false;
    if (!this.shot) this.shot = { clean, distance: 0 };
    for (const g of this.anims.values()) g.stop();
    this.currentAnim = null;
    // Collapse: tip forward and settle onto the ground.
    this.pos.y = this.terrain.getHeightAt(this.pos.x, this.pos.z);
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.root.rotation.set(1.1, this.yaw, 0);
  }

  get harvestable(): boolean {
    return this.dead;
  }

  /** Final harvest score from trophy stats × shot quality + distance bonus. */
  harvest(): HarvestResult {
    const shot = this.shot ?? { clean: false, distance: 0 };
    const quality = shot.clean ? 1 : 0.6;
    const trophyFactor = 1 + this.stats.trophy / 120;
    const score = Math.round(this.stats.weightKg * trophyFactor * quality + shot.distance * 0.4);
    return { ...this.stats, clean: shot.clean, distance: shot.distance, score };
  }

  private static rollStats(): DeerStats {
    const gender = Math.random() < 0.5 ? "male" : "female";
    return {
      gender,
      weightKg: Math.round(55 + Math.random() * 70),
      trophy: gender === "male" ? Math.round(Math.random() * 180) : 0,
    };
  }

  get state() {
    return this.brain.state;
  }

  get awareness(): number {
    return this.brain.awareness;
  }

  private turnToward(fx: number, fz: number): void {
    const target = Math.atan2(fx, fz);
    let diff = target - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Config.deer.turnLerp;
  }

  private clampBounds(): void {
    const lim = Config.world.size - 4;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
  }

  private syncTransform(): void {
    this.pos.y = this.terrain.getHeightAt(this.pos.x, this.pos.z);
    this.root.position.copyFrom(this.pos);
    this.root.rotation.set(0, this.yaw, 0);
    this.hitProxy.position.set(this.pos.x, this.pos.y + 0.7, this.pos.z);
    this.hitProxy.rotation.set(0, this.yaw, 0);
    // Invisible meshes are skipped by the active-mesh pass, so refresh the
    // world matrix ourselves — otherwise ray picking tests a stale transform.
    this.hitProxy.computeWorldMatrix(true);
  }

  dispose(): void {
    this.hitProxy.dispose();
    this.root.dispose(false, true);
  }

  private playAnim(name: DeerAnim): void {
    if (this.currentAnim === name) return;
    this.currentAnim = name;
    for (const [k, g] of this.anims) {
      if (k === name) g.start(true, name === "run" ? 1.4 : 1);
      else g.stop();
    }
  }
}
