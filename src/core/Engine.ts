import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

/** True when the browser exposes the WebGPU API. */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/**
 * Create and initialise a WebGPU engine bound to the canvas. Caller must have
 * already verified {@link isWebGPUSupported}.
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<WebGPUEngine> {
  const engine = new WebGPUEngine(canvas, {
    antialias: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });
  await engine.initAsync();

  // Ensure the backing buffer matches the laid-out canvas size (not the 300x150
  // default) before the first frame.
  engine.resize();
  window.addEventListener("resize", () => engine.resize());
  return engine;
}
