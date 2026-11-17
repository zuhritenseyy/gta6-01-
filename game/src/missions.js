// Missions: the story of Rey Solano, a courier in Sunvale who owes the wrong people
// money and takes jobs to pay it off. Each mission is a list of steps — go somewhere,
// pick something up, steal a car, survive the heat, grab the cash — with a marker on the
// map, a line of story text, a time limit where it matters, and a payout at the end.
// The mission runner knows nothing about drawing: it reports the current objective and
// the events the world should react to.

/**
 * A step: what to do and where. `kind` is goto (reach the marker), pickup (stand on it),
 * steal (enter the marked car), bring (drive the marked car to the marker), survive
 * (stay alive with the heat on for `seconds`), grab (stand in the vault while the
 * timer runs down), escape (reach the marker while wanted).
 */
export const MISSIONS = [
  {
    id: 'meet-rosa',
    name: 'First Day on the Job',
    reward: 100,
    intro: "Rosa's Diner needs a courier. Walk over and meet Mama Rosa — she has work, and she always pays.",
    steps: [
      { kind: 'goto', place: 'diner', text: 'Meet Mama Rosa at the diner' },
    ],
    outro: 'Rosa: "You drive? Good. A package at the docks needs legs. Take my pistol — Sunvale is not polite."',
  },
  {
    id: 'package-run',
    name: 'Package Run',
    reward: 250,
    intro: 'A sealed package waits at the docks. Collect it and deliver it to the Grand Hotel — 90 seconds, before the buyer walks.',
    steps: [
      { kind: 'pickup', place: 'docks', text: 'Pick up the package at the docks' },
      { kind: 'deliver', place: 'hotel', text: 'Deliver the package to the Grand Hotel', time: 90 },
    ],
    outro: 'Delivered. The buyer paid in cash, no questions. Rosa is pleased — and the city is watching.',
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    reward: 400,
    intro: "Kiko the mechanic wants a red sports car, no questions asked. Steal one and bring it to his garage. The owner will not be happy — and neither will the police.",
    steps: [
      { kind: 'steal', text: 'Steal a red sports car' },
      { kind: 'bring', place: 'garage', text: 'Bring the sports car to Kiko\'s Garage' },
    ],
    outro: 'Kiko: "Beautiful. She is mine now. You are good at this, Rey. Too good — be careful who notices."',
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    reward: 500,
    intro: 'The job went loud. Sunvale PD is on you — three stars and climbing. Survive 60 seconds of heat and lose them. Run, drive, hide, but do not get busted.',
    steps: [
      { kind: 'survive', seconds: 60, text: 'Survive the heat for 60 seconds' },
    ],
    outro: 'The sirens fade. You are still standing, still free — and the whole city knows your name now.',
  },
  {
    id: 'sunvale-job',
    name: 'The Sunvale Job',
    reward: 1500,
    intro: 'The big one: the Sunvale Bank vault. Get inside, hold the vault for 8 seconds while the guards come for you, then run for the safehouse with the whole city on your tail.',
    steps: [
      { kind: 'goto', place: 'bank', text: 'Reach the Sunvale Bank' },
      { kind: 'grab', place: 'bank', seconds: 8, text: 'Hold the vault — 8 seconds' },
      { kind: 'escape', place: 'safehouse', text: 'Escape to the safehouse' },
    ],
    outro: 'You did it. $1,500 and a clean getaway. Sunvale is yours now, Rey Solano — king of the streets.',
  },
];

/** The runner: which mission, which step, and how far through it the player is. */
export function createMissionRunner() {
  return {
    index: 0,
    step: 0,
    stepTime: 0,
    grabTime: 0,
    active: false,
    done: false,
    failed: false,
    message: '',
    messageTime: 0,
    /** When the next mission starts, after the finished one's outro has been read. */
    nextAt: 0,
  };
}

/** The mission the player is on, or null when the story is finished. */
export function currentMission(runner) {
  if (runner.index >= MISSIONS.length) return null;
  return MISSIONS[runner.index];
}

/** The step the player is on, or null when the mission is over. */
export function currentStep(runner) {
  const mission = currentMission(runner);
  if (!mission || runner.step >= mission.steps.length) return null;
  return mission.steps[runner.step];
}

/** Begin the current mission: reset its steps and show its intro. */
export function startMission(runner) {
  const mission = currentMission(runner);
  if (!mission) return;
  runner.step = 0;
  runner.stepTime = 0;
  runner.grabTime = 0;
  runner.active = true;
  runner.failed = false;
  say(runner, mission.intro, 6);
}

/** Show a line of story text (or an objective update) for a few seconds. */
export function say(runner, message, seconds) {
  runner.message = message;
  runner.messageTime = seconds || 4;
}

/**
 * Advance the mission clock: step timers run down, timed steps fail when they run out,
 * and the message fades. Returns 'timeout' when a timed step ran out of time.
 */
export function stepMissionClock(runner, dt) {
  if (runner.messageTime > 0) runner.messageTime -= dt;
  if (!runner.active) return null;
  runner.stepTime += dt;
  const step = currentStep(runner);
  if (step && step.time && runner.stepTime > step.time) {
    runner.active = false;
    runner.failed = true;
    return 'timeout';
  }
  return null;
}

/** Move to the next step, or finish the mission and pay out. Returns 'done' at the end. */
export function advanceStep(runner) {
  const mission = currentMission(runner);
  if (!mission) return null;
  runner.step += 1;
  runner.stepTime = 0;
  runner.grabTime = 0;
  if (runner.step >= mission.steps.length) {
    runner.active = false;
    runner.done = true;
    runner.index += 1;
    say(runner, mission.outro, 6);
    return 'done';
  }
  const step = currentStep(runner);
  if (step) say(runner, step.text, 4);
  return null;
}

/** Fail the mission (busted, wrecked, timed out): it can be retried from the start. */
export function failMission(runner, reason) {
  runner.active = false;
  runner.failed = true;
  runner.step = 0;
  runner.stepTime = 0;
  runner.grabTime = 0;
  say(runner, reason, 5);
}

/** Start the next mission after a finished one, if there is one. */
export function nextMission(runner) {
  runner.done = false;
  runner.failed = false;
  if (runner.index < MISSIONS.length) startMission(runner);
}

/** Where the current step's marker is, from the city's named places. */
export function stepTarget(runner, city) {
  const step = currentStep(runner);
  if (!step || !step.place) return null;
  return city.places[step.place] || null;
}
