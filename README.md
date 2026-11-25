# Tank War

A fast 2D top-down tank battler that runs in the browser and installs as an offline-capable
PWA. A ten-operation campaign with three bosses and selectable difficulty, single-match
skirmishes against bots, a large capture-the-flag arena, and shared-screen local two-player
duels.

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
| Select weapon   | `1` cannon · `2` machine gun · `3` rocket · `4` scatter · `5` railgun · `6` plasma · `7` flamer |
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

Ten hand-built operations across ten maps with persistent unlocks and best scores. The
**campaign difficulty** is chosen on the campaign screen and applies to every operation in
the run; each operation also shows the tier it was designed around.

1. **First Contact** — Downtown, elimination, 3 hostiles.
2. **Greenway Sweep** — Greenway park, elimination, 4 hostiles.
3. **Hold the Line** — Foundry, survive three waves.
4. **Seize the Square** — Village, hold the central capture zone for 20 seconds.
5. **Iron Marshal** — Ashfield ruins, destroy the boss and its escorts.
6. **Dune Patrol** — Dunes desert, elimination against 5 hostiles.
7. **Crossroads** — Crossroads junction, survive four waves.
8. **The Warden** — Compound, break the gates and destroy the boss.
9. **Operation Flagfall** — Frontier, capture the enemy flag.
10. **The Last Citadel** — Citadel, destroy the Sovereign.

Three bosses appear across the campaign: the **Iron Marshal** (operation 5), **The Warden**
(operation 8) and **The Sovereign** (operation 10). Bosses have heavy hulls, multiple
weapons, escorts, and **enrage** below half health, gaining reload, damage and speed.

The ten arenas are themed places: **city** avenues and apartment blocks, a **park** of lawns,
ponds and trees, an **industrial** foundry, a **village** of houses and fields, the
burnt-out **ruins** of Ashfield and the Citadel, plus the open **desert** dunes. Crossroads
and Compound reuse the city and industrial palettes, while Frontier is a much larger
follow-camera arena.

Winning an operation unlocks the next one. Difficulty names are **Rookie**, **Soldier**,
**Veteran** and **War Hero** (internally `easy`, `normal`, `hard`, `veteran`). Progress and
best scores are stored in `localStorage` under `tankwar.progress.v1`.

### Capture the Flag

A standalone mode on the **Frontier** arena — a 48 × 30 map (1920 × 1200 world units) with a
player-following camera, two fortified bases and a river between them.

- Drive over the enemy flag to pick it up, then carry it back to your own flag at base.
- The first flag captured wins. If the enemy carries your flag home, you lose.
- Carriers are slowed, drop the flag when destroyed, and respawn after 6 seconds.
- A dropped flag automatically returns home after 18 seconds.
- The enemy flag is hidden on the minimap until you spot it, then stays revealed.

The same rules drive campaign operation 9, so the campaign contains one flag operation.

### Skirmish

Pick any of the ten arenas, the number of hostiles (1–6), a difficulty (**Rookie**,
**Soldier**, **Veteran**, **War Hero**) and either **Last tank standing** (elimination) or
**Deathmatch** (respawns, first to the kill target).

### Local Versus

Two players, no bots, no respawns — last tank standing. Both tanks share one screen, one
keyboard and optionally two gamepads.

### Online Duel

Browser-to-browser duels over PeerJS/WebRTC, with no game server. One player creates a
room, the other joins with the room code. The host runs the authoritative simulation:
clients send their controls, the host resolves movement, hits, health and round wins, and
sends 20 Hz snapshots back. The client predicts its own movement and interpolates the
remote tank.

- 800 x 600 arena, symmetric cover, W/S drive, A/D turn, mouse aim, left-click fire.
- 100 HP, 25 damage per hit, 500 ms reload.
- Round wins persist; Play Again resets positions and health.
- PeerJS's public signalling service and public STUN servers are used. No TURN server is
  included, so restrictive or symmetric NATs may block a connection.

```bash
npm install
npm run dev
```

Open the app in two windows, choose **Online Duel** in both, create a room in one, and join
with its code in the other. HTTPS (or localhost) is required for WebRTC.

To play across restrictive networks, point `VITE_PEER_ICE_SERVERS` at your own TURN server
before starting or building. The value is a JSON array of `RTCIceServer` objects; see
`.env.example`. Without TURN, some home, office and mobile networks cannot connect.

## Weapons

| Weapon        | Ammo        | Notes                                              |
| ------------- | ----------- | -------------------------------------------------- |
| Cannon        | Unlimited   | Reliable mid-range damage.                          |
| Machine gun   | 320         | Fast, low damage per round, best at range.          |
| Rocket        | 8           | Slow, heavy, 76-unit splash; levels cover.          |
| Scatter       | 28          | Five pellets, devastating up close, short range.    |
| Railgun       | 5           | Store unlock. Hyper-velocity slug pierces two tanks. |
| Plasma        | 10          | Store unlock. Slow orb with a 105-unit splash.       |
| Flamer        | 260         | Store unlock. Automatic, short-range flame stream.   |

