  // ───────────────────────── v68: the math core, part two (the engine's mathematics) ─────────────────────────
  // The owner's second set of notes (2026-09-28, docs/MATH-TOOLKIT.md) is the engine layer under the first:
  //   the vector foundation (Pythagoras, dot, cross, projection, reflection) · transforms (rotation matrices and
  //   quaternions: Euler → quaternion → matrix → transform) · planes and normals (and portal frames) · collision (the
  //   quadratic and its discriminant, swept spheres, ray–plane, closest point, SAT, GJK and the Minkowski difference)
  //   · motion (the power rule, easing, springs, the damped oscillator, impulses, a fixed step) · curves (Bézier,
  //   Catmull–Rom, curvature, SLERP) · signed distance fields · Poisson-disk sampling and fBm · constraints (rank, the
  //   pseudoinverse, the null space, Lagrange) · the golden geometry (Fibonacci, φ, the golden spiral) · light
  //   (Lambert, the inverse square, Beer–Lambert, Fresnel) · Fourier · the ∇ field language and Navier–Stokes-style
  //   flow · tiling motifs · and the performance equations the 3D renderer's runtime complexity manager runs on
  //   (08rf_r3d_budget.js).
  // Pure, like part one (01d_mathcore.js), and added to the same MC. Vectors are arrays ([x, y] or [x, y, z]);
  // matrices are arrays of rows; quaternions are [w, x, y, z].
  Object.assign(MC, (() => {
    const TAU_ = Math.PI * 2, sq = x => x * x;
    // ── 1. the vector foundation. Pythagoras is the length of a vector in any number of dimensions.
    const V = {
      add: (a, b) => a.map((x, i) => x + b[i]),
      sub: (a, b) => a.map((x, i) => x - b[i]),
      scale: (a, k) => a.map(x => x * k),
      dot: (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
      cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
      len: a => Math.hypot(...a),
      dist: (a, b) => Math.hypot(...a.map((x, i) => x - b[i])),
      norm: a => { const L = Math.hypot(...a); return L > 1e-12 ? a.map(x => x / L) : a.map(() => 0); },
      proj: (a, b) => V.scale(b, V.dot(a, b) / V.dot(b, b)),   // a's part along b
      reject: (a, b) => V.sub(a, V.proj(a, b)),   // and its part across b
      reflect: (v, n) => V.sub(v, V.scale(n, 2 * V.dot(v, n))),   // r = v − 2(v·n)n, n a unit normal
      angle: (a, b) => Math.acos(clamp(V.dot(a, b) / (V.len(a) * V.len(b) || 1), -1, 1)),   // cos θ = a·b / |a||b|
      lerp: (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
      // drag to aim: the direction from Morty M to the finger P, and a strength v = k|d| (capped)
      aim: (M, P, k, vmax = Infinity) => { const d = V.sub(P, M), L = V.len(d); return { dir: V.norm(d), speed: Math.min(vmax, k * L), length: L }; }
    };
    // ── 2. transforms. A rotation matrix keeps lengths, angles and handedness (RᵀR = I, det R = 1); a quaternion is the
    // same rotation without gimbal lock, and is what orientation is kept in; a transform is position · rotation · scale.
    const M3 = {
      I: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      mul: (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])),
      T: A => [0, 1, 2].map(i => [A[0][i], A[1][i], A[2][i]]),
      det: A => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]),
      apply: (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]),
      rx: a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; },
      ry: a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; },
      rz: a => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; },
      euler: (x, y, z) => M3.mul(M3.rz(z), M3.mul(M3.ry(y), M3.rx(x))),   // turned about x, then y, then z
      isRotation: (A, e = 1e-9) => { const P = M3.mul(M3.T(A), A); return P.every((r, i) => r.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < e)) && Math.abs(M3.det(A) - 1) < e; },
      // an orientation derived, never faked: the frame whose z looks along fwd, x to its right, y up (Gram–Schmidt)
      look: (fwd, up = [0, 1, 0]) => { const z = V.norm(fwd); let x = V.cross(up, z); if (V.len(x) < 1e-9) x = V.cross([1, 0, 0], z); x = V.norm(x); const y = V.cross(z, x); return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]; }
    };
    const Qt = {
      axis: (ax, a) => { const n = V.norm(ax), s = Math.sin(a / 2); return [Math.cos(a / 2), n[0] * s, n[1] * s, n[2] * s]; },
      mul: ([aw, ax, ay, az], [bw, bx, by, bz]) => [aw * bw - ax * bx - ay * by - az * bz, aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw],
      conj: q => [q[0], -q[1], -q[2], -q[3]],
      norm: q => { const L = Math.hypot(...q); return q.map(x => x / L); },
      euler: (x, y, z) => Qt.mul(Qt.axis([0, 0, 1], z), Qt.mul(Qt.axis([0, 1, 0], y), Qt.axis([1, 0, 0], x))),   // the same order as M3.euler
      rotate: (q, v) => Qt.mul(Qt.mul(q, [0, v[0], v[1], v[2]]), Qt.conj(q)).slice(1),
      matrix: ([w, x, y, z]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]],
      fromMatrix: m => {   // (Shepperd's method: the largest of w, x, y, z first, so no division by a small number)
        const t = m[0][0] + m[1][1] + m[2][2];
        if (t > 0) { const s = Math.sqrt(t + 1) * 2; return [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]; }
        if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; return [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]; }
        if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; return [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s]; }
        const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; return [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
      },
      // SLERP: the shortest way round at a steady angular speed (cos θ = q₀·q₁)
      slerp: (a, b, t) => {
        let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
        if (d > 0.9995) return Qt.norm(a.map((x, i) => x + (b[i] - x) * t));
        const th = Math.acos(d), s = Math.sin(th), k0 = Math.sin((1 - t) * th) / s, k1 = Math.sin(t * th) / s;
        return a.map((x, i) => x * k0 + b[i] * k1);
      },
      angle: (a, b) => 2 * Math.acos(clamp(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]), 0, 1)),
      // the shortest rotation taking direction a onto direction b (a skull turned to face its own velocity)
      between: (a, b) => {
        a = V.norm(a); b = V.norm(b); const d = V.dot(a, b);
        if (d < -0.999999) { let ax = V.cross([1, 0, 0], a); if (V.len(ax) < 1e-6) ax = V.cross([0, 1, 0], a); return Qt.axis(ax, Math.PI); }
        const c = V.cross(a, b); return Qt.norm([1 + d, c[0], c[1], c[2]]);
      }
    };
    // a transform: M = T·R·S as a 4 × 4 (homogeneous coordinates); every instance of a mesh needs only this
    const trs = (t, q, s = [1, 1, 1]) => { const R = Qt.matrix(q); return [[R[0][0] * s[0], R[0][1] * s[1], R[0][2] * s[2], t[0]], [R[1][0] * s[0], R[1][1] * s[1], R[1][2] * s[2], t[1]], [R[2][0] * s[0], R[2][1] * s[1], R[2][2] * s[2], t[2]], [0, 0, 0, 1]]; };
    const applyM4 = (M, v) => [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] + M[i][3]);
    // ── 3. planes and normals: n·r + d = 0. A surface isn't just a shape: it faces somewhere.
    const PL = {
      make: (n, p0) => { const u = V.norm(n); return { n: u, d: -V.dot(u, p0) }; },
      fromPoints: (a, b, c) => PL.make(V.cross(V.sub(b, a), V.sub(c, a)), a),
      dist: (P, r) => V.dot(P.n, r) + P.d,   // signed: + on the side the normal points to
      distABCD: (a, b, c, d, [x, y, z]) => (a * x + b * y + c * z - d) / Math.sqrt(a * a + b * b + c * c),   // the notes' form, ax + by + cz = d
      project: (P, r) => V.sub(r, V.scale(P.n, PL.dist(P, r))),
      // the ray o + t·dir meets the plane at t = ((p₀ − o)·n) / (dir·n); null if it runs along it or away behind
      ray: (o, dir, P) => { const den = V.dot(dir, P.n); if (Math.abs(den) < 1e-12) return null; const t = -(V.dot(P.n, o) + P.d) / den; return t >= 0 ? t : null; },
      // a velocity against a surface: its normal part (into the surface) and its tangential part (along it)
      split: (v, n) => { const k = V.dot(v, n), vn = V.scale(n, k), vt = V.sub(v, vn); return { vn, vt, normal: k, tangent: V.len(vt) }; },
      // head-on (the normal part is the bigger: BONK) or glancing (the tangential: SKID), and the angle off the normal
      impact: (v, n) => { const s = PL.split(v, n); return { ...s, kind: Math.abs(s.normal) >= s.tangent ? "bonk" : "skid", angle: Math.atan2(s.tangent, Math.abs(s.normal)) }; },
      entering: (v, n) => V.dot(v, n) < 0,   // moving into the face the normal points out of
      between: (n1, n2) => Math.acos(clamp(Math.abs(V.dot(n1, n2)) / (V.len(n1) * V.len(n2)), 0, 1)),   // 0 parallel, π/2 perpendicular
      // an orthonormal frame on a surface: tangent, bitangent, normal (a portal's own coordinates)
      frame: (o, n, hint = [0, 1, 0]) => { const N = V.norm(n); let t = V.reject(hint, N); if (V.len(t) < 1e-9) t = V.reject([1, 0, 0], N); t = V.norm(t); return { o, n: N, t, b: V.cross(N, t) }; },
      toLocal: (F, p) => { const d = V.sub(p, F.o); return [V.dot(d, F.t), V.dot(d, F.b), V.dot(d, F.n)]; },
      // through portal A and out of portal B: a state carried from A's frame into B's, not teleported. In through A's
      // face means out of B's face, so the normal coordinate turns over and, to stay a rotation (det +1) rather than
      // a mirror, the tangent does too: a half-turn about the bitangent.
      portal: (A, B, p, v) => {
        const L = PL.toLocal(A, p), lv = [V.dot(v, A.t), V.dot(v, A.b), V.dot(v, A.n)], out = l => V.add(V.add(V.scale(B.t, -l[0]), V.scale(B.b, l[1])), V.scale(B.n, -l[2]));
        return { p: V.add(B.o, out(L)), v: out(lv) };
      }
    };
    // ── 4. collision
    // the quadratic ax² + bx + c = 0 and its discriminant Δ = b² − 4ac: Δ < 0 misses, Δ = 0 grazes, Δ > 0 crosses
    function quadratic(a, b, c) {
      if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? { disc: NaN, roots: [], kind: "none" } : { disc: Infinity, roots: [-c / b], kind: "cross" };
      const D = b * b - 4 * a * c, e = 1e-12 * Math.max(1, b * b, Math.abs(4 * a * c));
      if (D < -e) return { disc: D, roots: [], kind: "miss" };
      if (Math.abs(D) <= e) return { disc: D, roots: [-b / (2 * a)], kind: "graze" };
      const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D)), r = [q / a, c / q].sort((x, y) => x - y);   // (the stable form: no cancellation)
      return { disc: D, roots: r, kind: "cross" };
    }
    const CO = {
      quadratic,
      // continuous collision: the first time t ∈ [0, 1] a point moving p + v·t comes within r of c. Checking only
      // where it is each frame lets a fast skull tunnel through; this solves |p + vt − c|² = r² between the frames.
      sweep: (p, v, c, r) => {
        const m = V.sub(p, c); if (V.dot(m, m) <= r * r) return 0;
        const s = quadratic(V.dot(v, v), 2 * V.dot(v, m), V.dot(m, m) - r * r); const t = s.roots.find(x => x >= 0 && x <= 1);
        return t == null ? null : t;
      },
      // the point on segment A→B nearest P: t = (P − A)·(B − A) / |B − A|², clamped to [0, 1]
      closest: (P, A, B) => { const AB = V.sub(B, A), L2 = V.dot(AB, AB), t = L2 > 0 ? clamp(V.dot(V.sub(P, A), AB) / L2, 0, 1) : 0, C = V.add(A, V.scale(AB, t)); return { t, C, d: V.dist(P, C) }; },
      centroid: P => P.reduce((s, p) => V.add(s, p), P[0].map(() => 0)).map(x => x / P.length),
      support: (P, d) => P.reduce((b, p) => (V.dot(p, d) > V.dot(b, d) ? p : b), P[0]),
      minkowski: (A, B) => A.flatMap(a => B.map(b => V.sub(a, b))),   // A ⊖ B: they touch exactly when its hull holds the origin
      // SAT (two convex polygons, 2D): they overlap unless some edge's normal separates their shadows; when they
      // overlap, the axis and depth of the smallest push apart
      sat: (A, B) => {
        let best = Infinity, axis = null;
        for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length], n = V.norm([b[1] - a[1], a[0] - b[0]]), pa = A.map(p => V.dot(p, n)), pb = B.map(p => V.dot(p, n));
          const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
          if (o <= 0) return { hit: false, gap: -o, axis: n };
          if (o < best) { best = o; axis = n; }
        }
        if (V.dot(V.sub(CO.centroid(B), CO.centroid(A)), axis) < 0) axis = V.scale(axis, -1);
        return { hit: true, depth: best, axis };
      },
      // GJK (2D): walk a simplex of the Minkowski difference toward the origin; if it can't get past, they're apart
      gjk: (A, B, maxIt = 40) => {
        const sup = d => V.sub(CO.support(A, d), CO.support(B, V.scale(d, -1))), perp = (u, toward) => { const p = [-u[1], u[0]]; return V.dot(p, toward) < 0 ? V.scale(p, -1) : p; };
        let d = V.sub(CO.centroid(A), CO.centroid(B)); if (V.dot(d, d) < 1e-18) d = [1, 0];
        let S = [sup(d)]; d = V.scale(S[0], -1);
        for (let it = 0; it < maxIt; it++) {
          if (V.dot(d, d) < 1e-18) return true;
          const a = sup(d); if (V.dot(a, d) < 0) return false;
          S.push(a); const ao = V.scale(a, -1);
          if (S.length === 2) {
            const ab = V.sub(S[0], a);
            if (V.dot(ab, ao) > 0) { d = perp(ab, ao); if (V.dot(d, ao) === 0) return true; } else { S = [a]; d = ao; }
          } else {
            const b = S[1], c = S[0], ab = V.sub(b, a), ac = V.sub(c, a), abP = perp(ab, V.scale(ac, -1)), acP = perp(ac, V.scale(ab, -1));
            if (V.dot(abP, ao) > 0) { S = [b, a]; d = abP; } else if (V.dot(acP, ao) > 0) { S = [c, a]; d = acP; } else return true;
          }
        }
        return true;
      }
    };
    // ── 5. motion. The power rule gives rates for free: d/dt tⁿ = n·tⁿ⁻¹, so position → velocity → acceleration.
    const MO = {
      poly: (c, t) => c.reduceRight((s, a) => s * t + a, 0),   // c₀ + c₁t + c₂t² + …
      polyD: c => c.slice(1).map((a, i) => a * (i + 1)),   // its derivative, by the power rule term by term
      ease: n => t => Math.pow(clamp(t, 0, 1), n),   // tⁿ: n > 1 slow then fast; n < 1 fast then slow
      easeD: n => t => n * Math.pow(clamp(t, 0, 1), n - 1),   // how fast it's going (R(t) = R·tⁿ opens a portal; R′ is its speed)
      lerp: (a, b, t) => a + (b - a) * t,
      invLerp: (a, b, x) => (x - a) / (b - a),
      remap: (a, b, c, d, x) => c + (d - c) * (x - a) / (b - a),
      smoothstep: t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); },   // 3t² − 2t³: S′ = 0 at both ends
      smootherstep: t => { t = clamp(t, 0, 1); return t * t * t * (t * (6 * t - 15) + 10); },   // 6t⁵ − 15t⁴ + 10t³: S′ = S″ = 0 at both ends
      spring: (x, v, k, c) => -k * x - c * v,   // F = −kx − cv
      springStep: (s, target, k, c, dt, m = 1) => { s.v += (-k * (s.x - target) - c * s.v) / m * dt; s.x += s.v * dt; return s; },   // (semi-implicit Euler: stable at game steps)
      // the damped oscillator x″ + 2ζωx′ + ω²x = 0, solved: ζ < 1 bounces, ζ = 1 settles fastest, ζ > 1 creeps
      damped: (zeta, w, x0, v0, t) => {
        if (Math.abs(zeta - 1) < 1e-9) return (x0 + (v0 + w * x0) * t) * Math.exp(-w * t);
        if (zeta < 1) { const wd = w * Math.sqrt(1 - zeta * zeta); return Math.exp(-zeta * w * t) * (x0 * Math.cos(wd * t) + (v0 + zeta * w * x0) / wd * Math.sin(wd * t)); }
        const s = Math.sqrt(zeta * zeta - 1), r1 = -w * (zeta - s), r2 = -w * (zeta + s), A = (v0 - r2 * x0) / (r1 - r2);
        return A * Math.exp(r1 * t) + (x0 - A) * Math.exp(r2 * t);
      },
      // an impact along normal n: j = −(1 + e)(v_rel·n) / (1/m₁ + 1/m₂); e is how much bounce survives
      impulse: (vrel, n, e, m1, m2) => -(1 + e) * V.dot(vrel, n) / (1 / m1 + 1 / m2),
      // the two velocities after it, with Coulomb friction along the surface (at most μ·j)
      collide: (v1, v2, n, e, m1, m2, mu = 0) => {
        const vr = V.sub(v1, v2), j = MO.impulse(vr, n, e, m1, m2); let J = V.scale(n, j);
        const vt = V.sub(vr, V.scale(n, V.dot(vr, n))), L = V.len(vt);
        if (mu > 0 && L > 1e-12) { const t = V.scale(vt, 1 / L), jt = clamp(-L / (1 / m1 + 1 / m2), -mu * Math.abs(j), mu * Math.abs(j)); J = V.add(J, V.scale(t, jt)); }
        return { j, v1: V.add(v1, V.scale(J, 1 / m1)), v2: V.sub(v2, V.scale(J, 1 / m2)) };
      },
      // a fixed step with an accumulator (the game has run on one since v44: SIM_STEP in 10_boot.js)
      fixedStep: h => ({ h, acc: 0, advance(dt, step) { this.acc += dt; let n = 0; while (this.acc >= this.h - 1e-12) { step(this.h); this.acc -= this.h; n++; } return n; }, alpha() { return this.acc / this.h; } })
    };
    // ── 6. curves: art-directed paths (a physics trajectory is generated; these are drawn)
    const CU = {
      bezier: (P0, P1, P2, P3, t) => { const u = 1 - t; return P0.map((_, i) => u * u * u * P0[i] + 3 * u * u * t * P1[i] + 3 * u * t * t * P2[i] + t * t * t * P3[i]); },
      bezierD: (P0, P1, P2, P3, t) => { const u = 1 - t; return P0.map((_, i) => 3 * u * u * (P1[i] - P0[i]) + 6 * u * t * (P2[i] - P1[i]) + 3 * t * t * (P3[i] - P2[i])); },
      bezierDD: (P0, P1, P2, P3, t) => P0.map((_, i) => 6 * (1 - t) * (P2[i] - 2 * P1[i] + P0[i]) + 6 * t * (P3[i] - 2 * P2[i] + P1[i])),
      // Catmull–Rom: through its middle two points, with the outer two setting the tangents
      catmull: (P0, P1, P2, P3, t) => P0.map((_, i) => 0.5 * (2 * P1[i] + (P2[i] - P0[i]) * t + (2 * P0[i] - 5 * P1[i] + 4 * P2[i] - P3[i]) * t * t + (3 * P1[i] - P0[i] - 3 * P2[i] + P3[i]) * t * t * t)),
      catmullPath: (pts, u) => { const n = pts.length - 1, k = Math.min(n - 1, Math.floor(clamp(u, 0, 1) * n)), f = clamp(u, 0, 1) * n - k, at = i => pts[clamp(i, 0, n)]; return CU.catmull(at(k - 1), at(k), at(k + 1), at(k + 2), f); },
      // curvature κ = |r′ × r″| / |r′|³ (1 / the radius of the circle that fits there)
      curvature: (d1, d2) => { const a = d1.length === 2 ? [d1[0], d1[1], 0] : d1, b = d2.length === 2 ? [d2[0], d2[1], 0] : d2, L = V.len(a); return L < 1e-12 ? 0 : V.len(V.cross(a, b)) / (L * L * L); },
      curvatureOf: (f, t, h = 1e-3) => { const a = f(t - h), b = f(t), c = f(t + h); return CU.curvature(a.map((x, i) => (c[i] - x) / (2 * h)), a.map((x, i) => (c[i] - 2 * b[i] + x) / (h * h))); },
      // the sharpest turn along a path: a generated path with a spike here gets thrown out
      maxCurvature: (f, n = 200, t0 = 0, t1 = 1) => { let m = 0; for (let i = 1; i < n; i++) m = Math.max(m, CU.curvatureOf(f, t0 + (t1 - t0) * i / n)); return m; }
    };
    // ── 7. signed distance fields: d < 0 inside, 0 on the surface, > 0 outside; shapes combine by min and max
    const SDF = {
      sphere: (c, r) => p => V.dist(p, c) - r,
      box: (c, b) => p => { const q = p.map((x, i) => Math.abs(x - c[i]) - b[i]); return V.len(q.map(x => Math.max(x, 0))) + Math.min(Math.max(...q), 0); },
      plane: (n, h) => { const u = V.norm(n); return p => V.dot(p, u) - h; },
      capsule: (a, b, r) => p => CO.closest(p, a, b).d - r,
      union: (...fs) => p => Math.min(...fs.map(f => f(p))),
      intersect: (...fs) => p => Math.max(...fs.map(f => f(p))),
      subtract: (f1, f2) => p => Math.max(f1(p), -f2(p)),
      smoothUnion: (f1, f2, k) => p => { const a = f1(p), b = f2(p), h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); },
      normal: (f, p) => V.norm(MC.grad(f, p))   // the surface's normal is the field's gradient (part one's ∇)
    };
    // ── 8. placement and texture: Poisson-disk points (no two nearer than r: random, but never clumped) and fBm
    function poissonDisk(w, h, r, seed = 1, k = 30) {   // Bridson's method, on a grid of cells r/√2 across (one point a cell at most)
      const rnd = mulberry32(seed), cs = r / Math.SQRT2, gw = Math.ceil(w / cs), gh = Math.ceil(h / cs), grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
      const put = p => { pts.push(p); active.push(pts.length - 1); grid[Math.floor(p[1] / cs) * gw + Math.floor(p[0] / cs)] = pts.length - 1; };
      const fits = p => {
        if (p[0] < 0 || p[1] < 0 || p[0] >= w || p[1] >= h) return false;
        const gx = Math.floor(p[0] / cs), gy = Math.floor(p[1] / cs);
        for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2); j++) for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) { const q = grid[j * gw + i]; if (q >= 0 && sq(pts[q][0] - p[0]) + sq(pts[q][1] - p[1]) < r * r) return false; }
        return true;
      };
      put([rnd() * w, rnd() * h]);
      while (active.length) {
        const ai = Math.floor(rnd() * active.length), c = pts[active[ai]]; let found = false;
        for (let t = 0; t < k && !found; t++) { const a = rnd() * TAU_, d = r * (1 + rnd()), p = [c[0] + d * Math.cos(a), c[1] + d * Math.sin(a)]; if (fits(p)) { put(p); found = true; } }
        if (!found) active.splice(ai, 1);
      }
      return pts;
    }
    // value noise, −1 … 1, the same for the same seed; and fBm f(x) = Σ aⁱ N(bⁱx): detail at every scale
    const hash2 = (i, j, seed) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 * 2 - 1; };
    function noise(x, y, seed = 1) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = MO.smootherstep(fx), v = MO.smootherstep(fy), a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
    function fbm(x, y, { octaves = 5, lacunarity = 2, gain = 0.5, seed = 1 } = {}) { let s = 0, a = 1, f = 1; for (let i = 0; i < octaves; i++) { s += a * noise(x * f, y * f, seed + i * 17); a *= gain; f *= lacunarity; } return s; }
    // ── 9. constraints: rank, the pseudoinverse, the null space and Lagrange. Every transformation keeps some degrees of
    // freedom and throws others away (a camera throws away depth); the null space is what it throws away.
    const LA = {
      I: n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
      T: A => A[0].map((_, j) => A.map(r => r[j])),
      mul: (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0))),
      sub: (A, B) => A.map((r, i) => r.map((x, j) => x - B[i][j])),
      vec: (A, x) => A.map(r => r.reduce((s, a, k) => s + a * x[k], 0)),
      rank: (A, eps = 1e-9) => {   // Gaussian elimination with partial pivoting: the number of pivots
        const M = A.map(r => r.slice()), m = M.length, n = M[0].length, scale = Math.max(1e-300, ...M.flat().map(Math.abs)); let r = 0;
        for (let c = 0; c < n && r < m; c++) {
          let p = r; for (let i = r + 1; i < m; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
          if (Math.abs(M[p][c]) <= eps * scale) continue;
          [M[r], M[p]] = [M[p], M[r]];
          for (let i = r + 1; i < m; i++) { const f = M[i][c] / M[r][c]; for (let j = c; j < n; j++) M[i][j] -= f * M[r][j]; }
          r++;
        }
        return r;
      },
      // the Moore–Penrose pseudoinverse A⁺, by Greville's column-at-a-time recursion (exact for any rank)
      pinv: (A, eps = 1e-10) => {
        const n = A[0].length, col = k => A.map(r => r[k]), dot = V.dot;
        let a = col(0), aa = dot(a, a), P = [aa > eps ? a.map(x => x / aa) : a.map(() => 0)];
        for (let k = 1; k < n; k++) {
          a = col(k); const d = P.map(r => dot(r, a)), c = a.map((x, i) => x - d.reduce((s, dj, j) => s + A[i][j] * dj, 0)), cc = dot(c, c);
          const b = cc > eps * Math.max(1, dot(a, a)) ? c.map(x => x / cc) : P[0].map((_, i) => d.reduce((s, dj, j) => s + dj * P[j][i], 0) / (1 + dot(d, d)));
          P = P.map((r, j) => r.map((x, i) => x - d[j] * b[i])); P.push(b);
        }
        return P;
      },
      nullProjector: A => LA.sub(LA.I(A[0].length), LA.mul(LA.pinv(A), A)),   // N = I − A⁺A: A·N = 0
      nullity: A => A[0].length - LA.rank(A),   // rank + nullity = n (the dimensions going in)
      leastSquares: (A, b) => LA.vec(LA.pinv(A), b),   // x = A⁺b: the best fit, and the smallest such x
      // Lagrange: the point nearest p on the constraint Ax = b (∇f = λ∇g for f = |x − p|²): x = p − A⁺(Ap − b)
      lagrange: (p, A, b) => V.sub(p, LA.vec(LA.pinv(A), V.sub(LA.vec(A, p), b))),
      // move by dx, but only in the directions that don't disturb Ax (the secondary motion that keeps the primary one)
      nullStep: (x, dx, A) => V.add(x, LA.vec(LA.nullProjector(A), dx)),
      jacobian: (Fn, x, h = 1e-5) => { const cols = x.map((_, j) => { const a = x.slice(), b = x.slice(); a[j] += h; b[j] -= h; const A = Fn(a), B = Fn(b); return A.map((v, i) => (v - B[i]) / (2 * h)); }); return cols[0].map((_, i) => cols.map(c => c[i])); }
    };
    // ── 10. the golden geometry: Fibonacci for discrete growth, φ for proportion, the golden angle (part one) for
    // distribution, the golden spiral for continuous flow. The maths sets the relationships; art and play set the values.
    const PHI = (1 + Math.sqrt(5)) / 2, PSI = (1 - Math.sqrt(5)) / 2;
    const GG = {
      PHI, PSI,
      fib: n => { let a = 0, b = 1; for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; } return a; },   // F₀ = 0, F₁ = 1
      binet: n => (Math.pow(PHI, n) - Math.pow(PSI, n)) / Math.sqrt(5),   // exact: F_n = (φⁿ − ψⁿ)/√5
      nearest: n => Math.round(Math.pow(PHI, n) / Math.sqrt(5)),   // works because |ψ| < 1 (the floor form fails at every odd n)
      // the golden spiral, r = a·φ^(2θ/π): φ times wider every quarter turn (a logarithmic spiral)
      spiral: (theta, a = 1) => { const r = a * Math.pow(PHI, 2 * theta / Math.PI); return [r * Math.cos(theta), r * Math.sin(theta)]; },
      // the Fibonacci squares that approximate it: n squares, each laid against the last rectangle's long side
      squares: n => {
        const S = []; let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
        for (let i = 1; i <= n; i++) {
          const s = GG.fib(i); let q;
          if (i === 1) q = [0, 0]; else switch (i % 4) { case 2: q = [x1, y0]; break; case 3: q = [x1 - s, y1]; break; case 0: q = [x0 - s, y1 - s]; break; default: q = [x0, y0 - s]; }
          S.push({ x: q[0], y: q[1], s }); x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0] + s); y1 = Math.max(y1, q[1] + s);
        }
        return { squares: S, w: x1 - x0, h: y1 - y0 };
      },
      split: L => [L / PHI, L / (PHI * PHI)],   // a length cut in the golden ratio (the parts sum to L)
      ladder: (n, a = 1) => Array.from({ length: n }, (_, i) => a * Math.pow(PHI, i)),   // 1 : φ : φ² …
      scaffold: (i, base, step) => base + step * (GG.fib(i + 2) - 1)   // a growth scaffold: each rise a Fibonacci number of steps (then tuned by play)
    };
    // ── 11. light
    const LI = {
      lambert: (n, l) => Math.max(0, V.dot(V.norm(n), V.norm(l))),   // I ∝ max(0, n·l)
      inverseSquare: (I0, r) => I0 / (r * r),
      beer: (I0, sigma, d) => I0 * Math.exp(-sigma * d),   // through fog, smoke, water, a portal's haze
      schlick: (R0, cos) => R0 + (1 - R0) * Math.pow(1 - clamp(cos, 0, 1), 5),   // Fresnel: more mirror at a grazing angle
      r0: (n1, n2) => sq((n1 - n2) / (n1 + n2))
    };
    // ── 12. Fourier: any repeating motion as a sum of frequencies (the DFT, and the FFT that makes it cheap)
    const FO = {
      dft: x => { const n = x.length, re = new Array(n).fill(0), im = new Array(n).fill(0); for (let k = 0; k < n; k++) for (let t = 0; t < n; t++) { const a = -TAU_ * k * t / n; re[k] += x[t] * Math.cos(a); im[k] += x[t] * Math.sin(a); } return { re, im }; },
      idft: ({ re, im }) => { const n = re.length, x = new Array(n).fill(0); for (let t = 0; t < n; t++) for (let k = 0; k < n; k++) { const a = TAU_ * k * t / n; x[t] += re[k] * Math.cos(a) - im[k] * Math.sin(a); } return x.map(v => v / n); },
      fft: x => {   // radix 2, n a power of two
        const n = x.length, re = x.slice(), im = new Array(n).fill(0);
        for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
        for (let len = 2; len <= n; len <<= 1) { const a = -TAU_ / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
        return { re, im };
      },
      amplitude: ({ re, im }) => re.map((r, k) => Math.hypot(r, im[k])),
      series: (terms, w, t) => terms.reduce((s, [k, a, b]) => s + a * Math.cos(k * w * t) - b * Math.sin(k * w * t), 0)   // Σ cₙ e^{inωt}, real part; terms [n, re cₙ, im cₙ]
    };
    // ── 13. the field language: ∇ asks how something is changing here. Gradient: where it rises (attraction). Divergence:
    // whether it spreads (explosion) or gathers (implosion). Curl: whether it turns (vortex). Define the field, and let
    // everything in it respond. (Part one has grad, div and the 2D curl; the 3D curl and the identities are here.)
    const d3 = (F, p, i, j, h) => { const a = p.slice(), b = p.slice(); a[j] += h; b[j] -= h; return (F(a)[i] - F(b)[i]) / (2 * h); };
    const curl3 = (F, p, h = 1e-3) => [d3(F, p, 2, 1, h) - d3(F, p, 1, 2, h), d3(F, p, 0, 2, h) - d3(F, p, 2, 0, h), d3(F, p, 1, 0, h) - d3(F, p, 0, 1, h)];
    const grad3 = (phi, p, h = 1e-3) => p.map((_, i) => { const a = p.slice(), b = p.slice(); a[i] += h; b[i] -= h; return (phi(a) - phi(b)) / (2 * h); });
    const div3 = (F, p, h = 1e-3) => d3(F, p, 0, 0, h) + d3(F, p, 1, 1, h) + d3(F, p, 2, 2, h);
    const FL = {
      curl3, grad3, div3,
      // tier 1, analytic fields (p → velocity, 2D): cheap, and each with a known character
      uniform: w => () => w.slice(),   // wind: no divergence, no curl
      source: (c, q, core = 0.05) => ([x, y]) => { const dx = x - c[0], dy = y - c[1], k = q / (TAU_ * (dx * dx + dy * dy + core * core)); return [k * dx, k * dy]; },   // q > 0 blasts out (∇·F > 0); q < 0 drains in
      vortex: (c, gamma, core = 0.05) => ([x, y]) => { const dx = x - c[0], dy = y - c[1], k = gamma / (TAU_ * (dx * dx + dy * dy + core * core)); return [-k * dy, k * dx]; },   // pure turning: ∇·F = 0, ∇×F ≠ 0
      potential: phi => p => MC.grad(phi, p).map(x => -x),   // F = −∇φ: can attract or repel, can never swirl (∇×∇φ = 0)
      stream: psi => p => { const g = MC.grad(psi, p); return [g[1], -g[0]]; },   // F = (∂ψ/∂y, −∂ψ/∂x): can swirl, can never bunch up (∇·F = 0)
      turbulence: (scale = 1, amp = 1, seed = 3) => FL.stream(([x, y]) => amp * fbm(x * scale, y * scale, { octaves: 3, seed }) / scale),   // curl noise
      sum: (...fs) => (p, t) => fs.reduce((s, f) => V.add(s, f(p, t)), [0, 0]),
      probe: (F, p) => ({ div: MC.div(F, p), curl: MC.curl2(F, p), speed: V.len(F(p)) }),
      // a = g + F(p, t): a body carried by gravity and a field (RK4). For what flows round Morty; his own throw stays
      // a plain parabola until the owner rules otherwise.
      path: (p0, v0, g, F, dt, n) => {
        const acc = (p, t) => V.add(g, F(p, t)), out = [p0.slice()]; let p = p0.slice(), v = v0.slice(), t = 0;
        for (let i = 0; i < n; i++) {
          const k1v = acc(p, t), k1p = v, k2v = acc(V.add(p, V.scale(k1p, dt / 2)), t + dt / 2), k2p = V.add(v, V.scale(k1v, dt / 2)), k3v = acc(V.add(p, V.scale(k2p, dt / 2)), t + dt / 2), k3p = V.add(v, V.scale(k2v, dt / 2)), k4v = acc(V.add(p, V.scale(k3p, dt)), t + dt), k4p = V.add(v, V.scale(k3v, dt));
          p = p.map((x, j) => x + dt / 6 * (k1p[j] + 2 * k2p[j] + 2 * k3p[j] + k4p[j])); v = v.map((x, j) => x + dt / 6 * (k1v[j] + 2 * k2v[j] + 2 * k3v[j] + k4v[j])); t += dt; out.push(p.slice());
        }
        return out;
      },
      // a boss's death as one field changing in time: it blasts out (∇·F ≫ 0), starts to turn (|∇×F| rises), turns
      // inward into the portal (∇·F < 0 with ∇×F ≠ 0), and collapses (F → 0). T: the times each phase ends.
      death: (c, { q = 6, gamma = 8, core = 0.25, T = [0.35, 0.8, 1.6, 2.1] } = {}) => {
        const src = FL.source(c, q, core), sink = FL.source(c, -q * 0.6, core), vx = FL.vortex(c, gamma, core), ss = MO.smoothstep;
        const phase = t => (t < T[0] ? "expand" : t < T[1] ? "vortex" : t < T[2] ? "converge" : t < T[3] ? "collapse" : "closed");
        const F = (p, t) => {
          const out = t < T[0] ? 1 - ss(t / T[0]) * 0.7 : Math.max(0, 0.3 * (1 - ss((t - T[0]) / (T[1] - T[0])))), swirl = ss((t - T[0] * 0.5) / (T[1] - T[0] * 0.5)) * (t < T[2] ? 1 : 1 - ss((t - T[2]) / (T[3] - T[2])));
          const inw = ss((t - T[1] * 0.9) / (T[2] - T[1] * 0.9)) * (t < T[2] ? 1 : 1 - ss((t - T[2]) / (T[3] - T[2])));
          const a = src(p), b = sink(p), v = vx(p); return [a[0] * out + b[0] * inw + v[0] * swirl, a[1] * out + b[1] * inw + v[1] * swirl];
        };
        return { phase, F };
      },
      // tier 2: a grid of velocities (Stam's stable fluids: add forces, diffuse, carry the flow along itself, and
      // project it back to ∇·u = 0 so nothing is made or lost). Things in it sample the grid. Tier 3, a fluid on the
      // GPU for the big boss and portal moments, isn't built yet.
      Grid: (n, { nu = 0, iters = 30 } = {}) => {
        const N = n, S = (N + 2) * (N + 2), IX = (i, j) => i + (N + 2) * j, u = new Float64Array(S), v = new Float64Array(S), u0 = new Float64Array(S), v0 = new Float64Array(S), p = new Float64Array(S), dv = new Float64Array(S);
        const bnd = (b, x) => {
          for (let i = 1; i <= N; i++) { x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)]; x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)]; x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]; x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)]; }
          x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]); x[IX(0, N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]); x[IX(N + 1, 0)] = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]); x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
        };
        const solve = (b, x, x0, a, c, w = 1) => { for (let k = 0; k < iters; k++) { for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) x[IX(i, j)] += w * ((x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c - x[IX(i, j)]); bnd(b, x); } };   // (Gauss–Seidel; over-relaxed for the pressure)
        const advect = (b, d, d0, U, Vv, dt) => {
          const d0t = dt * N;
          for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
            const x = clamp(i - d0t * U[IX(i, j)], 0.5, N + 0.5), y = clamp(j - d0t * Vv[IX(i, j)], 0.5, N + 0.5), i0 = Math.floor(x), j0 = Math.floor(y), s1 = x - i0, t1 = y - j0;
            d[IX(i, j)] = (1 - s1) * ((1 - t1) * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) + s1 * ((1 - t1) * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]);
          }
          bnd(b, d);
        };
        const G = {
          N, u, v, IX,
          divergence: () => { let s = 0; for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) s += Math.abs((u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)]) * 0.5 * N); return s / (N * N); },
          project: () => {
            const h = 1 / N;
            for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { dv[IX(i, j)] = -0.5 * h * (u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)]); p[IX(i, j)] = 0; }
            bnd(0, dv); bnd(0, p); solve(0, p, dv, 1, 4, 1.8);
            for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { u[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) / h; v[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) / h; }
            bnd(1, u); bnd(2, v); return G;
          },
          // a field laid onto the grid (x, y in 0 … 1)
          fill: F => { for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { const f = F([(i - 0.5) / N, (j - 0.5) / N]); u[IX(i, j)] = f[0]; v[IX(i, j)] = f[1]; } bnd(1, u); bnd(2, v); return G; },
          force: (x, y, fx, fy, r = 0.1) => { for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) { const w = Math.exp(-(sq((i - 0.5) / N - x) + sq((j - 0.5) / N - y)) / (r * r)); u[IX(i, j)] += fx * w; v[IX(i, j)] += fy * w; } return G; },
          step: dt => {
            if (nu > 0) { u0.set(u); v0.set(v); const a = dt * nu * N * N; solve(1, u, u0, a, 1 + 4 * a); solve(2, v, v0, a, 1 + 4 * a); }
            G.project(); u0.set(u); v0.set(v); advect(1, u, u0, u0, v0, dt); advect(2, v, v0, u0, v0, dt); return G.project();
          },
          sample: (x, y) => {   // bilinear, x and y in 0 … 1
            const gx = clamp(x * N + 0.5, 0.5, N + 0.5), gy = clamp(y * N + 0.5, 0.5, N + 0.5), i0 = Math.floor(gx), j0 = Math.floor(gy), s = gx - i0, t = gy - j0, at = (A, i, j) => A[IX(i, j)];
            const L = A => (1 - s) * ((1 - t) * at(A, i0, j0) + t * at(A, i0, j0 + 1)) + s * ((1 - t) * at(A, i0 + 1, j0) + t * at(A, i0 + 1, j0 + 1));
            return [L(u), L(v)];
          }
        };
        return G;
      }
    };
    // ── 14. tiling motifs: cut material from one edge and put it back on another, by a translation or a turn, so the
    // area is kept and the edges still fit. A strange shape then tiles the plane like a plain square. Four, after the
    // Alhambra's: Avión (arrows turning about the square's corners), Hueso (the bone: bumps and dents, neighbours at
    // right angles), Pajarita (a curved pinwheel: each triangle's edge an S), Pétalo (a scale: each arc carried across).
    // Base layer: the tile. Variation layer: tone, opacity and inset per tile (never the outline, or it stops fitting).
    // Breakup layer: an fBm mask over the whole surface. Hero pieces go on top by hand.
    const edge = (P, Q, prof, n = 16) => { const d = V.sub(Q, P), out = [d[1], -d[0]], pts = []; for (let i = 0; i < n; i++) { const s = i / n, f = prof(s); pts.push([P[0] + d[0] * s + out[0] * f, P[1] + d[1] * s + out[1] * f]); } return pts; };   // (out: to the right of P→Q, outside a CCW outline)
    const rotAbout = (c, a) => p => { const x = p[0] - c[0], y = p[1] - c[1], co = Math.cos(a), si = Math.sin(a); return [c[0] + x * co - y * si, c[1] + x * si + y * co]; };
    const trap = (h, w, k) => s => { const m = Math.abs(s - 0.5); return m <= w ? h : m >= w + k ? 0 : h * (w + k - m) / k; };
    const SQ3 = Math.sqrt(3) / 2;
    const MOTIFS = {
      avion: (() => {   // AB bumps out in an arrowhead; AD is AB turned 90° about A (so it dents in); the same about C for CD and CB
        const A = [0, 0], B = [1, 0], C = [1, 1], D = [0, 1], tooth = s => (s < 0.25 ? 0 : s < 0.62 ? 0.3 * (s - 0.25) / 0.37 : s < 0.75 ? 0.3 * (0.75 - s) / 0.13 : 0);
        const ab = edge(A, B, tooth), cd = edge(C, D, tooth), cb = cd.map(rotAbout(C, Math.PI / 2)).slice(1).reverse(), da = ab.map(rotAbout(A, Math.PI / 2)).slice(1).reverse();
        // its neighbours are it turned about those corners, so the cells go round in a pinwheel: cell (i, j) is turned
        // 0, 90, 180 or 270° as (i, j) mod 2 is (0, 0), (1, 0), (1, 1) or (0, 1)
        const turn = (i, j) => [[0, 3], [1, 2]][((i % 2) + 2) % 2][((j % 2) + 2) % 2];
        return { base: "square", area: 1, poly: [...ab, B, ...cb, ...cd, D, ...da], place: (i, j) => ({ x: i, y: j, rot: turn(i, j) * Math.PI / 2 }) };
      })(),
      hueso: (() => {   // the bone: its ends bump out, its sides dent in by the same trapezoid; each neighbour is turned 90°
        const P = [[0, 0], [1, 0], [1, 1], [0, 1]], dent = trap(-0.14, 0.14, 0.1), bump = trap(0.14, 0.14, 0.1);
        return { base: "square", area: 1, poly: [...edge(P[0], P[1], dent), ...edge(P[1], P[2], bump), ...edge(P[2], P[3], dent), ...edge(P[3], P[0], bump)], place: (i, j) => ({ x: i, y: j, rot: ((i + j) % 2 + 2) % 2 ? Math.PI / 2 : 0 }) };
      })(),
      pajarita: (() => {   // each edge an S (turned half a turn about its middle, it's itself), so the down triangles are the up ones turned
        const S = s => 0.16 * Math.sin(TAU_ * s), P = [[0, 0], [1, 0], [0.5, SQ3]];
        return { base: "triangle", area: SQ3 / 2, poly: [...edge(P[0], P[1], S, 24), ...edge(P[1], P[2], S, 24), ...edge(P[2], P[0], S, 24)], place: (i, j, down) => ({ x: i + 0.5 * j, y: j * SQ3, rot: down ? Math.PI : 0, pivot: down ? [0.75, SQ3 / 2] : null }) };
      })(),
      petalo: (() => {   // the bottom and left bulge in arcs; the top and right carry the same arcs across (so they dent)
        const arc = s => 0.2 * Math.sin(Math.PI * s), P = [[0, 0], [1, 0], [1, 1], [0, 1]], bottom = edge(P[0], P[1], arc), left = edge(P[3], P[0], arc);
        const top = bottom.map(([x, y]) => [x, y + 1]).slice(1).reverse(), right = left.map(([x, y]) => [x + 1, y]).slice(1).reverse();
        return { base: "square", area: 1, poly: [...bottom, P[1], ...right, P[2], ...top, P[3], ...left], place: (i, j) => ({ x: i, y: j, rot: 0 }) };
      })()
    };
    const polyArea = P => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
    const inPoly = (pt, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    // the tiles covering cells i0 … i1, j0 … j1: each a placed copy of the motif
    function tiles(name, i0, i1, j0, j1) {
      const M = MOTIFS[name], out = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const down of M.base === "triangle" ? [false, true] : [false]) {
        const pl = M.place(i, j, down), c = pl.pivot || (M.base === "triangle" ? [0.5, SQ3 / 3] : [0.5, 0.5]), R = rotAbout(c, pl.rot);
        out.push({ i, j, down, poly: M.poly.map(p => { const q = R(p); return [q[0] + pl.x, q[1] + pl.y]; }) });
      }
      return out;
    }
    // the layers over them: tone, opacity and inset per tile from the seed, and the breakup mask from fBm at its middle
    const layers = (T, seed = 1) => { const rnd = mulberry32(seed); return T.map(t => { const c = CO.centroid(t.poly); return { tone: 0.85 + rnd() * 0.3, opacity: 0.6 + rnd() * 0.4, inset: 0.55 + rnd() * 0.25, breakup: 0.5 + 0.5 * fbm(c[0] * 0.7, c[1] * 0.7, { octaves: 4, seed }) }; }); };
    const TILE = { MOTIFS, SIGNATURE: ["avion", "hueso", "pajarita", "petalo"], tiles, layers, polyArea, inPoly };
    // ── 15. performance: the equations the 3D renderer's runtime complexity manager runs on (08rf_r3d_budget.js).
    // Each piece asks, each frame: how much am I worth on this one?
    const PF = {
      // screen-space error: a world error e at distance d is E = eH / (2d·tan(fov/2)) pixels (= e·F/d, F the focal length in pixels)
      sse: (e, H, d, fovY) => e * H / (2 * d * Math.tan(fovY / 2)),
      ssePx: (e, Fpx, d) => e * Fpx / d,
      areaPx: R => Math.PI * R * R,   // (R: the projected radius, the same formula with the bounding radius)
      triPx: (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2,
      subPixel: (a, b, c, min = 0.5) => PF.triPx(a, b, c) < min,   // under half a pixel: it adds nothing
      level: (E, T) => { let k = 0; while (k < T.length && E <= T[k]) k++; return k; },   // T falling: E > T₀ is LOD 0
      // a cluster hierarchy cut: refine where the error still shows (E > T), draw the rest as they are
      refine: (node, errPx, T, out = []) => { if (node.kids && node.kids.length && errPx(node) > T) for (const k of node.kids) PF.refine(k, errPx, T, out); else out.push(node); return out; },
      priority: (E, I, C) => E * I / C,   // the most improvement for the least cost first
      importance: (w, S, M, G, Fc) => w.s * S + w.m * M + w.g * G + w.f * Fc,
      perceptual: (A, G, M, C) => A * G * M * C,
      select: (items, budget) => { const out = []; let spent = 0; for (const it of items.slice().sort((a, b) => PF.priority(b.E, b.I, b.C) - PF.priority(a.E, a.I, a.C))) if (spent + it.C <= budget) { out.push(it); spent += it.C; } return out; },
      // the frustum of the game's pinhole (its centre on the horizon HY, focal length F, in camera space looking down −z):
      // four planes through the eye, and a near one. n·c + d < −r: the whole sphere is outside that plane.
      frustum: (W, H, HY, Fpx, near = 0.05) => [[Fpx, 0, -W / 2], [-Fpx, 0, -W / 2], [0, -Fpx, -HY], [0, Fpx, -(H - HY)]].map(n => ({ n: V.norm(n), d: 0 })).concat([{ n: [0, 0, -1], d: -near }]),
      outside: (planes, c, r) => planes.some(P => V.dot(P.n, c) + P.d < -r),
      // hierarchical: a node out of view takes its children with it, untested
      cull: (node, planes, out = []) => { if (PF.outside(planes, node.c, node.r)) return out; if (node.kids && node.kids.length) for (const k of node.kids) PF.cull(k, planes, out); else out.push(node); return out; },
      // Hi-Z: a pyramid of the farthest depth in each block; a thing is hidden if its nearest depth is behind all of it
      hiZ: (depth, w, h) => { const L = [{ w, h, d: Float32Array.from(depth) }]; while (L[L.length - 1].w > 1 || L[L.length - 1].h > 1) { const P = L[L.length - 1], nw = Math.max(1, Math.ceil(P.w / 2)), nh = Math.max(1, Math.ceil(P.h / 2)), d = new Float32Array(nw * nh); for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let m = -Infinity; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = Math.min(P.w - 1, x * 2 + dx), sy = Math.min(P.h - 1, y * 2 + dy); m = Math.max(m, P.d[sy * P.w + sx]); } d[y * nw + x] = m; } L.push({ w: nw, h: nh, d }); } return L; },
      occluded: (Z, [x0, y0, x1, y1], zNear, eps = 1e-6) => { let k = 0; while (k < Z.length - 1 && Math.max(x1 - x0, y1 - y0) >> k > 4) k++; const P = Z[k], s = 1 << k; let far = -Infinity; for (let y = Math.floor(y0 / s); y <= Math.min(P.h - 1, Math.floor(y1 / s)); y++) for (let x = Math.floor(x0 / s); x <= Math.min(P.w - 1, Math.floor(x1 / s)); x++) far = Math.max(far, P.d[y * P.w + x]); return zNear > far + eps; },
      backface: (n, view) => V.dot(n, view) >= 0,   // view: from the eye to the face
      normalCone: ns => { const a = V.norm(ns.reduce((s, n) => V.add(s, n), [0, 0, 0])); return { axis: a, angle: Math.max(...ns.map(n => V.angle(n, a))) }; },
      // every face in the cluster turned away from the eye (the cone, widened by the cluster's size as seen)
      coneAway: (cone, c, r, eye) => { const v = V.sub(c, eye), d = V.len(v); if (d <= r) return false; return V.angle(v, cone.axis) + cone.angle + Math.asin(r / d) < Math.PI / 2; },
      hysteresis: (on, E, T, D) => (on ? E >= T - D : E > T + D),   // a dead zone [T − Δ, T + Δ]: no flicker at the edge
      morph: (E, lo, hi) => MO.smoothstep((E - lo) / (hi - lo)),   // V = (1 − S)V_low + S·V_high
      dynRes: (s, Tt, Tg, sMin = 0.5) => clamp(s * Math.sqrt(Tt / Tg), sMin, 1),   // pixels cost ∝ s², so s_new = s·√(T_target / T_gpu)
      ema: (avg, x, a = 0.1) => (avg == null ? x : a * x + (1 - a) * avg),
      budget: fps => 1000 / fps,
      frame: (cpu, gpu) => Math.max(cpu, gpu),
      bound: (cpu, gpu) => (cpu >= gpu ? "cpu" : "gpu"),
      fill: (P, O, S, Cf) => P * O * S * Cf,
      overdraw: (fragments, pixels) => fragments / pixels,
      submit: (Nd, Cd, Ni, Ci, other = 0) => Nd * Cd + Ni * Ci + other,   // a hundred draws, or one instanced draw of a hundred
      mip: (dudx, dvdx, dudy, dvdy) => Math.max(0, Math.log2(Math.max(Math.hypot(dudx, dvdx), Math.hypot(dudy, dvdy)))),   // UV change a pixel, in texels
      stream: (A, I, Vis, mem) => A * I * Vis / mem,
      // what stays in memory under a budget: the most value per byte first; eviction takes the least first
      resident: (items, budget) => { const out = []; let m = 0; for (const it of items.slice().sort((a, b) => b.value / b.mem - a.value / a.mem)) if (m + it.mem <= budget) { out.push(it); m += it.mem; } return out; },
      evictOrder: items => items.slice().sort((a, b) => a.value / a.mem - b.value / b.mem),
      hz: (I, fmin, fmax) => fmin + clamp(I, 0, 1) * (fmax - fmin),   // physics, animation: how often, from how much it matters
      distHz: (d, fmax, k, fmin) => clamp(fmax / (1 + k * d * d), fmin, fmax),
      energy: (m, v, Iw, w) => 0.5 * m * V.dot(v, v) + 0.5 * V.dot(w, Iw),   // ½mv² + ½ωᵀIω (Iw: I·ω): below a threshold for long enough, it sleeps
      bones: (A, steps) => steps.find(s => A >= s.minArea).bones,
      // a particle budget shared by importance: nobody gets more than it asked for, and the total never exceeds B
      particles: (req, B) => {
        const out = new Array(req.length).fill(0); let left = B, open = req.map((_, i) => i);
        while (open.length && left > 1e-9) {
          const wsum = open.reduce((s, i) => s + req[i].importance, 0); let used = 0; const next = [];
          for (const i of open) { const share = left * req[i].importance / wsum, give = Math.min(share, req[i].want - out[i]); out[i] += give; used += give; if (out[i] < req[i].want - 1e-9) next.push(i); }
          left -= used; if (next.length === open.length) break; open = next;
        }
        return out.map(Math.floor);
      },
      emission: (want, Q) => want * clamp(Q, 0, 1),
      // likely visibility: what was seen last frame is tested first, what was deeply hidden last
      coherence: items => items.slice().sort((a, b) => (b.seen ? 2 : b.hiddenDeep ? 0 : 1) - (a.seen ? 2 : a.hiddenDeep ? 0 : 1)),
      // a PID governor: e = T_target − T_frame; Q moves by Kp·e + Ki·Σe + Kd·Δe, held to 0 … 1 (and Σe with it)
      // (Σe leaks a little each frame, so a long-gone overload doesn't hold Q down)
      pid: ({ kp = 0.003, ki = 0.0004, kd = 0.002, Q = 1 } = {}) => ({ Q, I: 0, prev: null, update(e) { const d = this.prev == null ? 0 : e - this.prev; this.prev = e; this.I = clamp(this.I * 0.95 + e, -100, 100); this.Q = clamp(this.Q + kp * e + ki * this.I + kd * d, 0, 1); return this.Q; } }),
      // what to give up first: the most saving for the least harm; the protected list never goes
      PROTECT: ["morty", "ring", "collision", "bosses", "near", "lighting", "shadows", "reflections", "particles", "distant"],
      efficiency: (savings, damage) => savings / Math.max(1e-9, damage),
      sacrifice: (opts, keep = 4) => opts.filter(o => PF.PROTECT.indexOf(o.name) < 0 || PF.PROTECT.indexOf(o.name) >= keep).sort((a, b) => PF.efficiency(b.savings, b.damage) - PF.efficiency(a.savings, a.damage)),
      amdahl: (P, S) => 1 / ((1 - P) + P / S),   // speed a part P up S times: the whole goes 1 / ((1 − P) + P/S) faster
      roofline: (peak, bandwidth, ai) => Math.min(peak, bandwidth * ai),   // compute-bound or bandwidth-bound
      little: (lambda, W) => lambda * W,   // L = λW: how many are alive at once (the pool to keep)
      jank: (T, B) => Math.max(0, T - B) / B,
      percentile: (xs, q) => { if (!xs.length) return 0; const s = Array.from(xs).sort((a, b) => a - b), k = clamp(q, 0, 1) * (s.length - 1), i = Math.floor(k); return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (k - i) : s[i]; },
      stats: (xs, B) => { const a = Array.from(xs), n = a.length || 1, m = a.reduce((s, x) => s + x, 0) / n; return { mean: m, median: PF.percentile(a, 0.5), p95: PF.percentile(a, 0.95), p99: PF.percentile(a, 0.99), worst: a.length ? Math.max(...a) : 0, variance: a.reduce((s, x) => s + sq(x - m), 0) / n, jank: a.reduce((s, x) => s + PF.jank(x, B), 0) / n }; },
      // the runtime complexity manager's one number: Q_i = f(SSE, A, V, O, G, C, B). Here: seen (V), not hidden (1 − O),
      // worth it (the strongest of its error, its size on screen and its part in the game), and affordable (B / C)
      rcm: ({ sse, T, A, Aref, V: vis = 1, O = 0, G = 0, C = 1, B = 1 }) => clamp(vis * (1 - O) * clamp(Math.max(G, clamp(sse / T, 0, 1), clamp(A / Aref, 0, 1)), 0, 1) * clamp(B / C, 0, 1), 0, 1)
    };
    return { V, M3, Q: Qt, trs, applyM4, PL, CO, MO, CU, SDF, poissonDisk, noise, fbm, LA, GG, LI, FO, FL, TILE, PF };
  })());
