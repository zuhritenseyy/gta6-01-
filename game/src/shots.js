// The screenshot scenes behind ?shot=start|chase|mission. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a short game really looks like and the same seed always gives the
// same frame. The chase shows the city at its busiest: a sports car, three wanted stars,
// police behind, the minimap and a mission objective on the HUD.

import { STEP } from './config.js';
import { stepCarPhysics } from './vehicles.js';
import { createOfficer, spawnPoliceCar } from './police.js';
import { beginCurrentMission } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const CHASE_SECONDS = 4;
const MISSION_SECONDS = 4;

/** Steer a car along a horizontal road at `laneY`, heading east. */
function laneSteer(car, laneY) {
  const angleError = car.angle;
  const lateral = (laneY - car.y) * 0.02;
  return Math.max(-1, Math.min(1, -angleError * 2.5 + lateral));
}

/**
 * Set `state` to the named scene (start, chase or mission; any other name is start) and
 * return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, state) {
  const p = state.player;
  if (name === 'chase') {
    // A sports car on the long east road, three stars, two patrol cars on its tail.
    const car = state.cars.find((c) => c.type === 'sports' && !c.wrecked);
    car.x = 700;
    car.y = 1176;
    car.angle = 0;
    car.speed = 300;
    car.driver = 'player';
    car.parked = false;
    state.inCar = true;
    state.playerCar = car;
    p.x = car.x;
    p.y = car.y;
    state.wanted.stars = 3;
    state.wanted.quiet = 0;
    const escorts = [];
    for (let i = 0; i < 2; i += 1) {
      const cop = spawnPoliceCar(state.random, car.x, car.y);
      cop.x = car.x - 260 - i * 140;
      cop.y = 1176 + (i === 0 ? 48 : -48);
      cop.angle = 0;
      cop.speed = 320;
      state.cars.push(cop);
      escorts.push(cop);
    }
    state.money = 640;
    // The package run: the marker sits at the docks, far away, so the objective arrow
    // and the HUD show while the chase fills the frame.
    state.missions.index = 1;
    beginCurrentMission(state);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const steer = laneSteer(car, 1176);
      stepCarPhysics(state.city, car, { throttle: 1, steer, brake: false }, STEP);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      state.elapsed += STEP;
    }
    // The patrol cars get no chase step during the drive (only the player car is
    // stepped), so put them back on its tail for the frame, same offsets as above.
    escorts.forEach((cop, i) => {
      cop.x = car.x - 260 - i * 140;
      cop.y = 1176 + (i === 0 ? 48 : -48);
      cop.angle = 0;
      cop.speed = 320;
    });
    return { screen: SCREEN_PLAY, best: state.money };
  }

  if (name === 'mission') {
    // On foot outside Rosa's Diner, first mission live, an officer watching.
    state.missions.index = 0;
    beginCurrentMission(state);
    p.x = 800;
    p.y = 520;
    p.angle = -Math.PI / 2;
    state.money = 150;
    state.wanted.stars = 1;
    state.officers.push(createOfficer(960, 470));
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      state.elapsed += STEP;
    }
    return { screen: SCREEN_PLAY, best: state.money };
  }

  // The title scene: the city alive behind the menu — traffic rolling, people walking.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    state.elapsed += STEP;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
