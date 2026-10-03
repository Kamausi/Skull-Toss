# The math toolkit (v68)

The owner's notes (2026-09-28) set out a mathematical toolkit for Skull Toss, in two sets: part one (below) and the
engine's mathematics (part two, further down). Each system has a job, not a
decoration:

- **Geometry** says where.
- **The temporal systems** say when.
- **Physics and transforms** say how.
- **The analysis layer** says whether a generated thing is any good.

> Generate → simulate → analyse → adapt.

## Where it lives

- `src/js/01d_mathcore.js` (part one) and `src/js/01e_mathcore_engine.js` (part two): the core, one object `MC`. All
  of it is pure functions, deterministic from a seed, with no hold on the game's state. It's exposed to the dev
  build as `SkullToss.debug.mathCore()`.
- `src/js/08re_r3d_math.js` and `src/js/08rf_r3d_budget.js`: the core at work in the 3D renderer (see
  `docs/RENDER3D.md`).
- `tools/montecarlo.mjs` and `tools/perf3d.mjs`: the core at work in testing.
- The spec checks every property below: two "v68 Math core" tests for part one and three "v68 Math core (engine)"
  tests for part two.

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

## Part two: the engine's mathematics

The second set of notes is the layer under the first: the vector foundation that everything else stands on, then
transforms, geometry, collision, motion, fields, procedural generation, constraints, time and rendering, and a block
of performance equations for the 3D renderer. The notes' own summary:

> Geometry defines where things are. Functions define how they change. Derivatives define how fast they change.
> Integrals define what accumulates over time. Fields define how objects influence each other.

### The rules the notes set down

- **Never fake an orientation that can be derived** from a transform, a velocity, a surface normal or a field
  (`MC.M3.look`, `MC.Q.between`).
- **Don't animate the particles. Define the field, and let them respond to it.**
- **Don't simulate fluid because it's interesting.** Simulate flow where it makes the play, the effects or the world
  more coherent.
- **Morty isn't a particle.** His throw stays the game's own physics; fields move what's round him. `a = g + F(p, t)`
  is ready (`MC.FL.path`) for the day the owner wants wind, vortex or portal stages to bend the throw itself.
