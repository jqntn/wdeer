/**
 * Need zones give the deer a believable purpose and make it findable — the
 * basis for planning a stalk. The deer cycles feed/water/bed weighted by the
 * time of day (dawn/dusk = feeding). Pure module (no Babylon).
 */
export type ZoneKind = "feed" | "water" | "bed";

export interface NeedZone {
  kind: ZoneKind;
  x: number;
  z: number;
  radius: number;
}

export const NEED_ZONES: NeedZone[] = [
  { kind: "feed", x: 25, z: 30, radius: 22 },
  { kind: "water", x: -130, z: 70, radius: 16 },
  { kind: "bed", x: 95, z: -110, radius: 18 },
];

/** Which zone kind the deer should favour at this time of day (0..1). */
export function preferredKind(timeOfDay: number): ZoneKind {
  const t = ((timeOfDay % 1) + 1) % 1;
  const dawn = t >= 0.2 && t < 0.35;
  const dusk = t >= 0.6 && t < 0.78;
  const day = t >= 0.35 && t < 0.6;
  if (dawn || dusk) return "feed";
  if (day) return "water";
  return "bed"; // night
}

/** Pick the next zone: usually the time-preferred one, sometimes random. */
export function preferredZone(timeOfDay: number, rand: () => number): NeedZone {
  if (rand() < 0.2) {
    return NEED_ZONES[Math.floor(rand() * NEED_ZONES.length) % NEED_ZONES.length];
  }
  const kind = preferredKind(timeOfDay);
  return NEED_ZONES.find((z) => z.kind === kind) ?? NEED_ZONES[0];
}

/** A random point inside a zone (for grazing wander within it). */
export function pointInZone(zone: NeedZone, rand: () => number): { x: number; z: number } {
  const ang = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * zone.radius;
  return { x: zone.x + Math.cos(ang) * r, z: zone.z + Math.sin(ang) * r };
}
