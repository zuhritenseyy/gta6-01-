// Pedestrians: the people on the sidewalks. They stroll from corner to corner, chat in
// place sometimes, and run from gunfire, speeding cars and bodies. A pedestrian the player
// hits is a crime, and one who is scared remembers it for a while.

import { PEDS } from './config.js';
import { isOnRoad, randomSidewalkPoint } from './city.js';

let nextId = 1;

/** One walker: a position, a colour, a mood, and the corner it is heading for. */
export function createPedestrian(random, x, y) {
  return {
    id: nextId,
    x, y,
    angle: random() * Math.PI * 2,
    speed: PEDS.walkSpeed * (0.7 + random() * 0.6),
    color: random(),
    target: null,
    state: 'walk',
    scared: 0,
    down: 0,
    pause: random() * 3,
  };
}

/** Scatter the city's walkers on the sidewalks. */
export function spawnPedestrians(random) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const point = randomSidewalkPoint(random);
    peds.push(createPedestrian(random, point.x, point.y));
  }
  return peds;
}

/** A walker picks a new corner to stroll to: a nearby sidewalk point. */
function pickTarget(ped, random) {
  const point = randomSidewalkPoint(random);
  ped.target = point;
}

/**
 * One step for every pedestrian: stroll toward the target, pause at corners, flee from
 * danger (a point and radius the world hands in), and stay out of the road's middle and
 * out of buildings. `danger` is null when the streets are calm.
 */
export function stepPedestrians(city, peds, danger, dt, random) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    if (ped.scared > 0) ped.scared -= dt;

    // Flee: run straight away from the danger point.
    if (danger) {
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d = Math.hypot(dx, dy);
      if (d < danger.radius) {
        ped.state = 'flee';
        ped.scared = 3;
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
        ped.y += Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
        keepInCity(ped);
        continue;
      }
    }

    if (ped.state === 'flee') {
      if (ped.scared <= 0) ped.state = 'walk';
      else {
        ped.x += Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
        ped.y += Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
        keepInCity(ped);
        continue;
      }
    }

    if (ped.pause > 0) {
      ped.pause -= dt;
      continue;
    }
    if (!ped.target) pickTarget(ped, random);
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.target = null;
      ped.pause = 1 + random() * 4;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    // Walkers keep to the sidewalks: if one drifts onto the road, steer it back off.
    if (isOnRoad(ped.x, ped.y)) {
      const point = randomSidewalkPoint(random);
      ped.target = point;
    }
    keepInCity(ped);
  }
}

function keepInCity(ped) {
  ped.x = Math.max(24, Math.min(3176, ped.x));
  ped.y = Math.max(24, Math.min(2376, ped.y));
}

/** Knock a pedestrian down (hit by a car): they stay down a while, then get up scared. */
export function knockDown(ped) {
  ped.down = 4;
  ped.scared = 6;
  ped.state = 'flee';
}

/** Scare every pedestrian near a point: gunfire, a crash, a body. */
export function scareNear(peds, x, y, radius) {
  for (const ped of peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius && ped.down <= 0) {
      ped.scared = 3;
      ped.state = 'flee';
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}
