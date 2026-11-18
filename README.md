[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON TIDE — Make GTA 6

A rain-soaked open-world crime game set in **Tidewater**, a neon harbour city
at night. You are **Mara Voss**, a getaway driver back after three years away,
working six jobs for fixer Ilya Kane while Commissioner Hale and the Ebb gang
close in.

Entry for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## The game

- **Open world on foot and by car** — a 440×440 grid city: Neon Row, Dockside,
  Old Cannery, The Spire, Marina and The Causeway.
- **Traffic and pedestrians** — civilian cars loop the blocks, pedestrians
  stroll the sidewalks and stop for you.
- **Wanted level and police** — 0–5 stars, named units with live states
  (PURSUIT / RAMMING / ROADBLOCK) and a helicopter at three stars.
- **Six story jobs** — LOW WATER, COLD CARGO, RISING TIDE, BLUE LIGHTS,
  HARBOR LIGHTS and LAST TIDE, each in stages with dialogue and a beacon.
- **Combat** — fists, pistol, SMG and carbine, with enemy health bars, muzzle
  flashes and tracers; run foes over in a car.
- **HUD with minimap** — cash, REP, clock, wanted stars, radio, objective
  with distance, health and ammo, plus a full city map screen.
- **Activities and progression** — 16 Tide Tapes to collect, a safehouse,
  respray to clear heat, street races, REP levels and localStorage saves
  (CONTINUE shows chapter, cash and day).
- **Radio** — three WebAudio synth stations, no audio files.

## Controls

WASD walk / drive · mouse aim (click to shoot) · Shift sprint · Space handbrake ·
F enter / steal car · E interact · Q radio · R reload · 1–4 weapons · M city map ·
V camera · P pause.

## Run it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — no network requests, everything is vendored or generated in code
(three.js r160 minified under `game/vendor/`).

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with `vendor/makefun-game.ts`.

## Screenshots

Four real renders of the game's own code (`?shot=chase|start|combat|map`):

1. `1-chase.jpg` — night rain chase (cover)
2. `2-start.jpg` — title screen
3. `3-combat.jpg` — on-foot shootout in Neon Row
4. `4-map.jpg` — city map

## License

MIT. Original city, characters, story and art — nothing from any commercial game.
