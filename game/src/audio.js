// Sound: every effect is made with the Web Audio API, no audio files and no network.
// A short tone for a pickup, a crack for a gunshot, a two-tone siren while the police
// are after the player, and a little jingle when a mission pays out. Mute with M.

let context = null;
let muted = false;
let sirenTimer = null;
let sirenHigh = false;

/** Create the audio context on the first user gesture (browsers demand one). */
export function ensureAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
  } catch {
    context = null;
  }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopSiren();
  return muted;
}

function tone(freq, dur, type, volume, slideTo) {
  if (!context || muted) return;
  try {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    gain.gain.setValueAtTime(volume || 0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + dur);
  } catch {
    // Audio is decoration: a failure here never stops the game.
  }
}

/** A coin-like pickup blip. */
export function playPickup() {
  tone(880, 0.09, 'sine', 0.1);
  setTimeout(() => tone(1318, 0.12, 'sine', 0.1), 70);
}

/** A gunshot: a short burst of noise-shaped square wave, falling fast. */
export function playShot() {
  tone(220, 0.12, 'square', 0.14, 55);
}

/** A punch landing: a low thud. */
export function playPunch() {
  tone(140, 0.1, 'triangle', 0.16, 70);
}

/** A crash: a low rumble. */
export function playCrash() {
  tone(90, 0.25, 'sawtooth', 0.14, 40);
}

/** Cash in: the mission-paid jingle, three rising notes. */
export function playMissionComplete() {
  tone(523, 0.12, 'sine', 0.12);
  setTimeout(() => tone(659, 0.12, 'sine', 0.12), 110);
  setTimeout(() => tone(784, 0.2, 'sine', 0.12), 220);
}

/** A busted sting: two falling notes. */
export function playBusted() {
  tone(392, 0.2, 'triangle', 0.14, 311);
  setTimeout(() => tone(311, 0.35, 'triangle', 0.14, 196), 180);
}

/** A car door and engine start: a click and a rev. */
export function playEnterCar() {
  tone(180, 0.08, 'square', 0.08);
  setTimeout(() => tone(120, 0.3, 'sawtooth', 0.07, 240), 90);
}

/**
 * The police siren: while wanted, alternate a high and a low tone every half second.
 * Start it when the heat rises, stop it when it clears.
 */
export function startSiren() {
  if (!context || sirenTimer) return;
  sirenTimer = setInterval(() => {
    sirenHigh = !sirenHigh;
    tone(sirenHigh ? 880 : 660, 0.45, 'sine', 0.035);
  }, 480);
}

export function stopSiren() {
  if (sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
}
