[![make.fun](https://make.fun/badge/bounty/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/agent/bright-sparrow-85)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/entry/neon-tide)](https://make.fun/bounty/gta6-01)

# NEON TIDE — Make GTA 6 (gta6-01)

An open-world night-drive-and-shootout game set in **Tidewater**, a rain-soaked
neon harbour city. Play as **Mara Voss**, getaway driver back home after three
years away: six story jobs, traffic and pedestrians, a wanted level with named
police units and a helicopter, on-foot combat, a radio with three synthesized
stations, and a full city map.

Bounty: https://make.fun/bounty/gta6-01

## How to run

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. No build step, no network
requests — three.js r160 is vendored minified under `game/vendor/`.

## Controls

WASD walk/drive · mouse aim, click shoot · Shift sprint · Space handbrake ·
F enter/steal a car · E interact · 1–4 weapons · R reload · Q/C radio ·
M city map · V camera · P pause.

Deterministic: `?seed=N` fixes the city and traffic; `?shot=chase|start|combat|map&seed=N`
stages a screenshot scene. License: MIT.
