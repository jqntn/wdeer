import { describe, it, expect } from "vitest";
import { computeSight, computeHearing, computeSmell, updateAwareness } from "./Senses";

describe("computeSight", () => {
  const forward = { forwardX: 0, forwardZ: 1 }; // deer facing +Z

  it("detects a visible player in front, within range", () => {
    const s = computeSight({ dx: 0, dz: 20, ...forward, visibility: 1, moving: false });
    expect(s).toBeGreaterThan(0);
  });

  it("does not see a player behind it (outside the cone)", () => {
    const s = computeSight({ dx: 0, dz: -20, ...forward, visibility: 1, moving: false });
    expect(s).toBe(0);
  });

  it("does not see a player beyond sight range", () => {
    const s = computeSight({ dx: 0, dz: 300, ...forward, visibility: 1, moving: false });
    expect(s).toBe(0);
  });

  it("is harder to see when crouched (lower visibility)", () => {
    const stand = computeSight({ dx: 0, dz: 60, ...forward, visibility: 1, moving: false });
    const crouch = computeSight({ dx: 0, dz: 60, ...forward, visibility: 0.55, moving: false });
    expect(crouch).toBeLessThan(stand);
  });
});

describe("computeHearing", () => {
  it("hears the player inside the noise radius, louder when closer", () => {
    expect(computeHearing(5, 20)).toBeGreaterThan(computeHearing(15, 20));
  });
  it("hears nothing outside the noise radius", () => {
    expect(computeHearing(30, 20)).toBe(0);
  });
  it("hears nothing when the player is silent (radius 0)", () => {
    expect(computeHearing(1, 0)).toBe(0);
  });
});

describe("computeSmell", () => {
  // Player 20m on the deer's -Z side: dx=0, dz=-20.
  it("smells the player when downwind (wind carries scent to the deer)", () => {
    const s = computeSmell({ dx: 0, dz: -20, windX: 0, windZ: 1, windStrength: 1 });
    expect(s).toBeGreaterThan(0);
  });
  it("does NOT smell the player when upwind (the signature mechanic)", () => {
    const s = computeSmell({ dx: 0, dz: -20, windX: 0, windZ: -1, windStrength: 1 });
    expect(s).toBe(0);
  });
  it("smells nothing beyond scent range", () => {
    const s = computeSmell({ dx: 0, dz: -300, windX: 0, windZ: 1, windStrength: 1 });
    expect(s).toBe(0);
  });
});

describe("updateAwareness", () => {
  it("rises while a stimulus is present", () => {
    expect(updateAwareness(0, 1, 0.1)).toBeGreaterThan(0);
  });
  it("decays toward zero with no stimulus", () => {
    expect(updateAwareness(0.5, 0, 0.1)).toBeLessThan(0.5);
  });
  it("clamps to the 0..1 range", () => {
    expect(updateAwareness(0.99, 1, 1)).toBeLessThanOrEqual(1);
    expect(updateAwareness(0.01, 0, 1)).toBeGreaterThanOrEqual(0);
  });
});
