  // ───────────────────────── v68: the math core (the owner's procedural geometry toolkit) ─────────────────────────
  // The owner's notes (2026-09-28, docs/MATH-TOOLKIT.md) set out a mathematical toolkit for Skull Toss: each system is
  // a job, not a decoration. Geometry says WHERE, the temporal systems say WHEN, physics and transforms say HOW, and
  // the analysis layer says whether a thing is any good:
  //   deformations (twist, bend, taper, shear, bulge, wave, ripple, jitter, squash) · substitution curves (Lévy C,
  //   Heighway dragon, twin dragon, terdragon) · the parametric rose · polyrhythms · barycentric (cevian) coordinates
  //   · the golden angle · integer-angle rays and 2π's convergents · Cantor recursion · Monte Carlo · Voronoi ·
  //   complex multiplication · logarithmic response · Dijkstra · conics · spacetime intercepts · eigenvectors and PCA
  //   · integrals · gradient, divergence and curl · Stokes' circulation · spherical trigonometry.
  // Everything here is pure (numbers in, numbers out), deterministic from its seed, and has no hold on the game's
  // state, so it can serve the renderer, the tools and the spec alike. Points are arrays: [x, y] or [x, y, z].
  const MC = (() => {
    const TAU_ = Math.PI * 2, sq = x => x * x;
    // ── deformations: each takes parameters and returns p → p' ([x, y, z]); compose() chains them right to left
    const D = {
      // twist about the x axis: the rotation grows along x (θ(x) = s·x); det J = 1, so volume is kept
      twist: s => ([x, y, z]) => { const a = s * x, c = Math.cos(a), n = Math.sin(a); return [x, y * c - z * n, y * n + z * c]; },
      // bend in the x–y plane round a circle of curvature k (straight at k = 0): x runs along the arc
      bend: k => ([x, y, z]) => { if (Math.abs(k) < 1e-9) return [x, y, z]; const r = 1 / k, a = x * k, c = Math.cos(a), n = Math.sin(a); return [(r - y) * n, r - (r - y) * c, z]; },
      // taper: the cross-section scales linearly along x (1 at x = 0)
      taper: k => ([x, y, z]) => { const f = Math.max(0, 1 + k * x); return [x, y * f, z * f]; },
      // shear: layers slide along x in proportion to y
      shear: k => ([x, y, z]) => [x + k * y, y, z],
      // bulge: swell around a centre c, within radius r, by amt (smoothly to nothing at r)
      bulge: (c, r, amt) => p => { const d = [p[0] - c[0], p[1] - c[1], (p[2] || 0) - (c[2] || 0)], L = Math.hypot(...d); if (L >= r || L < 1e-9) return p; const k = 1 + amt * sq(Math.cos(L / r * Math.PI / 2)); return [c[0] + d[0] * k, c[1] + d[1] * k, (c[2] || 0) + d[2] * k]; },
      // wave: periodic displacement in y travelling along x
      wave: (amp, k, w, t = 0) => ([x, y, z]) => [x, y + amp * Math.sin(k * x - w * t), z],
      // ripple: a radial ring out of an impact at c, decaying with distance and time
      ripple: (c, amp, k, t, decay = 2) => ([x, y, z]) => { const d = Math.hypot(x - c[0], y - c[1]), e = amp * Math.exp(-decay * t) * Math.sin(k * d - 8 * t) / (1 + d * 3); return [x, y, z + e]; },
      // jitter: controlled high-frequency displacement, the same for the same seed and point
      jitter: (amp, seed = 1) => ([x, y, z]) => { const h = v => { const s = Math.sin(v * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s) - 0.5; }; return [x + amp * h(x + y * 3.1 + z * 7.7), y + amp * h(y + z * 5.3 + 1.7), z + amp * h(z + x * 2.9 + 3.3)]; },
      // squash and stretch along x, volume kept (s along, 1/√s across)
      squash: s => ([x, y, z]) => { const q = 1 / Math.sqrt(Math.max(1e-6, s)); return [x * s, y * q, z * q]; },
      compose: (...fs) => p => fs.reduceRight((q, f) => f(q), p),
      // the Jacobian's determinant by central differences (1 means the deformation keeps volume)
      detJ: (f, p, h = 1e-4) => { const J = [0, 1, 2].map(i => { const a = p.slice(), b = p.slice(); a[i] += h; b[i] -= h; const A = f(a), B = f(b); return [0, 1, 2].map(j => (A[j] - B[j]) / (2 * h)); }); return J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]); },
      // deform a flat position array (x, y, z, x, y, z, …) from a rest copy into out
      apply: (f, rest, out) => { for (let i = 0; i < rest.length; i += 3) { const q = f([rest[i], rest[i + 1], rest[i + 2]]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; } return out; }
    };
    // ── substitution curves: a word of F, +, − rewritten n times, then walked by a turtle
    function rewrite(axiom, rules, n) { let w = axiom; for (let i = 0; i < n; i++) { let o = ""; for (const ch of w) o += rules[ch] != null ? rules[ch] : ch; w = o; } return w; }
    function turtle(word, turn, step = 1, a0 = 0) { let x = 0, y = 0, a = a0; const pts = [[0, 0]]; for (const ch of word) { if (ch === "F" || ch === "G") { x += step * Math.cos(a); y += step * Math.sin(a); pts.push([x, y]); } else if (ch === "+") a += turn; else if (ch === "-") a -= turn; } return pts; }
    const CURVES = {
      levy: n => turtle(rewrite("F", { F: "+F--F+" }, n), Math.PI / 4, Math.pow(Math.SQRT1_2, n)),   // 2^n pieces, each 1/√2 of the last
      dragon: n => turtle(rewrite("FX", { X: "X+YF+", Y: "-FX-Y" }, n), Math.PI / 2, Math.pow(Math.SQRT1_2, n)),   // 2^n segments
      twin: n => { const A = CURVES.dragon(n), B = A.map(([x, y]) => [-x + A[A.length - 1][0], -y + A[A.length - 1][1]]); return A.concat(B.slice(1)); },   // two dragons, a half-turn apart
      terdragon: n => turtle(rewrite("F", { F: "F+F-F" }, n), TAU_ / 3, Math.pow(1 / Math.sqrt(3), n))   // 3^n pieces, each 1/√3
    };
    const segments = pts => pts.length - 1;
    const similarityDim = (pieces, ratio) => Math.log(pieces) / Math.log(1 / ratio);   // log N / log(1/r): 2 for all four
    // ── the parametric rose: spiral winding × petal waveform × exponential opening (docs/MATH-TOOLKIT.md)
    const ROSE = { petals: 3.6, tau: 8 * Math.PI, from: -5 * Math.PI / 3, to: 24 * Math.PI, open: Math.PI / 2 };
    function rosePoint(theta, t, P = ROSE) {   // t ∈ [0, 1] runs from the flower's heart to its petal edge
      const ph = ((P.petals * theta) % TAU_ + TAU_) % TAU_, phi = P.open * Math.exp(-theta / P.tau);
      const x = 1 - 0.5 * sq(1.25 * sq(1 - ph / Math.PI) - 0.25), r = x * Math.sin(phi) * t, h = x * Math.cos(phi) * t;
      return [r * Math.cos(theta), r * Math.sin(theta), h];
    }
    function roseMesh(nTheta = 360, nT = 8, P = ROSE) {   // positions and triangle indices for the surface
      const pos = [], idx = [];
      for (let i = 0; i <= nTheta; i++) { const th = P.from + (P.to - P.from) * i / nTheta; for (let j = 0; j <= nT; j++) pos.push(...rosePoint(th, j / nT, P)); }
      for (let i = 0; i < nTheta; i++) for (let j = 0; j < nT; j++) { const a = i * (nT + 1) + j, b = a + nT + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      return { pos, idx };
    }
    // ── polyrhythms: a against b in one cycle; they meet gcd(a, b) times and repeat after lcm(a, b) sub-beats
    const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a)), lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
    function poly(a, b) {
      const L = lcm(a, b), hitsA = [], hitsB = [], both = [];
      for (let i = 0; i < L; i++) { const A = i % (L / a) === 0, B = i % (L / b) === 0; if (A) hitsA.push(i / L); if (B) hitsB.push(i / L); if (A && B) both.push(i / L); }
      return { a, b, lcm: L, gcd: gcd(a, b), hitsA, hitsB, both };
    }
    // a rhythm seed: one master cycle, each role on its own count; phase(role, t) is where it is in its beat (0 … 1)
    function rhythmSeed(cycle, counts) { return { cycle, counts, beat: (role, t) => Math.floor((t / cycle) * counts[role]), phase: (role, t) => { const u = (t / cycle) * counts[role]; return u - Math.floor(u); } }; }
    // ── barycentric (cevian) coordinates: P = uA + vB + wC with u + v + w = 1, from the sub-triangles' areas
    const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    function bary(P, A, B, C) { const T = area2(A, B, C); return [area2(P, B, C) / T, area2(A, P, C) / T, area2(A, B, P) / T]; }
    const fromBary = ([u, v, w], A, B, C) => [u * A[0] + v * B[0] + w * C[0], u * A[1] + v * B[1] + w * C[1]];
    const inTriangle = b => b.every(x => x >= -1e-9);
    function baryPath(stops, u) { const n = stops.length - 1, k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k; return stops[k].map((x, i) => x + (stops[k + 1][i] - x) * f); }
    // ── the golden angle (phyllotaxis): r = √i, θ = i·α
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // 137.50776°
    const phyllotaxis = (n, c = 1, rot = 0) => Array.from({ length: n }, (_, i) => { const r = c * Math.sqrt(i + 0.5), a = i * GOLDEN + rot; return [r * Math.cos(a), r * Math.sin(a)]; });
    // ── integer-angle rays: (n, n) in polar; 1/(2π) is irrational, so arms only seem to close at 2π's convergents
    const rays = n => Array.from({ length: n }, (_, i) => [i * Math.cos(i), i * Math.sin(i)]);
    const TWO_PI_APPROX = [[6, 1], [19, 3], [25, 4], [44, 7], [333, 53], [710, 113]];   // the convergents of 2π (355/113 is π's)
    const armOf = (n, q) => ((n % q) + q) % q;   // which of q apparent arms integer n lies on
    // ── Cantor recursion: remove the open middle third of every surviving interval; (2/3)^n of the length survives
    function cantor(n, a = 0, b = 1) { let I = [[a, b]]; for (let k = 0; k < n; k++) I = I.flatMap(([p, q]) => { const d = (q - p) / 3; return [[p, p + d], [q - d, q]]; }); return I; }
    const inCantor = (x, I) => I.some(([p, q]) => x >= p && x <= q);
    // ── Monte Carlo: estimate a probability (or mean) from n seeded samples; se is its standard error
    function monteCarlo(trial, n, seed = 1) { const rnd = mulberry32(seed); let s = 0, s2 = 0; for (let i = 0; i < n; i++) { const v = +trial(rnd, i); s += v; s2 += v * v; } const m = s / n; return { mean: m, se: Math.sqrt(Math.max(0, s2 / n - m * m) / n), n }; }
    // ── Voronoi: each point belongs to its nearest site; cells' areas by sampling
    const nearest = (p, sites) => { let bi = -1, bd = Infinity; sites.forEach((s, i) => { const d = sq(p[0] - s[0]) + sq(p[1] - s[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
    function voronoiAreas(sites, box, n = 20000, seed = 7) { const rnd = mulberry32(seed), c = new Array(sites.length).fill(0), [x0, y0, x1, y1] = box; for (let i = 0; i < n; i++) c[nearest([x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)], sites)]++; const A = (x1 - x0) * (y1 - y0); return c.map(k => k / n * A); }
    // ── complex numbers as [re, im]: one multiplication rotates and scales
    const C_ = { mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], polar: (r, t) => [r * Math.cos(t), r * Math.sin(t)], abs: a => Math.hypot(a[0], a[1]), arg: a => Math.atan2(a[1], a[0]) };
    C_.rotate = (z, t) => C_.mul(z, C_.polar(1, t));
    C_.spiral = (z0, r, t, n) => { const w = C_.polar(r, t), out = [z0]; for (let i = 1; i < n; i++) out.push(C_.mul(out[i - 1], w)); return out; };
    // ── logarithmic response: fast early, flattening late; perceptual loudness; shake from energy
    const logCurve = (n, k = 1) => Math.log(1 + k * n);
    const dbToGain = db => Math.pow(10, db / 20), gainToDb = g => 20 * Math.log10(Math.max(1e-9, g));
    const shakeFrom = (energy, k = 1) => k * Math.log(1 + Math.max(0, energy));
    // ── Dijkstra: least-cost paths on a weighted graph { node: { next: cost } }
    function dijkstra(G, src) {
      const dist = { [src]: 0 }, prev = {}, done = new Set(), Q = [src];
      while (Q.length) { Q.sort((a, b) => dist[a] - dist[b]); const u = Q.shift(); if (done.has(u)) continue; done.add(u);
        for (const [v, w] of Object.entries(G[u] || {})) { const d = dist[u] + w; if (dist[v] == null || d < dist[v]) { dist[v] = d; prev[v] = u; Q.push(v); } } }
      return { dist, path: to => { if (dist[to] == null) return null; const p = [to]; while (p[0] !== src) p.unshift(prev[p[0]]); return p; } };
    }
    // ── conics: the throw's parabola, a target's ellipse, a diverging hyperbola
    const conic = {
      parabolaY: (x, y0, theta, v, g) => y0 + x * Math.tan(theta) - g * x * x / (2 * v * v * sq(Math.cos(theta))),
      apex: (v, theta, g) => sq(v * Math.sin(theta)) / (2 * g),
      range: (v, theta, g) => v * v * Math.sin(2 * theta) / g,
      ellipse: (a, b, t, ph = 0) => [a * Math.cos(t + ph), b * Math.sin(t + ph)],
      hyperbola: (a, b, t) => [a * Math.cosh(t), b * Math.sinh(t)]
    };
    // ── spacetime: events are (x, y, z, t); an intercept is the time two moving things are closest
    function intercept(S, T, t0, t1, n = 200) {
      const d = t => { const a = S(t), b = T(t); return Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)); };
      let bt = t0, bd = Infinity; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, v = d(t); if (v < bd) { bd = v; bt = t; } }
      let lo = Math.max(t0, bt - (t1 - t0) / n), hi = Math.min(t1, bt + (t1 - t0) / n);   // golden-section refine
      for (let k = 0; k < 40; k++) { const m1 = hi - (hi - lo) / 1.618, m2 = lo + (hi - lo) / 1.618; if (d(m1) < d(m2)) hi = m2; else lo = m1; }
      const t = (lo + hi) / 2; return { t, dist: d(t) };
    }
    // ── eigenvectors: a symmetric 2 × 2's, and the principal axis (PCA) of a set of vectors
    function eig2([[a, b], [, d]]) { const tr = a + d, det = a * d - b * b, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc, l2 = tr / 2 - disc; const v = Math.abs(b) > 1e-12 ? [l1 - d, b] : a >= d ? [1, 0] : [0, 1], L = Math.hypot(...v); return { values: [l1, l2], v1: [v[0] / L, v[1] / L] }; }
    function principalAxis(vs) { const n = vs.length, mx = vs.reduce((s, v) => s + v[0], 0) / n, my = vs.reduce((s, v) => s + v[1], 0) / n; let xx = 0, xy = 0, yy = 0; for (const [x, y] of vs) { xx += sq(x - mx); xy += (x - mx) * (y - my); yy += sq(y - my); } return eig2([[xx / n, xy / n], [xy / n, yy / n]]); }
    // ── integrals: Simpson's rule, arc length and a line integral along a sampled path
    function simpson(f, a, b, n = 64) { n += n % 2; const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; }
    function lineIntegral(path, f) { let s = 0; for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], m = a.map((x, k) => (x + b[k]) / 2); s += f(m) * Math.hypot(...b.map((x, k) => x - a[k])); } return s; }
    const arcLength = path => lineIntegral(path, () => 1);
    // ── fields: gradient of a scalar field, divergence and curl of a vector field (central differences)
    const H = 1e-4;
    const grad = (phi, p) => p.map((_, i) => { const a = p.slice(), b = p.slice(); a[i] += H; b[i] -= H; return (phi(a) - phi(b)) / (2 * H); });
    const div = (F, p) => p.reduce((s, _, i) => { const a = p.slice(), b = p.slice(); a[i] += H; b[i] -= H; return s + (F(a)[i] - F(b)[i]) / (2 * H); }, 0);
    const curl2 = (F, [x, y]) => (F([x + H, y])[1] - F([x - H, y])[1]) / (2 * H) - (F([x, y + H])[0] - F([x, y - H])[0]) / (2 * H);
    // the portal's field: a pull toward the centre (negative divergence) and a swirl round it (curl)
    const portalField = (pull, swirl, core = 0.2) => ([x, y]) => { const r2 = x * x + y * y + core * core; return [(-pull * x - swirl * y) / r2, (-pull * y + swirl * x) / r2]; };
    // ── Stokes: the circulation round a circle equals the curl's flux through its disc
    function circulation(F, c, r, n = 720) { let s = 0; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU_, p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], t = [-Math.sin(a), Math.cos(a)], f = F(p); s += (f[0] * t[0] + f[1] * t[1]) * r * TAU_ / n; } return s; }
    function curlFlux(F, c, r, n = 120) { let s = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const rr = (i + 0.5) / n * r, a = (j + 0.5) / n * TAU_; s += curl2(F, [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]) * rr * (r / n) * (TAU_ / n); } return s; }
    // ── spherical trigonometry: great circles (the geodesics), angles, excess and area
    const unit = v => { const L = Math.hypot(...v); return v.map(x => x / L); }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    function greatCircle(a, b, t) { a = unit(a); b = unit(b); const w = Math.acos(clamp(dot(a, b), -1, 1)); if (w < 1e-9) return a; const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s; return a.map((x, i) => x * k1 + b[i] * k2); }
    function sphAngle(A, B, C) { const n1 = unit(cross(A, B)), n2 = unit(cross(A, C)); return Math.acos(clamp(dot(n1, n2), -1, 1)); }   // the angle at A
    function sphExcess(A, B, C) { A = unit(A); B = unit(B); C = unit(C); return sphAngle(A, B, C) + sphAngle(B, C, A) + sphAngle(C, A, B) - Math.PI; }
    const sphArea = (A, B, C, R = 1) => R * R * sphExcess(A, B, C);
    return { D, rewrite, turtle, CURVES, segments, similarityDim, ROSE, rosePoint, roseMesh, gcd, lcm, poly, rhythmSeed, bary, fromBary, inTriangle, baryPath,
      GOLDEN, phyllotaxis, rays, TWO_PI_APPROX, armOf, cantor, inCantor, monteCarlo, nearest, voronoiAreas, C: C_, logCurve, dbToGain, gainToDb, shakeFrom,
      dijkstra, conic, intercept, eig2, principalAxis, simpson, lineIntegral, arcLength, grad, div, curl2, portalField, circulation, curlFlux,
      greatCircle, sphAngle, sphExcess, sphArea };
  })();
