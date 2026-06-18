import { describe, it, expect } from "vitest";
import { DeerBrain, type BrainContext } from "./DeerBrain";

function ctx(overrides: Partial<BrainContext> = {}): BrainContext {
  return {
    deerX: 0,
    deerZ: 0,
    forwardX: 0,
    forwardZ: 1,
    playerX: 0,
    playerZ: 0,
    playerVisibility: 0,
    playerMoving: false,
    playerNoiseRadius: 0,
    windX: 0,
    windZ: 0,
    windStrength: 0,
    timeOfDay: 0.3,
    rand: () => 0.5,
    ...overrides,
  };
}

describe("DeerBrain", () => {
  it("flees after sustained detection (player seen in front)", () => {
    const b = new DeerBrain();
    const c = ctx({ playerX: 0, playerZ: 20, playerVisibility: 1 });
    let state = "graze";
    for (let i = 0; i < 30; i++) state = b.think(0.1, c).state;
    expect(b.awareness).toBeGreaterThan(0.8);
    expect(state).toBe("flee");
  });

  it("stays calm when the player is undetectable", () => {
    const b = new DeerBrain();
    const c = ctx({ playerX: 0, playerZ: 400, playerVisibility: 1, playerNoiseRadius: 20 });
    for (let i = 0; i < 30; i++) b.think(0.1, c);
    expect(b.awareness).toBe(0);
    expect(["graze", "wander"]).toContain(b.state);
  });

  it("alarm() bumps awareness directly (e.g. a gunshot)", () => {
    const b = new DeerBrain();
    b.alarm(0.5);
    expect(b.awareness).toBeCloseTo(0.5, 5);
  });

  it("produces a run animation intent while fleeing", () => {
    const b = new DeerBrain();
    const c = ctx({ playerX: 0, playerZ: 15, playerVisibility: 1 });
    let intent = b.think(0.1, c);
    for (let i = 0; i < 30; i++) intent = b.think(0.1, c);
    expect(intent.anim).toBe("run");
    expect(intent.moving).toBe(true);
  });
});
