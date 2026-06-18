/**
 * Central tunable constants. Sense/ballistics/movement values live here so they
 * can be balanced in one place during the M5 polish pass (see plan: "sense tuning
 * is make-or-break").
 */
export const Config = {
  world: {
    /** Half-extent of the playable square, metres. Full map ~ (size*2)^2. */
    size: 500,
    /** Heightmap grid subdivisions (vertices per side ~ subdivisions+1). */
    subdivisions: 256,
    /** Vertical scale of the terrain noise, metres. */
    maxHeight: 60,
    /** Noise feature size; larger = broader hills. */
    noiseScale: 0.0035,
    seed: 1337,
  },

  camera: {
    fovDeg: 65,
    near: 0.1,
    far: 2000,
    eyeHeight: 1.7,
  },

  physics: {
    gravity: -9.81,
  },

  render: {
    fogStart: 120,
    fogEnd: 600,
    fogColor: [0.62, 0.69, 0.72] as const,
    shadowMapSize: 2048,
  },

  env: {
    /** Seconds for a full 24h cycle. */
    dayLengthSeconds: 600,
    /** 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset. */
    startTimeOfDay: 0.34,
    /** Freeze the cycle at startTimeOfDay (handy while building). */
    paused: false,
  },

  foliage: {
    treeCount: 1400,
    bushCount: 900,
    /** Don't place foliage above this terrain height (rocky peaks bare). */
    maxSlope: 0.45,
    /** Keep a clearing around the world centre. */
    clearingRadius: 35,
  },

  player: {
    walkSpeed: 2.6,
    crouchSpeed: 1.3,
    proneSpeed: 0.7,
    sprintSpeed: 5.6,
    eyeStand: 1.7,
    eyeCrouch: 1.0,
    eyeProne: 0.45,
    staminaMax: 100,
    staminaDrainPerSec: 22,
    staminaRegenPerSec: 14,
    mouseSensitivity: 0.0022,
    pitchLimit: 1.45, // radians, ~83°
    collisionRadius: 0.4,
    /** Hearing: noise radius (m) the player emits per stance while moving. */
    noiseRadius: { still: 2, prone: 5, crouch: 10, walk: 20, sprint: 42 },
    /** Sight: silhouette exposure multiplier per stance (1 = fully visible). */
    visibility: { stand: 1.0, crouch: 0.55, prone: 0.3 },
  },

  weapon: {
    /** Camera FOV (rad) when aiming down sights — the scope zoom. */
    adsFovDeg: 28,
    adsLerpPerSec: 12,
    /** Procedural sway amplitude (rad) at hip vs aimed, and breath damping. */
    swayHip: 0.02,
    swayAds: 0.006,
    breathSwayMult: 0.18,
    muzzleVelocity: 840, // m/s, used by M4 ballistics
  },

  assets: {
    /** Animated quadruped (CC0 Khronos Fox placeholder; swap for Quaternius deer). */
    deerModel: "/assets/animals/fox.glb",
    /** glTF animation-clip names → logical states. */
    deerClips: { idle: "Survey", walk: "Walk", run: "Run" },
    deerScale: 0.019,
  },

  deer: {
    count: 3,
    walkSpeed: 1.8,
    runSpeed: 9,
    turnLerp: 0.12,
    grazeTimeMin: 4,
    grazeTimeMax: 11,
    arriveRadius: 3,
    fleeDistance: 130,
    fleeForgetSpeed: 0.6, // awareness must drop below alert*this to stop fleeing
  },

  hunt: {
    /** Vitals sphere offset from deer feet (forward, up) and its radius. */
    vitalsForward: 0.55,
    vitalsHeight: 0.85,
    vitalsRadius: 0.34,
    /** A wounded deer bleeds, flees, then collapses after this long. */
    bleedOutTime: 7,
    bloodDropInterval: 0.45,
    harvestRange: 3.5,
    respawnDelay: 4,
    muzzleVelocity: 840,
    bulletGravityScale: 1, // 1 = real gravity on the bullet
    maxBulletRange: 450,
  },

  senses: {
    sightRange: 85,
    /** cos(60°): view cone half-angle. */
    sightHalfAngleCos: 0.5,
    movingSightMult: 1.35,
    scentRange: 65,
    /** cos(35°): scent plume half-angle. */
    scentHalfAngleCos: 0.82,
    gunshotRadius: 450,
    awarenessGainPerSec: 1.7,
    awarenessDecayPerSec: 0.45,
    alertThreshold: 0.4,
    fleeThreshold: 0.85,
  },
} as const;

export type GameConfig = typeof Config;
