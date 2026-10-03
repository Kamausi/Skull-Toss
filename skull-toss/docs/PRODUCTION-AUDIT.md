# Skull Toss: production audit and asset inventory (Phase 0)

This is the Phase 0 audit from the owner's master brief, *AAA 3D graphics overhaul and app-store production pass*
(2026-09-28). It records what the game is made of now, how each part is drawn, and the order the overhaul will take.
It is a working document: each asset's status changes here as it moves through the pipeline.

**Evidence.**
- Every entry comes from reading the source (`src/js/*.js`, `src/maps/*.json`, `src/markup.html`, `src/css`,
  `src/art`) or from running the dev build headless.
- Nothing here is marked COMPLETE. No asset has yet passed the brief's full gate: visual, gameplay, performance,
  memory, compatibility and regression, including a real-device check.

**What was measured, and what wasn't.**
- The container renders in software (SwiftShader, headless Chromium), so its frame times say nothing about a phone
  (see `docs/PERF-AUDIT.md`).
- Every performance number below is a *relative* baseline for comparing before and after a change. Real-device numbers
  are listed as outstanding.

**The owner's directives since this audit was written** (all 2026-10-03):
- *"When you continue I want every asset regenerated as well, not just rendering 2D assets into 3D."* So a cut-out
  (a painting traced and extruded) and a projected painting (Morty's face today) are **not end states**: every asset
  in §2 is to be rebuilt as a model, with its own geometry and materials, before it can be COMPLETE.
- *"Use this engine to upgrade Skull Toss before we do the visual overhaul."* The engine is the owner's Wilds of
  Aether prototype. Its engine layers came over first, in v71: the r186 runtime and renderer standards, a world scene
  (its terrain foundation), its instanced scatter, its character pipeline and its authored-asset bridge
  (`docs/RENDER3D.md`, "The engine"). The asset-by-asset overhaul builds on them.
- *"Use the skull for Morty's head"*, *"Use this for his eyes"* and *"Use this for the sling shot"*: three models the
  owner supplied (a Fab free pack's human skull, a low-poly eye, a slingshot OBJ). Since v73 they are Morty's head and
  eyes and the slingshot in 3D (§13, ASSET-001 pass 4 and ASSET-007 pass 2). Their sources and provenance are in
  `src/models/source` (`MANIFEST.json`); none is marked for shipping until the owner records its licence there.

**Statuses** (the brief's scale):
`NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` · `VERIFICATION` · `OPTIMIZED` · `COMPLETE`

They describe the **3D production pass**, not the 2D game. Every asset listed already ships in 2D and works.

---

## 1. Rendering architecture discovered

| Layer | Technology | Where | Notes |
|---|---|---|---|
| Page | One self-contained HTML file built by `src/build.py`. It concatenates 111 JS parts in name order into one strict IIFE, inlines the CSS (5 files), fonts (4 families, woff2), SVG/WebP art and three MP3 stings. | `src/build.py`, `index.html` (about 3.4 MB) | No asset is fetched at run time except Firebase and the music. |
| Play field (default) | **Canvas 2D**: a painter's-order renderer over a pinhole projection (`x = W/2 + F·X/Z`, `y = HY − F·Y/Z`, metres, y up, z into the screen). | `08c_scene.js` (`draw`), `04d_visual.js`, `05_layers.js` | Painted planes are cached per screen size ("paint once, photograph every frame"). |
| Multiplane camera | A rostrum camera: springs that overshoot and settle, exposed 24 times a second. It leans with the aim, follows the throw, anticipates and jolts. | `04c_camera.js`, `04e_director.js` | This is authored 1930s camera behaviour, not a modern smoothed camera. |
| GPU effects | **WebGL** on its own canvas (`#gpuFx`): one instanced draw for 4,096 particle slots, up to 96 light pools, and a quarter-size bloom (Full quality only). | `08j_gpu.js` | Composited over the 2D canvas by CSS. |
| Film | Canvas 2D at 12 fps: grain, dust, scratches, gate weave, iris. | `09e_film.js` | |
| **3D renderer (off by default)** | **Three.js r186** since v71 (the Wilds of Aether engine's revision; 0.180.0 before), bundled (`src/vendor/three.js`, built by `tools/vendor`), `WebGLRenderer` with the Wilds standards (sRGB, ACES filmic, PCF shadows), `MeshToonMaterial` with a three-step ramp, plus an ink hull (back faces pushed out in screen space by `onBeforeCompile`). | `08r_r3d.js` to `08rh_r3d_bosses.js` | Switched on with `?r3d` or `SkullToss.debug.r3d(true)`. |
| How 3D reaches the screen | **In place.** Each model is posed in camera space at its 2D drawing's spot and rendered into an offscreen WebGL canvas inside a scissor box. The box is then copied into the 2D frame under the 2D canvas's transform and clip. Hero pieces (Morty, the ring, the launcher) render at once; the rest are batched into one render per flush point. | `08r_r3d.js` (`r3dDraw`, `r3dRender`, `r3dFlush`) | This keeps the painter's order, physics and tests unchanged. It also means there is **no shared depth buffer, no cast shadows and no common lighting pass between pieces**, and each flush costs a render and a copy (see §9). |
| 3D runtime complexity manager | Screen-space-error LOD with a dead zone and a 250 ms crossfade, frustum culling, an EMA and PID governor, dynamic resolution (0.7–1), and a particle budget. | `08rf_r3d_budget.js`, `MC.PF` | Gives up in order: distant, particles, animation, resolution. Morty, the ring and the bosses are never given up. |
| Math core | Vectors, matrices, quaternions, planes, collision (SAT/GJK), curves, SDFs, noise, flow fields, a stable-fluids grid, Fresnel, Beer–Lambert, and the performance equations. | `01d_mathcore.js`, `01e_mathcore_engine.js` | Documented in `docs/MATH-TOOLKIT.md`. |
| UI | **DOM + CSS**: 114 buttons, 22 screens and sheets, design tokens, four font families. Some sheets draw canvas previews (the Vault's Morty, the Cart's shopkeeper, the mascot). | `src/markup.html`, `src/css/*`, `09*_*.js` | The HUD is DOM over the canvases. |
| Simulation | A fixed step of 1/240 s with an accumulator (`10_boot.js`). Flight is exact and event-driven, solving for contact times rather than overlapping steps (`07_game.js`). Gameplay dice are seeded (`mulberry32` via `seedRun`); visual randomness uses `Math.random`, so it can't touch replays. | `07_game.js`, `10_boot.js`, `07j_replay.js` | Replays are deterministic, with a version bump on every gameplay change. |
| Audio | WebAudio, synthesised plus a recorded score; a musical clock drives environment animation. | `02*_*.js` | |
| Shells | Capacitor (iOS/Android) and Electron. | `platforms/`, `03e_platform.js` | WebGPU in the packaged WebViews is **unverified** (§9). |

**Renderer decision (brief §345).**
- **Keep `WebGLRenderer` for now** (Three.js r186 since v71, the Wilds of Aether engine's revision).
- The look depends on `onBeforeCompile` (the ink hull) and `MeshToonMaterial` ramps. Under `WebGPURenderer` both need
  TSL rewrites.
- WebGPU availability in the Capacitor WebViews is not established.
- Re-evaluate once the scene work below is done. A WebGPU path needs a TSL port of the ink and ramp materials, plus
  runtime capability detection with the WebGL2 path as the fallback.

---

## 2. Asset inventory

**How to read it.**
- One row per production asset. Families of cosmetic items are one row, with a count; each member gets a sub-ID
  (for example `COS-SKULL-07`) when it goes through the pipeline.
- **Now**: how it's drawn in the shipping game.
- **3D today**: what the off-by-default 3D renderer does with it.
  - *cut-out*: the 2D painting traced along its outline and extruded, so it has real depth but reads as a cardboard
    flat.
  - *model*: real geometry.
  - *2D*: not converted.
  - Per the owner (above), *cut-out* is a stage, not an end state: every cut-out row is to become a *model*.
- **G** and **V**: gameplay and visual importance, 1 (low) to 3 (critical).

**Per-asset requirements** (materials, lighting, animation, VFX, optimisation) are set per family in §2.10.
- Each asset's individual record is written when it enters production, in that asset's pass report (brief §397).
- Writing 170 full records now, before the art direction and the renderer foundation exist, would be guesswork.

### 2.1 Primary subjects

| ID | Asset | Source | Now | 3D today | G | V | Strategy | Status |
|---|---|---|---|---|---|---|---|---|
| ASSET-001 | Morty (the skull): cranium, sockets, pupils, brows, nose, teeth, jaw | `08a_skull.js`, `src/art/skull/*.svg` | Rubber rig (vector) | model: the owner's skull (cranium, hinged mandible, 28 teeth) with the owner's eyeballs, lids, glyph eyes and brows (v73); the v72 built face for looks not carried yet | 3 | 3 | Sculpted skull with modelled sockets, nose and jaw on a hinge; eyes and brows as geometry with morph targets; bone material; volume-preserving squash | IN PROGRESS (pass 4, §13) |
| ASSET-002 | Morty's expressions and speech | `08a_skull.js`, `08g_voice.js` | Rig poses, speech bubbles | via the painted face | 2 | 3 | Morph targets and brow and pupil rigs; speech stays a 2D bubble | NOT STARTED |
| ASSET-003 | Squash, stretch and smear in flight | `08c_scene.js` (`drawSmear`), `08k_feel.js` | Vector deformation | 2D smear over the model | 2 | 3 | Render-only non-uniform scale (`s`, `1/√s`) and a bounded smear mesh; never fed back into collision | NOT STARTED |
| ASSET-004 | Morty's shadow | `drawSkullShadow` | Painted ellipse | 2D | 2 | 2 | Contact shadow (a projected blob or a short ray) | NOT STARTED |
| ASSET-005 | Morty's body sections (the collected bones) and frame launcher | `07p_body.js`, `08i_body.js` | Vector | cut-out | 1 | 2 | Modelled bones, sharing the bone material | NOT STARTED |
| ASSET-006 | Morty's wings (Rush, cosmetic wings) | `drawRushWings`, `08i_body.js` | Vector | live cut-out | 1 | 2 | Modelled feathers or membranes with secondary motion | NOT STARTED |
| ASSET-007 | The slingshot (launcher, bands, sling pouch) | `08c_scene.js`, `src/art/launcher/launcher.svg` | SVG + vector bands | model: the owner's slingshot (frame, cord wraps, leather pouch) with the game's stretched bands (v73) | 3 | 3 | Keep the model; add wood grain, iron fittings and a band stretch shader; contact with the ground | IMPLEMENTED (pass 2, §13) |
| ASSET-008 | Aim guide: reticle, dots, chevrons, effort gauge, ghost shot, aim arc | `08c_scene.js`, `08k_feel.js` | Vector | 2D | 3 | 2 | Stays screen-space (readability beats 3D here), redrawn in the art direction's ink language | NOT STARTED |
| ASSET-009 | The ring (all cosmetic styles; fire, wings, light, reflection) | `08b_ring.js`, `src/art/rings/hoop.webp` | Vector/bitmap | model (torus per style) | 3 | 3 | Keep; material per style; the opening must match collision exactly (§6) | IMPLEMENTED |
| ASSET-010 | Ring post, pole and anchors (post, gear, branch, arch, signpost, batten, rail) | `drawPole`, `drawPost`, `07n_environment.js` | Vector | model (post) and live cut-out (anchors) | 2 | 2 | Modelled anchors per map | IN PROGRESS |
| ASSET-011 | Decoy rings (Adventure+) | `07s_plus.js`, `07z_rings.js` | Vector | 2D | 2 | 2 | Ring model, variant material | NOT STARTED |
| ASSET-012 | Bank rings and seals | `07y_banks.js` | Vector | 2D | 3 | 2 | Modelled boards with a surface material per bank kind | NOT STARTED |
| ASSET-013 | Depth lanes (stakes, haze) | `07z_lanes.js` | Vector | live cut-out | 2 | 1 | Modelled stakes; haze from the fog system | IN PROGRESS |
| ASSET-014 | Ring track and shadow | `drawTrackAndShadow` | Vector | 2D | 2 | 1 | Ground decal and a contact shadow | NOT STARTED |

### 2.2 Bosses (all 16 modelled in v69; not yet complete)

Every boss below is **model**: toon-shaded geometry with an ink hull, posed each frame from the same state as the 2D
drawing (hurt, tell, phase, dying). The models were checked at gameplay distance (idle, hurt, dead) with no render
failures. They have **not** been reviewed at hero distance, in motion, or on a device, and the boss deaths' gags, shards
and wordmark are still 2D.

| ID | Boss (map, tier) | Source | Status |
|---|---|---|---|
| ASSET-020 | The Crow King (1, mini) | `07d_boss.js`, `08rh_r3d_bosses.js` | VERIFICATION |
| ASSET-021 | The Pumpkin King (1, end) | `07d_boss.js` | VERIFICATION |
| ASSET-022 | Bat Baron (2, mini) | `07f_bosses.js` | VERIFICATION |
| ASSET-023 | The Count (2, end) | | VERIFICATION |
| ASSET-024 | The Owl (3, mini) | | VERIFICATION |
| ASSET-025 | Marrowroot (3, end) | | VERIFICATION |
| ASSET-026 | The Jester (4, mini) | | VERIFICATION |
| ASSET-027 | The Ringmaster (4, end) | | VERIFICATION |
| ASSET-028 | The Gator (5, mini) | | VERIFICATION |
| ASSET-029 | Madame (5, end) | | VERIFICATION |
| ASSET-030 | The Scarecrow (6, mini) | | VERIFICATION |
| ASSET-031 | The Undertaker (6, end) | | VERIFICATION |
| ASSET-032 | The Cuckoo (7, mini) | | VERIFICATION |
| ASSET-033 | The Clock King (7, end) | | VERIFICATION |
| ASSET-034 | The Projectionist (8, mini) | | VERIFICATION |
| ASSET-035 | The Reel Reaper (8, end) | | VERIFICATION |
| ASSET-036 | Boss shots: seed, clod, bat, bone, mud, pin, gear, film frame | `07d_boss.js` (`drawSeeds`), `08rg_r3d_bosskit.js` | VERIFICATION |
| ASSET-037 | Boss death FX: 16 archetypes, shards, gags, wordmark, hit-stop flashes | `07r_bossdeath.js` | NOT STARTED (2D) |
| ASSET-038 | Boss arena light (the scenery dims, a spot finds the ring) | `07n_environment.js` (`drawBossLight`) | NOT STARTED |
| ASSET-039 | Boss captions (CAW!, PTOO!, …) | `07d_boss.js`, `07f_bosses.js` | 2D by design (comic lettering) |

### 2.3 Gameplay objects

| ID | Asset | Source | 3D today | G | V | Status |
|---|---|---|---|---|---|---|
| ASSET-040…048 | Targets: standard, swinging, shielded, decoy, runaway, popup, split, golden, secret (+ the bullseye) | `07e_directors.js` | live cut-out | 3 | 2 | IN PROGRESS |
| ASSET-050…057 | Obstacles: bumper, bar, spikes, cannon, fan, magnet, crusher, barrier | `07m_obstacles.js` | live cut-out (with their eyes) | 3 | 2 | IN PROGRESS |
| ASSET-058 | Moving gates (per-map look) | `07wa_gates.js` | live cut-out | 3 | 2 | IN PROGRESS |
| ASSET-059 | The phantom coach | `07wb_coach.js` | live cut-out | 2 | 3 | IN PROGRESS |
| ASSET-060 | The secret-path fork | `07wa_gates.js` (`drawSecretFork`) | 2D | 2 | 2 | NOT STARTED |
| ASSET-061…064 | Hazards: balloon, bat, bone, pendulum | `07e_directors.js` (`drawHazards`) | live cut-out | 3 | 2 | IN PROGRESS |
| ASSET-065…067 | Underwater: currents, water jets, air pockets | `07x_water.js` | 2D | 3 | 2 | NOT STARTED |
| ASSET-068 | Encounter actors (lantern, bell, crank…) and obstacle eyes | `07w_encounter.js` | live cut-out | 2 | 2 | IN PROGRESS |
| ASSET-070…088 | Power-ups (19): rush, deadeye, blast, ghost, magnet, second, cursed, lucky, ricochet, heavy, time, combo, chaos, vine, dive, clones, rewind, homing, flip: pickup props, icons, auras, their in-play effects | `07c_power.js`, `07v_newpowers.js` | pickup: live cut-out; effects 2D | 3 | 2 | IN PROGRESS |
| ASSET-089 | Can Alley cans | `07o_bonus.js` | live cut-out | 2 | 2 | IN PROGRESS |
| ASSET-090…097 | Attractions (8): Target Gallery, Can Alley, Long Shot, Curtain Call, Perfect Pitch, Gale Force, Sudden Death, Swing: booths, boards, props | `07u_attractions.js` | live cut-out | 3 | 3 | IN PROGRESS |
| ASSET-098 | The portal ring | `07t_portal.js` | live cut-out | 3 | 3 | IN PROGRESS |
| ASSET-099 | The rift (travel between maps) | `07t_portal.js` (`drawRift`) | 2D | 2 | 3 | NOT STARTED |
| ASSET-100 | Black Ring fragments | `08n_wildlife.js` (`drawFragment`), `09c_sheets.js` | 2D | 2 | 2 | NOT STARTED |
| ASSET-101 | The continue ghost | `07g_continue.js` | 2D | 2 | 2 | NOT STARTED |

### 2.4 Environments (eight maps)

Each map has a look (sky, horizon, moon, stars, skyline, silhouette, haze), a travel set, an ecosystem and a music
clock. The list below is by subsystem; each map's pass covers every subsystem on that map.

| ID | Asset | Source | 3D today | G | V | Status |
|---|---|---|---|---|---|---|
| ASSET-110 | Skies and skylines (8 looks) | `05b_scene_sky.js`, `06g_travel.js` (`drawSkyGrade`) | 2D matte painting | 1 | 3 | NOT STARTED |
| ASSET-111 | Moon and stars (the moon's phase and sky progress with travel) | `src/art/moon/moon.webp`, `05b_scene_sky.js` | 2D | 1 | 2 | NOT STARTED |
| ASSET-112 | Ground and land (hills, dips, slices) | `05c_scene_ground.js`, `06h_land.js` | 2D | 2 | 3 | NOT STARTED |
| ASSET-113 | The road (curving, continuous) | `06h_land.js` (`drawLandPath`) | 2D | 2 | 3 | NOT STARTED |
| ASSET-114 | Travel scenery: 84 kinds across 8 maps (65 SVG sources plus vector kinds), in backdrop, mid and near rows | `06g_travel.js`, `05d_scene_sets.js`, `06d_props.js`, `06f_props_sets.js`, `src/art/travel/*.svg` | set-piece cut-outs (a piece is 3D only while its depth shows) | 1 | 3 | IN PROGRESS |
| ASSET-115 | Near-frame props (foreground framing) | `05c_scene_ground.js` (`drawNearKind`), `05_layers.js` | 2D | 1 | 2 | NOT STARTED |
| ASSET-116 | Moonshine Cemetery (the graveyard: stones, stone faces, props) | `06c_graveyard.js` | set-piece cut-outs | 1 | 3 | IN PROGRESS |
| ASSET-117 | Weather: rain, fog, leaves, lightning | `06e_weather.js` | 2D | 1 (wind: 3) | 2 | NOT STARTED |
| ASSET-118 | Water surface: reflections, ripples, sheen | `08l_water.js` | 2D (reflects 2D pieces) | 1 | 3 | NOT STARTED |
| ASSET-119 | The aquatic environment (the Drowned Theatre and the marsh): sea floor, water column, caustics, under-surface, far layer, big fish | `08m_aquatic.js` | 2D | 2 | 3 | NOT STARTED |
| ASSET-120 | Heat haze (the Bone Desert) | `08n_wildlife.js` (`drawHeatHaze`) | 2D | 1 | 2 | NOT STARTED |
| ASSET-121 | Travel haze, tone and decals | `06g_travel.js` | 2D | 1 | 2 | NOT STARTED |
| ASSET-122 | Arena frame and boss arena | `05c_scene_ground.js`, `07n_environment.js` | 2D | 1 | 2 | NOT STARTED |

Scenery families inside ASSET-114, by map (from `src/maps/*.json`):
- **Vegetation (27):** corn, tree-autumn, bush, tree-bare, willow, tree, pine, fern, gnarled-root, mushroom-ring,
  seaweed, anemone, coral (brain, branch, fan), cattails, reeds, lily-pads, swamp-cypress, cypress-knees, saguaro,
  tumbleweed, glow-fungus, crystal-cluster, stalagmites, void-bloom, void-thorn.
- **Props (42):** pumpkins, cart, fence, haybale, scarecrow, crowpost, crypt, urn, angel, gas-lamp, lantern,
  iron-fence, gilded-gate, owl-tree, hollow-log, skullpile, bonetree, opera-box, column-ruin, poster-wall,
  stage-light, theatre-seats, shells, debris-flat, dock-post, stilt-shack, rowboat, mesa, ribcage, skull-post,
  boot-hill, wagon-wreck, mine-cart, mine-lamp, gear-stack, pendulum-frame, bell, chain-pillar, film-reel,
  director-chair, rope-post, spotlight.
- **Backdrop landmarks (23):** including pumpkin-giant, gilded-mausoleum, obelisk and weeping-angel.

### 2.5 Cast and wildlife (32 kinds)

The cast per map comes from the map's `ecosystem` field; wildlife behaviour is in `08n_wildlife.js`. Every kind is
**live cut-out** today.

| ID | Kinds | Source | Status |
|---|---|---|---|
| ASSET-130…135 | Walkers: zombie, witch, skeleton, ghost, werewolf, the gravedigger (dig cycle) | `06b_world_draw.js`, `06c_graveyard.js` | IN PROGRESS |
| ASSET-136 | The cat (moves with the map) | `06c_graveyard.js` (`drawCat`) | IN PROGRESS |
| ASSET-137…146 | Sky and land wildlife: crow, bat, owl, deer, fox, spirit, vulture, scorpion, tumbleweed, dragonfly | `06b_world_draw.js`, `08n_wildlife.js` | IN PROGRESS |
| ASSET-147…156 | Water life: fish (and the big fish), crab, jelly, octopus, shrimp, eel, turtle, frog, gator, strider | `08m_aquatic.js` | IN PROGRESS |
| ASSET-157…161 | Caves and abyss: clockbug, fungi, firefly, voidling, fragment motes | `08n_wildlife.js` | IN PROGRESS |

### 2.6 VFX

| ID | Effect | Source | Status |
|---|---|---|---|
| ASSET-170 | Particles, comic bursts, contact stars | `08e_fx.js`, `04d_visual.js`, `04e_director.js` | 2D (by design for now) |
| ASSET-171 | Trails: 38 cosmetic styles | `08e_fx.js` | 2D |
| ASSET-172 | Impacts: 21 cosmetic styles | `08h_looks.js`, `08e_fx.js` | 2D |
| ASSET-173 | GPU particles, light pools, bloom | `08j_gpu.js` | WebGL, separate canvas |
| ASSET-174 | Film treatment: grain, dust, scratches, gate weave, iris, spotlight | `09e_film.js` | 2D, 12 fps |
| ASSET-175 | Ring fire, power glow, auras (32 cosmetic auras) | `08c_scene.js`, `08f_wear.js` | 2D |
| ASSET-176 | Portal motes, rift, rewind, ghost shot, homing lock, clones, vine | `07t_portal.js`, `07v_newpowers.js`, `08k_feel.js` | 2D |
| ASSET-177 | Cracks, bone hand, the cartoon's mischief (the hand), Adventure+ print and glitch | `07n_environment.js`, `09l_mischief.js`, `07s_plus.js` | 2D |
| ASSET-178 | Camera jolts, hit-stop, flashes | `04c_camera.js`, `07r_bossdeath.js` | system |

### 2.7 Cosmetics (21 slots, 470 items; `01b_catalog.js`, drawn in `08d`, `08f`, `08h`, `08i`)

| ID | Slot (count) | Status |
|---|---|---|
| COS-SKULL | Skull skins (43): material swaps on ASSET-001 | IN PROGRESS (v73: on the skull, each skin's colour, socket colour and pattern; the glow-behind, own-eyes and own-jaw skins keep the built face) |
| COS-EYES / COS-TEETH / COS-PAINT | Eyes (24), teeth (18), face paint (32) | NOT STARTED |
| COS-HAT / COS-HAIR / COS-BEARD / COS-GLASSES / COS-MASK | Hats (54), hair (12), beards (9), glasses (12), masks (8) | hats: live cut-out; the rest NOT STARTED |
| COS-WINGS | Wings (9) | live cut-out |
| COS-RING / COS-RINGWINGS | Ring styles (29), ring wings (9) | ring styles: model; ring wings NOT STARTED |
| COS-POLE / COS-LAUNCHER / COS-BAND | Poles (22), launchers (7), bands (11) | cut-out in the Vault preview; NOT STARTED |
| COS-TRAIL / COS-IMPACT / COS-AURA / COS-AIM | Trails (38), impacts (21), auras (32), aim guides (18) | VFX (see §2.6) |
| COS-REEL / COS-TITLE | Film reels (10), titles (52: text) | UI and film |

### 2.8 UI, HUD and screens (DOM + CSS unless noted)

| ID | Asset | Source |
|---|---|---|
| UI-001 | HUD: score, multiplier, lives, progress bar (Adventure only), pause button, power-up card and timer gauge | `09b_ui.js`, `02_controls_hud.css` |
| UI-002 | Toasts, achievement popups, speech bubbles, captions | `09b_ui.js`, `08g_voice.js` |
| UI-003 | Reel cards: leader, main titles, intermission, the map title card (held until a tap), cue marks | `09i_reel.js` (canvas) |
| UI-004 | Opening: logo splash, the title in the dark found by two spotlights, pivoting curtains | `09q_intro.js`, `src/art/logo/logo.webp` |
| UI-005 | Title screen, the mascot, the sleeper | `#title`, `09b_ui.js` (canvas mascot) |
| UI-006 | Pause | `#pause` |
| UI-007 | Results / game over | `#over` |
| UI-008…021 | Sheets: play (modes), customise (the Vault) + buy bar, achievements, challenges, Codex, Souls, mastery (the Shot Book), season, settings, info, the Curio Cart + cart bar, leaderboard, profile | `09c`–`09p` |
| UI-022 | Vault preview (Morty spins), Cart (Mort the ghoul, coffin pick), item icons and art (drawn procedurally) | `09d_shop.js`, `09g_store.js` (canvas) |
| UI-023 | The Diegetic Arcade | `09o_arcade.js` |
| UI-024 | Typography and tokens: Bangers, Bebas Neue, Luckiest Guy, Nunito Sans | `src/fonts`, `01_tokens.css` |
| UI-025 | Visual debug overlay (dev only) | `09h_visuals.js` |

UI statuses are all NOT STARTED for this pass. The brief's specific UI regression tests (score and multiplier
non-overlap, notification readability, the results layout, the title card) join the spec when UI work starts; see
§12 for the title card, which today does not wait for a tap.

### 2.9 Systems (shared dependencies, owned by no single asset)

| ID | System | Source | Status |
|---|---|---|---|
| SYS-001 | 3D renderer foundation: one scene, one depth buffer, shared lights and shadows (see change control CC-001, §7) | `08r_r3d.js` | IN PROGRESS (step 1 done: one depth buffer per frame) |
| SYS-002 | Camera: rostrum camera, shot director, encounter states, road-turn camera | `04c_camera.js`, `04e_director.js` | 2D camera drives the 3D camera; unchanged |
| SYS-003 | Lighting: key, fill and rim per map; ring light; boss light; GPU light pools | `07n_environment.js`, `08j_gpu.js`, `08r_r3d.js` | IN PROGRESS (v70: key, fill and rim from each map's palette) |
| SYS-004 | Material library (families in §3) | `08r_r3d.js` (`r3dToon`), `08rg_r3d_bosskit.js` | toon ramp + ink only |
| SYS-005 | Runtime complexity manager and quality tiers | `08rf_r3d_budget.js`, `10_boot.js` | IMPLEMENTED |
| SYS-006 | Painted-plane cache (the 2D backdrops) | `05_layers.js` | shipping |
| SYS-007 | Fixed-step simulation, event-driven collision, replays | `07_game.js`, `10_boot.js`, `07j_replay.js` | shipping; must not change |
| SYS-008 | Musical clock (drives environment animation) | `02f_music_clock.js` | shipping |

### 2.10 Family requirements (the specification each row inherits)

| Family | Geometry | Materials | Lighting | Animation | VFX | Optimisation |
|---|---|---|---|---|---|---|
| Hero (Morty, ring, launcher) | Hand-built silhouette first; bevels; no microgeometry under 2 px at gameplay distance | Bone, ink, wood, iron; toon ramp per material | Key + rim; contact shadow | Rubber hose: volume-preserving squash, overshoot springs | Impact, trail, aura hooks | Never culled or degraded (RCM-protected) |
| Bosses | Modelled from the 2D drawings' proportions; faces as geometry | Per boss (feather, gourd, cloth, bark, brass…) | Arena spot + key; boss rim | Posed from game state each frame; hover and wing phase from one clock | Death archetype, shards, gag | RCM-protected; one draw group per boss |
| Gameplay objects | The silhouette and the collision proxy agree (Hausdorff within tolerance) | Readable: high value contrast against the map | Must read in every map's light | Tells stay as strong as the 2D | Hit and break effects | Instanced where repeated |
| Scenery | Kit-built, controlled asymmetry (the Asset Bible) | Per map palette; wood, stone, iron, foliage, water | Map key light, fog, height fog | Wind bend by height, beat-synced cast | Leaves, dust, motes | LOD by screen-space error, instancing, culling |
| Cast and wildlife | Low-poly rigged or morph-cycled | Toon ramp, per-kind palette | As scenery | Walk and fly cycles on the musical clock | — | Cut on twos; LOD; hidden when too small |
| VFX | Sprites, meshes and GPU particles | Emissive, additive | Light pools | Anticipation, event, dissipation | — | Strict particle caps (360 CPU, 4,096 GPU, 480 3D motes) |
| UI | — | — | — | Press, hover, disabled and selected states | — | DOM, never in the 3D resolution scale |

---

## 3. Asset dependency map

```
SYS-007 simulation (authoritative, unchanged) ──────────────┐
   │ positions, phases, tells, hits                          │
   ▼                                                         ▼
SYS-002 camera (projection x = W/2 + F·X/Z) ──► SYS-001 3D scene ◄── SYS-003 lighting ◄── map look (src/maps)
                                                   │    ▲                     ▲
                        SYS-004 material library ──┘    │                     │
                                                        │           SYS-008 musical clock
   ┌──────────────┬──────────────┬──────────────┬───────┴──────┬──────────────┐
ASSET-001 Morty  ASSET-009 ring  ASSET-020…036  ASSET-040…101   ASSET-110…122  ASSET-130…161
 ├ 002 faces      ├ 010 anchors   bosses+shots   gameplay objs   environment    cast, wildlife
 ├ 003 squash     ├ 011 decoys    └ 037 deaths   └ 098 portal    └ 118/119 water
 ├ 004 shadow     └ 012 banks                       └ 099 rift        (reflects everything)
 └ COS-* skins, hats, eyes…
                                    ASSET-170…178 VFX (drawn over or into the scene)
                                    UI-* (DOM, independent of the 3D resolution)
```

**Key dependencies.**
- Everything in 3D depends on SYS-001; today each piece is composited separately.
- Water reflections (ASSET-118) depend on every visible asset, so they come last in the environment pass.
- Cosmetics depend on ASSET-001's final geometry and UVs, so skins wait for Morty.
- The portal and the rift (ASSET-098, ASSET-099) depend on the camera handoff and on the next map's scene being
  available.

---

## 4. Current visual-quality assessment

**The shipping 2D game** is authored and coherent:
- one hand, a rubber-hose line, painted multiplane backdrops and a film print;
- it's consistent across eight maps, sixteen bosses and 470 cosmetics.

The brief's placeholder test, *"would a player recognise this as a placeholder?"*, is mostly passed in 2D. Where 2D
falls short of the brief:
- There is no real depth or lighting: shadows and highlights are painted, and nothing is lit by the scene.
- Depth comes from parallax only.

**The 3D path** (behind `?r3d`) is uneven:
- **Real models:** Morty's head, the ring, the slingshot and post, and now the 16 bosses and their shots.
  - Morty's face is still his 2D face painted onto a shell, which reads as a decal from an angle.
- **Cut-outs (2.5D):** everything else that is converted (scenery, props, cast, targets, obstacles, attractions,
  hats). It is traced from the painting and extruded.
  - At a glance it holds together, and the Fleischer tabletop-set idea is deliberate.
  - Up close and in motion it reads as cardboard flats. By the brief's standard those are placeholders for models.
- **Still painted:** skies, skylines, ground, the road, water, effects and every UI screen.

**Structural limits of the in-place compositing** (these, not the individual models, are the biggest obstacle to the
brief):
- There is no shared depth between pieces, so occlusion is painter's order only.
- Nothing casts a shadow on anything else.
- Each piece is lit in isolation, so light can't be consistent across the frame.
- Each flush point costs a render and a copy into the 2D canvas.

**Not yet inspected:**
- hero-distance review of any 3D asset;
- motion review (only stills so far);
- dark, bright and fog conditions per asset;
- real devices.

---

## 5. Proposed visual direction: "a 1930s studio miniature, lit and shot on film"

The brief's own rule (§216) is *AAA technical fidelity + 1930s rubber-hose authorship, not photorealism*. The
direction:

- **Form.**
  - Hand-built miniatures, the way the Fleischer studio built its tabletop sets: real geometry with bevels and
    controlled asymmetry (the Asset Bible's rules still apply).
  - Characters keep their exaggerated rubber-hose silhouettes and pie-cut eyes.
  - Silhouette is judged first, at gameplay distance.
- **Surface.**
  - A small material library (§6 of the brief, adapted), each family defined as a toon ramp plus parameters, not a PBR
    texture set:
    - **bone** (warm ivory, readable cavities);
    - **ink** (near-black, the contour);
    - **stone**, **wood** (directional grain), **iron and brass**, **cloth**, **gourd and vegetation**;
    - **water** (Fresnel, depth absorption);
    - **emissive** (lanterns, fire, the portal).
  - The ramp is where physically based shading becomes stylised: a lit value is computed, then shaped (§219 of the
    brief).
  - Metals get a narrow specular band; cloth and stone none.
  - Textures stay small and procedural or hand-painted (grain, dust, stains), in keeping with the single-file build.
- **Light.**
  - One key light per map (the moon or the map's lamp), a hemisphere fill, a rim for Morty and the bosses, and emissive
    practicals.
  - Real shadows from the key light onto the ground and from the ring onto the ground.
  - Contact shadows under everything that stands.
  - Height fog and atmospheric perspective carry depth.
  - Gameplay readability sets the limit: the ring and Morty are always the brightest, most contrasted things in frame.
- **Line.**
  - The ink hull on every model, a constant few pixels wide at any distance (the brief's §218).
  - Silhouette-only; no post-process edge filter.
- **Motion.**
  - The rostrum camera stays: it overshoots and exposes on 24.
  - Characters animate on the musical clock.
  - Squash and stretch preserve volume.
- **Film.**
  - The existing grain, gate weave and flicker stay subtle and photosensitivity-safe.
  - Bloom only on emissives. No depth of field during aiming.
- **UI.**
  - DOM, restyled as the film's own title cards and lobby cards.
  - It is never scaled by the 3D resolution.

---

## 6. Proposed production order (the brief's phases, mapped onto this codebase)

| Phase | Work | Assets |
|---|---|---|
| 0 | This audit, the baseline measurements, the equation matrix | — |
| 1 | **Renderer foundation (CC-001):** one Three.js scene rendered once a frame. The painted backdrops become textured planes at their depths (a real multiplane); the remaining 2D art is layered in until converted. Capability detection; WebGL2 as the baseline. | SYS-001, SYS-006 |
| 1b | **Engine upgrade (v71, the owner's call):** the Wilds of Aether engine's layers: r186 and its renderer standards; the world (terrain foundation drawn once a frame on the 2D camera's pixels, road ribbon, water, fog, a 1024 shadow map); the instanced scatter; the character pipeline (LOD budgets, two material classes, faceted shading, rig, face controller); the authored-asset bridge | SYS-001, SYS-002, SYS-003, ASSET-110…122 (foundation) |
| 2 | Camera and lighting foundation: the 3D camera stays locked to the 2D projection. Per-map key, fill and rim lights; shadow map; contact shadows; height fog; the material library. | SYS-002, SYS-003, SYS-004 |
| 3 | **Morty vertical slice:** sculpted skull, modelled face with morph targets, bone material, volume-preserving squash, shadow, trail and impact hooks. Every expression and a representative set of skins. | ASSET-001…006, COS-SKULL (sample) |
| 4 | Ring, launcher and aim: the ring's opening matched to collision; launcher materials; the aim guide restyled | ASSET-007…014 |
| 5 | Bosses: finish review (hero distance, motion), materials and rim light, the death archetypes in 3D | ASSET-020…039 |
| 6 | Gameplay objects: targets, obstacles, gates, hazards, power-ups, attractions, as models instead of cut-outs | ASSET-040…101 |
| 7 | One **environment vertical slice** (Crow Hollow): sky dome, ground, road, scenery kit, weather, fog | ASSET-110…122 on map 1 |
| 8 | Portal and rift as a 3D transition (the physical toss is kept) | ASSET-098, ASSET-099 |
| 9 | The other seven maps, water last (reflections depend on everything) | ASSET-110…122, ASSET-130…161 |
| 10 | VFX: particles, trails and impacts with anticipation, event and dissipation; the GPU layer inside the scene | ASSET-170…178 |
| 11 | Cosmetics (all 470, by slot) | COS-* |
| 12 | UI and menus | UI-* |
| 13 | Micro-detail pass; lighting and cinematic polish | all |
| 14 | Optimisation, device tiers, real-device pacing; flip the default; full regression; launch audit | all |

**Paused.** The owner's earlier request to put *every math-toolkit system into gameplay* changes gameplay, so it waits
until after this audit, per the brief (§19). The mechanics were designed as part of that request. Where they're visual
(the stable-fluid smoke, the boss-death field particles, the Fresnel and Beer–Lambert water, the spring camera, the
Poisson-disk placement), they fold into the phases above. Where they change play (new force fields, new volley
patterns, a Fibonacci difficulty scaffold), they need the owner's go-ahead as gameplay changes, each with a replay
version bump and a balance run.

---

## 7. Change control CC-001: one 3D scene instead of in-place compositing

This is the one major architectural change the overhaul needs (brief §23).

1. **What changes.**
   - Today each 3D piece is rendered into its own box and copied into the 2D canvas, in painter's order.
   - Proposed: the WebGL canvas becomes the stage, and one scene is rendered once a frame. It contains:
     - the models;
     - the painted backdrops as textured planes at their depths;
     - the 2D art not yet converted, as camera-facing cards at their depths.
   - Effects that stay 2D, and the film treatment, draw over it on the existing canvases. The DOM UI is unchanged.
2. **Why.**
   - Consistent lighting, cast and contact shadows, and a real depth buffer (correct intersections: the ring through a
     boss, the road under the ring) are impossible while each piece is rendered alone.
   - It also removes the per-flush render-and-copy cost, the largest cost in the 3D measurements.
3. **Files.**
   - `08r_r3d.js` (the renderer), `08c_scene.js` (the draw order becomes a scene build);
   - `05_layers.js` (plates become textures);
   - `08rd_r3d_sets.js` (cut-outs become scene nodes);
   - `10_boot.js` (frame loop order).
   - The 2D path stays intact behind the switch until the default flips.
4. **What must not change.**
   - Physics, collision, the fixed step, the projection (`x = W/2 + F·X/Z`), the aim, replays, scoring, progression,
     the portal sequence, and every spec test's gameplay assertion.
   - The 3D camera is derived from the same projection the 2D uses, so every hit and miss happens at the same pixel.
5. **Performance.**
   - One render per frame instead of several renders and copies.
   - Added: one shadow map (1024² on phones, one cascade), texture memory for the backdrop plates (already painted per
     screen size today, so similar memory), and depth-sorted transparency for the cards.
   - The runtime complexity manager keeps its role (screen-space-error LOD, resolution scaling), now over one scene.
6. **Fallback.**
   - The 2D renderer stays as the default until the full regression suite and real-device pacing pass with 3D on.
   - If WebGL2 is missing, the game stays 2D.
7. **Progress.**
   - v70: one depth buffer a frame; each map's light rig with a rim; contact shadows under the bosses.
   - v71 (the engine upgrade): the land, the road, the water and the scatter are one lit scene rendered once a frame,
     first, with the shadow map, and they write the frame's depth, so every 3D piece after them is depth-tested
     against the land. The remaining pieces still render in place on top (Morty, the ring, the bosses, the cut-outs);
     moving them into the same scene is the next step, as each is regenerated.

---

## 8. Equation and system matrix (brief §340)

*Class*: A = baseline for this renderer, B = scalable (behind quality tiers), C = platform-specific, D = research
(not planned).

| Brief § | Equation / system | Current implementation | Required | Class | Cost | Fallback | Test |
|---|---|---|---|---|---|---|---|
| 33–35 | Transform pipeline, projection | 2D pinhole `x = W/2 + F·X/Z`; the Three.js camera matched to it (`r3dPlace`) | One camera for both; documented handedness (right-handed, y up, metres) | A | none | — | spec: models land where the 2D drew them |
| 34 | TRS, quaternions, SLERP | `MC.Q`, `MC.trs` | Bosses' and Morty's orientation from quaternions | A | trivial | — | math spec |
| 36 | Critically damped camera spring, `α = 1 − e^{−λΔt}` | Rostrum springs (deliberate overshoot, 24 fps exposure) | **Keep the authored overshoot** (the brief's own §339: art direction outranks); frame-rate-independent smoothing is already guaranteed by the fixed step | A | — | — | camera spec |
| 38 | Band-limited shake | Jolts move planes against each other; no screen shake | 3D: jolt the camera by band-limited noise with an exponential envelope; never during aim | A | trivial | — | camfx log |
| 39–40 | Slingshot, ballistic | `04_state.js` mapping; exact flight in `07_game.js` | Unchanged (gameplay) | — | — | — | replay determinism |
| 41–42 | Drag, wind field, curl noise | Wind hazard plus curl-noise flow (`06i_flow.js`) for air and water visuals | Visual wind through `MC.FL`: vegetation bend, leaves, fog | A | low | static wind | visual review |
| 43–44 | Fixed step, semi-implicit Euler | 1/240 s accumulator; exact events | Unchanged | — | — | — | spec |
| 48–50 | CCD, ring crossing, moving ring | Event-driven contact times (exact, swept) | Unchanged; the 3D ring's opening must match the collision radius | A | — | — | spec: ring model and collision agree |
| 51, 319–320 | Buoyancy, drag; underwater absorption and fog | Underwater physics in `07x_water.js`; painted tint | Beer–Lambert colour by depth (`MC` has it); height fog underwater | A | low | tint | visual review, map 4 |
| 52–53 | Gerstner, ripples | Painted sheen and ripple rings | Ripple rings stay; the surface as a mesh with a few Gerstner terms on High | B | medium | painted | visual review |
| 54–55 | Navier–Stokes, smoke | `MC.FL.Grid` (stable fluids) exists, unused in play | Boss-death smoke on a coarse grid, High only | B | medium | sprite puffs | perf3d |
| 56–57 | Particle lifetimes, energy-scaled impact | Caps (360, 4,096, 480); impacts not energy-scaled | Impact size, debris, flash and camera jolt from one normalised `I` | A | low | — | visual review |
| 58–63 | Normals, Bézier, Catmull–Rom, arc length | `MC.CU` curves; boss routes on paths | Arc-length tables for the road and the rift | A | low | — | math spec |
| 64–67 | Volume-preserving squash, overshoot, smear | 2D squash on Morty and bosses | 3D: `S = diag(s, 1/√s, 1/√s)`, render-only | A | trivial | — | spec: collision radius unchanged |
| 68–70 | Projected size, SSE LOD, hysteresis | **Implemented** (`08rf_r3d_budget.js`: `E = depth·sc`, dead zone 0.2T, crossfade) | Extend to model LODs | A | — | painted | RCM spec |
| 71–73 | Quadric simplification, cluster culling, HZB | Frustum culling implemented; `MC` has the Hi-Z level choice | LODs authored per model (small scene; clustered geometry not justified) | D (clusters) | — | — | — |
| 75 | SDFs | `MC.SDF` | Portal and rift shapes; UI badges | B | low | meshes | visual review |
| 81–90 | Rendering equation, GGX, Schlick, energy conservation | Toon ramp; `MC` has Fresnel | Stylised: shaped diffuse plus a Fresnel rim; no full PBR on characters | A (stylised) | low | — | visual review |
| 95 | Beer–Lambert | `MC` | Water, glass, the portal's interior | A | low | — | — |
| 98–99 | Attenuation, spotlights | GPU light pools; 2D spots | Point and spot lights for lanterns, the boss spot, the title spotlights | A | medium | light pools | perf3d |
| 101–103 | Penumbra, VSM, AO | None (painted) | One shadow map (PCF soft) plus contact shadows; baked AO in the toon ramp | A / B | 1–2 ms | blob shadows | perf3d, visual |
| 109 | Height fog | Painted haze per zone | Scene fog by height and distance, per map | A | low | — | visual review |
| 116–117 | Vegetation wind by height | None in 3D | Vertex bend `h^γ·A·sin(ωt + k·x)` on the musical clock | A | low | none | visual review |
| 167–169 | P95/P99, variance, dynamic resolution PID | **Implemented** (`MC.PF`, the RCM governor) | Real-device calibration | A | — | — | perf3d, device |
| 170–173 | Pixel cost, overdraw, draw calls, instancing | Batching into one render per flush | One scene: instanced scenery kits | A | — | — | perf3d |
| 176 | Amdahl | **Implemented** in perf3d | — | A | — | — | perf3d |
| 178–183 | Exposure, tone mapping, colour space | sRGB output; no tone mapping | Linear lighting, ACES filmic, per-map grade (UI excluded) | A | low | — | visual review |
| 184–188 | Bloom, DoF, motion blur, grain, flicker | Bloom (GPU layer), film grain and flicker (subtle) | Bloom on emissives only; no DoF or motion blur during aim | A | low | off | visual review |
| 189–193 | Portal geometry, rift tunnel, parallel transport | 2D portal and rift; the toss is physical | 3D tunnel along a spline with parallel-transport frames | A | medium | 2D rift | spec: portal sequence unchanged |
| 195 | Moon angular size | Moon progresses with travel | Moon on the sky dome at a fixed angular size | A | none | — | visual review |
| 196–197 | Road continuity (C1/C2) | `06h_land.js` curving road (painted) | Road mesh from the same spline; shared end tangents | A | low | painted | spec: continuity |
| 198–201 | Poisson disk, blue noise, bounded variation, seeded streams | `MC.poissonDisk`; scenery zones by density; gameplay dice seeded, visuals on `Math.random` | Seeded visual stream per map (repeatable screenshots) without touching the gameplay stream | A | none | — | visual regression |
| 211–214 | PSNR, IoU silhouettes | None | Silhouette IoU between each 2D drawing and its model (boss and gameplay-object gate) | A | offline | — | new tool |
| 217–218 | Ink width constant in pixels | **Implemented** (the ink hull) | Keep | A | — | — | — |
| 251, 253 | Portal sequence, the ring non-anchor rule | Enforced by gameplay code and spec | Unchanged | — | — | — | spec |
| 260–261 | Visual and collision agreement; collision LOD ≠ visual LOD | 2D drawings match collision | Hausdorff check for each gameplay model | A | offline | — | new spec |
| 274–277 | UI scaling, non-overlap, contrast | CSS layout; the spec checks overflow | The brief's overlap and readability tests | A | — | — | spec |
| 285–287 | Capability detection, quality tiers | `R3D.ok` (WebGL); the 2D adaptive quality; the RCM | WebGL2 detection, then Low/Medium/High mapped onto the RCM channels | A | — | 2D | spec |
| 133, 140–150, 164 | Ray tracing, neural upscaling, frame generation, NeRF, splats, DirectStorage | — | **Not planned**: not available in the browser or the Capacitor WebViews, or not justified for a stylised game | C / D | — | — | — |

---

## 9. Risks

**Technical**
1. **The compositing model (CC-001).**
   - Converting more assets on the in-place path adds cost and can't give shared light or shadows.
   - The foundation has to change before most assets can reach COMPLETE.
2. **2D and 3D parity during the transition.**
   - The spec asserts gameplay through the 2D path; the 3D path must stay pixel-aligned with it (the same projection).
   - One regression this session proves the risk: an edit swallowed a line of draw calls. It was caught in review
     before commit.
3. **Single-file build size.** `index.html` is about 3.4 MB and Three.js adds 716 KB. Models are procedural code (small);
   textures must stay small (procedural or compressed) or the file grows past what a store shell loads quickly.
4. **WebGL in the shells.**
   - Capacitor's iOS WKWebView and Android WebView must be tested for WebGL2, context loss and memory.
   - WebGPU there is unverified.
5. **Photosensitivity.** Lightning, hit flashes and film flicker must stay inside the accessibility limits
   (`docs/ACCESSIBILITY.md`).

**Performance**
1. **Per-flush render and copy.**
   - In headless runs this is the dominant 3D cost: each copy reads the WebGL canvas back.
   - On phones it stays on the GPU but still synchronises two contexts. CC-001 removes it.
2. **Fill rate and overdraw.** Painted backdrop planes, fog, water and particles are full-screen layers. Phones are
   fill-bound (the v52 audit: rasterising was 70% of the frame, JavaScript under 1%).
3. **Shadow maps on mid-range phones.** One cascade, 1024², PCF. It is the first thing the governor drops before
   resolution.
4. **Live cut-outs.** Tracing re-cuts on twos cost CPU; replacing cut-outs with models removes that cost.
5. **Thermal.** Sustained 60 fps rendering on phones is unmeasured.

---

## 10. Baseline (software rendering: compare, don't read absolutely)

Measured in this container on 2026-09-28 at the current head (`src/version.json` still says v67; the 3D work is
marked v68–v69 in the code because it is off by default):
- `node tools/perf3d.mjs`: the 3D frame report per map;
- `node tools/perf.mjs`: the 2D game.

**3D frame report, before Phase 1** (`6081bde`, 240 frames a map, governor free; median / P95 / P99 frame gap in ms,
and the 3D's share of the frame's work):

| Map | median | P95 | P99 | 3D share |
|---|---|---|---|---|
| 1 Crow Hollow | 10.5 | 22.2 | 718.7 | 91% |
| 2 Gilded Graveyard | 15.4 | 31.2 | 354.7 | 43% |
| 3 Whistling Woods | 9.4 | 21.6 | 403.0 | 25% |
| 4 Drowned Theater | 12.7 | 26.9 | 575.6 | 28% |
| 5 Black Marsh | 10.1 | 21.8 | 400.3 | 19% |
| 6 Bone Desert | 492.9 | 671.8 | 950.9 | 98% |
| 7 Clockwork Caves | 416.6 | 580.3 | 793.5 | 98% |
| 8 Black Abyss | 7.8 | 23.9 | 433.8 | 20% |

**What that shows.**
- Maps 6 and 7 are as slow at `879a27e` (553 and 438 ms medians), so this is not a regression from the boss models.
  The v68 note that map 7 fell to "about 15 ms" doesn't hold in this container.
- A per-piece breakdown (new in `tools/perf3d.mjs`) puts almost all of it inside three.js's render call. Wrapping
  WebGL's upload calls showed why: only 3–4 texture uploads a frame on map 6, but one 260 × 188 canvas took 12 s to
  upload. That is the software renderer uploading a canvas texture, not the game's work. Painting and cutting all the
  live pieces together costs about 12 ms a frame.
- So the headless 3D numbers mostly measure the software renderer's canvas uploads, and they vary from run to run for
  the same map (map 6's median was 25 ms in a 120-frame run). Only a phone can say whether uploads matter there.
  Real-device baselines are outstanding (brief §389: Low 30 fps, Medium 60, High 60–120; pass mark P99 within budget
  after a 15–30 minute soak).
- The 2D game's last full audit is v52 (`docs/PERF-AUDIT.md`); it is unchanged by the 3D work, which is off by
  default.

---

## 11. The first asset

**SYS-001 (the renderer foundation, CC-001) comes first, as Phase 1**, because every asset's lighting, shadow and depth
checks depend on it.

**The first asset through the full pipeline is ASSET-001, Morty.** The brief puts the primary subject first, and his
face is the weakest point of the current 3D path: a painted decal on a shell.

His pass:
- a sculpted skull, with modelled sockets, nose, teeth and a jaw on a real hinge;
- pie-cut eyes and brows as geometry, with expressions as morph targets;
- a bone material with warm cavities and a cool rim;
- volume-preserving squash that is render-only (his collision radius is untouched);
- a contact shadow;
- checks at hero distance, gameplay distance and in flight, in each map's light.

It is reported in the §397 format.

---

## 12. Where the brief and the game disagree (decisions for the owner)

These are recorded, not changed. Each one is either an approved design the brief doesn't know about, or a brief
requirement the game doesn't meet yet.

| # | Brief | The game now | Proposal |
|---|---|---|---|
| 1 (**decided 2026-09-28: keep**) | §254: the mini-boss at a score of 25, the main boss 25 later | 80 hits a map: the mini-boss at hit 30, the ring breaks loose at 40, the end boss at 50 (approved v47 structure, `src/maps/blueprint.json`) | Keep the approved structure; the brief's numbers look like an earlier plan |
| 2 (**decided 2026-09-28: keep**) | §36: a critically damped camera spring (ζ ≈ 1) | The rostrum camera overshoots and settles on purpose and exposes 24 times a second (the 1930s look) | Keep the overshoot (the brief's §339: art direction outranks); it is already frame-rate independent through the fixed step |
| 3 (**decided 2026-09-28: done in v70**) | §387: the Adventure title card stays until the player taps | The card shows for about 2.9 s, then the countdown leader plays; a tap skips (spec: "A Story run opens on Reel One's title card…") | Change it in the UI pass so the title card holds until a tap, then the countdown plays; the spec changes with it |
| 4 | §346, §358: a multi-file project, GLB models, KTX2 textures, streamed assets | One self-contained HTML file; models are built in code; art is inlined | Keep the single file: it's what the web, the Capacitor shells and the offline play already rely on, and procedural models are small. Revisit only if models need sculpted detail that code can't carry, and then as an embedded compressed buffer, not network streaming |
| 5 | §370: "the Raven King" | The map-1 mini-boss is the Crow King (`boss.crow.name`) | Read the brief's Raven King as the Crow King |
| 6 | §133, §140–150: ray tracing, neural upscaling, frame generation, NeRF, splats | Not available in browsers or the shells, or not justified for this art style | Not planned (class C/D in §8) |

---

## 13. Pass reports

### SYS: the engine upgrade (v71), the owner's Wilds of Aether engine

**Status: IMPLEMENTED** (off by default with the rest of the 3D renderer; not COMPLETE: no device check yet).

**Files.** New: `src/js/08ri_r3d_world.js`, `08rj_r3d_scatter.js`, `08rk_r3d_actor.js`, `08rl_r3d_assets.js`.
Changed: `tools/vendor` (r186, `GLTFLoader`), `src/vendor/three.js`, `08r_r3d.js` (revision guard, renderer standards,
the cel family out of tone mapping), `08rb`, `08ra`, `08rd`, `08rg`, `08rh` (`toneMapped: false`), `08c_scene.js` and
`06h_land.js` (the world replaces the painted ground and the land's slices when it's drawn), `08rf_r3d_budget.js`
(authored animations tick), `99_dev_hooks.js`.

**Implemented.** Every engine layer of the Wilds file, adapted (the table in `docs/RENDER3D.md`, "The engine"): the
runtime and renderer standards, the world (terrain foundation, road ribbon, water, fog, shadow map), the instanced
scatter, the character pipeline and the authored-asset bridge. Not ported, with reasons: the RPG game, HUD and camera
controls; the embedded rock and grass GLBs (licence unconfirmed, as the Wilds file itself notes); the layer-2 studio
rig (in Three.js it lights the land too).

**Mathematics applied.**
- Camera match: a world point (x, y, z) goes to camera space as ((sx − W/2)/s, −(sy − HY)/s, −F/s), where (sx, sy, s)
  is the 2D camera's `project(x, y, z)`. A pinhole camera at the eye with focal length F and principal point (W/2, HY)
  then draws it on (sx, sy). So the 2D camera's per-depth parallax, which no single 3D camera has, holds vertex by
  vertex.
- Rows: the play's flat ground gets 14 rows evenly spaced on the screen (1/z linear); the land beyond 8 m gets 42,
  each ×1.09 further (geometric), out to 300 m.
- Light: flat ground's irradiance is E = π(0.55·hemi + 0.45·key·n·L / L_y); a Lambert surface returns albedo·E/π, so
  flat open ground returns its albedo. Colours mix in sRGB (as the 2D canvas does), then go to the GPU linear.
- Scatter: a copy's place is a pure function of (set, cell, index) through an integer hash (Wilds' `envRand`); what
  depends on the camera (the density band by distance, the lane's width near the camera, the boardwalk's gap) is
  applied when it's drawn, never when it's placed.
- LOD: level by height on screen h, thresholds (180, 70) px, up at ×1.15 and down at ×0.85 (a dead zone).
- Face controller (Wilds'): blink openness max(0.08, 1 − sin πp) over 0.135 s at intervals 2–6.2 s; gaze
  clamp(dx / max(0.35, dz)) × travel, only while dz > 0.04 (the target is in front of the face).

**Verification** (headless SwiftShader; the spec's five new tests):
- Runtime: r186, sRGB, ACES, PCF; toon and ink untouched by tone mapping; the GLB loader bundled; no CDN.
- All 16 bosses, idle, hurt and dead, on r186: 0 fails, no console errors or deprecation warnings.
- World: on maps 1, 5, 6, 7 and 8 the land is on the 2D camera's pixels within 0.0001 px (55 vertices each), still and
  mid-throw; flat ground within 0–2 levels of its painted colour (6 on the desert); water only on the Marsh; each map
  its own fog; a throw still goes in.
- Scatter: grass and rocks on Crow Hollow, the Marsh's boardwalk (no grass in the water), the Caves' ties and rails, the
  Gilded Quarter's flagstones; down the road and back, every copy where it was.
- Character pipeline: three levels with fewer triangles each, two material classes, faceted, the LOD dead zone, pose
  and rest, the walk, the face's proportions, expressions (all 17 of the pose library's), gaze only forward, a blink.
- Bridge: an embedded glTF replaces a procedural actor, fitted to its height and ground; Slot_Hat; "hurt" finds the
  Flinch clip; a bad file leaves the procedural model; shipping without a licence is refused.
- Contact sheets of all eight maps, 2D against the world, checked by eye (and three defects found and fixed: the land
  washed grey by Fresnel sheen, the lane dressing painted over by the land, the Marsh's water over its boardwalk).

**Gameplay regression.** None: render only, off by default, physics and replays untouched; full spec, soak and
persistence (see the commit).

**Performance** (software rendering: relative only). The world costs about 3–10 ms a frame headless after its first
frame (130–180 ms, building and compiling). About 6,300 land triangles, 450 road, 1,300 water (Marsh), and a few
thousand in the scatter, in one draw call per kind; one 1024² shadow map. The vendored engine grew from 711 to 800 KB.

**Remaining.**
- Real-device pacing (as for the whole renderer).
- Each map's land given its own look in the overhaul (the world takes the painted palette for now), and water its own
  shader (Fresnel and Beer–Lambert: §5).
- The travel decals and the secret path's old road are still painted over the land.
- Moving Morty, the ring and the bosses into the world's scene (CC-001, next), as each is regenerated.

**Next dependency.** The asset-by-asset overhaul, on these layers: Morty's face as geometry through `r3dFace` and its
controller (ASSET-001 passes 2 and 3), then the cast and wildlife through the character pipeline.

### ASSET-001 Morty, passes 2 and 3 (v72): the face as geometry

**Status: IN PROGRESS** (the default look and most cosmetics built; the face pieces and a few skins still fall back).

**Files modified.** New `src/js/08rm_r3d_mortyface.js`; `08rb_r3d_skull.js` (a finer shell, the geometric face built
and used first), `08a_skull.js` (the 2D rig's surface mode), `08re_r3d_math.js` (the deformer skips empty geometry),
`99_dev_hooks.js`, the spec.

**Implemented.**
- The skin is the shell's UV-mapped surface texture: colour, pattern, paint job and the dark of the hollows (sockets
  swelling from their inner edges, lids, cheeks pushing up, the nose, the mouth), painted by the 2D rig with no pupils,
  brows, teeth or face pieces, and with the jaw at rest.
- Pupils, glyph eyes and brows are meshes, from the same face state as the 2D (`faceFor`): look direction, pupil size,
  lids and cheeks cut the pupil to what shows; the spiral turns, the star rocks.
- Eleven teeth, one mesh each, each at its own height on the grin's curve (read from the artwork's column above it),
  inked; gold, fangs, one, toothless and the jaw shapes.
- The jaw: the shell below the mouth's top, inside the jaw and mouth artwork, split off as its own mesh, hinged; it
  drops 0.42 skull radii a unit of the rig's jaw (as the 2D) with a small swing, and a dark mouth fills only the gap.
- The outline is cut by the skin's own silhouette (it used to ring the shell's ellipsoid).

**Visual checks.** All 16 of the rig's moods, 2D against 3D (contact sheets); close-ups of idle, fear, strain,
gleeful and excited; wood with a gold tooth, tiger with fangs and giant eyes, neon with X eyes; glasses falling back;
in play at rest and in flight. Defects found and fixed in the pass: socket edges stepped when darkened per vertex
(moved to the material), dentures (the teeth row's box is taller than any tooth), a dark blob under the chin (an
oversized mouth backing), a pale band under the upper teeth when the jaw dropped (split at the hinge line instead of
the mouth's top), a faint ink ring round the head.

**Gameplay regression.** None: render only, off by default.

**Performance.** The shell is 96 × 72 (about 13,800 triangles with its ink copy), split in two; 11 teeth at 12
triangles plus ink; the pupils, glyphs and brows a few hundred. The surface texture is repainted each frame, as the
projected face was. Not measured on a device.

**Remaining.**
- The face pieces as models: masks, glasses, hair, beards (they still fall back).
- The pumpkin, radio and flaming skulls' eyes, the ice skull's jaw, the five glow-behind skulls; eye cosmetics beyond
  pie, tiny, giant, crossed and sleepy; teeth cosmetics beyond the eight listed.
- Bone a touch warmer than the 2D's white (the bone ramp under the map's key); a look on a phone.
- The jaw's split edge is a little ragged at its sides at hero size.

**Next dependency.** The face pieces (COS-MASK, COS-GLASSES, COS-HAIR, COS-BEARD) as models on the head's slots.

### ASSET-001 Morty, pass 1 (v70)

**Status: IN PROGRESS.** Pass 1 of 3. Passes 2 and 3 (the jaw, teeth, eyes and brows as geometry) landed together in v72, above.

**Files modified.** `src/js/08rb_r3d_skull.js`.

**Implemented.**
- The face shell is sculpted, on a denser mesh (72 × 56 segments instead of 40 × 32).
  - The eye sockets are hollows 0.2 skull radii deep, and the nose 0.1.
  - The brow ridge over each socket and the cheekbones under and outboard of them stand out 0.05–0.06.
  - Each is placed from the skull artwork's own socket and nose boxes (`SOCK`, the nose layer), so the painted face
    lines up with the sculpt.
- The painted face is still projected straight on, so every expression, skin, paint, set of teeth and eye cosmetic
  carries over unchanged.
- Bone has its own toon ramp (shadow 140, half 225, lit 255, against the scenery's 90/175/255). He keeps the
  drawing's white where he faces the light and shades only where the surface turns away (the socket walls, the far
  cheek).
- The face texture is 512 px, up from 256. It was being magnified at hero size on a DPR 2 screen.
- The cranium is set back 0.26 behind the face, so the hollows never show the back of his head.
- The outline comes from an unsculpted copy of the shell. It rings the head without creasing into the hollows: a
  first try inked the sculpted shell itself and drew black lines inside the sockets.

**Mathematics applied.**
- The relief is a sum of smooth bumps, (1 − d)², with d the squared normalised distance from each feature's ellipse
  centre. It is scaled by the surface's facing, so the rim of the shell doesn't move.
- The normals are recomputed from the moved vertices, so the toon light shades the hollows.
- The UVs are unchanged (a straight-on projection). The painting stays where the rig drew it, whatever the depth.

**Visual checks** (headless, DPR 2, quality pinned at 1):
- At rest, side by side with the 2D Morty: the pupils, glints, teeth and grin are all present; the sockets and
  cheeks now take shading.
- In flight at gameplay distance, turned: reads as a round, lit skull.
- Two defects were found and fixed in this pass: the back of the head showing through the sockets, and ink
  creasing into the hollows.

**Gameplay regression.** None expected: render only, 3D off by default, collision untouched. Full spec (see the commit).

**Performance.** The shell has about 4,000 triangles instead of about 1,300 (plus the ink copy). The face texture is
1 MB instead of 256 KB of upload when repainted. Not measured on a device.

**Compatibility.** WebGL2 (as the rest of the renderer). Mobile not yet checked.

**Remaining.**
- Still warmer and a touch softer than the 2D drawing at rest. The 3D renders at 1.5× on a DPR 2 screen by design;
  worth a look on a phone.
- The jaw still opens only in the painting.
- The eyes and brows are still painted.
- No hero-distance review in every map's light yet.

**Next dependency.** Pass 2, the jaw: it needs the 2D rig's jaw value (`o.jaw`) driving a hinged mesh, with the
painted jaw masked out of the face texture.

### ASSET-001 Morty, pass 4, and ASSET-007 the slingshot, pass 2 (v73): the owner's models

**Status: IN PROGRESS** for Morty (masks, hair, beards and a few skins and cosmetics still use the v72 face);
**IMPLEMENTED** for the slingshot (the default launcher; Vault launchers are still cut-outs).

**The owner's calls.** "Use the skull for Morty's head", "Use this for his eyes", "Use this for the sling shot", each
with a model: `human-skull.glb` (a Fab free pack: one anatomical skull at five levels of detail and a text plate, no
textures), `low-poly-eye.glb` (an eyeball with a 4K iris and sclera map, a cornea) and a slingshot OBJ (3ds Max, 2012:
a Y-fork, cord wraps, a leather pouch and two slack bands; its material and texture files are empty).

**Files.** New: `tools/model-bake.mjs`, `src/models/morty-head.bin` and `slingshot.bin` (baked), `src/models/source`
(the three sources, the OBJ gzipped, and `MANIFEST.json`), `src/js/08ro_r3d_models.js` (reads the bakes),
`src/js/08rp_r3d_mortyhead.js` (the head). Modified: `src/build.py` (embeds `src/models/*.bin` as `MODEL_EMBED`),
`08rb_r3d_skull.js` (the head first, then the v72 face, then the projected one; a thinner outline for the skull),
`08rc_r3d_launcher.js` (the slingshot model), `08rn_r3d_glasses.js` (the glasses take any face's surface),
`08rm_r3d_mortyface.js` (wires the glasses in and fixes a v72 line a comment had swallowed), `99_dev_hooks.js`, the spec.

**The bake.** Two of the skull's levels (v1, 18,620 triangles, for hero size; v3, 3,392, when Morty is under 24 px of
radius on screen, with a dead zone to 30) are welded, stood with the chin at 0, scaled to a height of 1 and split by
connectivity into the cranium, the mandible and 28 teeth. Each tooth goes to the row of the bone it sits closest to
(14 and 14), numbered left to right. The mandible's hinge is the top of its back quarter (the condyles, not the
coronoid processes). Every vertex gets its ambient occlusion from 96 orthographic depth maps. The eye keeps its ball
(with UVs), its cornea and its colour map, cut to 512 px. The slingshot keeps its frame and pouch whole and its four
wraps simplified by vertex clustering (from 13-25 thousand triangles each to 1-3 thousand); its bands are dropped.
Positions are 16-bit, so the two bins come to 268 KB and 182 KB.

**Implemented.**
- The head replaces the sphere and its face whenever the look allows. The bone takes the skin's colour, or its pattern
  painted flat and projected straight on, and darkens toward the skin's socket colour where the baked occlusion says the
  skull hides its own sky: the sockets, the nose and the gaps between the teeth read in any skin.
- The mandible and the lower teeth swing open on the hinge with the rig's jaw (0.5 radians a unit), take the teeth's
  jaw shape, and slide with the face's skew. The teeth cosmetics are the skull's own teeth: toothless hides them all,
  one keeps a single upper incisor, gold gilds an upper lateral incisor, fangs lengthen the upper canines, tiny, big and
  jumbo scale them where they stand.
- An eyeball in each socket looks where the face looks, crosses for the crossed eyes, swells with the sockets (fear,
  shock), and is giant or tiny with those eyes. Lids in the skin's colour close for blinks, sleep and the shut eyes and
  half close for sleepy; lower lids push up for the cheeks and the happy eyes. The x, star and spiral glyphs stand in
  the empty socket. A catch light stands for the cornea's shine.
- Brows are ink bars on the brow ridge. Glasses sit on the skull: each pair is built over the real sockets on the
  skull's outer envelope (its front surface, each point the highest within about 0.07 skull radii), with arms to the
  skull's temples.
- The slingshot's frame is posed on the game's anchors (its tip wraps on the band tips, its foot toward the handle's
  foot), its pouch on the pouch's two ends; the bands are still the game's own, stretched every frame.

**Visual checks.** The 16 moods, the eye and teeth cosmetics, all 12 glasses, wood and candy skins, close-ups at
170 px of radius, and play at rest, 2D against 3D. Defects found and fixed in the pass: the house ink hull drew black
scribbles round the skull's real hollows and covered the eyes in their sockets (the head's ink now writes no depth, so
it is the outline only); the cornea darkened the eye beneath it in the cel render (replaced by a catch light); the eye
showed black until its map had decoded (plain until then); the bandit's mask sank into the sockets (the envelope);
the glasses' arms stood out past the narrower skull (to its temples). A comment had swallowed v72's mouth-backing
sizing.

**Gameplay regression.** None: render only, 3D still off by default; the 2D Morty and slingshot are untouched.

**Performance.** The hero head is 18,620 triangles plus its ink copy (the light level 3,392); the eyes 1,150 each;
the slingshot's frame and pouch about 13,900 and its wraps about 7,100, each with ink. Decoding the bins takes a few
milliseconds once. Not measured on a device.

**Remaining.**
- Masks, hair and beards on the skull; the skins that draw their own eyes or jaw, or a glow behind; the eye and teeth
  cosmetics not listed above.
- The skull is anatomical, not Morty's cartoon proportions; whether to keep it as is or push it toward him is the
  owner's call.
- The slingshot's frame is chunkier than the 2D launcher (the model's own proportions at the game's tip spacing).
- The three sources' licences, for `MANIFEST.json`, before any of them can ship.

