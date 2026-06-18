import { Config } from "../core/Config";
import { computeSight, computeHearing, computeSmell, updateAwareness } from "./Senses";
import { preferredZone, pointInZone } from "./NeedZones";

export type DeerState = "graze" | "wander" | "alert" | "flee";
export type DeerAnim = "idle" | "walk" | "run";

export interface BrainContext {
  deerX: number;
  deerZ: number;
  forwardX: number;
  forwardZ: number;
  playerX: number;
  playerZ: number;
  playerVisibility: number;
  playerMoving: boolean;
  playerNoiseRadius: number;
  windX: number;
  windZ: number;
  windStrength: number;
  timeOfDay: number;
  rand: () => number;
}

export interface Intent {
  state: DeerState;
  anim: DeerAnim;
  moving: boolean;
  targetX: number;
  targetZ: number;
  speed: number;
  /** Desired facing (unit XZ); null = keep current. */
  faceX: number | null;
  faceZ: number | null;
}

/** Deer "brain": integrates senses into awareness and runs the behaviour FSM. */
export class DeerBrain {
  awareness = 0;
  state: DeerState = "graze";
  private targetX = 0;
  private targetZ = 0;
  private grazeTimer = 0;
  private hasTarget = false;

  /** Instantaneous alarm (e.g. a nearby gunshot) bumps awareness directly. */
  alarm(amount: number): void {
    this.awareness = Math.min(1, this.awareness + amount);
  }

  think(dt: number, ctx: BrainContext): Intent {
    const dx = ctx.playerX - ctx.deerX;
    const dz = ctx.playerZ - ctx.deerZ;
    const dist = Math.hypot(dx, dz) || 1e-3;

    const stimulus = Math.max(
      computeSight({ dx, dz, forwardX: ctx.forwardX, forwardZ: ctx.forwardZ, visibility: ctx.playerVisibility, moving: ctx.playerMoving }),
      computeHearing(dist, ctx.playerNoiseRadius),
      computeSmell({ dx, dz, windX: ctx.windX, windZ: ctx.windZ, windStrength: ctx.windStrength }),
    );
    this.awareness = updateAwareness(this.awareness, stimulus, dt);

    const { alertThreshold, fleeThreshold } = Config.senses;
    const wasFleeing = this.state === "flee";

    if (this.awareness >= fleeThreshold) {
      this.enterFlee(ctx, dx, dz, dist);
    } else if (wasFleeing && this.awareness > alertThreshold * Config.deer.fleeForgetSpeed) {
      // keep fleeing until calmed
    } else if (this.awareness >= alertThreshold) {
      this.state = "alert";
    } else if (this.state === "alert" || this.state === "flee") {
      this.beginWander(ctx);
    }

    switch (this.state) {
      case "flee":
        return this.fleeIntent(ctx, dx, dz, dist);
      case "alert":
        return this.alertIntent(dx, dz, dist);
      case "wander":
        return this.wanderIntent(dt, ctx);
      default:
        return this.grazeIntent(dt, ctx);
    }
  }

  private beginWander(ctx: BrainContext): void {
    this.state = "wander";
    const zone = preferredZone(ctx.timeOfDay, ctx.rand);
    const p = pointInZone(zone, ctx.rand);
    this.targetX = p.x;
    this.targetZ = p.z;
    this.hasTarget = true;
  }

  private enterFlee(ctx: BrainContext, dx: number, dz: number, dist: number): void {
    if (this.state !== "flee") {
      const lim = Config.world.size - 5;
      const ax = -dx / dist;
      const az = -dz / dist;
      this.targetX = Math.max(-lim, Math.min(lim, ctx.deerX + ax * Config.deer.fleeDistance));
      this.targetZ = Math.max(-lim, Math.min(lim, ctx.deerZ + az * Config.deer.fleeDistance));
      this.state = "flee";
    }
  }

  private fleeIntent(ctx: BrainContext, dx: number, dz: number, dist: number): Intent {
    const tdx = this.targetX - ctx.deerX;
    const tdz = this.targetZ - ctx.deerZ;
    const tdist = Math.hypot(tdx, tdz) || 1e-3;
    if (tdist < Config.deer.arriveRadius) {
      // reached cover; re-pick further away if still alarmed
      this.enterFleeAgain(ctx, dx, dz, dist);
    }
    return {
      state: "flee",
      anim: "run",
      moving: true,
      targetX: this.targetX,
      targetZ: this.targetZ,
      speed: Config.deer.runSpeed,
      faceX: (this.targetX - ctx.deerX) / (Math.hypot(this.targetX - ctx.deerX, this.targetZ - ctx.deerZ) || 1e-3),
      faceZ: (this.targetZ - ctx.deerZ) / (Math.hypot(this.targetX - ctx.deerX, this.targetZ - ctx.deerZ) || 1e-3),
    };
  }

  private enterFleeAgain(ctx: BrainContext, dx: number, dz: number, dist: number): void {
    const lim = Config.world.size - 5;
    this.targetX = Math.max(-lim, Math.min(lim, ctx.deerX + (-dx / dist) * Config.deer.fleeDistance));
    this.targetZ = Math.max(-lim, Math.min(lim, ctx.deerZ + (-dz / dist) * Config.deer.fleeDistance));
  }

  private alertIntent(dx: number, dz: number, dist: number): Intent {
    return {
      state: "alert",
      anim: "idle",
      moving: false,
      targetX: 0,
      targetZ: 0,
      speed: 0,
      faceX: dx / dist,
      faceZ: dz / dist,
    };
  }

  private wanderIntent(dt: number, ctx: BrainContext): Intent {
    if (!this.hasTarget) this.beginWander(ctx);
    const tdx = this.targetX - ctx.deerX;
    const tdz = this.targetZ - ctx.deerZ;
    const tdist = Math.hypot(tdx, tdz) || 1e-3;
    if (tdist < Config.deer.arriveRadius) {
      this.state = "graze";
      this.grazeTimer = Config.deer.grazeTimeMin + ctx.rand() * (Config.deer.grazeTimeMax - Config.deer.grazeTimeMin);
      return this.grazeIntent(dt, ctx);
    }
    return {
      state: "wander",
      anim: "walk",
      moving: true,
      targetX: this.targetX,
      targetZ: this.targetZ,
      speed: Config.deer.walkSpeed,
      faceX: tdx / tdist,
      faceZ: tdz / tdist,
    };
  }

  private grazeIntent(dt: number, ctx: BrainContext): Intent {
    this.grazeTimer -= dt;
    if (this.grazeTimer <= 0) {
      this.beginWander(ctx);
      return this.wanderIntent(dt, ctx);
    }
    return { state: "graze", anim: "idle", moving: false, targetX: 0, targetZ: 0, speed: 0, faceX: null, faceZ: null };
  }
}
