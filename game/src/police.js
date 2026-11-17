// The Sunvale police: patrol cars that chase the player's car and officers on foot who
// chase the player and try to bust them. A cop is a person with a badge and a gun; a
// patrol car is a car with a driver who never gives up while the heat is on. Cops shoot
// back from three stars up, and a bust costs money and the heat.

import { CAR_TYPES, PISTOL, POLICE_RAM_DAMAGE, WANTED } from './config.js';
import { createCar, stepCarPhysics } from './vehicles.js';
import { collideCity, nearestRoadPoint } from './city.js';
import { fireBullet } from './combat.js';

let nextOfficerId = 1;

/** One officer on foot: position, health, and the bust timer while they hold the player. */
export function createOfficer(x, y) {
  return {
    id: nextOfficerId,
    kind: 'officer',
    x, y,
    angle: 0,
    speed: 265,
    health: 50,
    radius: 14,
    fireDelay: 0,
    holdTime: 0,
    dead: false,
  };
}

/** A patrol car, spawned on a road at the map's edge, already rolling toward the player. */
export function spawnPoliceCar(random, playerX, playerY) {
  const edges = [
    { x: 400, y: 120 + random() * 300 },
    { x: 2800, y: 120 + random() * 300 },
    { x: 400 + random() * 2200, y: 400 },
    { x: 400 + random() * 2200, y: 2000 },
  ];
  const spot = edges[Math.floor(random() * edges.length)];
  const car = createCar('police', spot.x, spot.y, Math.atan2(playerY - spot.y, playerX - spot.x));
  car.driver = 'police';
  car.targetSpeed = 520;
  return car;
}

/** An officer spawned a short walk from the player, on the nearest road. */
export function spawnOfficer(random, playerX, playerY) {
  const angle = random() * Math.PI * 2;
  const dist = 420 + random() * 200;
  const point = nearestRoadPoint(playerX + Math.cos(angle) * dist, playerY + Math.sin(angle) * dist);
  return createOfficer(point.x, point.y);
}

/**
 * One step of a patrol car chasing the player: steer at them, ram them, and if the
 * player is on foot and close, the driver gets out and joins the foot chase. Returns
 * 'ram' when it hit the player's car this step, 'bail' when the driver got out.
 */
export function stepPoliceCar(city, car, player, playerCar, dt) {
  const tx = playerCar ? playerCar.x : player.x;
  const ty = playerCar ? playerCar.y : player.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = dist > 60 ? 1 : 0.4;
  stepCarPhysics(city, car, { throttle, steer, brake: false }, dt);

  if (playerCar && dist < 58) {
    playerCar.health -= POLICE_RAM_DAMAGE * dt * 2;
    return 'ram';
  }
  if (!playerCar && dist < 70) return 'bail';
  return null;
}

/**
 * One step of an officer chasing the player on foot: run at them, and when close enough
 * hold them for a bust. Shooting happens from three stars up. Returns 'bust' when the
 * hold finishes, or 'shot' with a bullet when the officer fired.
 */
export function stepOfficer(city, officer, player, stars, bullets, dt) {
  if (officer.dead) return null;
  const dx = player.x - officer.x;
  const dy = player.y - officer.y;
  const dist = Math.hypot(dx, dy);
  officer.angle = Math.atan2(dy, dx);
  if (dist > WANTED.bustDistance) {
    officer.holdTime = 0;
    const nx = officer.x + Math.cos(officer.angle) * officer.speed * dt;
    const ny = officer.y + Math.sin(officer.angle) * officer.speed * dt;
    const pushed = collideCity(city, nx, ny, officer.radius);
    officer.x = pushed ? pushed.x : nx;
    officer.y = pushed ? pushed.y : ny;
  } else {
    officer.holdTime += dt;
    if (officer.holdTime >= WANTED.bustHoldSeconds) return 'bust';
    return null;
  }
  // Cops open fire from three stars, at a distance, every second or so.
  officer.fireDelay -= dt;
  if (stars >= 3 && dist > 120 && dist < 460 && officer.fireDelay <= 0) {
    officer.fireDelay = 1.1;
    const aim = officer.angle + (Math.random() - 0.5) * 0.16;
    bullets.push(fireBullet(officer, aim, false));
    return 'shot';
  }
  return null;
}

/** A cop car close enough to see the player freezes the wanted cooldown. */
export function copInSight(cops, playerX, playerY) {
  for (const cop of cops) {
    if (cop.dead) continue;
    const d = Math.hypot(cop.x - playerX, cop.y - playerY);
    if (d < 520) return true;
  }
  return false;
}

export const POLICE_SPEC = CAR_TYPES.police;
export const OFFICER_BULLET_SPEED = PISTOL.bulletSpeed;
