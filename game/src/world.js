// The world: every system in one place, advancing one fixed step at a time. The player
// walks and drives, traffic rolls, pedestrians stroll, the police hunt, bullets fly and
// the story advances — and step() reports what happened as bit flags, so the loop can
// react without the world knowing about screens or sound. No drawing and no browser here
// except the random seed: the world is pure rules, which is what makes it testable.

import { CAR_TYPES, MONEY_START, PARKED, PISTOL, PLAYER, STEP, TRAFFIC, WANTED } from './config.js';
import { collideCity, generateCity, nearestRoadPoint, randomRoadPoint } from './city.js';
import { createRandom } from './random.js';
import { createCar, spawnParkedCar, spawnTrafficCar, stepCarPhysics, stepTrafficCar, wreckCar } from './vehicles.js';
import { knockDown, scareNear, spawnPedestrians, stepPedestrians } from './people.js';
import { bloodPuff, fireBullet, impactPuff, muzzleFlash, punchHits, spawnParticle, stepBullets, stepParticles } from './combat.js';
import { addCrime, clearWanted, createWanted, policeWanted, stepWanted } from './wanted.js';
import { copInSight, createOfficer, spawnOfficer, spawnPoliceCar, stepOfficer, stepPoliceCar } from './police.js';
import { advanceStep, currentMission, currentStep, failMission, nextMission, say, startMission, stepMissionClock, stepTarget } from './missions.js';
import { saveGame } from './save.js';

export const EVENT_OVER = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_CRIME = 8;
export const EVENT_SHOT = 16;
export const EVENT_PICKUP = 32;
export const EVENT_PUNCH = 64;

const AMMO_SPOTS = [
  { x: 1248, y: 760 }, { x: 2800, y: 1150 }, { x: 400, y: 1650 }, { x: 2000, y: 400 },
];
const HEALTH_SPOTS = [
  { x: 800, y: 1080 }, { x: 1600, y: 1980 },
];

/** The whole game state, built from a seed. */
export function createWorld(seed) {
  const random = createRandom(seed);
  const city = generateCity(random);
  const cars = [];
  for (let i = 0; i < PARKED.count; i += 1) cars.push(spawnParkedCar(city, random));
  for (let i = 0; i < TRAFFIC.count; i += 1) cars.push(spawnTrafficCar(random));
  const state = {
    seed,
    city,
    random,
    player: {
      x: city.start.x, y: city.start.y, vx: 0, vy: 0,
      angle: 0, health: PLAYER.health, ammo: PISTOL.startAmmo,
      invulnerable: 0, fireDelay: 0, punchCooldown: 0,
    },
    inCar: false,
    playerCar: null,
    cars,
    peds: spawnPedestrians(random),
    officers: [],
    guards: [],
    policeCars: [],
    bullets: [],
    particles: [],
    pickups: [
      ...AMMO_SPOTS.map((s) => ({ ...s, kind: 'ammo', taken: false })),
      ...HEALTH_SPOTS.map((s) => ({ ...s, kind: 'health', taken: false })),
    ],
    wanted: createWanted(),
    missions: { index: 0, step: 0, stepTime: 0, grabTime: 0, active: false, done: false, failed: false, message: '', messageTime: 0 },
    money: MONEY_START,
    marker: null,
    missionInfo: null,
    elapsed: 0,
    best: MONEY_START,
    packageHeld: false,
    sportsTarget: null,
  };
  return state;
}

/** Begin a fresh campaign: money, missions and the player back at the start. */
export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  Object.keys(fresh).forEach((key) => { state[key] = fresh[key]; });
  startMission(state.missions);
  updateMarker(state);
}

/** Load a save onto the state: money, mission, position and health. */
export function applySave(state, save) {
  state.money = save.money;
  state.missions.index = save.missionIndex;
  state.player.health = save.health;
  state.player.x = save.x;
  state.player.y = save.y;
  state.player.ammo = save.ammo;
  state.best = Math.max(state.best, save.money);
  startMission(state.missions);
  updateMarker(state);
}

