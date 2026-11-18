// Sunvale: boot and the one loop. Input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what
// is there. The game moves between six screens: title, play, paused, busted, game over
// and the story's end. Progress saves itself when a mission pays out.
//
// ?seed=N fixes the city. ?shot=start|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { FIELD, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_OVER, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, applySave, beginCurrentMission, resetWorld, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { ensureAudio, playBusted, playMissionComplete, playPickup, playPunch, playShot, startSiren, stopSiren, toggleMute } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const hud = createHud();

/** The mouse, in world units: window pixels, through the view, past the camera. */
function mouseToWorld(clientX, clientY) {
  const ratio = window.devicePixelRatio || 1;
  const fx = (clientX * ratio - renderer.view.x) / renderer.view.scale;
  const fy = (clientY * ratio - renderer.view.y) / renderer.view.scale;
  return {
    x: fx + renderer.camera.x - FIELD.width / 2,
    y: fy + renderer.camera.y - FIELD.height / 2,
  };
}

function runShot(name) {
  const scene = stageShot(name, state);
  // Staged scenes get two paints and no frames to ease over, so put the camera
  // on the player now; without this it still sits near the world centre.
  renderer.snapCamera(state.player);
  hud.setContext(canvas.getContext('2d'), renderer.view);
  let painted = 0;
  function paint() {
    renderer.drawWorld(state, state.city, STEP);
    if (scene.screen === SCREEN_TITLE) hud.drawTitle(state, scene.best);
    else hud.draw(state, state.city);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let sirenOn = false;
  // One-shot presses the screens do not use (enter a car, punch) wait here for the
  // next world step, so no press is lost between the screen and the simulation.
  let pendingActions = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function syncSiren() {
    if (state.wanted.stars > 0 && !sirenOn) {
      startSiren();
      sirenOn = true;
    } else if (state.wanted.stars === 0 && sirenOn) {
      stopSiren();
      sirenOn = false;
    }
  }

  function startNewGame() {
    clearSave();
    resetWorld(state);
    screen = SCREEN_PLAY;
    announce('Sunvale. Meet Mama Rosa at the diner — follow the pink marker.');
  }

  function continueGame() {
    const save = loadGame();
    if (save) applySave(state, save);
    else resetWorld(state);
    screen = SCREEN_PLAY;
    announce('Welcome back to Sunvale.');
  }

  function respawn() {
    state.player.health = 100;
    state.player.invulnerable = 2;
    beginCurrentMission(state);
    screen = SCREEN_PLAY;
    announce('Back on the streets. The job is still open.');
  }

  function react(events) {
    if (events & EVENT_SHOT) playShot();
    if (events & EVENT_PUNCH) playPunch();
    if (events & EVENT_PICKUP) playPickup();
    if (events & EVENT_MISSION_DONE) {
      playMissionComplete();
      if (state.missions.index >= 5) screen = SCREEN_WIN;
    }
    if (events & EVENT_BUSTED) {
      playBusted();
      saveGame(state);
      screen = SCREEN_BUSTED;
    }
    if (events & EVENT_OVER) {
      saveGame(state);
      screen = SCREEN_OVER;
    }
    syncSiren();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    // The world owns enter-car and punch; the screens own confirm and pause.
    pendingActions |= actions & (ACTION_ENTER_CAR | ACTION_PUNCH);
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        ensureAudio();
        if (hasSave()) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        ensureAudio();
        respawn();
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    const mouse = input.mouse();
    const aim = mouseToWorld(mouse.x, mouse.y);
    const click = input.takeClick();
    const actions = pendingActions | input.takeActions();
    pendingActions = 0;
    const events = stepWorld(state, {
      move: input.move(),
      aim,
      click,
      actions,
    }, STEP);
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(state, state.city, STEP);
    hud.setContext(canvas.getContext('2d'), renderer.view);
    if (screen === SCREEN_TITLE) hud.drawTitle(state, state.best);
    else if (screen === SCREEN_PAUSED) {
      hud.draw(state, state.city);
      hud.drawPaused();
    } else if (screen === SCREEN_OVER) hud.drawOver(state);
    else if (screen === SCREEN_BUSTED) hud.drawBusted(state);
    else if (screen === SCREEN_WIN) {
      hud.draw(state, state.city);
      hud.drawWin(state);
    } else hud.draw(state, state.city);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // N starts a brand-new campaign from the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && screen === SCREEN_TITLE) {
      ensureAudio();
      startNewGame();
    }
  });

  announce('Sunvale. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
