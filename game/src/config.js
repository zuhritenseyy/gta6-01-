// Sunvale: every tuning number and colour in one place. The camera shows a 1280x720
// window onto a 3200x2400 city; the renderer scales the window to the browser, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The whole city, in world units: roads, blocks, a park, a beach and the bay. */
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Streets run every 400 units; each road is 96 wide, so blocks are 304 on a side. */
export const ROAD_SPACING = 400;
export const ROAD_WIDTH = 96;

export const PLAYER = {
  radius: 14,
  walkSpeed: 250,
  runSpeed: 380,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchArc: 1.1,
};

export const PISTOL = {
  damage: 34,
  bulletSpeed: 760,
  range: 520,
  fireDelay: 0.22,
  startAmmo: 24,
  pickupAmmo: 12,
};

/** Car handling: one set of numbers per body style, tuned so each feels different. */
export const CAR_TYPES = {
  sedan: { length: 64, width: 32, accel: 420, brake: 640, maxSpeed: 430, grip: 3.4, reverse: 150, color: '#4a7fb5', health: 120 },
  taxi: { length: 64, width: 32, accel: 420, brake: 640, maxSpeed: 430, grip: 3.4, reverse: 150, color: '#f2c94c', health: 120 },
  van: { length: 76, width: 36, accel: 300, brake: 520, maxSpeed: 350, grip: 3.0, reverse: 130, color: '#e8e4da', health: 180 },
  sports: { length: 66, width: 32, accel: 620, brake: 760, maxSpeed: 560, grip: 4.2, reverse: 170, color: '#d64541', health: 100 },
  truck: { length: 92, width: 38, accel: 260, brake: 480, maxSpeed: 320, grip: 2.6, reverse: 120, color: '#7a6a53', health: 240 },
  police: { length: 66, width: 32, accel: 560, brake: 720, maxSpeed: 520, grip: 4.0, reverse: 160, color: '#20242e', health: 160 },
};

/** Traffic cruises slower than the player can drive; police chase faster than traffic. */
export const TRAFFIC_SPEED = 150;
export const POLICE_RAM_DAMAGE = 12;

/** Wanted stars: 0 to 5. A crime adds stars, quiet time sheds them one at a time. */
export const WANTED = {
  max: 5,
  decaySeconds: 22,
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killPolice: 2,
  bustDistance: 46,
  bustHoldSeconds: 1.0,
  bustFine: 200,
};

/** Pedestrians: how many walk the streets, how fast, how far they run from trouble. */
export const PEDS = { count: 42, walkSpeed: 70, fleeSpeed: 190, fleeRadius: 260 };

/** Traffic: how many cars drive the roads on their own. */
export const TRAFFIC = { count: 22 };

/** Parked cars the player can steal, scattered along the streets. */
export const PARKED = { count: 26 };

export const MONEY_START = 50;

/** Sun-soaked Sunvale: warm sand, green parks, blue bay, pastel roofs, dark asphalt. */
export const PALETTE = {
  backdrop: '#1c2433',
  grass: '#79b264',
  grassDark: '#6aa457',
  sand: '#e6d49a',
  water: '#3d9db5',
  waterDeep: '#2b7f97',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  lane: '#f2c94c',
  sidewalk: '#c9c2b2',
  park: '#5da24e',
  tree: '#3f7d33',
  treeLight: '#57a047',
  building: ['#e07a5f', '#81b29a', '#f2cc8f', '#e9c46a', '#7fb3d5', '#f4a261', '#a78bfa', '#ef8354'],
  roof: ['#b85c46', '#5f8f7a', '#d9b06a', '#c9a227', '#5a87a8', '#c97a44', '#8b6fd6', '#c96a3f'],
  player: '#2ec4b6',
  playerDark: '#1d8a80',
  cop: '#20242e',
  copLight: '#e8e4da',
  ped: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#6d597a', '#e07a9a', '#8ab17d'],
  blood: '#a41623',
  bullet: '#ffd166',
  muzzle: '#ffe66d',
  panel: '#20242ee6',
  text: '#f4f1e8',
  muted: '#b9b3a4',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#57cc5a',
  blue: '#4fc3f7',
  marker: '#ff5d8f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'sunvale.save.v1';