- **Every transformation keeps some degrees of freedom and throws others away. Know which.** (A camera throws away
  depth: the spec checks that the projection's Jacobian has exactly that null direction.)
- **Maths sets the relationships; art direction and play-testing set the values** (Fibonacci, φ).
- **Tiles:** mathematical consistency in the base, handcrafted variation over it (base, variation and breakup layers,
  then hero pieces).
- **Performance:** each piece asks how much it's worth on this frame, rather than the game picking Low, Medium or High.

### What each system does

The status legend is part one's. **In the game** means something the game already did before these notes, now
named here.

| Layer | System | Core | Status |
|---|---|---|---|
| Vectors | Pythagorean distance, dot, cross, normalise, projection and rejection, reflection `r = v − 2(v·n)n`, the angle between; drag to aim (`v = k·|d|`) | `MC.V` | Library. The game's own aim and collision code already does these sums inline. |
| Transforms | Rotation matrices (`RᵀR = I`, `det R = 1`), Euler → quaternion → matrix → transform (`M = T·R·S`), SLERP, the rotation between two directions, a frame looking along a direction | `MC.M3`, `MC.Q`, `trs` | Library. The 3D renderer uses Three.js's own equivalents; the twist is the rotation matrix whose angle grows along x (the spec checks they agree). |
| Planes and normals | `n·r + d = 0`, the signed distance, ray–plane `t = ((p₀ − o)·n) / (d·n)`, the normal and tangential split (BONK or SKID), Lambert, the angle between surfaces, a surface frame, a state carried from one portal's frame to another's | `MC.PL` | Library: collision response, sound by impact kind, and the portal-to-portal transform. |
| Collision | The quadratic and its discriminant (a swept sphere that can't tunnel), the closest point on a segment, SAT (with the push apart), GJK and the Minkowski difference | `MC.CO` | Library. The spec checks GJK and SAT agree on hundreds of random pairs. |
| Motion | The power rule (position → velocity → acceleration), `tⁿ` easing and its rate, lerp and its inverse, smoothstep and smootherstep, the spring-damper `F = −kx − cv`, the damped oscillator in all three kinds, impulses `j = −(1 + e)(v_rel·n) / (1/m₁ + 1/m₂)` with Coulomb friction, a fixed step with an accumulator | `MC.MO` | **In the 3D renderer:** smoothstep crossfades set pieces. **In the game:** the fixed step (`SIM_STEP`, 1/240 s, `10_boot.js`). Library: camera and UI feel, impact response. |
| Curves | Cubic Bézier and its derivatives, Catmull–Rom, curvature `κ = |r′ × r″| / |r′|³`, the sharpest turn along a path | `MC.CU` | Library: boss routes, rift paths, camera paths, and throwing out generated paths with curvature spikes. |
| Signed distance fields | Sphere, box, plane, capsule; union = min, intersection = max, subtraction = `max(d₁, −d₂)`, a smooth union; the normal as the gradient | `MC.SDF` | Library: portals, masks, procedural shapes. |
| Placement and texture | Poisson-disk sampling (no two points nearer than r), value noise and fBm `Σ aⁱN(bⁱx)` | `MC.poissonDisk`, `noise`, `fbm` | Library: target and prop placement, paper and cel breakup. |
| Constraints | Rank, the Moore–Penrose pseudoinverse (Greville's method: exact at any rank), the null-space projector `N = I − A⁺A`, rank + nullity = n, least squares, Lagrange (the nearest point on `Ax = b`), a step in the null space, numerical Jacobians | `MC.LA` | Library: boss secondary motion that keeps its primary pattern, constrained movement, generator diagnostics. |
| Golden geometry | Fibonacci, Binet `F_n = (φⁿ − ψⁿ)/√5`, round(φⁿ/√5), the Fibonacci squares, the golden spiral (φ each quarter turn), the golden cut, `1 : φ : φ²`, a Fibonacci growth scaffold; with part one's golden angle | `MC.GG` | Library: difficulty scaffolds (then tuned by play), proportions, spiral effects. |
| Light | Lambert, the inverse square, Beer–Lambert, Fresnel–Schlick (and R₀ from the refractive indices) | `MC.LI` | Library. The toon ramp is Lambert under Three.js. |
| Fourier | The DFT and its inverse, a radix-2 FFT, the amplitude spectrum, a Fourier series | `MC.FO` | Library: rhythm-driven motion and effects. The spec checks a 3-against-4 polyrhythm's spectrum is its two pulses' harmonics. |
| The ∇ field language | Gradient (where), divergence (spreading), curl (turning); the 3D curl and the identities `∇×∇φ = 0` and `∇·(∇×F) = 0`. Sources and sinks, vortices, wind, `F = −∇φ` (can't swirl), stream functions (can't bunch up), curl-noise turbulence. A boss's death as one field in time: it blasts out, turns, spirals in to the portal, and closes (`F → 0`). | `MC.FL` | **In the 3D renderer:** the portal's field is a sink plus a vortex (the spec checks it equals part one's `portalField`). **In the game:** the v58 curl-noise atmosphere (`06i_flow.js`). Library: the death sequence, field-driven stages. |
| Navier–Stokes-style flow | Tier 1, the analytic fields above. Tier 2, Stam's stable fluids on a grid: forces, diffusion, self-advection, and projection back to `∇·u ≈ 0` (Gauss–Seidel, over-relaxed); things in it sample the grid. | `MC.FL.Grid` | Library. Tier 3, a GPU fluid for the big boss and portal moments, isn't built. |
| Tiling motifs | Cut material from one edge and put it back on another, so the area is kept and the edges fit. **Avión** (arrows turned about the square's corners), **Hueso** (the bone, neighbours at right angles), **Pajarita** (a curved pinwheel: every triangle edge an S), **Pétalo** (arcs carried across). Tiles over any range, with variation and breakup layers. | `MC.TILE` | Library: stage signatures (the notes' order is Avión, Hueso, Pajarita, Pétalo), portal interiors, the rift's endless backdrop. The spec checks each keeps its area and covers the plane exactly once. |
| Performance | Screen-space error and projected size, sub-pixel triangles, LOD levels, cluster refinement, cost-aware priority `E·I/C`, frustum (and hierarchical) culling, Hi-Z occlusion, backface and normal-cone culling, hysteresis, LOD morphing, dynamic resolution, EMA, frame budget, fill rate, overdraw, the draw-call model, mip level, streaming priority, memory residency and value-per-byte eviction, physics and animation rates, sleep energy, a particle budget, adaptive emission, temporal coherence, the PID governor, what to give up first, Amdahl, the roofline, Little's law, jank, percentiles, and the runtime complexity manager's `Q_i = f(SSE, A, V, O, G, C, B)` | `MC.PF` | **In the 3D renderer:** screen-space error with hysteresis and a crossfade, frustum culling, the build budget, the EMA timing and jank, the PID governor, what to give up first, dynamic resolution (with Amdahl), the particle budget, and the adaptive re-cut rate (`08rf_r3d_budget.js`). **Tool:** `tools/perf3d.mjs`. **In the game:** the 2D adaptive quality in `10_boot.js` is a coarse governor of the same kind. Library: the rest (cluster hierarchies, Hi-Z, cones and streaming wait for real meshes). |

### Corrections kept from the notes

- **Binet.** `F_n = ⌊φⁿ/√5⌋` is wrong at every odd n (at n = 1 it gives 0). The exact form is `(φⁿ − ψⁿ)/√5`, and
  rounding `φⁿ/√5` to the nearest integer works because `|ψ| < 1`.
- **"Nanite."** It's Unreal's own technology. What's here is the same idea from the published ideas (clusters, error
  in pixels, refine where it shows), not Nanite.
- **Resolution and Amdahl.** `s_new = s·√(T_t / T_g)` assumes all of the frame's time scales with pixels. The 3D
  renderer applies it to the 3D's own share of the frame only.
- **Grid flow.** On a grid where velocity and pressure share cells, projection takes out most of the divergence, not
  all of it (about 93% in 30 over-relaxed sweeps). The spec checks for at least 90%.
