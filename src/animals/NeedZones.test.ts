import { describe, it, expect } from "vitest";
import { preferredKind, preferredZone, pointInZone, NEED_ZONES } from "./NeedZones";

describe("preferredKind", () => {
  it("favours feeding at dawn and dusk", () => {
    expect(preferredKind(0.27)).toBe("feed"); // dawn
    expect(preferredKind(0.7)).toBe("feed"); // dusk
  });
  it("favours water through midday", () => {
    expect(preferredKind(0.5)).toBe("water");
  });
  it("favours bedding at night", () => {
    expect(preferredKind(0.95)).toBe("bed");
    expect(preferredKind(0.05)).toBe("bed");
  });
});

describe("preferredZone", () => {
  it("returns the time-preferred zone when not rolling random", () => {
    const z = preferredZone(0.5, () => 0.9); // >0.2 → not random
    expect(z.kind).toBe("water");
  });
});

describe("pointInZone", () => {
  it("returns a point within the zone radius", () => {
    const zone = NEED_ZONES[0];
    const p = pointInZone(zone, () => 0.5);
    const dist = Math.hypot(p.x - zone.x, p.z - zone.z);
    expect(dist).toBeLessThanOrEqual(zone.radius);
  });
});
