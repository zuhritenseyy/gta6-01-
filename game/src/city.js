// Sunvale City: the map itself. A grid of streets every 400 units, blocks full of
// buildings, a park in the middle, a beach and the bay along the east edge, and the named
// places the story sends the player to. Generation is seeded, so the same seed builds the
// same city; the rules (roads, collisions, places) never touch the browser.

import { PALETTE, ROAD_SPACING, ROAD_WIDTH, WORLD } from './config.js';

/** The streets: verticals and horizontals, each a centre line with a width. */
export const ROADS_V = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const ROADS_H = [400, 800, 1200, 1600, 2000];

/** The park block: the block between roads x 1200-1600, y 800-1200. No buildings there. */
export const PARK = { x: 1248, y: 848, w: 304, h: 304 };

/** The bay: water east of x 3040, with a sand beach in front of it. */
export const WATER = { x: 3040, y: 0, w: 160, h: WORLD.height };
export const BEACH = { x: 2960, y: 0, w: 80, h: WORLD.height };

const ROOF_COLORS = PALETTE.building;
const WALL_COLORS = PALETTE.roof;

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function roadCentre(lines, value) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/**
 * Build the city from a seeded random. Returns roads, buildings, trees, water, the park
 * and the named places, plus the query helpers the world and the renderer share.
 */
export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const half = ROAD_WIDTH / 2;

  // One or two buildings per block, set back from the street by a sidewalk's width.
  for (let bx = 0; bx < ROADS_V.length - 1; bx += 1) {
    for (let by = 0; by < ROADS_H.length - 1; by += 1) {
      const x0 = ROADS_V[bx] + half + 24;
      const y0 = ROADS_H[by] + half + 24;
      const x1 = ROADS_V[bx + 1] - half - 24;
      const y1 = ROADS_H[by + 1] - half - 24;
      if (x0 >= PARK.x && x0 < PARK.x + PARK.w && y0 >= PARK.y && y0 < PARK.y + PARK.h) {
        // The park: trees and lawn, no buildings.
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40), r: 12 + random() * 8 });
        }
        continue;
      }
      const wide = x1 - x0;
      const tall = y1 - y0;
      if (random() < 0.45) {
        buildings.push(makeBuilding(x0, y0, wide, tall, random));
      } else {
        const split = random() < 0.5;
        if (split) {
          const cut = x0 + wide * (0.42 + random() * 0.16);
          buildings.push(makeBuilding(x0, y0, cut - x0 - 12, tall, random));
          buildings.push(makeBuilding(cut + 12, y0, x1 - cut - 12, tall, random));
        } else {
          const cut = y0 + tall * (0.42 + random() * 0.16);
          buildings.push(makeBuilding(x0, y0, wide, cut - y0 - 12, random));
          buildings.push(makeBuilding(x0, cut + 12, wide, y1 - cut - 12, random));
        }
      }
    }
  }

  // Street trees along the sidewalks, kept off the road itself.
  for (let i = 0; i < 60; i += 1) {
    const vertical = random() < 0.5;
    if (vertical) {
      const road = pick(random, ROADS_V);
      trees.push({ x: road + half + 12, y: 60 + random() * (WORLD.height - 120), r: 10 + random() * 6 });
    } else {
      const road = pick(random, ROADS_H);
      trees.push({ x: 60 + random() * (WORLD.width - 200), y: road + half + 12, r: 10 + random() * 6 });
    }
  }

  const city = {
    buildings,
    trees,
    places: {
      diner: { name: "Rosa's Diner", x: 800, y: 330, color: '#e07a5f' },
      garage: { name: "Kiko's Garage", x: 2000, y: 1530, color: '#f2c94c' },
      bank: { name: 'Sunvale Bank', x: 1600, y: 730, color: '#81b29a' },
      hotel: { name: 'Grand Hotel', x: 2400, y: 330, color: '#7fb3d5' },
      docks: { name: 'Sunvale Docks', x: 2800, y: 1930, color: '#3d9db5' },
      safehouse: { name: 'Safehouse', x: 400, y: 1930, color: '#a78bfa' },
      hospital: { name: 'Sunvale General', x: 800, y: 1130, color: '#f4f1e8' },
      pier: { name: 'Marina Pier', x: 2960, y: 1200, color: '#e6d49a' },
    },
    start: { x: 800, y: 470 },
  };
  return city;
}

function makeBuilding(x, y, w, h, random) {
  const color = pick(random, ROOF_COLORS);
  const roof = pick(random, WALL_COLORS);
  return {
    x, y, w, h,
    color,
    roof,
    windows: Math.max(2, Math.floor(w / 46)),
    floors: Math.max(2, Math.floor(h / 52)),
  };
}

/** True when the point is on a road (within half a road width of a street centre). */
export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const road of ROADS_V) if (Math.abs(x - road) <= half) return true;
  for (const road of ROADS_H) if (Math.abs(y - road) <= half) return true;
  return false;
}

/** The nearest point on a road centre line to (x, y), for spawning traffic and walkers. */
export function nearestRoadPoint(x, y) {
  const vx = roadCentre(ROADS_V, x);
  const hy = roadCentre(ROADS_H, y);
  if (Math.abs(x - vx) <= Math.abs(y - hy)) return { x: vx, y, horizontal: false };
  return { x, y: hy, horizontal: true };
}

/** A random point on a road, for spawning traffic cars. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, ROADS_V), y: 80 + random() * (WORLD.height - 160), horizontal: false };
  }
  return { x: 80 + random() * (WORLD.width - 240), y: pick(random, ROADS_H), horizontal: true };
}

/** A random point on a sidewalk (just off a road), for spawning pedestrians. */
export function randomSidewalkPoint(random) {
  const point = randomRoadPoint(random);
  const half = ROAD_WIDTH / 2 + 14;
  if (point.horizontal) return { x: point.x, y: point.y + (random() < 0.5 ? -half : half) };
  return { x: point.x + (random() < 0.5 ? -half : half), y: point.y };
}

/**
 * Circle-vs-city collision: buildings are solid, the bay is solid, the world edge is solid.
 * Returns the push-out for a circle at (x, y) with radius r, or null when it is free.
 */
export function collideCity(city, x, y, r) {
  if (x < r) return { x: r, y };
  if (x > WORLD.width - r) return { x: WORLD.width - r, y };
  if (y < r) return { x, y: r };
  if (y > WORLD.height - r) return { x, y: WORLD.height - r };
  if (x + r > WATER.x && x - r < WATER.x + WATER.w && y + r > WATER.y && y - r < WATER.y + WATER.h) {
    return { x: WATER.x - r, y };
  }
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      const pushLeft = (x + r) - b.x;
      const pushRight = (b.x + b.w) - (x - r);
      const pushUp = (y + r) - b.y;
      const pushDown = (b.y + b.h) - (y - r);
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) return { x: b.x - r, y };
      if (min === pushRight) return { x: b.x + b.w + r, y };
      if (min === pushUp) return { x, y: b.y - r };
      return { x, y: b.y + b.h + r };
    }
  }
  return null;
}

/** True when a circle at (x, y) with radius r overlaps any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}
