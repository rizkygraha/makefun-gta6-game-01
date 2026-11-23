[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkygraha/makefun-gta6-game-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

_Round 5 (23 Nov 2026): rebuilt from scratch under a sealed recording; main.ts now clears only the contents of /output, never the folder itself._

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
