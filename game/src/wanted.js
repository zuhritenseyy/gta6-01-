// The wanted level: Sunvale's heat. Crimes add stars, quiet time sheds them, and the
// stars decide how many police hunt the player. A star is not just a number: while the
// player is wanted, every cop in the city knows roughly where they are.

import { WANTED } from './config.js';

export function createWanted() {
  return { stars: 0, quiet: 0, lastCrime: 0 };
}

/** A crime: add stars (capped at five) and reset the quiet timer. */
export function addCrime(wanted, stars, now) {
  wanted.stars = Math.min(WANTED.max, wanted.stars + stars);
  wanted.quiet = 0;
  wanted.lastCrime = now;
}

/** Clear the heat entirely: a bust, a completed escape, a new day. */
export function clearWanted(wanted) {
  wanted.stars = 0;
  wanted.quiet = 0;
}

/**
 * One step of the heat: while the player commits nothing, the quiet timer grows and the
 * stars fall one at a time. Cops in sight freeze the timer: you cannot cool off while
 * a patrol car is watching you. Returns true when a star just fell off.
 */
export function stepWanted(wanted, dt, copInSight) {
  if (wanted.stars === 0) return false;
  if (copInSight) {
    wanted.quiet = 0;
    return false;
  }
  wanted.quiet += dt;
  if (wanted.quiet >= WANTED.decaySeconds) {
    wanted.quiet = 0;
    wanted.stars -= 1;
    return true;
  }
  return false;
}

/** How many police the current heat calls for: one a star, plus one more from three up. */
export function policeWanted(stars) {
  if (stars <= 0) return 0;
  return stars + (stars >= 3 ? 1 : 0);
}

/** How fast the heat rises: the label the HUD shows under the stars. */
export function heatLabel(stars) {
  if (stars === 0) return 'Clean';
  if (stars <= 2) return 'Suspect';
  if (stars <= 3) return 'Wanted';
  if (stars <= 4) return 'Dangerous';
  return 'Most Wanted';
}
