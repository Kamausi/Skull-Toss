# The 3D renderer (from v68, in progress)

The owner's call (2026-09-28): the graphics go from 2D to real 3D, in the 1930s cartoon style (toon shading, ink
outlines, the film print), and **nothing ships in 3D until everything is converted**. Until then the renderer is off
by default. Add `?r3d` to the address to see it, or call `SkullToss.debug.r3d(true)` in a dev build.

## How it works

- **Engine.** Three.js, bundled into the page as `src/vendor/three.js`: an IIFE that sets `THREE`, in its own
  `<script>` ahead of the game's. To rebuild it (pinned versions): `cd tools/vendor && npm install && npm run build`.
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

## What's converted

| Piece | File | How |
|---|---|---|
| Morty | `08rb_r3d_skull.js` | A modelled head (cranium and a jaw-deep face shell). His 2D face is painted live onto the shell's front, so every expression, skin, paint and set of teeth carries over. His wings are a live piece behind him. |
| The ring | `08ra_r3d_ring.js` | A torus in the cosmetic's colour. The lifebuoy has white quarters and a rope; chain, bones, thorn, fire and portal rings keep their character. |
| The slingshot, the post | `08rc_r3d_launcher.js` | Turned wood, capped tips and rubber bands, posed from the painted launcher's anchors. The post is wood on an iron foot. |
| Scenery, graveyard props, the walking cast | `08rd_r3d_sets.js` | **Set pieces.** Each painting (for a walker, each drawing of its walk) is cut out along its own outline (marching squares, simplified) and extruded with real depth. It's painted front and back, its cut edge is its own paint in shadow, and it's inked, like the Fleischer studio's miniature sets. A piece is built only while its depth would show on screen (the runtime complexity manager, below); otherwise it stays painted. |
| Everything drawn live | `08rd_r3d_sets.js` (`r3dCapture`, `r3dLiveAt`, `r3dWrap`) | **Live pieces**, cut out the same way on twos (12 a second). Wildlife, sea life, the cat and the cast are also painted and sent to the GPU only on those twos, and are cut out only while their depth shows; the protected pieces (below) are painted every frame. The 2D drawing is run into an offscreen copy of the stage, lifted off, traced and stood up at its depth. This covers the cat, the owls and deer, the fish, crabs and eels, targets, obstacles (with their eyes), gates, the coach, hazards, the encounter's actor, the power-up, the cans, the lanes' stakes, the overhead anchors, all 16 bosses, the attractions, the gravedigger, the portal ring, Morty's hats, and Vault launchers and poles. |

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
- What's left in the headless runs is the copy of each rendered box into the 2D canvas. Headless, the 2D canvas lives
  on the CPU, so every copy reads the WebGL canvas back. On a phone both canvases are on the GPU and the copy stays
  there. Real-device frame pacing is still the gate before shipping.

## Still to convert

- The sky, the far skyline and the ground stay painted backdrops (a 3D game's matte paintings). The land's slices are
  still painted.
- Effects stay 2D cel animation, drawn over the 3D: particles, contact stars, trails, the boss-death gags, the rift,
  weather and auras.
- Water reflections show the 2D pieces.
- The menu previews (the Vault, the Cart, the mascot) are still 2D.
- Proper models for the bosses (they're live cut-outs now), and a second look at the look against real devices.

Then the default flips, and the full spec, e2e, matrix, soak and persistence suites run with 3D on. Real-device frame
pacing is a gate before shipping, because each 3D piece costs a render and a copy.
