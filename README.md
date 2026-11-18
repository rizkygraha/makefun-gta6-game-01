# NEON TIDE

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/reward.svg)](https://make.fun/bounty/gta6-01)

A rain-soaked neon harbor city at night, built for [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01). Mara Voss, getaway driver, is back in Tidewater after three years away. Six jobs. One city run by Commissioner Hale and the gang called the Ebb. Drive it, fight for it, take it back.

## The city

Tidewater has six districts: Neon Row, Dockside, Old Cannery, The Spire, Marina, and the Causeway. Traffic drives the grid, pedestrians walk the sidewalks, and the police answer with named units (PURSUIT, RAMMING, ROADBLOCK) plus a helicopter at three stars. Rain falls, neon hums, and the harbor never sleeps.

## Play

- **6 story jobs** with payouts from $1,200 to $8,000, stages, objectives, and dialogue from fixer Ilya Kane, hacker Pip, and rival wheelman Dario Flint.
- **On foot and driving**: steal any parked car with F, drive, handbrake-drift with Space.
- **Combat**: fists, pistol, SMG, carbine. Enemies close in and shoot back.
- **Activities**: street races, 16 Tide Tapes to collect, a safehouse that saves, a respray that clears heat, a hospital that heals.
- **Systems**: wanted stars 0–5, REP progression, cash, radio with three synth stations, localStorage saves with CONTINUE.
- **HUD**: cash, REP, clock, wanted stars, radio, objective with distance, dialogue, circular minimap, and a full city map (M).

## Controls

WASD move / drive · Mouse aim, click shoot · F enter / steal car · E interact · Q radio · R reload · 1–4 weapons · M map · V camera · Shift sprint · Space handbrake.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: three.js r160 is vendored under `game/vendor/`.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node cli/makefun.mjs check --repo .
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`.

## Screenshots

Four real renders of the game's own code: `1-chase.jpg` (night rain chase, cover), `2-start.jpg` (title screen), `3-combat.jpg` (on-foot shootout next to a stolen car), `4-map.jpg` (city map). Captured with Playwright at 1024×640 from `?shot=<name>&seed=N`.

## License

MIT. See LICENSE.
