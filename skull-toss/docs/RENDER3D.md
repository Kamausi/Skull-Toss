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
| Scenery, graveyard props, the walking cast | `08rd_r3d_sets.js` | **Set pieces.** Each painting (for a walker, each drawing of its walk) is cut out along its own outline (marching squares, simplified) and extruded with real depth. It's painted front and back, its cut edge is its own paint in shadow, and it's inked, like the Fleischer studio's miniature sets. Only pieces within 30 m are built (`R3D_SETS.near`); beyond that the depth can't be seen, and they stay painted. |
| Everything drawn live | `08rd_r3d_sets.js` (`r3dCapture`, `r3dLiveAt`, `r3dWrap`) | **Live pieces**, cut out the same way on twos (12 a second). The 2D drawing is run into an offscreen copy of the stage, lifted off, traced and stood up at its depth. This covers the cat, the owls and deer, the fish, crabs and eels, targets, obstacles (with their eyes), gates, the coach, hazards, the encounter's actor, the power-up, the cans, the lanes' stakes, the overhead anchors, all 16 bosses, the attractions, the gravedigger, the portal ring, Morty's hats, and Vault launchers and poles. |

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
