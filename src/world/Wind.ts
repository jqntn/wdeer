import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { GameSystem } from "../core/Game";
import { Noise } from "./Noise";

/**
 * Global wind. `direction` is the unit vector the wind — and therefore the
 * player's scent — travels *toward* (in the XZ plane). Drifts smoothly so the
 * player must keep re-reading it while stalking.
 */
export class Wind implements GameSystem {
  /** Unit vector (XZ) the wind blows toward. */
  readonly direction = new Vector3(1, 0, 0);
  /** 0..1 relative strength; scales scent carry distance. */
  strength = 0.6;

  private readonly noise = new Noise(98765);
  private t = 0;

  update(dt: number): void {
    this.t += dt;
    // Heading wanders over ~minutes; strength breathes.
    const heading = this.noise.fbm(this.t * 0.01, 0, 3) * Math.PI * 2;
    this.strength = 0.35 + this.noise.fbm(0, this.t * 0.02, 3) * 0.55;
    this.direction.set(Math.cos(heading), 0, Math.sin(heading));
  }

  /** Compass heading (degrees, 0=+Z/North, clockwise) the wind blows toward. */
  get headingDeg(): number {
    const deg = (Math.atan2(this.direction.x, this.direction.z) * 180) / Math.PI;
    return (deg + 360) % 360;
  }
}
