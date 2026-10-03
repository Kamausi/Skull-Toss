# The 3D renderer (from v68, in progress)

The owner's call (2026-09-28): the graphics go from 2D to real 3D, in the 1930s cartoon style (toon shading, ink
outlines, the film print), and **nothing ships in 3D until everything is converted**. Until then the renderer is off
by default. Add `?r3d` to the address to see it, or call `SkullToss.debug.r3d(true)` in a dev build.

## How it works

- **Engine.** Three.js **r186** (v71, the Wilds of Aether engine's revision; it was 0.180), bundled into the page as
  `src/vendor/three.js`: an IIFE that sets `THREE`, in its own `<script>` ahead of the game's, with `GLTFLoader` for
  authored models. Nothing is fetched from a CDN, so the game still runs offline and in the app shells. A bundle of
  another revision is refused and the game stays 2D. To rebuild it (pinned versions):
  `cd tools/vendor && npm install && npm run build`.
- **Drawing in place.** Each converted piece is drawn exactly where its 2D drawing was.
  - The model is posed in camera space at the same screen spot and size.
  - It's rendered into an offscreen WebGL canvas inside a scissor box round it.
  - That box is copied into the 2D frame under the 2D canvas's current transform.
  - So a squash, a shy ring's turn and the water's mirror still apply. The painter's order, the rostrum camera, the
    aim, the physics, the replays and every test stay as they were.
- **The camera** is a pinhole at the eye with its centre on the horizon (`HY`), so a model's perspective matches the
  2D projection: `x = W/2 + F·X/Z`, `y = HY − F·Y/Z`. `r3dPlace` puts a model where a world radius *R* comes out
  *r* pixels.
- **The look.** Two parts:
  - `MeshToonMaterial` with a three-step ramp (shadow, half, lit), under the map's key light and a hemisphere fill.
  - An ink hull on every model: its back faces, pushed out along the normals in screen space, so the line is the same
    few pixels wide near or far, like a cel.

## The engine (v71): the owner's Wilds of Aether engine, brought over

The owner's call (2026-10-03): *"Use this engine to upgrade skull toss before we do the visual overhaul."* The engine
is the owner's Wilds of Aether prototype (one HTML file, Three.js r186). Its engine layers came over; its game (an
OSRS-style grid RPG: tile pathfinding, inventory, quests, the minimap, chat, pinch-zoom and drag-look cameras) didn't,
because Skull Toss keeps its own game, camera and controls. Each layer, and how it fits Skull Toss:

