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
| Morty | `08rb_r3d_skull.js` | A modelled head (cranium and a jaw-deep face shell). His 2D face is painted live onto the shell's front, so every expression, skin, paint and set of teeth carries over. |
| The ring | `08ra_r3d_ring.js` | A torus in the cosmetic's colour. The lifebuoy has white quarters and a rope; chain, bones, thorn, fire and portal rings keep their character. |
| The slingshot, the post | `08rc_r3d_launcher.js` | Turned wood, capped tips and rubber bands, posed from the painted launcher's anchors. The post is wood on an iron foot. |
| Scenery (all 64 travel kinds), graveyard props | `08rd_r3d_sets.js` | **Set pieces.** Each painting is cut out along its own outline (marching squares, simplified) and extruded with real depth, painted front and back, its cut edge dark and inked, like the Fleischer studio's miniature sets. |

Hooks are one line at the top of each 2D drawing: `drawSkull`, `drawRingShape`, `drawLauncher`, `drawPost`,
`drawTravelProp` and `drawProp`. A prop reacting to a hit draws in 2D until it settles.

## Still to convert

- **B.** The sky and ground (painted backdrops for now), the walkers and creatures, the water.
- **C.** Targets, obstacles, hazards, gates, the coach, encounters and power-ups.
- **D.** The 16 bosses, their deaths, and the portal and rift.
- **E.** Cosmetics (hats, launchers, poles, wings, auras), the mini-games and the menu previews.

Then the default flips, and the full spec, e2e, matrix, soak and persistence suites run with 3D on. Real-device frame
pacing is a gate before shipping, because each 3D piece costs a render and a copy.
