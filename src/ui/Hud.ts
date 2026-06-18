import type { GameSystem } from "../core/Game";
import type { Player } from "../player/Player";
import type { Wind } from "../world/Wind";
import type { Weapon } from "../player/Weapon";
import type { HarvestResult } from "../animals/Deer";
import { Config } from "../core/Config";

const STYLE = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#e6ecdf}
#hud .crosshair{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;
  border-radius:50%;border:1.5px solid rgba(230,236,223,.8);box-shadow:0 0 2px #000}
#hud.aim .crosshair{width:4px;height:4px;margin:-2px 0 0 -2px;background:#e6ecdf;border:none}
#hud .scope{position:absolute;inset:0;display:none;background:radial-gradient(circle at 50% 50%,
  transparent 0 26%,rgba(0,0,0,.55) 33%,#000 46%)}
#hud.aim .scope{display:block}
#hud .compass{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:120px;height:34px;
  background:rgba(10,14,10,.5);border:1px solid rgba(230,236,223,.25);border-radius:6px;
  display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:1px}
#hud .windArrow{display:inline-block;margin-left:6px;font-size:16px;transition:transform .1s linear}
#hud .stamina{position:absolute;left:24px;bottom:24px;width:160px;height:8px;
  background:rgba(0,0,0,.5);border-radius:4px;overflow:hidden}
#hud .stamina>i{display:block;height:100%;background:linear-gradient(90deg,#7fae54,#cfe39b);width:100%}
#hud .prompt{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:14px;
  background:rgba(10,14,10,.55);padding:6px 12px;border-radius:6px;display:none}
#hud .toast{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-size:15px;
  background:rgba(10,14,10,.6);padding:8px 14px;border-radius:6px;opacity:0;transition:opacity .3s}
#harvest{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.55);font-family:system-ui,sans-serif;color:#e6ecdf;z-index:5}
#harvest .card{background:#141a12;border:1px solid #2c3a24;border-radius:10px;padding:22px 26px;width:300px}
#harvest h2{margin:0 0 12px;font-size:18px}
#harvest .row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#b9c6ab}
#harvest .row b{color:#e6ecdf}
#harvest .score{font-size:26px;margin:12px 0 16px;text-align:center;color:#cfe39b}
#harvest button{width:100%;padding:9px;border:0;border-radius:6px;background:#5e8b3a;color:#fff;
  font-size:14px;cursor:pointer}
#startHint{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;
  padding-bottom:14vh;pointer-events:none;font-family:system-ui,sans-serif;color:#e6ecdf;z-index:4}
#startHint .box{background:rgba(10,14,10,.6);padding:14px 18px;border-radius:8px;text-align:center;
  max-width:520px;line-height:1.7;font-size:13px}
#startHint b{font-size:15px;display:block;margin-bottom:6px}
#startHint .keys{color:#b9c6ab}
`;

/** DOM overlay HUD: crosshair/scope, wind compass, stamina, prompt, harvest panel. */
export class Hud implements GameSystem {
  private readonly hud: HTMLDivElement;
  private readonly arrow: HTMLSpanElement;
  private readonly staminaFill: HTMLElement;
  private readonly prompt: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly harvest: HTMLDivElement;
  private toastTimer = 0;

  constructor(
    private readonly player: Player,
    private readonly wind: Wind,
    private readonly weapon: Weapon,
  ) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    this.hud = document.createElement("div");
    this.hud.id = "hud";
    this.hud.innerHTML = `
      <div class="scope"></div>
      <div class="crosshair"></div>
      <div class="compass">WIND<span class="windArrow">↑</span></div>
      <div class="stamina"><i></i></div>
      <div class="prompt"></div>
      <div class="toast"></div>`;
    document.body.appendChild(this.hud);
    this.arrow = this.hud.querySelector(".windArrow")!;
    this.staminaFill = this.hud.querySelector(".stamina>i")!;
    this.prompt = this.hud.querySelector(".prompt")!;
    this.toast = this.hud.querySelector(".toast")!;

    this.harvest = document.createElement("div");
    this.harvest.id = "harvest";
    document.body.appendChild(this.harvest);

    const hint = document.createElement("div");
    hint.id = "startHint";
    hint.innerHTML = `<div class="box"><b>Click to play — stalk the deer</b>
      <span class="keys">WASD move · Mouse look · Shift sprint / hold-breath · C crouch · Z prone<br>
      RMB aim · LMB fire · E harvest · Stay downwind and out of sight</span></div>`;
    document.body.appendChild(hint);
    document.addEventListener("pointerlockchange", () => {
      hint.style.display = document.pointerLockElement ? "none" : "flex";
    });
  }

  update(dt: number): void {
    // Wind arrow relative to where the player is facing.
    const rel = this.wind.headingDeg - (this.player.headingYaw * 180) / Math.PI;
    this.arrow.style.transform = `rotate(${rel}deg)`;

    this.staminaFill.style.width = `${(this.player.stamina / Config.player.staminaMax) * 100}%`;
    this.hud.classList.toggle("aim", this.weapon.isAimed);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.style.opacity = "0";
    }
  }

  setPrompt(text: string | null): void {
    this.prompt.style.display = text ? "block" : "none";
    if (text) this.prompt.textContent = text;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.style.opacity = "1";
    this.toastTimer = 2.5;
  }

  showHarvest(r: HarvestResult, onContinue: () => void): void {
    document.exitPointerLock();
    this.harvest.innerHTML = `
      <div class="card">
        <h2>Harvest</h2>
        <div class="row"><span>Sex</span><b>${r.gender}</b></div>
        <div class="row"><span>Weight</span><b>${r.weightKg} kg</b></div>
        <div class="row"><span>Trophy</span><b>${r.trophy || "—"}</b></div>
        <div class="row"><span>Shot</span><b>${r.clean ? "Clean (vitals)" : "Tracked (wound)"}</b></div>
        <div class="row"><span>Distance</span><b>${Math.round(r.distance)} m</b></div>
        <div class="score">${r.score} pts</div>
        <button>Continue</button>
      </div>`;
    this.harvest.style.display = "flex";
    this.harvest.querySelector("button")!.addEventListener("click", () => {
      this.harvest.style.display = "none";
      onContinue();
    });
  }
}