| Wilds layer | In Skull Toss | File |
|---|---|---|
| **Runtime**: Three.js r186, `WebGLRenderer`, sRGB out, ACES filmic tone mapping (exposure 1.03), a PCF shadow map, pixel ratio capped at 1.5, the high-performance GPU | The same, bundled instead of fetched. Tone mapping is per material: the cel family (toon, ink, flat colour) is `toneMapped: false`, as Wilds keeps its faces' line work out of the curve, so the cartoon palette is exact; the world is too by default (below), with `R3D_WORLD.filmic` to send it through ACES. The shadow map renders once a frame, in the world pass. | `tools/vendor`, `08r_r3d.js` |
| **Terrain foundation**: a seeded height field, vertex-coloured by masks (meadow, forest, wet band, rock on slopes), lit by a hemisphere and a shadow-casting sun, with fog | **The world** (`r3dWorldDraw`): the frame's first 3D render, replacing the painted ground plate and the land's painted slices. The heights are the 2D land's own (`landH`, the road's bend `landCx`, flat within 9 m; the plate's painted hills on a flat map). Each vertex goes on the very pixel the 2D camera (`project`) draws that point, at the depth `r3dPlace` gives a model there, so the multiplane parallax, the rostrum camera, the road's yaw and the gate weave all carry over (measured: within 0.0001 px, still and mid-throw). Colour: the plate's gradient, the map's hill colour where the land rises, rock on steep slopes, the stage light at the ring, a low value-noise mottle fixed to the land. The road is its own ribbon so it keeps its width far off. The key light is the moon, where it hangs in the painted sky; the land writes the frame's depth beyond 8 m, so 3D pieces go behind a crest. | `08ri_r3d_world.js` |
| **Water**: a translucent physical plane with a clear coat | On the Marsh, an opaque matte plane in the painted water's own colours, under the boardwalk; the 2D sheens and the moon's path still play over it. Its own shader is the overhaul's (below). | `08ri_r3d_world.js` |
| **Environment pass**: instanced sets (one draw call per kind), placed by a seeded hash under ecological rules (density by distance band, no steep ground, no water, clear of paths), each copy its own scale, turn, lean and colour | **The scatter.** Laid out in cells along the track, seeded by the cell alone, so a copy stays where it was put as the road goes by. Grass (Wilds' blade tufts, in the map's grass colours: what the plate's inked ticks were), rocks on slopes, and each lane's dressing as geometry: rail ties and rails, boardwalk planks and posts (with the gap in open water at the ring), flagstones. | `08rj_r3d_scatter.js` |
| **Character pipeline**: LOD0/1/2 from one recipe with triangle budgets, two material classes, faceted per-triangle shading, a procedural surface atlas, an articulated rig, the face as geometry with a face controller (blink, gaze, expressions), contact shadows | The same, for the models to come (Morty's face, the cast, the wildlife): the surface class is the cel family, the metal class a toon with a narrow bright band. The level is picked by height on the screen with a 15% dead zone (this renderer's distances are the 2D camera's). The expressions are Wilds' three plus every face in the game's pose library. | `08rk_r3d_actor.js` |
| **Hybrid authored-asset bridge**: a Blender-made GLB replaces a procedural actor's look once loaded; a failed load keeps the procedural one | The same: fitted to the procedural model's bounds, materials brought into the house look, clips found through aliases and crossfaded, `Slot_*` nodes as attachment points. Embedded (data URI, ArrayBuffer or glTF JSON), since the game is one file. Wilds' own rule is enforced: an asset can't be marked for shipping without a licence in its manifest. | `08rl_r3d_assets.js` |

**What was not brought over, and why.**
- The embedded rock and grass GLBs. Wilds' own note says their provenance and licence must be confirmed before
  shipping, and they're woodland-RPG assets; the scatter draws its own.
- The game, the HUD and the camera controls (above).
- The "character-only" studio light rig on layer 2. In Three.js a light on a layer lights everything a camera on that
  layer sees (`WebGLRenderer.projectObject` tests the light's layers against the camera's, not the mesh's), so in Wilds
  that rig also lights the land. Here the characters render in the cel scene and the land in the world's, so each keeps
  its own light.

**Two things the port found** (worth knowing in Wilds too).
- Under a low key light ahead of the camera, seen at grazing angles, even Wilds' rough land (`MeshStandardMaterial`,
  roughness 0.96) floods grey with Fresnel sheen; its water does too. The land here is a Lambert (the matte surface
  Wilds meant), and the calibration assumes one.
- The light calibration: Three's lights are physical (a Lambert surface under irradiance E returns albedo·E/π), so the
  hemisphere gives 55% of a flat surface's light and the key the rest, both scaled by π and the key by 1 / its
  height. Flat open ground comes out its painted colour: measured within 0–2 levels of 255 on Crow Hollow and the
  Abyss, and 6 on the desert, whose moon and sky are warm.

**Dev hooks:** `r3dWorld(on)`, `r3dWorldState()`, `r3dWorldProbe()` (the pixel check), `r3dWorldCalib()` (the colour
check), `r3dFilmic(on)`, `r3dScatter()`, `r3dScatterOn(on)`, `r3dKit()` (the pipeline and the bridge, for tests).

## What's converted

| Piece | File | How |
|---|---|---|
| Morty | `08rb_r3d_skull.js`, `08rm_r3d_mortyface.js` | A modelled head: a cranium and a sculpted face shell (real hollows for the sockets and nose, a brow ridge and cheekbones). **His face is geometry (v72):** the pupils (pie, tiny, giant, crossed), the glyph eyes (x, star, spiral, and the shut, happy and screwed-shut curves) and the brows are meshes; each tooth is its own inked mesh at its own place on the grin's curve; the jaw is its own part of the shell, hinged, dropping with the rig's jaw value over a dark mouth. The skin (its colour, pattern, paint job and the dark of the hollows, which swell, take lids and push up cheeks as the 2D's do) is the shell's UV-mapped surface texture, painted by the 2D rig in its surface mode, with no features in it. Everything is driven by the same face state the 2D reads. Looks that draw their own eyes or face pieces (masks, glasses, hair, beards, the pumpkin, radio and flaming eyes, the ice jaw, the glow-behind skulls, and the eye and teeth cosmetics not listed) keep the v70 projected face until their pass. |
| The ring | `08ra_r3d_ring.js` | A torus in the cosmetic's colour. The lifebuoy has white quarters and a rope; chain, bones, thorn, fire and portal rings keep their character. |
| The slingshot, the post | `08rc_r3d_launcher.js` | Turned wood, capped tips and rubber bands, posed from the painted launcher's anchors. The post is wood on an iron foot. |
| Scenery, graveyard props, the walking cast | `08rd_r3d_sets.js` | **Set pieces.** Each painting (for a walker, each drawing of its walk) is cut out along its own outline (marching squares, simplified) and extruded with real depth. It's painted front and back, its cut edge is its own paint in shadow, and it's inked, like the Fleischer studio's miniature sets. A piece is built only while its depth would show on screen (the runtime complexity manager, below); otherwise it stays painted. |
| The 16 bosses and their shots | `08rg_r3d_bosskit.js`, `08rh_r3d_bosses.js` | **Models**, not cut-outs (v69). A kit of toon parts (ellipsoids, lathes, extruded slabs, tubes, gears, pie-cut eyes) written in the 2D drawing's own coordinates, so each model matches its drawing's proportions. Each frame the model is posed from the same boss state the 2D drawing reads: hurt, tell, phase, sway, hoot, the gator's waterline, the jester's spring, the count's cape, the clock king's pendulum, the pumpkin's split. The 2D clips (the waterline, the boss-death shatter) cut the model too. The shots (seed, clod, bat, bone, mud, pin, gear, film frame) are small models batched with the scene. Checked idle, hurt and dead on every map with no failures; not yet reviewed at hero distance or on a device. |
| Everything drawn live | `08rd_r3d_sets.js` (`r3dCapture`, `r3dLiveAt`, `r3dWrap`) | **Live pieces**, cut out the same way on twos (12 a second). Wildlife, sea life, the cat and the cast are also painted and sent to the GPU only on those twos, and are cut out only while their depth shows; the protected pieces (below) are painted every frame. The 2D drawing is run into an offscreen copy of the stage, lifted off, traced and stood up at its depth. This covers the cat, the owls and deer, the fish, crabs and eels, targets, obstacles (with their eyes), gates, the coach, hazards, the encounter's actor, the power-up, the cans, the lanes' stakes, the overhead anchors, the attractions, the gravedigger, the portal ring, Morty's hats, and Vault launchers and poles. |

**One depth buffer a frame (Phase 1, v70).** The depth buffer is cleared once, at the frame's first 3D render; after that
each render clears only the colour inside its box. So a 3D piece hides behind any 3D piece already drawn in front of it
by true depth (Morty passing through the ring, the ring through a boss), while the 2D art in between keeps the
painter's order. An overlay meant to sit on Morty (a hat, a frame launcher) goes down on its own, on fresh depth.
`SkullToss.debug.r3dShared(false)` turns it off for comparison.

**Light (Phase 1, v70).** Each map lights its models from its own palette (`r3dLightRig`, from `src/maps/*.json`
look): the key light takes the moon's colour, the hemisphere fill the sky's top and bottom, and every toon material
gets a thin rim in the moon's colour where its surface turns away from the camera (a Fresnel term, (1 − n·v)³,
strength 0.35; `SkullToss.debug.r3dRim(k)` to try others, `r3dLights()` to read the rig).

**Contact shadows (Phase 1, v70).** Each modelled boss that stands on the ground or hovers over it gets a soft shadow
at its feet, by the same rule as Morty's (`BLUEPRINT.shadow.skull`: the higher its lowest point, the smaller and
fainter, slid along the light), once a frame. The gator and Madame, up to their necks in water, get none.

**Batching.** Hero pieces with 2D drawn over them (Morty, the ring, the slingshot, the post) render at once, into their
own box. Everything else is queued. The queue renders as one scene in a single call (clones posed by their own
matrices; a faded piece wears copies of its materials, in tenths) and is copied in once, at the next hero piece or
flush point. That keeps the painter's order at one copy per group instead of one per piece.

## The math core at work (`08re_r3d_math.js`, see `docs/MATH-TOOLKIT.md`)

- **Deformations.** Knocked, the ring twists while it wobbles. A contact's squash wrings Morty (squash ∘ twist, volume
  kept). The post bends as the ring it holds shakes.
