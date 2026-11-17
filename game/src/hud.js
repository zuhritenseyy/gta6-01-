// The HUD: everything the player reads while playing — health, cash, wanted stars, the
// minimap, the mission objective, the speedometer — and the panels for the title, pause,
// busted, game over and the story's end. The HUD draws in the same 1280x720 field space
// the renderer sets up, on top of the world.

import { FIELD, FONT, PALETTE, WANTED, WORLD } from './config.js';
import { BEACH, PARK, ROADS_H, ROADS_V, WATER } from './city.js';
import { heatLabel } from './wanted.js';

const MINIMAP = { x: FIELD.width - 264, y: 16, w: 248, h: 186 };
const STAR_SIZE = 26;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createHud() {
  const fonts = new Map();
  let context = null;
  let view = null;

  function setContext(ctx, v) {
    context = ctx;
    view = v;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function bar(x, y, w, h, frac, color, back) {
    context.fillStyle = back || 'rgba(0,0,0,0.5)';
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(frac, 0, 1)), h - 4);
  }

  /** The top-left cluster: health, cash, ammo. */
  function drawStatus(state) {
    const p = state.player;
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(14, 14, 250, 84);
    text('REY SOLANO', 26, 40, 18, PALETTE.text, 'left');
    bar(26, 48, 150, 14, p.health / 100, p.health > 30 ? PALETTE.green : PALETTE.red);
    text(`${Math.ceil(p.health)}`, 184, 61, 16, PALETTE.text, 'left');
    text(`$${Math.floor(state.money)}`, 26, 88, 22, PALETTE.gold, 'left');
    text(`Ammo ${p.ammo}`, 150, 88, 16, PALETTE.muted, 'left');
  }

  /** The wanted stars, top-right under the minimap, with the heat label. */
  function drawWanted(state) {
    const stars = state.wanted.stars;
    const y = MINIMAP.y + MINIMAP.h + 14;
    text(heatLabel(stars), MINIMAP.x, y + 20, 18, stars > 0 ? PALETTE.red : PALETTE.muted, 'left');
    for (let i = 0; i < 5; i += 1) {
      const x = MINIMAP.x + 110 + i * (STAR_SIZE + 4);
      drawStar(x, y + 6, STAR_SIZE / 2, i < stars ? PALETTE.gold : 'rgba(255,255,255,0.25)');
    }
  }

  function drawStar(cx, cy, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  /** The minimap: the whole city shrunk, with the player, the police and the marker. */
  function drawMinimap(state, city) {
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.save();
    context.beginPath();
    context.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.clip();
    context.fillStyle = PALETTE.grassDark;
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = PALETTE.water;
    context.fillRect(MINIMAP.x + WATER.x * sx, MINIMAP.y, WATER.w * sx, MINIMAP.h);
    context.fillStyle = PALETTE.park;
    context.fillRect(MINIMAP.x + PARK.x * sx, MINIMAP.y + PARK.y * sy, PARK.w * sx, PARK.h * sy);
    context.strokeStyle = PALETTE.road;
    context.lineWidth = 5;
    for (const road of ROADS_V) {
      context.beginPath();
      context.moveTo(MINIMAP.x + road * sx, MINIMAP.y);
      context.lineTo(MINIMAP.x + road * sx, MINIMAP.y + MINIMAP.h);
      context.stroke();
    }
    for (const road of ROADS_H) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + road * sy);
      context.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + road * sy);
      context.stroke();
    }
    if (state.marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(MINIMAP.x + state.marker.x * sx, MINIMAP.y + state.marker.y * sy, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const officer of state.officers) {
      context.fillStyle = '#6ea8ff';
      context.beginPath();
      context.arc(MINIMAP.x + officer.x * sx, MINIMAP.y + officer.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.driver === 'police') {
        context.fillStyle = '#6ea8ff';
        context.beginPath();
        context.arc(MINIMAP.x + car.x * sx, MINIMAP.y + car.y * sy, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // The player: a white dot with a teal ring, always on top.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 7, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    text('SUNVALE', MINIMAP.x, MINIMAP.y + MINIMAP.h + 34, 13, PALETTE.muted, 'left');
  }

  /** The current objective, bottom centre, with the mission name. */
  function drawObjective(state) {
    const mission = state.mission;
    if (!mission) return;
    const step = mission.step;
    if (!step) return;
    context.fillStyle = 'rgba(0,0,0,0.5)';
    const w = 560;
    context.fillRect((FIELD.width - w) / 2, FIELD.height - 64, w, 44);
    text(mission.name, FIELD.width / 2, FIELD.height - 42, 15, PALETTE.gold, 'center');
    text(step.text, FIELD.width / 2, FIELD.height - 24, 17, PALETTE.text, 'center');
  }

  /** The speedometer, bottom right, only while driving. */
  function drawSpeed(state) {
    if (!state.inCar || !state.playerCar) return;
    const kmh = Math.round(Math.abs(state.playerCar.speed) * 0.32);
    text(`${kmh}`, FIELD.width - 30, FIELD.height - 84, 44, PALETTE.text, 'right');
    text('km/h', FIELD.width - 30, FIELD.height - 58, 15, PALETTE.muted, 'right');
    text(state.playerCar.type.toUpperCase(), FIELD.width - 30, FIELD.height - 100, 15, PALETTE.muted, 'right');
  }

  /** The story line and the hint line, above the objective. */
  function drawMessage(state) {
    if (state.missions.messageTime > 0 && state.missions.message) {
      context.fillStyle = 'rgba(0,0,0,0.55)';
      const lines = wrapText(state.missions.message, 90);
      const h = lines.length * 24 + 20;
      context.fillRect((FIELD.width - 760) / 2, 108, 760, h);
      lines.forEach((line, i) => {
        text(line, FIELD.width / 2, 108 + 30 + i * 24, 18, PALETTE.text, 'center');
      });
    }
    const hint = state.inCar
      ? 'WASD drive · E exit car · Click shoot · P pause · M mute'
      : 'WASD move · Shift run · E enter car · F punch · Click shoot · P pause · M mute';
    text(hint, FIELD.width / 2, FIELD.height - 76, 14, 'rgba(244,241,232,0.75)', 'center');
  }

  function wrapText(value, maxLen) {
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxLen) {
        lines.push(line.trim());
        line = word;
      } else line += ' ' + word;
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 74, 46, PALETTE.text, 'center');
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, y + 118 + i * 30, 20, PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center');
  }

  /** Paint the HUD over a playing frame. */
  function draw(state, city) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawStatus(state);
    drawMinimap(state, city);
    drawWanted(state);
    drawObjective(state);
    drawSpeed(state);
    drawMessage(state);
  }

  function drawTitle(state, best) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawPanel('SUNVALE', [
      'An open-world crime game: a city to explore on foot and by car,',
      'traffic and pedestrians, cars to steal, police who chase,',
      'five missions and a story — and a wanted level that follows you.',
      '',
      'WASD move · Shift run · E enter a car · F punch · Click to shoot',
      `Best so far: $${Math.floor(best)}`,
    ], best > 0 ? 'Press Space to continue — or N for a new game' : 'Press Space to start', PALETTE.gold);
  }

  function drawPaused() {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawPanel('PAUSED', ['The city waits for you.', 'Progress is saved when you finish a mission.'], 'Press P to resume', PALETTE.blue);
  }

  function drawOver(state) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawPanel('WASTED', [`Rey went down in Sunvale. Cash kept: $${Math.floor(state.money)}.`], 'Press Space to try again', PALETTE.red);
  }

  function drawBusted(state) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawPanel('BUSTED', [`The police caught Rey. Fine paid: $${WANTED.bustFine}.`, `Cash left: $${Math.floor(state.money)}.`], 'Press Space to walk free', PALETTE.blue);
  }

  function drawWin(state) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawPanel('KING OF SUNVALE', [
      'All five missions done. The bank job paid out, the heat is gone,',
      `and Rey Solano owns this city. Final cash: $${Math.floor(state.money)}.`,
    ], 'Press Space to keep cruising', PALETTE.gold);
  }

  return { setContext, draw, drawTitle, drawPaused, drawOver, drawBusted, drawWin };
}
