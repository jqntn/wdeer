import type { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import { Config } from "../core/Config";
import type { GameSystem } from "../core/Game";
import type { Terrain } from "../world/Terrain";
import type { Foliage } from "../world/Foliage";
import type { InputManager } from "./InputManager";

export type Stance = "stand" | "crouch" | "prone";

/** First-person player: movement, stances, stamina, and sense-relevant state. */
export class Player implements GameSystem {
  readonly camera: UniversalCamera;
  stamina: number = Config.player.staminaMax;
  stance: Stance = "stand";
  speed = 0;
  isMoving = false;

  private yaw = 0;
  private pitch = 0;
  private eyeHeight: number = Config.player.eyeStand;
  private readonly pos = new Vector3(0, 0, 0);

  constructor(
    scene: Scene,
    private readonly input: InputManager,
    private readonly terrain: Terrain,
    private readonly foliage: Foliage,
  ) {
    this.pos.set(0, 0, -10);
    this.camera = new UniversalCamera("player", new Vector3(0, 0, 0), scene);
    this.camera.fov = (Config.camera.fovDeg * Math.PI) / 180;
    this.camera.minZ = Config.camera.near;
    this.camera.maxZ = Config.camera.far;
    this.camera.inputs.clear(); // we drive look/movement manually
    scene.activeCamera = this.camera;
    this.syncCamera();
  }

  update(dt: number): void {
    this.applyLook();
    this.resolveStance();
    this.move(dt);
    this.updateStamina(dt);
    this.syncCamera();
  }

  private applyLook(): void {
    const { dx, dy } = this.input.consumeMouseDelta();
    const s = Config.player.mouseSensitivity;
    this.yaw += dx * s;
    this.pitch += dy * s;
    this.pitch = Math.max(-Config.player.pitchLimit, Math.min(Config.player.pitchLimit, this.pitch));
  }

  private resolveStance(): void {
    this.stance = this.input.prone ? "prone" : this.input.crouch ? "crouch" : "stand";
  }

  private targetSpeed(): number {
    const canSprint = this.stance === "stand";
    if (this.input.sprint && canSprint && this.stamina > 1) return Config.player.sprintSpeed;
    switch (this.stance) {
      case "crouch":
        return Config.player.crouchSpeed;
      case "prone":
        return Config.player.proneSpeed;
      default:
        return Config.player.walkSpeed;
    }
  }

  private move(dt: number): void {
    const f = this.input.forward;
    const s = this.input.strafe;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    let dirX = sin * f + cos * s;
    let dirZ = cos * f - sin * s;
    const len = Math.hypot(dirX, dirZ);
    this.isMoving = len > 0.001;

    if (this.isMoving) {
      dirX /= len;
      dirZ /= len;
      this.speed = this.targetSpeed();
      this.pos.x += dirX * this.speed * dt;
      this.pos.z += dirZ * this.speed * dt;
      this.collideFoliage();
      this.clampBounds();
    } else {
      this.speed = 0;
    }
  }

  /** Circle push-out against tree trunk colliders. */
  private collideFoliage(): void {
    const pr = Config.player.collisionRadius;
    for (const t of this.foliage.treeColliders) {
      const dx = this.pos.x - t.x;
      const dz = this.pos.z - t.z;
      const min = t.radius + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        this.pos.x += dx * push;
        this.pos.z += dz * push;
      }
    }
  }

  private clampBounds(): void {
    const lim = Config.world.size - 2;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
  }

  private updateStamina(dt: number): void {
    const sprinting = this.speed === Config.player.sprintSpeed && this.isMoving;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - Config.player.staminaDrainPerSec * dt);
    } else {
      this.stamina = Math.min(Config.player.staminaMax, this.stamina + Config.player.staminaRegenPerSec * dt);
    }
  }

  private syncCamera(): void {
    const targetEye =
      this.stance === "prone" ? Config.player.eyeProne : this.stance === "crouch" ? Config.player.eyeCrouch : Config.player.eyeStand;
    // Smoothly approach the stance eye height.
    this.eyeHeight += (targetEye - this.eyeHeight) * 0.2;
    this.pos.y = this.terrain.getHeightAt(this.pos.x, this.pos.z);
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Current emitted noise radius (m) for the deer's hearing sense. */
  get noiseRadius(): number {
    const n = Config.player.noiseRadius;
    if (!this.isMoving) return n.still;
    if (this.speed === Config.player.sprintSpeed) return n.sprint;
    if (this.stance === "crouch") return n.crouch;
    if (this.stance === "prone") return n.prone;
    return n.walk;
  }

  /** Silhouette exposure (0..1) for the deer's sight sense. */
  get visibility(): number {
    const v = Config.player.visibility;
    return this.stance === "crouch" ? v.crouch : this.stance === "prone" ? v.prone : v.stand;
  }

  get eyePosition(): Vector3 {
    return this.camera.position;
  }

  get headingYaw(): number {
    return this.yaw;
  }
}