- **The portal.** Its 2D lensing stays; over it goes a parametric rose, its petal edges drawn in light, with 89
  golden-angle motes carried in by the portal field (pull and swirl).
  - It turns at its field's circulation round the rim (Stokes).
  - Its brightness is the field's energy through the disc (a Simpson integral).

## The runtime complexity manager (`08rf_r3d_budget.js`)

The owner's performance equations (the second set of notes, 2026-09-28) run the 3D renderer. There's no Low, Medium
or High setting: each piece asks, every frame, how much it's worth on this one. The equations themselves are in the
math core (`MC.PF`, `docs/MATH-TOOLKIT.md`).

- **Screen-space error, not distance.** A set piece painted flat is wrong by the depth it lacks. On screen that's
  `E = depth·F/z` pixels (the notes' `E = eH / (2d·tan(fov/2))`, since `F = H / (2·tan(fov/2))`).
  - It's built in 3D above `T + Δ` and painted below `T − Δ`. `T` is 4 px at full quality and rises to 12 px under
    load; `Δ` is 20% of `T`. The dead zone stops a piece flickering as the camera pushes in.
  - Each switch crossfades over a quarter second (smoothstep), so nothing pops. A piece seen for the first time just
    starts as it is.
  - This replaces the old fixed 30 m cut. Unprotected live pieces use the same test, with their own depth.
- **Frustum culling.** Each set piece's bounding sphere (round its foot, reaching its farthest corner) is tested
  against the view's four sides and the near plane: `n·c + d < −r` means it's wholly outside, and nothing is drawn.
- **A build budget.** New set pieces are cut 5 ms' worth during a frame. The rest wait, painted meanwhile, and up to
  4 ms more of them are cut after the frame, the most visible first (priority = the error the build would fix). This
  spreads the first-build hitch on coming into a map over several frames.
- **Timing.** It keeps the gap between frames and the work in each, smoothed by an EMA (α = 0.1), and how much of the
  work is the 3D's. It also keeps the median, P95, P99 and worst of the last 240 frame gaps, and the jank (how far
  past the 16.7 ms budget, on average). A gap over a second counts as a pause, not a frame.