Crates, rocks, trees and buildings are destructible; the map border and fences are not.
Destroyed cover leaves rubble and opens new firing lanes. Rockets and destroyed tanks emit
splash damage with distance falloff and a damage floor.

## Store, coins and loadouts

Every hostile tank destroyed by a human player earns **10 coins** in Campaign and Skirmish.
Local Versus does not award coins, and store weapons/boosters are disabled there for
fairness. Coins are banked when a match ends and shown on the result screen.

The **Store** on the main menu sells:

- **Weapons** — permanently unlock the Railgun (280), Plasma (320) and Flamer (220).
- **Boosters** — permanent upgrades. Equip up to two: Ammo Belt, Reinforced Hull,
  Composite Armour, Quick Loader, Combat Stim and Reactive Shield.
- **Skins** — eight tank paint jobs, from Desert Tan (60) to Gold Commander (450).

Progress, coins, unlocks, equipped skin and boosters are stored in `localStorage` under
`tankwar.progress.v1`.

## Pickups

Health, ammo, overcharge (damage), turbo (speed), plating (armour) and shield spawn on the
maps and periodically during a match. Effects are timed; the HUD shows active buffs. Crates
and centre spawns reward map control.

## Project layout

```
src/
  engine/            Framework-free simulation (no React, no DOM)
    game.ts          Match orchestration, objectives, respawns, results, HUD snapshots
    world.ts         World/entity factories, line of sight, spawn picking, cover damage
    ai.ts            Bot target selection, weapon choice, steering
    input.ts         Keyboard/mouse/gamepad/touch sampling
    math.ts          Geometry, angles, letterboxed view transforms
    rng.ts           Seeded mulberry32 PRNG
    spatial.ts       Uniform-grid broadphase
    systems/         movement, collision, weapons, projectiles, damage, pickups, flags,
                     particles
  data/              Maps (ASCII-authoring), campaign, bosses, weapons, balance, store,
                     skins, boosters and purchase helpers
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

- Maps are authored as ASCII grids and parsed into merged terrain and obstacle rectangles,
  so editing `src/data/maps.ts` is enough to add an arena. Maps may use different sizes;
  most are 24×16, while Frontier is 48×30 with a follow camera. Cell legend:
  `#` wall, `X` crate, `O` rock, `B` building, `T` tree, `~` water, `=` road,
  `:` pavement, `,` grass, `;` dirt, with `1`/`2` players, `*` bots, `+` pickups and
  `Y`/`E` for the player/enemy flags.
- Tanks use a hull direction and an independent turret angle with separate turn rates.
- Bullets are sub-stepped against a spatial grid, which keeps fast projectiles from
  tunnelling through walls.
- Bots think on a short cadence, prefer visible targets and players, lead their shots by
  weapon speed, and choose weapons by range. In CTF they split between attackers heading
  for the enemy flag and defenders guarding their own.
- Objectives are implemented in `Game.updateMode`: elimination, survival waves, capture
  progress/contest, deathmatch kill targets and versus. Flag pickup, drops, returns and
  captures live in `systems/flags.ts`.
- Bosses are spawned from `src/data/bosses.ts`, scale with campaign difficulty and enrage
  below half health.
- Scoring: kills, pickups, flag captures, plus time and remaining-health bonuses at victory.

## PWA and offline play

`vite-plugin-pwa` generates the manifest and a Workbox service worker with `autoUpdate`.
The production build precaches the app shell, icons and fonts-free assets, so an installed
copy runs fully offline. Install from the browser's install affordance, or from the
**Install app** button on the main menu when the browser offers it.

If you change the vector icon artwork, regenerate the PNGs with `npm run icons` (the script
writes `public/icons/icon-192.png`, `icon-512.png` and a maskable variant using only Node's
`zlib`).

## Tests

`npm test` runs 147 tests across eight suites:

- `math` — circle/rect resolution, segment intersection, view fitting, follow camera, angle
  helpers.
- `spatial` — grid broadphase deduplication and rebuilds.
- `maps` — every arena's spawns are free, destructible cover has finite HP, walls do not,
  borders exist, terrain is painted, the capture square is clear, Frontier has flags and a
  follow camera, and campaign references valid maps and bosses.
- `weapons` — weapon tables, ammo, pellet spread, refill caps, piercing and store prices.
- `damage` — armour, shields, plating cap, kill credit/score/coins, splash falloff, crate,
  rock, tree and building destruction, respawn timers.
- `store` — purchases, affordability, skins, booster slots, loadouts and difficulty names.
- `ai` — target preference (visibility, players), weapon choice by range and ammo.
- `game` — versus win/loss, capture fill and contesting, deathmatch respawns and kill
  targets, survival wave timing, CTF flag capture win/loss, boss spawning and enrage, HUD
  snapshots, countdown gating, long idle simulation staying finite.

## Assets and licensing

All visuals are procedurally drawn with Canvas 2D paths and gradients; all audio is
synthesised with the Web Audio API at runtime. No third-party art, audio or font assets are
bundled. The project code is provided as-is for you to use and modify.