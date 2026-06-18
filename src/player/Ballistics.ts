import type { Scene } from "@babylonjs/core/scene";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Culling/ray"; // ensure ray picking is available

import { Config } from "../core/Config";
import type { GameSystem } from "../core/Game";
import type { InputManager } from "./InputManager";
import type { Deer } from "../animals/Deer";

interface Projectile {
  pos: Vector3;
  vel: Vector3;
  origin: Vector3;
  dir: Vector3;
  dist: number;
}

export interface ShotListener {
  /** clean = vitals kill; deer = the animal hit (null for terrain/miss). */
  onShot(clean: boolean | null, deer: Deer | null, distance: number): void;
}

const FIRE_COOLDOWN = 1.1; // bolt-action cycle

/** Projectile ballistics with gravity drop and per-segment ray picking. */
export class Ballistics implements GameSystem {
  private readonly projectiles: Projectile[] = [];
  private cooldown = 0;

  constructor(
    private readonly scene: Scene,
    private readonly camera: UniversalCamera,
    private readonly input: InputManager,
    private readonly deer: Deer[],
    private readonly listener: ShotListener,
  ) {}

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.input.consumeFire() && this.cooldown <= 0) {
      this.fire();
      this.cooldown = FIRE_COOLDOWN;
    }
    this.stepProjectiles(dt);
  }

  private fire(): void {
    const ray = this.camera.getForwardRay();
    const dir = ray.direction.normalizeToNew();
    const origin = this.camera.position.add(dir.scale(0.6));
    this.projectiles.push({
      pos: origin.clone(),
      vel: dir.scale(Config.hunt.muzzleVelocity),
      origin: origin.clone(),
      dir: dir.clone(),
      dist: 0,
    });
    this.alarmDeer(origin);
    this.listener.onShot(null, null, 0); // fired (for audio); hit resolved separately
  }

  private alarmDeer(origin: Vector3): void {
    for (const d of this.deer) {
      const dist = Vector3.Distance(origin, d.pos);
      const amt = 1 - dist / Config.senses.gunshotRadius;
      if (amt > 0) d.alarm(amt);
    }
  }

  private stepProjectiles(dt: number): void {
    const g = Config.physics.gravity * Config.hunt.bulletGravityScale;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const prev = p.pos.clone();
      p.vel.y += g * dt;
      p.pos.addInPlace(p.vel.scale(dt));

      const seg = p.pos.subtract(prev);
      const segLen = seg.length();
      p.dist += segLen;

      const ray = new Ray(prev, seg.scale(1 / Math.max(segLen, 1e-6)), segLen);
      const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && m.isEnabled());
      if (pick?.hit && pick.pickedPoint) {
        this.resolveHit(pick.pickedMesh, pick.pickedPoint, p);
        this.projectiles.splice(i, 1);
      } else if (p.dist > Config.hunt.maxBulletRange) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private resolveHit(mesh: { metadata?: unknown } | null, point: Vector3, p: Projectile): void {
    const deer = (mesh?.metadata as { deer?: Deer } | undefined)?.deer ?? null;
    const distance = Vector3.Distance(p.origin, point);
    if (deer) {
      // Clean kill if the bullet's path passed through the vitals, not by where
      // it entered the body box.
      const clean = deer.applyHit(p.origin, p.dir, distance);
      this.listener.onShot(clean, deer, distance);
    } else {
      this.listener.onShot(false, null, distance); // missed the animal (terrain/tree)
    }
  }
}
