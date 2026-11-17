// Cars: what they are, how they drive, and the traffic that fills the streets. A car is
// a body with an angle, a speed along its nose and a type; the player's car and the traffic
// share the same physics, and police cars reuse it for the chase. No drawing here, only
// motion and the road rules.

import { CAR_TYPES, ROAD_WIDTH, TRAFFIC, TRAFFIC_SPEED } from './config.js';
import { collideCity, randomRoadPoint, ROADS_H, ROADS_V } from './city.js';

let nextId = 1;

export function createCar(type, x, y, angle) {
  const spec = CAR_TYPES[type];
  return {
    id: nextId,
    type,
    spec,
    x, y,
    angle,
    speed: 0,
    steer: 0,
    parked: false,
    driver: null,
    health: spec.health,
    wrecked: false,
    brakeLight: false,
    signal: 0,
    road: null,
    direction: 1,
    targetSpeed: TRAFFIC_SPEED,
  };
}

/** A parked car on a roadside, waiting to be stolen: type and colour by the seed. */
export function spawnParkedCar(city, random) {
  const types = ['sedan', 'taxi', 'van', 'sports', 'truck'];
  const type = types[Math.floor(random() * types.length)];
  const point = randomRoadPoint(random);
  const half = ROAD_WIDTH / 2 + 22;
  let x;
  let y;
  let angle;
  if (point.horizontal) {
    x = point.x;
    y = point.y + (random() < 0.5 ? -half : half);
    angle = random() < 0.5 ? 0 : Math.PI;
  } else {
    x = point.x + (random() < 0.5 ? -half : half);
    y = point.y;
    angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = createCar(type, x, y, angle);
  car.parked = true;
  return car;
}

/** A traffic car already rolling on a road, in a lane, going one way. */
export function spawnTrafficCar(random) {
  const types = ['sedan', 'taxi', 'van', 'sedan', 'truck'];
  const type = types[Math.floor(random() * types.length)];
  const point = randomRoadPoint(random);
  const car = createCar(type, 0, 0, 0);
  car.driver = 'traffic';
  if (point.horizontal) {
    car.direction = random() < 0.5 ? 1 : -1;
    car.angle = car.direction === 1 ? 0 : Math.PI;
    car.x = point.x;
    car.y = point.y + (car.direction === 1 ? -24 : 24);
    car.road = { horizontal: true, line: point.y };
  } else {
    car.direction = random() < 0.5 ? 1 : -1;
    car.angle = car.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
    car.x = point.x + (car.direction === 1 ? 24 : -24);
    car.y = point.y;
    car.road = { horizontal: false, line: point.x };
  }
  car.speed = TRAFFIC_SPEED * (0.8 + random() * 0.4);
  return car;
}

/**
 * One step of car physics: throttle accelerates along the nose, steering turns harder the
 * slower the car goes, drag and the road slow it, and the city pushes it out of buildings.
 * `control` is { throttle -1..1, steer -1..1, brake }.
 */
export function stepCarPhysics(city, car, control, dt) {
  const spec = car.spec;
  if (control.throttle > 0) car.speed += spec.accel * control.throttle * dt;
  else if (control.throttle < 0) car.speed += spec.accel * 0.7 * control.throttle * dt;
  if (control.brake) car.speed -= Math.sign(car.speed) * spec.brake * dt;
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 4 && control.throttle === 0) car.speed = 0;
  car.speed = Math.max(-spec.reverse, Math.min(spec.maxSpeed, car.speed));
  const turn = car.steer * spec.grip * dt * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += turn * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pushed = collideCity(city, nx, ny, spec.length / 2 - 6);
  if (pushed) {
    car.x = pushed.x;
    car.y = pushed.y;
    car.speed *= 0.45;
    car.health -= Math.abs(car.speed) * 0.02;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.brakeLight = control.brake || control.throttle < 0;
}

/** The car ahead of `car` on the same lane, within `distance`, or null. */
function carAhead(cars, car, distance) {
  let best = null;
  let bestD = distance;
  for (const other of cars) {
    if (other === car || other.parked || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < bestD && side < 40) {
      best = other;
      bestD = along;
    }
  }
  return best;
}

/**
 * One step of a traffic car: hold its lane and speed, stop for the car ahead, and at an
 * intersection sometimes turn onto the crossing street. It never leaves the road.
 */
export function stepTrafficCar(city, cars, car, random, dt) {
  if (car.wrecked) return;
  const ahead = carAhead(cars, car, 110);
  let throttle = 0.6;
  if (ahead) throttle = 0;
  const target = ahead ? 0 : car.targetSpeed;
  if (car.speed < target) car.speed += 260 * dt;
  else if (car.speed > target) car.speed -= 320 * dt;

  // At an intersection, sometimes turn: pick the crossing road and a new direction.
  const onV = ROADS_V.some((line) => Math.abs(car.x - line) < 8);
  const onH = ROADS_H.some((line) => Math.abs(car.y - line) < 8);
  if (onV && onH && random() < dt * 0.5) {
    if (car.road.horizontal) {
      const line = ROADS_V.find((v) => Math.abs(car.x - v) < 8);
      car.road = { horizontal: false, line };
      car.direction = random() < 0.5 ? 1 : -1;
      car.angle = car.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
      car.x = line + (car.direction === 1 ? 24 : -24);
    } else {
      const line = ROADS_H.find((h) => Math.abs(car.y - h) < 8);
      car.road = { horizontal: true, line };
      car.direction = random() < 0.5 ? 1 : -1;
      car.angle = car.direction === 1 ? 0 : Math.PI;
      car.y = line + (car.direction === 1 ? -24 : 24);
    }
  }

  // Stay glued to the lane: nudge back toward the lane centre.
  if (car.road.horizontal) {
    const laneY = car.road.line + (car.direction === 1 ? -24 : 24);
    car.y += (laneY - car.y) * Math.min(1, 2.2 * dt);
    car.angle += (0 - car.angle) * 0;
    const want = car.direction === 1 ? 0 : Math.PI;
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * Math.min(1, 3 * dt);
  } else {
    const laneX = car.road.line + (car.direction === 1 ? 24 : -24);
    car.x += (laneX - car.x) * Math.min(1, 2.2 * dt);
    const want = car.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * Math.min(1, 3 * dt);
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pushed = collideCity(city, nx, ny, car.spec.length / 2 - 6);
  if (pushed) {
    car.x = pushed.x;
    car.y = pushed.y;
    car.speed = 0;
    // A building means the lane ended: turn the car around on its road.
    car.direction *= -1;
    car.angle += Math.PI;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.brakeLight = throttle === 0;
}

/** A car is wrecked when its health is gone: it stops and smokes, and nobody drives it. */
export function wreckCar(car) {
  car.wrecked = true;
  car.speed = 0;
  car.driver = null;
  car.parked = false;
}

export function carCount() {
  return TRAFFIC.count;
}
