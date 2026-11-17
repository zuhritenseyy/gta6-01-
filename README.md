# Sunvale — gta6-01

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/zuhritenseyy/gta6-01-/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/zuhritenseyy/gta6-01-/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): a sun-soaked city to explore on foot and by car, traffic and pedestrians, cars to steal, a wanted level with police who chase, five missions with a story, combat, a HUD with a minimap, a start screen and a save — all in static files, no network.

You are Rey Solano, a courier in Sunvale City who owes the wrong people money. Mama Rosa has work: deliveries, a hot sports car, a heat wave to survive, and finally the Sunvale Bank job.

## Play it

Serve `game/` with any static server, then open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# game/ is on http://localhost:8080
```

No build step, no network request, no library — plain ES modules and canvas.

## Controls

- **WASD / arrows** — move (on foot) or drive (in a car), **Shift** to run
- **E** — enter / exit a car (stealing one raises your wanted level)
- **Mouse click** — shoot the pistol, **F** — punch
- **P / Esc** — pause, **M** — mute, **N** — new game from the title screen

## The city

- A 3200×2400 city: gridded streets, a park, a beach and the bay, named places (Rosa's Diner, Kiko's Garage, Sunvale Bank, Grand Hotel, the Docks, the Safehouse)
- Traffic that follows the roads, pedestrians who stroll the sidewalks and flee gunfire
- Wanted level 0–5 stars: stealing, hitting pedestrians, shooting and killing police raise it; quiet time cools it off. Police cars ram, officers on foot try to bust you
- Five missions: First Day on the Job, Package Run, Hot Wheels, Heat Wave, The Sunvale Job
- Save: progress (money, mission, position, health) is kept in localStorage when a mission pays out

## Files

- `game/src/city.js` — the map: streets, blocks, buildings, park, beach, named places
- `game/src/vehicles.js` — car physics and traffic AI
- `game/src/people.js` — pedestrian AI
- `game/src/combat.js` — bullets, punches, particles
- `game/src/wanted.js` — the heat: stars, decay, police numbers
- `game/src/police.js` — patrol cars, officers, busts
- `game/src/missions.js` — the story and the five missions
- `game/src/audio.js` — procedural WebAudio effects (no audio files)
- `game/src/world.js` — the simulation: one fixed step ties every system together
- `game/src/render.js` — the camera and the city drawing
- `game/src/hud.js` — health, cash, wanted stars, minimap, objectives, menus
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|chase|mission`)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
