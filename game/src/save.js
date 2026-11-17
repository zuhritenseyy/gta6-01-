// Saving: the whole campaign fits in one localStorage row — money, which mission the
// player is on, where they stand and how healthy they are. A save never holds the heat:
// the police always let a returning player start clean.

import { SAVE_KEY } from './config.js';

/** The shape of a save: plain numbers and strings, nothing the game cannot rebuild. */
export function makeSave(state) {
  return {
    version: 1,
    money: Math.floor(state.money),
    missionIndex: state.missions.index,
    health: Math.round(state.player.health),
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    ammo: state.player.ammo,
    savedAt: Date.now(),
  };
}

/** Write the save; a private window or a full store just means it does not stick. */
export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave(state)));
    return true;
  } catch {
    return false;
  }
}

/** Read the save back, or null when there is none or it is not ours. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/** True when a save is waiting on the title screen. */
export function hasSave() {
  return loadGame() !== null;
}

/** Wipe the save (new game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe.
  }
}