- **The governor.** A PID loop, `Q += Kp·e + Ki·Σe + Kd·Δe` with `e = T_target − T_work` and a leaky `Σe`, moves one
  quality `Q` between 0 and 1.
- **What goes first.** `Q` is given up channel by channel, in order of saving ÷ harm. Each channel spends its own
  quarter of `Q`:
  1. **Distant detail.** Set pieces go back to paint as `T` rises.
  2. **Particles.** The portal's motes thin. Effects ask for particles and get a share of a budget (480 × the
     channel's quality) by importance; nobody gets more than it asked for.
  3. **Animation.** Unprotected live pieces are painted and cut less often, down to 4 a second.
  4. **Resolution, last.** Its floor falls from 1 to 0.7. It comes down at most twice a second, by
     `s·√(T_t / T_3d)` (pixels cost ∝ s²). Only the 3D's own share of the frame counts (Amdahl: the rest doesn't
     shrink with it). It goes back up at once when there's room.

  The protected things never go: Morty (his hats, wings and launcher), the ring and its support, and whatever the
  skull can hit (targets, obstacles, hazards, the encounter, the power-up, the cans), and the bosses.
- **Measuring it.** `SkullToss.debug.r3dPerf()` returns `Q`, the channels, the scale, the frame statistics, the 3D's
  share and Amdahl's speed-up for a 3D twice as fast. It also has the piece counts (in 3D, painted, crossfading,
  culled, built, waiting) and the GPU's textures and geometries. `r3dHold(q)` pins the quality.
  `tools/perf3d.mjs` prints all of it for each map.

### What the measurements found (software WebGL, so compare rather than read absolutely)

- Before, every live piece was painted and sent to the GPU every frame, including a fish two pixels long. On the Drowned
  Theatre that was about 770 ms of texture upload a frame. With the screen-space test and the cadence, map 7 fell from
  about 400 ms a frame to about 15 ms, and map 4's P90 from 733 ms to 17 ms.
- Re-measured in Phase 1 (docs/PRODUCTION-AUDIT.md §10): in this container maps 6 and 7 cost about 400–500 ms a frame
  again, before and after the boss models. The render call's own time is almost all canvas-texture uploads in the
  software renderer (one 260 × 188 upload took 12 s), so those numbers vary from run to run and say nothing about a
  phone. `tools/perf3d.mjs` now prints the costliest live pieces and render kinds per map (`MAPS=6,7` runs only
  those).
- What's left in the headless runs is the copy of each rendered box into the 2D canvas. Headless, the 2D canvas lives
  on the CPU, so every copy reads the WebGL canvas back. On a phone both canvases are on the GPU and the copy stays
  there. Real-device frame pacing is still the gate before shipping.

## Still to convert

- The sky and the far skyline stay painted backdrops (a 3D game's matte paintings). The ground is 3D now (the world,
  v71), but the travel decals and the secret path's old road are still painted over it, and the overhaul still has to
  give each map's land its own look (the world takes the painted palette for now).
- Effects stay 2D cel animation, drawn over the 3D: particles, contact stars, trails, the boss-death gags, the rift,
  weather and auras.
- Water reflections show the 2D pieces.
- The menu previews (the Vault, the Cart, the mascot) are still 2D.
- The bosses' deaths (archetypes, gags, shards, wordmark) are still 2D, and the bosses need a review at hero distance
  and in motion.
- A second look at the look against real devices.
- The production plan for the rest (one scene instead of in-place compositing, then Morty, the ring, the bosses,
  gameplay objects, the maps, effects, cosmetics and UI, in that order) is in `docs/PRODUCTION-AUDIT.md`.

Then the default flips, and the full spec, e2e, matrix, soak and persistence suites run with 3D on. Real-device frame
pacing is a gate before shipping, because each 3D piece costs a render and a copy.