/** Where the objective marker sits: the step's place, or the nearest sports car. */
export function updateMarker(state) {
  const step = currentStep(state.missions);
  if (!state.missions.active || !step) {
    state.marker = null;
    state.missionInfo = null;
    return;
  }
  const mission = currentMission(state.missions);
  state.missionInfo = { name: mission.name, step };
  if (step.kind === 'steal') {
    state.marker = nearestSportsCar(state);
    return;
  }
  if (step.kind === 'survive') {
    state.marker = null;
    return;
  }
  state.marker = stepTarget(state.missions, state.city);
}

function nearestSportsCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.type !== 'sports' || car.wrecked || car.driver === 'police') continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** The nearest drivable car to the player, within reach, or null. */
function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** The player gets in a car: stealing it is a crime, and its driver runs away. */
function enterCar(state, car) {
  const wasTraffic = car.driver === 'traffic';
  if (wasTraffic) {
    const ped = { id: 9000 + car.id, x: car.x + 30, y: car.y, angle: 0, speed: 190, color: 0, target: null, state: 'flee', scared: 5, down: 0, pause: 0 };
    state.peds.push(ped);
    scareNear(state.peds, car.x, car.y, 200);
  }
  const isPolice = car.type === 'police';
  car.driver = 'player';
  car.parked = false;
  state.inCar = true;
  state.playerCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  addCrime(state.wanted, isPolice ? 2 : 1, state.elapsed);
  const step = currentStep(state.missions);
  if (step && step.kind === 'steal' && car.type === 'sports') {
    advanceStep(state.missions);
    updateMarker(state);
  }
  return isPolice ? 2 : 1;
}

/** The player gets out: the car stops where it is, and the player steps beside it. */
function exitCar(state) {
  const car = state.playerCar;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  state.inCar = false;
  state.playerCar = null;
}

/** A bank guard: stands by the vault and shoots at the player while the grab runs. */
function spawnGuards(state) {
  const bank = state.city.places.bank;
  state.guards = [];
  for (let i = 0; i < 3; i += 1) {
    state.guards.push({
      id: 7000 + i, kind: 'guard',
      x: bank.x + (i - 1) * 90, y: bank.y + 60,
      angle: 0, health: 60, radius: 14, fireDelay: 1 + i * 0.4, dead: false,
    });
  }
}

function stepGuard(state, guard, dt) {
  if (guard.dead) return;
  const dx = state.player.x - guard.x;
  const dy = state.player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  guard.angle = Math.atan2(dy, dx);
  guard.fireDelay -= dt;
  if (dist < 460 && guard.fireDelay <= 0) {
    guard.fireDelay = 1.2;
    const aim = guard.angle + (Math.random() - 0.5) * 0.14;
    state.bullets.push(fireBullet(guard, aim, false));
  }
}

/**
 * One fixed step of the whole world. `input` is { move: {x, y, run}, aim: {x, y},
 * click, actions } from the input layer. Returns the events of this step as flags.
 */
