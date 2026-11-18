# NEON TIDE

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Mara Voss, a
getaway driver, is back in Tidewater — a rain-soaked neon harbour city at
night — and The Ebb owns the docks. Six story jobs, a wanted level with
named police units and a helicopter, traffic and pedestrians, combat, radio,
saves and a full city map.

## Run it

There is nothing to install. Serve the `game/` folder with any static
server and open `index.html` in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

The game runs offline: three.js is vendored under `game/vendor/`, the
music is synthesised with WebAudio, and there are no network requests.

## Play

| Key | Action |
| --- | ------ |
| WASD | Walk / drive |
| Mouse | Aim · Click to shoot |
| Shift | Sprint |
| Space | Handbrake drift |
| F | Enter / steal a vehicle |
| E | Interact · next stage |
| Q | Previous radio station |
| R | Reload · 1–4 weapons |
| M | City map / pause |
| V | 3D chase / classic camera |

## The game

- **The city.** Tidewater: six districts (Neon Row, Dockside, The Spire,
  Marina, The Causeway, Old Cannery), a harbour with a pier, neon signs,
  rain, and a day clock.
- **The story.** Six jobs with payouts from $1,200 to $8,000, each with
  stages, an objective marker and dialogue: Low Water, Cold Cargo, Rising
  Tide, Blue Lights, Harbor Lights, Last Tide.
- **The law.** A wanted level of 0–5 stars. Named police units
  (TIDE-11, SURGE-07, RIP-23…) chase with states — PURSUIT, RAMMING,
  ROADBLOCK — and a helicopter joins at three stars. A respray clears
  the heat for $200.
- **The loop.** Steal cars, take jobs, fight the Flint crew and The Ebb,
  collect 16 Tide Tapes, buy properties, raise your REP, save and continue.
- **The radio.** Three synth stations (Tide FM 91.7, Harbour 88.3,
  Static 104.1), all generated in the browser.

## Tech

- three.js r160, vendored as `game/vendor/three.module.min.js` (MIT).
- ES modules, no build step, no network. Fixed 1/60 s timestep, seeded
  city generation (`?seed=N`), staged screenshot scenes
  (`?shot=chase|start|combat|map&seed=N`) that play the real rules
  forward and set `window.__shotReady`.

## License

MIT. See [LICENSE](LICENSE).
