import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";

import { initPhysics } from "./Physics";
import { Environment } from "../world/Environment";
import { Terrain } from "../world/Terrain";
import { Foliage } from "../world/Foliage";
import { Wind } from "../world/Wind";
import { InputManager } from "../player/InputManager";
import { Player } from "../player/Player";
import { Weapon } from "../player/Weapon";
import { AssetManager } from "./AssetManager";
import { Deer } from "../animals/Deer";
import { NEED_ZONES, pointInZone } from "../animals/NeedZones";
import { Config } from "./Config";
import { BloodTrail } from "../fx/BloodTrail";
import { AudioBus } from "../fx/AudioBus";
import { Ballistics, type ShotListener } from "../player/Ballistics";
import { Hud } from "../ui/Hud";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/** A per-frame updatable subsystem (player, deer, wind, …). */
export interface GameSystem {
  update(dt: number): void;
  dispose?(): void;
}

/**
 * Owns the scene and the update loop. Subsystems register via {@link addSystem}
 * and are ticked every frame from `onBeforeRenderObservable`.
 */
export class Game implements ShotListener {
  readonly engine: WebGPUEngine;
  readonly scene: Scene;

  // Populated in init(); referenced by later milestones.
  env!: Environment;
  terrain!: Terrain;
  foliage!: Foliage;
  wind!: Wind;
  input!: InputManager;
  player!: Player;
  weapon!: Weapon;
  assets!: AssetManager;
  deer: Deer[] = [];
  blood!: BloodTrail;
  audio!: AudioBus;
  hud!: Hud;
  ballistics!: Ballistics;
  private bestScore = Number(localStorage.getItem("wdeer.best") ?? 0);
  private busy = false; // harvest panel open

  private readonly systems: GameSystem[] = [];

  constructor(engine: WebGPUEngine) {
    this.engine = engine;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.62, 0.69, 0.72, 1);
  }

  addSystem<T extends GameSystem>(system: T): T {
    this.systems.push(system);
    return system;
  }

  /** Build the world and start the render loop. */
  async init(): Promise<void> {
    await initPhysics(this.scene);

    this.env = this.addSystem(new Environment(this.scene));
    this.terrain = new Terrain(this.scene);
    this.foliage = new Foliage(this.scene, this.terrain, this.env);
    this.wind = this.addSystem(new Wind());

    const canvas = this.engine.getRenderingCanvas() as HTMLCanvasElement;
    this.input = new InputManager(canvas);
    this.player = this.addSystem(new Player(this.scene, this.input, this.terrain, this.foliage));
    this.weapon = this.addSystem(new Weapon(this.scene, this.player.camera, this.input));

    this.blood = new BloodTrail(this.scene);
    this.audio = this.addSystem(new AudioBus(this.wind));
    canvas.addEventListener("click", () => this.audio.init()); // user-gesture audio unlock
    this.hud = this.addSystem(new Hud(this.player, this.wind, this.weapon));

    this.assets = new AssetManager();
    await this.assets.load(this.scene);
    this.spawnDeer();

    this.ballistics = this.addSystem(new Ballistics(this.scene, this.player.camera, this.input, this.deer, this));
    this.addSystem({ update: (dt) => this.updateHarvest(dt) });

    this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      for (const system of this.systems) system.update(dt);
    });

    this.engine.runRenderLoop(() => this.scene.render());
  }

  private spawnDeer(): void {
    for (let i = 0; i < Config.deer.count; i++) {
      this.spawnOne(NEED_ZONES[i % NEED_ZONES.length].kind);
    }
  }

  private spawnOne(_kind: string): void {
    const zone = NEED_ZONES[Math.floor(Math.random() * NEED_ZONES.length)];
    const p = pointInZone(zone, Math.random);
    const deer = new Deer(this.assets.deer, p, this.player, this.wind, this.env, this.terrain, this.blood);
    this.deer.push(this.addSystem(deer));
  }

  /** Ballistics callback: gunshot at fire, feedback on hit. */
  onShot(clean: boolean | null, deer: Deer | null, distance: number): void {
    if (clean === null) {
      this.audio.playGunshot();
      return;
    }
    if (deer && clean) this.hud.showToast(`Clean kill • ${Math.round(distance)} m`);
    else if (deer) this.hud.showToast("Hit! It bolted — follow the blood");
    else this.hud.showToast("Missed");
  }

  /** Prompt + E-to-harvest on the nearest downed deer in range. */
  private updateHarvest(_dt: number): void {
    if (this.busy) return;
    const eye = this.player.eyePosition;
    let nearest: Deer | null = null;
    let best: number = Config.hunt.harvestRange;
    for (const d of this.deer) {
      if (!d.harvestable) continue;
      const dist = Vector3.Distance(new Vector3(eye.x, d.pos.y, eye.z), d.pos);
      if (dist < best) {
        best = dist;
        nearest = d;
      }
    }
    if (!nearest) {
      this.hud.setPrompt(null);
      return;
    }
    this.hud.setPrompt("Press E to harvest");
    if (this.input.consumeInteract()) {
      const result = nearest.harvest();
      if (result.score > this.bestScore) {
        this.bestScore = result.score;
        localStorage.setItem("wdeer.best", String(this.bestScore));
      }
      this.busy = true;
      this.hud.setPrompt(null);
      const harvested = nearest;
      this.hud.showHarvest(result, () => {
        this.removeDeer(harvested);
        this.spawnOne("feed");
        this.busy = false;
      });
    }
  }

  private removeDeer(deer: Deer): void {
    const di = this.deer.indexOf(deer);
    if (di >= 0) this.deer.splice(di, 1);
    this.removeSystem(deer);
    deer.dispose();
  }

  private removeSystem(system: GameSystem): void {
    const i = this.systems.indexOf(system);
    if (i >= 0) this.systems.splice(i, 1);
  }

  dispose(): void {
    for (const system of this.systems) system.dispose?.();
    this.scene.dispose();
  }
}
