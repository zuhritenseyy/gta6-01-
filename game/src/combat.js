// Combat: fists, the pistol, bullets and the sparks they make. Bullets fly straight and
// die on a building or at their range; a punch is a short arc in front of the player. The
// particles (muzzle flash, impact puffs, blood) are data the renderer draws, and the hits
// are numbers the world turns into damage, wanted stars and noise.

import { PISTOL } from './config.js';
import { hitsBuilding } from './city.js';

let nextBulletId = 1;
let nextParticleId = 1;

/** A bullet: who fired it, where it is going, how far it has left to fly. */
export function fireBullet(from, angle, friendly) {
  return {
    id: nextBulletId,
    x: from.x + Math.cos(angle) * 22,
    y: from.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * PISTOL.bulletSpeed,
    vy: Math.sin(angle) * PISTOL.bulletSpeed,
    left: PISTOL.range,
    friendly,
  };
}

/** A particle: a short-lived puff, flash or spark with a velocity and a colour. */
export function spawnParticle(particles, x, y, vx, vy, life, size, color) {
  particles.push({ id: nextParticleId, x, y, vx, vy, life, maxLife: life, size, color });
}

/** A muzzle flash: three bright sparks at the barrel. */
export function muzzleFlash(particles, x, y, angle) {
  for (let i = 0; i < 3; i += 1) {
    const spread = angle + (Math.random() - 0.5) * 0.5;
    spawnParticle(particles, x, y, Math.cos(spread) * 260, Math.sin(spread) * 260, 0.08, 5, '#ffe66d');
  }
}

/** An impact puff where a bullet stops: grey smoke and a spark. */
export function impactPuff(particles, x, y) {
  for (let i = 0; i < 4; i += 1) {
    const a = Math.random() * Math.PI * 2;
    spawnParticle(particles, x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.35, 4, '#9aa0ab');
  }
  spawnParticle(particles, x, y, 0, 0, 0.12, 7, '#ffd166');
}

/** A hit on a person: a red puff. */
export function bloodPuff(particles, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const a = Math.random() * Math.PI * 2;
    spawnParticle(particles, x, y, Math.cos(a) * 120, Math.sin(a) * 120, 0.3, 4, '#a41623');
  }
}

/**
 * Step every bullet: move it, stop it on a building, and test it against a list of
 * targets ({x, y, radius}). Returns the hits as {bullet, target} pairs; spent bullets
 * are removed. Friendly bullets never hit the player; enemy bullets never hit cops.
 */
export function stepBullets(city, bullets, targets, dt) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.left -= PISTOL.bulletSpeed * dt;
    let spent = b.left <= 0;
    if (!spent && hitsBuilding(city, b.x, b.y, 2)) spent = true;
    if (!spent) {
      for (const t of targets) {
        if (t.dead || t.down > 0) continue;
        const dx = t.x - b.x;
        const dy = t.y - b.y;
        if (dx * dx + dy * dy < t.radius * t.radius) {
          hits.push({ bullet: b, target: t });
          spent = true;
          break;
        }
      }
    }
    if (spent) bullets.splice(i, 1);
  }
  return hits;
}

/** Step every particle: drift, fade, and drop the dead ones. */
export function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
}

/**
 * A punch: everyone within range and inside the arc in front of (x, y) takes the damage.
 * Returns the list of targets hit, nearest first.
 */
export function punchHits(x, y, angle, targets) {
  const hit = [];
  for (const t of targets) {
    if (t.dead || t.down > 0) continue;
    const dx = t.x - x;
    const dy = t.y - y;
    const d = Math.hypot(dx, dy);
    if (d > 34 + t.radius) continue;
    let diff = Math.atan2(dy, dx) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) hit.push({ target: t, dist: d });
  }
  hit.sort((a, b) => a.dist - b.dist);
  return hit.map((h) => h.target);
}
