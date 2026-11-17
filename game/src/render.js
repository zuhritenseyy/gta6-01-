// Drawing only: the world state in, pixels out. A camera follows the player across the
// 3200x2400 city and the 1280x720 window scales to the browser. Flat shapes and canvas
// text, in Sunvale's sun-soaked palette: sand, green parks, the blue bay, pastel roofs.

import { FIELD, FONT, PALETTE, ROAD_WIDTH, WORLD } from './config.js';
import { BEACH, PARK, ROADS_H, ROADS_V, WATER } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

/** How far the camera looks ahead of a moving player, in world units. */
const LOOKAHEAD = 60;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  /** Where the camera sits this frame, in world units: the player, eased toward. */
  function updateCamera(player, dt) {
    const tx = clamp(player.x + (player.vx || 0) * LOOKAHEAD * 0.02, FIELD.width / 2, WORLD.width - FIELD.width / 2);
    const ty = clamp(player.y + (player.vy || 0) * LOOKAHEAD * 0.02, FIELD.height / 2, WORLD.height - FIELD.height / 2);
    const ease = Math.min(1, 6 * dt);
    camera.x += (tx - camera.x) * ease;
    camera.y += (ty - camera.y) * ease;
  }

  function drawGround(city) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // The bay and its beach, along the east edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(BEACH.x, BEACH.y, BEACH.w, BEACH.h);
    context.fillStyle = PALETTE.water;
    context.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
    context.fillStyle = PALETTE.waterDeep;
    for (let y = 40; y < WORLD.height; y += 160) {
      context.fillRect(WATER.x + 20, y, 100, 6);
    }
    // The park: lawn and a pond.
    context.fillStyle = PALETTE.park;
    context.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.arc(PARK.x + PARK.w / 2, PARK.y + PARK.h / 2, 42, 0, Math.PI * 2);
    context.fill();
  }

  function drawRoads() {
    const half = ROAD_WIDTH / 2;
    context.fillStyle = PALETTE.road;
    for (const road of ROADS_V) context.fillRect(road - half, 0, ROAD_WIDTH, WORLD.height);
    for (const road of ROADS_H) context.fillRect(0, road - half, WORLD.width, ROAD_WIDTH);
    // Lane dashes down the middle of every street.
    context.fillStyle = PALETTE.lane;
    for (const road of ROADS_V) {
      for (let y = 30; y < WORLD.height; y += 64) context.fillRect(road - 2, y, 4, 30);
    }
    for (const road of ROADS_H) {
      for (let x = 30; x < WORLD.width; x += 64) context.fillRect(x, road - 2, 30, 4);
    }
    // Sidewalk edges.
    context.strokeStyle = PALETTE.sidewalk;
    context.lineWidth = 4;
    for (const road of ROADS_V) {
      context.beginPath();
      context.moveTo(road - half - 2, 0);
      context.lineTo(road - half - 2, WORLD.height);
      context.moveTo(road + half + 2, 0);
      context.lineTo(road + half + 2, WORLD.height);
      context.stroke();
    }
    for (const road of ROADS_H) {
      context.beginPath();
      context.moveTo(0, road - half - 2);
      context.lineTo(WORLD.width, road - half - 2);
      context.moveTo(0, road + half + 2);
      context.lineTo(WORLD.width, road + half + 2);
      context.stroke();
    }
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      // A soft shadow, then the roof, then a grid of windows.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = b.windows;
      const rows = b.floors;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 12 + (c * (b.w - 24)) / cols, b.y + 12 + (r * (b.h - 24)) / rows, 10, 12);
        }
      }
    }
    for (const tree of city.trees) {
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.treeLight;
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const spec = car.spec;
    const halfL = spec.length / 2;
    const halfW = spec.width / 2;
    if (car.wrecked) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(-halfL, -halfW, spec.length, spec.width);
    }
    context.fillStyle = spec.color;
    context.fillRect(-halfL, -halfW, spec.length, spec.width);
    // Windows, roof and headlights, so a car reads as a car from above.
    context.fillStyle = '#cfe8ef';
    context.fillRect(-halfL * 0.45, -halfW + 5, halfL * 0.7, spec.width - 10);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-halfL * 0.15, -halfW, 6, spec.width);
    context.fillStyle = '#fff6c9';
    context.fillRect(halfL - 4, -halfW + 4, 3, 6);
    context.fillRect(halfL - 4, halfW - 10, 3, 6);
    if (car.brakeLight) {
      context.fillStyle = '#ff2e2e';
      context.fillRect(-halfL - 1, -halfW + 4, 3, 6);
      context.fillRect(-halfL - 1, halfW - 10, 3, 6);
    }
    if (car.type === 'police') {
      context.fillStyle = PALETTE.copLight;
      context.fillRect(-halfL * 0.3, -halfW, halfL * 0.6, spec.width);
      context.fillStyle = '#ff2e2e';
      context.fillRect(-2, -halfW - 2, 8, 5);
      context.fillStyle = '#2e6bff';
      context.fillRect(-2, halfW - 3, 8, 5);
    }
    if (car.type === 'taxi') {
      context.fillStyle = '#20242e';
      context.fillRect(-halfL * 0.2, -halfW + 2, halfL * 0.4, 5);
      context.fillRect(-halfL * 0.2, halfW - 7, halfL * 0.4, 5);
    }
    context.restore();
    if (car.wrecked) {
      context.fillStyle = 'rgba(120,120,120,0.5)';
      context.beginPath();
      context.arc(car.x - halfL * 0.5, car.y - halfW * 0.5, 10, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPerson(x, y, angle, color, down) {
    context.save();
    context.translate(x, y);
    if (down > 0) {
      context.rotate(Math.PI / 2);
      context.fillStyle = color;
      context.fillRect(-12, -7, 24, 14);
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(4, 0, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.inCar) return;
    // A soft shadow, then Rey: teal jacket, dark hair, facing the aim.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(p.x + 3, p.y + 4, 13, 12, 0, 0, Math.PI * 2);
    context.fill();
    drawPerson(p.x, p.y, p.angle, PALETTE.player, 0);
    // The pistol, when armed, points where the mouse is.
    if (p.ammo > 0) {
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = '#20242e';
      context.fillRect(10, -2, 12, 4);
      context.restore();
    }
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) {
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 18, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawMarker(state, city) {
    const target = state.marker;
    if (!target) return;
    const pulse = 1 + Math.sin(state.elapsed * 4) * 0.12;
    context.save();
    context.translate(target.x, target.y);
    context.scale(pulse, pulse);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 30, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -44);
    context.lineTo(10, -26);
    context.lineTo(-10, -26);
    context.closePath();
    context.fill();
    context.restore();
    // An edge arrow when the marker is off screen, pointing the way.
    const left = camera.x - FIELD.width / 2;
    const top = camera.y - FIELD.height / 2;
    if (target.x < left || target.x > left + FIELD.width || target.y < top || target.y > top + FIELD.height) {
      const cx = clamp(target.x, left + 40, left + FIELD.width - 40);
      const cy = clamp(target.y, top + 40, top + FIELD.height - 40);
      const ang = Math.atan2(target.y - cy, target.x - cx);
      context.save();
      context.translate(cx, cy);
      context.rotate(ang);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-8, -10);
      context.lineTo(-8, 10);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  /** Paint one frame of the world, then hand the HUD the same state to finish. */
  function drawWorld(state, city, dt) {
    updateCamera(state.player, dt);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // The camera shows a 1280x720 window of the city: clip to it.
    context.save();
    context.beginPath();
    context.rect(camera.x - FIELD.width / 2, camera.y - FIELD.height / 2, FIELD.width, FIELD.height);
    context.clip();
    context.translate(-camera.x + FIELD.width / 2, -camera.y + FIELD.height / 2);
    drawGround(city);
    drawRoads();
    drawBuildings(city);
    for (const car of state.cars) drawCar(car);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    for (const officer of state.officers) {
      drawPerson(officer.x, officer.y, officer.angle, PALETTE.cop, 0);
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(officer.x, officer.y - 4, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of state.bullets) {
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    drawPlayer(state);
    drawMarker(state, city);
    context.restore();
    return { camera, view, text };
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld, camera, view, text };
}
