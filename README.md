# NEON TIDE

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01). Rain-soaked neon harbor city at night — Tidewater. Mara Voss, getaway driver, is back after three years away, and the Ebb owns the streets.

## The game

- **A complete open world**: the city of Tidewater — Neon Row, Dockside, Old Cannery, The Spire, Marina, and the Causeway bridge over the harbor.
- **On foot and by car**: walk, sprint, steal any car with F, drive with arcade handling and a handbrake drift.
- **Traffic and pedestrians** who drive the grid and run when the city gets loud.
- **Wanted level 0–5**: named police units (Unit 7 — Kestrel, Unit 12 — Brine…) that pursue, ram, and set roadblocks, plus a helicopter with a searchlight at 3 stars.
- **Six story jobs** with payouts from $1,200 to $8,000, stages, objectives and dialogue from fixer Ilya Kane and hacker Pip.
- **Combat**: fists, pistol, SMG and carbine, with reloads, muzzle flash and tracers, against the Ebb and boss Dario Flint.
- **HUD with a circular minimap**, a full city map screen (M), a radio with three synth stations (Q), and saves in localStorage.
- **Activities**: street races, 16 Tide Tapes to collect, a safehouse, a respray garage that clears heat, and a hospital.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No install, no network: three.js r160 is vendored under `game/vendor/`, everything else is the game's own code under `game/src/`.

## Controls

WASD move / drive · Mouse aim · Click shoot · Shift sprint · Space handbrake · F enter / steal car · E interact · Q radio · R reload · 1–4 weapons · M map · V camera · Esc pause

## Build

`main.ts` at the repository root copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node ../gta6-01-kit/cli/makefun.mjs check --kit ../gta6-01-kit --repo .
```

## License

MIT. See [LICENSE](LICENSE).
