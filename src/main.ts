import { createEngine, isWebGPUSupported } from "./core/Engine";
import { Game } from "./core/Game";

async function boot(): Promise<void> {
  const gate = document.getElementById("gate");
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;

  if (!isWebGPUSupported() || !canvas) {
    gate?.classList.add("show");
    return;
  }

  try {
    const engine = await createEngine(canvas);
    const game = new Game(engine);
    await game.init();
    // Debug handle for the preview/eval harness.
    (window as unknown as { __wdeer?: unknown }).__wdeer = { engine, game };
  } catch (err) {
    console.error("Failed to start wdeer:", err);
    if (gate) {
      gate.classList.add("show");
      const p = gate.querySelector("p");
      if (p) p.textContent = "Failed to initialise the renderer. See the console for details.";
    }
  }
}

void boot();
