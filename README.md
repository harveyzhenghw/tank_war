# Tank War

A fast 2D top-down tank battler that runs in the browser and installs as an offline-capable
PWA. Five-arena campaign, single-match skirmishes against bots, and shared-screen local
two-player duels.

Everything you see and hear is generated at runtime: tanks, maps, effects and the weapon
audio are drawn or synthesised in code. There are no sprite sheets, texture files or audio
samples.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build and offline preview:

```bash
npm run build      # type-check + bundle + generate the service worker
npm run preview
```

Other scripts:

| Script              | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm test`          | Run the Vitest suite once                            |
| `npm run test:watch`| Watch mode                                           |
| `npm run typecheck` | `tsc --noEmit`                                       |
| `npm run icons`     | Regenerate the PWA PNG icons from the vector artwork |

Requires Node 18+ (developed on Node 22).

## Controls

### Player 1 — keyboard + mouse

| Action          | Input                                        |
| --------------- | -------------------------------------------- |
| Drive           | `W` `A` `S` `D` — hull turns toward the input |
| Aim             | Mouse (turret is independent of the hull)    |
| Manual turret   | `Q` / `E`                                    |
| Fire            | Left mouse or `Space`                        |
| Overdrive       | Right mouse or `Left Shift`                  |
| Select weapon   | `1` cannon · `2` machine gun · `3` rocket · `4` scatter |
| Cycle weapon    | `Tab`                                        |
| Pause           | `Esc` or `P`                                 |

Bindings for drive / fire / overdrive / cycle can be remapped in **Settings**. Mouse aim is
always on.

### Player 2 — local versus

| Action        | Input                       |
| ------------- | --------------------------- |
| Drive         | Arrow keys                  |
| Turret        | `,` / `.`                   |
| Fire          | `/` or `Numpad 0`           |
| Overdrive     | `Right Shift`               |
| Cycle weapon  | `M`                         |

### Gamepad

Any connected pad is picked up automatically. Pad 1 drives Player 1 (or Player 2 in a duel
if only a second pad is present); pad 2 drives Player 2. Left stick or D-pad moves, right
stick aims, `A`/right trigger fires, `B` overdrives, bumpers cycle weapons, `X`/`Y` jump
straight to cannon/machine gun.

### Touch

On coarse-pointer devices a dual-stick overlay appears (configurable in Settings):

- **Left stick** — drive the hull.
- **Right stick** — aim the turret; holding it fires.
- **SWAP** — cycle weapon.
- **BOOST** — overdrive burst.

## Game modes

### Campaign

Five hand-built operations with persistent unlocks and best scores:

1. **First Contact** — Foundry, elimination, 3 easy hostiles.
2. **Sandstorm** — Dunes, elimination, 4 regular hostiles.
3. **Hold the Line** — Crossroads, survive three waves.
4. **Seize the Yard** — Compound, hold the central capture zone for 20 seconds.
5. **Last Stand** — Ashfield, elimination against 6 veteran hostiles.

Winning an operation unlocks the next one. Progress and best scores are stored in
`localStorage` under `tankwar.progress.v1`.

### Skirmish

Pick any of the five arenas, the number of hostiles (1–6), a difficulty (Recruit, Regular,
Hardened, Veteran) and either **Last tank standing** (elimination) or **Deathmatch**
(respawns, first to the kill target).

### Local Versus

Two players, no bots, no respawns — last tank standing. Both tanks share one screen, one
keyboard and optionally two gamepads.

## Weapons

| Weapon        | Ammo        | Notes                                              |
| ------------- | ----------- | -------------------------------------------------- |
| Cannon        | Unlimited   | Reliable mid-range damage.                          |
| Machine gun   | 320         | Fast, low damage per round, best at range.          |
| Rocket        | 8           | Slow, heavy, 76-unit splash; damages crates.        |
| Scatter       | 28          | Five pellets, devastating up close, short range.    |

Crates are destructible; walls and rocks are not. Rockets and destroyed tanks emit splash
damage with distance falloff and a damage floor.

## Pickups

Health, ammo, overcharge (damage), turbo (speed), plating (armour) and shield spawn on the
maps and periodically during a match. Effects are timed; the HUD shows active buffs. Crates
and centre spawns reward map control.

## Project layout

```
src/
  engine/            Framework-free simulation (no React, no DOM)
    game.ts          Match orchestration, objectives, respawns, results, HUD snapshots
    world.ts         World/entity factories, line of sight, spawn picking, crates
    ai.ts            Bot target selection, weapon choice, steering
    input.ts         Keyboard/mouse/gamepad/touch sampling
    math.ts          Geometry, angles, letterboxed view transforms
    rng.ts           Seeded mulberry32 PRNG
    spatial.ts       Uniform-grid broadphase
    systems/         movement, collision, weapons, projectiles, damage, pickups, particles
  data/              Maps (ASCII-authoring), campaign, weapons, balance profiles
  render/            Canvas 2D renderer and colour palettes
  audio/             WebAudio synthesis (SFX + ambient music loop)
  react/             Menus, HUD, touch overlay, game screen
  App.tsx            Screen routing, progress/settings persistence, PWA install prompt
tests/               Vitest suites for geometry, maps, weapons, damage, AI and matches
scripts/gen-icons.mjs Pure-Node PNG icon generator
```

The simulation is plain TypeScript. React only renders menus and HUD; the canvas loop lives
outside React renders and is driven by `requestAnimationFrame`, so gameplay never re-renders
the component tree.

### Design notes

- Maps are authored as 24×16 ASCII grids and parsed into merged obstacle rectangles, so
  editing `src/data/maps.ts` is enough to add an arena.
- Tanks use a hull direction and an independent turret angle with separate turn rates.
- Bullets are sub-stepped against a spatial grid, which keeps fast projectiles from
  tunnelling through walls.
- Bots think on a short cadence, prefer visible targets and players, lead their shots by
  weapon speed, and choose weapons by range.
- Objectives are implemented in `Game.updateMode`: elimination, survival waves, capture
  progress/contest, deathmatch kill targets and versus.
- Scoring: kills, pickups, plus time and remaining-health bonuses at victory.

## PWA and offline play

`vite-plugin-pwa` generates the manifest and a Workbox service worker with `autoUpdate`.
The production build precaches the app shell, icons and fonts-free assets, so an installed
copy runs fully offline. Install from the browser's install affordance, or from the
**Install app** button on the main menu when the browser offers it.

If you change the vector icon artwork, regenerate the PNGs with `npm run icons` (the script
writes `public/icons/icon-192.png`, `icon-512.png` and a maskable variant using only Node's
`zlib`).

## Tests

`npm test` runs 85 tests across seven suites:

- `math` — circle/rect resolution, segment intersection, view fitting, angle helpers.
- `spatial` — grid broadphase deduplication and rebuilds.
- `maps` — every arena's spawns are free, crates are destructible, walls are not, borders
  exist, campaign references valid maps.
- `weapons` — weapon tables, ammo, pellet spread, refill caps.
- `damage` — armour, shields, plating cap, kill credit/score, splash falloff, crate
  destruction, respawn timers.
- `ai` — target preference (visibility, players), weapon choice by range and ammo.
- `game` — versus win/loss, capture fill and contesting, deathmatch respawns and kill
  targets, survival wave timing, HUD snapshots, countdown gating, long idle simulation
  staying finite.

## Assets and licensing

All visuals are procedurally drawn with Canvas 2D paths and gradients; all audio is
synthesised with the Web Audio API at runtime. No third-party art, audio or font assets are
bundled. The project code is provided as-is for you to use and modify.