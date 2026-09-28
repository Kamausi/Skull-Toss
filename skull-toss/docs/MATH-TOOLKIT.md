# The math toolkit (v68)

The owner's notes (2026-09-28) set out a mathematical toolkit for Skull Toss. Each system has a job, not a
decoration:

- **Geometry** says where.
- **The temporal systems** say when.
- **Physics and transforms** say how.
- **The analysis layer** says whether a generated thing is any good.

> Generate → simulate → analyse → adapt.

## Where it lives

- `src/js/01d_mathcore.js`: the core. All of it is pure functions, deterministic from a seed, with no hold on the
  game's state. It's exposed to the dev build as `SkullToss.debug.mathCore()`.
- `src/js/08re_r3d_math.js`: the core at work in the 3D renderer (see `docs/RENDER3D.md`).
- `tools/montecarlo.mjs`: the core at work in testing.
- The spec checks every property below, in the two "v68 Math core" tests.

## What each system does

Status legend:

- **In the 3D renderer**: used now, when the 3D renderer is on.
- **Tool**: used by a development tool.
- **Library**: built and tested, ready for the design it's named for; not yet wired into play.

Wiring a library system into play changes the rules, so it waits for the owner's call.

| System | Job | Core | Status |
|---|---|---|---|
| Deformations: twist, bend, taper, shear, bulge, wave, ripple, jitter, squash & stretch; `compose` | Organic, reversible, parameterised motion of 3D geometry | `MC.D` | **In the 3D renderer.** Knocked, the ring twists as it wobbles. A contact's squash wrings Morty (squash ∘ twist). The post bends as the ring shakes. |
| Lévy C, Heighway dragon, twin dragon, terdragon | Compact, reproducible paths and decoration from a rewrite rule and a count | `MC.CURVES`, `rewrite`, `turtle` | Library: boss-attack paths, trails, portal interiors. |
| The parametric rose | A vortex with independent petal frequency (3.6) and opening (τ = 8π) | `MC.rosePoint`, `roseMesh` | **In the 3D renderer.** The portal's petal edges, drawn in light, opening as it opens. |
| Polyrhythm (a : b) | Timing: roles meet gcd(a, b) times and the pattern repeats after lcm(a, b) sub-beats | `MC.poly`, `rhythmSeed` | Library: an arena's "rhythm seed" for targets, obstacles and bosses. The music clock (`02f_music_clock.js`) is the master clock it would hang from. |
| Barycentric (cevian) coordinates | Positions inside a triangle that survive its scaling and turning | `MC.bary`, `fromBary`, `baryPath` | Library. The post-mini-boss triangle path (`ring.tri`) is where it would go. |
| The golden angle (137.50776°) | Even, deterministic spreads with no grid | `MC.phyllotaxis` | **In the 3D renderer.** The portal's 89 motes. |
| Integer-angle rays and 2π's convergents | Near-periodic "arms" that form and break (44/7, then 710/113) | `MC.rays`, `TWO_PI_APPROX`, `armOf` | Library: escalating boss patterns. |
| Cantor recursion | Complexity by iteration depth: 2ⁿ pieces, (2/3)ⁿ of the length | `MC.cantor` | Library: fracturing walls and corridors as a difficulty dial. |
| Monte Carlo | Measure a design by sampling it | `MC.monteCarlo` | **Tool.** `tools/montecarlo.mjs`: P(make) per map through the game's own physics, and the aim σ at which half the throws still go in. |
| Voronoi | Territory: every point belongs to its nearest site | `MC.nearest`, `voronoiAreas` | Library: the "territory boss", and rejecting layouts where a target owns no space. |
| Complex multiplication | One product rotates and scales; repeated, it spirals | `MC.C` | Library. The rose and the motes use the same polar arithmetic. |
| Logarithms | Tame multiplicative growth: difficulty, loudness (dB), shake from energy | `MC.logCurve`, `dbToGain`, `shakeFrom` | Library. |
| Dijkstra | Reachability and least-cost routes | `MC.dijkstra` | Library: proving a generated arena can be played. |
| Conics | The throw's parabola, a target's ellipse, a diverging hyperbola | `MC.conic` | The game's flight already *is* the parabola (the aim guide samples the same flight). The core carries the closed forms, for checks and tools. |
| Spacetime intercepts (Minkowski-style events) | When two moving things meet: S(t) = T(t) | `MC.intercept` | Library: timed gates and a portal's entry volume. |
| Eigenvectors and PCA | Dominant directions and what drives variance | `MC.eig2`, `principalAxis` | Library: camera look-ahead; analysing playtest data. |
| Integrals | Accumulation: Simpson's rule, arc length, line integrals | `MC.simpson`, `lineIntegral`, `arcLength` | **In the 3D renderer.** The portal's brightness is its field's energy through the disc. A throw's danger score (∫ hazard ds) is ready for scoring. |
| Gradient, divergence, curl | A field's direction, expansion and rotation | `MC.grad`, `div`, `curl2`, `portalField` | **In the 3D renderer.** The portal field pulls in (negative divergence) and swirls round (curl); the motes ride it. The v58 curl-noise atmosphere (`06i_flow.js`) is the same idea. |
| Stokes' theorem | A surface's curl equals its boundary's circulation | `MC.circulation`, `curlFlux` | **In the 3D renderer.** The portal's spin is its field's circulation round the rim. The spec checks the two sides agree. |
| Spherical trigonometry | Great circles, spherical excess, curved-arena geometry | `MC.greatCircle`, `sphExcess`, `sphArea` | Library: a curved special stage, and geodesic target paths. |
| Tensor calculus (metrics, Jacobians) | The general frame for warped spaces and portal coordinate changes | `MC.D.detJ` (Jacobians) | Library: the framework under warped arenas and portal transforms. |

## Corrections kept from the notes

- **Segment counts.** Lévy C and dragon curves have 2ᴺ segments (256 at N = 8); the terdragon has 3ᴺ (6561).
- **Dimension.** Their similarity dimension log N / log(1/r) is 2 for both constructions.
- **Primes and 44 arms.** Primes other than 2 and 11 fall on the 20 residues coprime to 44. It isn't all primes,
  and it's a residue fact, not a property of the drawing.
- **Polyrhythms.** gcd gives how often two grids coincide; the full cycle is the lcm.
- **2π's convergents.** 710/113 approximates 2π; 355/113 is π's. The core's list keeps only 2π's (6, 19/3, 25/4,
  44/7, 333/53, 710/113).
