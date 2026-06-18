import { Config } from "../core/Config";

/**
 * Pure sensory math (no Babylon deps → unit-testable). All positions are XZ.
 * Each function returns a stimulus in 0..1; the deer's awareness integrates
 * the strongest sense over time.
 */

export interface SightInput {
  /** Player relative to deer: player - deer. */
  dx: number;
  dz: number;
  /** Deer facing direction (unit XZ). */
  forwardX: number;
  forwardZ: number;
  /** Player silhouette exposure (stance), 0..1. */
  visibility: number;
  moving: boolean;
}

/** Sight: within the view cone, closer/visible/moving = stronger. */
export function computeSight(i: SightInput): number {
  const dist = Math.hypot(i.dx, i.dz);
  if (dist < 1e-3) return 1;
  const effRange = Config.senses.sightRange * i.visibility * (i.moving ? Config.senses.movingSightMult : 1);
  if (dist > effRange) return 0;
  const cos = (i.dx * i.forwardX + i.dz * i.forwardZ) / dist;
  if (cos < Config.senses.sightHalfAngleCos) return 0; // outside cone
  return clamp01(1 - dist / effRange);
}

/** Hearing: inside the player's emitted noise radius. Gunshots pass a large radius. */
export function computeHearing(dist: number, noiseRadius: number): number {
  if (noiseRadius <= 0 || dist > noiseRadius) return 0;
  return clamp01(1 - dist / noiseRadius);
}

export interface SmellInput {
  /** Player relative to deer: player - deer. */
  dx: number;
  dz: number;
  /** Wind direction the scent travels toward (unit XZ). */
  windX: number;
  windZ: number;
  windStrength: number;
}

/**
 * Smell: the player's scent is carried downwind. The deer detects it when it
 * sits in the plume — i.e. the player→deer direction aligns with the wind.
 */
export function computeSmell(i: SmellInput): number {
  const dist = Math.hypot(i.dx, i.dz);
  if (dist < 1e-3) return 1;
  const effRange = Config.senses.scentRange * Math.max(0.2, i.windStrength);
  if (dist > effRange) return 0;
  // player→deer = -(dx,dz); does it align with the wind?
  const cos = (-i.dx * i.windX + -i.dz * i.windZ) / dist;
  if (cos < Config.senses.scentHalfAngleCos) return 0;
  return clamp01(cos * (1 - dist / effRange) * i.windStrength);
}

/** Integrate awareness toward stimulus, with constant decay. Returns new awareness. */
export function updateAwareness(awareness: number, stimulus: number, dt: number): number {
  const next =
    awareness + stimulus * Config.senses.awarenessGainPerSec * dt - Config.senses.awarenessDecayPerSec * dt;
  return clamp01(next);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