export function stepWorld(state, input, dt) {
  let events = 0;
  state.elapsed += dt;
  const p = state.player;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.fireDelay > 0) p.fireDelay -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;

  // The mission clock: timed steps can run out.
  if (stepMissionClock(state.missions, dt) === 'timeout') {
    failMission(state.missions, 'Too slow — the job fell through. Try it again.');
    updateMarker(state);
  }

  // --- The player, on foot or behind the wheel.
  if (state.inCar && state.playerCar) {
    const car = state.playerCar;
    const move = input.move;
    const throttle = move.y < 0 ? 1 : move.y > 0 ? -0.7 : 0;
    const steer = move.x;
    stepCarPhysics(state.city, car, { throttle, steer, brake: false }, dt);
    p.x = car.x;
    p.y = car.y;
    p.vx = Math.cos(car.angle) * car.speed;
    p.vy = Math.sin(car.angle) * car.speed;
    p.angle = car.angle;
    if (car.health <= 0) {
      wreckCar(car);
      exitCar(state);
      spawnParticle(state.particles, car.x, car.y, 0, -40, 0.8, 18, '#555555');
      events |= EVENT_CRIME;
    }
    // Running over a pedestrian in the car is a crime.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 34 && Math.abs(car.speed) > 60) {
        knockDown(ped);
        addCrime(state.wanted, WANTED.hitPedestrian, state.elapsed);
        events |= EVENT_CRIME;
        scareNear(state.peds, car.x, car.y, 240);
      }
    }
  } else {
    const move = input.move;
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = move.x;
    let my = move.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    }
    p.vx = mx * speed;
    p.vy = my * speed;
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    const pushed = collideCity(state.city, nx, ny, PLAYER.radius);
    p.x = pushed ? pushed.x : nx;
    p.y = pushed ? pushed.y : ny;
    // Walking into a parked car shoves it a little; walking into traffic is unwise.
    for (const car of state.cars) {
      if (car.parked || car.wrecked) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < 40 && Math.abs(car.speed) > 100) {
        p.health -= 18;
        p.invulnerable = 1;
        const pushed2 = collideCity(state.city, p.x + (p.x - car.x) * 0.5, p.y + (p.y - car.y) * 0.5, PLAYER.radius);
        if (pushed2) {
          p.x = pushed2.x;
          p.y = pushed2.y;
        }
      }
    }
  }

  // --- One-shot actions: enter/exit a car, punch, shoot.
  const actions = input.actions;
  if (actions) {
    if (actions & 4) {
      if (state.inCar) exitCar(state);
      else {
        const car = nearestCar(state, 70);
        if (car) {
          enterCar(state, car);
          events |= EVENT_CRIME;
        }
      }
    }
    if ((actions & 8) && !state.inCar && p.punchCooldown <= 0) {
      p.punchCooldown = 0.4;
      const targets = [
        ...state.officers.map((o) => ({ ...o, who: 'officer', ref: o })),
        ...state.guards.map((g) => ({ ...g, who: 'guard', ref: g })),
      ];
      const hit = punchHits(p.x, p.y, p.angle, targets);
      if (hit.length > 0) {
        events |= EVENT_PUNCH;
        for (const t of hit) {
          t.ref.health -= PLAYER.punchDamage;
          bloodPuff(state.particles, t.ref.x, t.ref.y);
          if (t.ref.health <= 0) {
            t.ref.dead = true;
            if (t.who === 'officer') addCrime(state.wanted, WANTED.killPolice, state.elapsed);
          }
        }
      }
    }
  }
  if (input.click && p.fireDelay <= 0 && p.ammo > 0) {
    p.fireDelay = PISTOL.fireDelay;
    p.ammo -= 1;
    const angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    p.angle = angle;
    state.bullets.push(fireBullet(p, angle, true));
    muzzleFlash(state.particles, p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, angle);
    addCrime(state.wanted, 0, state.elapsed);
    if (state.wanted.stars === 0) addCrime(state.wanted, WANTED.shoot, state.elapsed);
    events |= EVENT_SHOT;
    scareNear(state.peds, p.x, p.y, 260);
  }

  // --- Traffic, pedestrians, police.
  for (const car of state.cars) {
    if (car.driver === 'traffic') stepTrafficCar(state.city, state.cars, car, state.random, dt);
  }
  stepPedestrians(state.city, state.peds, null, dt, state.random);

  // Police numbers follow the heat: spawn what the stars call for, dismiss the rest.
  const wantCops = policeWanted(state.wanted.stars);
  const copCars = state.cars.filter((c) => c.driver === 'police');
  const footCops = state.officers.filter((o) => !o.dead);
  if (copCars.length + footCops.length < wantCops) {
    if (state.inCar || Math.random() < 0.6) {
      const car = spawnPoliceCar(state.random, p.x, p.y);
      state.cars.push(car);
    } else {
      state.officers.push(spawnOfficer(state.random, p.x, p.y));
    }
  }
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver !== 'police' || car.wrecked) continue;
    const result = stepPoliceCar(state.city, car, p, state.playerCar, dt);
    if (result === 'bail') {
      state.officers.push(createOfficer(car.x, car.y));
      car.driver = null;
      car.parked = true;
      car.speed = 0;
    }
  }
  for (const officer of state.officers) {
    if (officer.dead) continue;
    const result = stepOfficer(state.city, officer, p, state.wanted.stars, state.bullets, dt);
    if (result === 'bust') {
      events |= EVENT_BUSTED;
    }
  }
  for (const guard of state.guards) stepGuard(state, guard, dt);

  // --- Bullets: who they hit, and what it costs.
  const targets = [
    { x: p.x, y: p.y, radius: 14, who: 'player', ref: p },
    ...state.officers.filter((o) => !o.dead).map((o) => ({ x: o.x, y: o.y, radius: 14, who: 'officer', ref: o })),
    ...state.guards.filter((g) => !g.dead).map((g) => ({ x: g.x, y: g.y, radius: 14, who: 'guard', ref: g })),
    ...state.peds.filter((pd) => pd.down <= 0).map((pd) => ({ x: pd.x, y: pd.y, radius: 12, who: 'ped', ref: pd })),
  ];
  const hits = stepBullets(state.city, state.bullets, targets, dt);
  for (const hit of hits) {
    const { bullet, target } = hit;
    if (bullet.friendly && target.who === 'player') continue;
    if (!bullet.friendly && target.who !== 'player') continue;
    if (target.who === 'player') {
      if (p.invulnerable <= 0) {
        p.health -= PISTOL.damage;
        p.invulnerable = 0.5;
        bloodPuff(state.particles, p.x, p.y);
      }
    } else if (target.who === 'officer') {
      target.ref.health -= PISTOL.damage;
      bloodPuff(state.particles, target.ref.x, target.ref.y);
      if (target.ref.health <= 0) {
        target.ref.dead = true;
        addCrime(state.wanted, WANTED.killPolice, state.elapsed);
        events |= EVENT_CRIME;
      }
    } else if (target.who === 'guard') {
      target.ref.health -= PISTOL.damage;
      bloodPuff(state.particles, target.ref.x, target.ref.y);
      if (target.ref.health <= 0) target.ref.dead = true;
    } else if (target.who === 'ped') {
      knockDown(target.ref);
      addCrime(state.wanted, WANTED.hitPedestrian, state.elapsed);
      events |= EVENT_CRIME;
      scareNear(state.peds, target.ref.x, target.ref.y, 240);
    }
  }

  // --- Pickups: ammo and health on the street.
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    const d = Math.hypot(pickup.x - p.x, pickup.y - p.y);
    if (d < 34) {
      pickup.taken = true;
      if (pickup.kind === 'ammo') p.ammo += PISTOL.pickupAmmo;
      else p.health = Math.min(PLAYER.health, p.health + 50);
      events |= EVENT_PICKUP;
    }
  }

  // --- The heat cools when the cops lose sight of the player.
  const sight = copInSight([...state.officers, ...state.cars.filter((c) => c.driver === 'police')], p.x, p.y);
  stepWanted(state.wanted, dt, sight);

  // --- Mission steps: what the player has to do, and when it is done.
  const step = currentStep(state.missions);
  if (state.missions.active && step) {
    // The heat-wave step keeps three stars on the player until it is survived.
    if (step.kind === 'survive' && state.wanted.stars < 3) {
      state.wanted.stars = 3;
      state.wanted.quiet = 0;
    }
    const place = stepTarget(state.missions, state.city);
    const px = state.inCar && state.playerCar ? state.playerCar.x : p.x;
    const py = state.inCar && state.playerCar ? state.playerCar.y : p.y;
    if (step.kind === 'goto' || step.kind === 'pickup' || step.kind === 'deliver') {
      if (place && Math.hypot(place.x - px, place.y - py) < 80) {
        if (step.kind === 'pickup') state.packageHeld = true;
        if (step.kind === 'deliver') state.packageHeld = false;
        if (advanceStep(state.missions) === 'done') events |= EVENT_MISSION_DONE;
        updateMarker(state);
      }
    } else if (step.kind === 'bring') {
      if (place && state.inCar && state.playerCar && state.playerCar.type === 'sports' && Math.hypot(place.x - px, place.y - py) < 100) {
        if (advanceStep(state.missions) === 'done') events |= EVENT_MISSION_DONE;
        updateMarker(state);
      }
    } else if (step.kind === 'survive') {
      if (state.missions.stepTime >= step.seconds) {
        clearWanted(state.wanted);
        if (advanceStep(state.missions) === 'done') events |= EVENT_MISSION_DONE;
        updateMarker(state);
      }
    } else if (step.kind === 'grab') {
      if (place && Math.hypot(place.x - px, place.y - py) < 100) {
        state.missions.grabTime += dt;
        if (state.guards.length === 0) spawnGuards(state);
        if (state.missions.grabTime >= step.seconds) {
          state.guards = [];
          if (advanceStep(state.missions) === 'done') events |= EVENT_MISSION_DONE;
          updateMarker(state);
        }
      } else {
        state.missions.grabTime = Math.max(0, state.missions.grabTime - dt);
      }
    } else if (step.kind === 'escape') {
      if (place && Math.hypot(place.x - px, place.y - py) < 80) {
        if (advanceStep(state.missions) === 'done') events |= EVENT_MISSION_DONE;
        updateMarker(state);
      }
    }
  }

  // Mission payout and save, the moment one finishes. The next job starts a few
  // seconds later, once the outro has been read; the last one ends the story.
  if (events & EVENT_MISSION_DONE) {
    const finished = state.missions.index - 1;
    const mission = currentMission({ index: finished });
    if (mission) {
      state.money += mission.reward;
      state.best = Math.max(state.best, state.money);
    }
    saveGame(state);
    if (state.missions.index < 5) {
      state.missions.nextAt = state.elapsed + 5;
    }
  }

  // Between missions: when the outro's time is up, the next job begins.
  if (state.missions.done && state.missions.nextAt > 0 && state.elapsed >= state.missions.nextAt) {
    state.missions.nextAt = 0;
    nextMission(state.missions);
    updateMarker(state);
  }

  // A busted player pays a fine, loses the heat, and wakes up at the hospital.
  if (events & EVENT_BUSTED) {
    state.money = Math.max(0, state.money - WANTED.bustFine);
    clearWanted(state.wanted);
    state.officers = state.officers.filter((o) => !o.dead);
    const hospital = state.city.places.hospital;
    p.x = hospital.x;
    p.y = hospital.y + 60;
    if (state.inCar) exitCar(state);
    failMission(state.missions, 'Busted! The mission failed — the job is still open when you are ready.');
    updateMarker(state);
  }

  // Wasted: no health left, the run ends here.
  if (p.health <= 0) {
    events |= EVENT_OVER;
  }

  stepParticles(state.particles, dt);
  return events;
}

/** The heat-wave step forces three stars the moment it starts. */
export function beginSurviveStep(state) {
  state.wanted.stars = 3;
  state.wanted.quiet = 0;
}

/** Start the mission the runner points at, wiring its special steps. */
export function beginCurrentMission(state) {
  startMission(state.missions);
  const step = currentStep(state.missions);
  if (step && step.kind === 'survive') beginSurviveStep(state);
  updateMarker(state);
}
