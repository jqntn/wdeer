import type { GameSystem } from "../core/Game";
import type { Wind } from "../world/Wind";

/**
 * Lightweight synthesized audio via the Web Audio API — a gunshot crack and a
 * wind-driven ambient bed. Avoids fragile sample downloads; swap for CC0
 * Freesound clips later by decoding them into buffers here.
 */
export class AudioBus implements GameSystem {
  private ctx: AudioContext | null = null;
  private noiseShort!: AudioBuffer;
  private noiseLong!: AudioBuffer;
  private ambientGain: GainNode | null = null;

  constructor(private readonly wind: Wind) {}

  /** Must be called from a user gesture (e.g. the pointer-lock click). */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.noiseShort = this.makeNoise(0.5, false);
    this.noiseLong = this.makeNoise(2, true);
    this.startAmbient();
  }

  update(_dt: number): void {
    if (this.ambientGain) {
      // Wind audibly breathes with strength.
      this.ambientGain.gain.value = 0.02 + this.wind.strength * 0.06;
    }
  }

  playGunshot(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseShort;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3800, t);
    lp.frequency.exponentialRampToValueAtTime(350, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.45);
  }

  private startAmbient(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseLong;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.04;
    src.connect(lp).connect(this.ambientGain).connect(ctx.destination);
    src.start();
  }

  private makeNoise(seconds: number, brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }
}
