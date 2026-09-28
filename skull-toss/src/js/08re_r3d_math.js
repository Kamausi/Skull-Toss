  // ───────────────────────── v68 3D: the math core at work (01d_mathcore.js) ─────────────────────────
  // Deformation primitives on the models, and the portal as a field:
  //   · the ring, knocked, twists (T_s: slices turned by s·x, volume kept) while it wobbles;
  //   · Morty, squashed on a contact, twists with the squash (squash ∘ twist), so a BONK wrings him like rubber;
  //   · the post bends (a bend of curvature k along its length) as the ring it holds shakes;
  //   · the portal (its lensing stays the 2D drawing's: it bends the scene behind it) carries a parametric rose, its petal
  //     edges drawn in light, opening as it opens, turning at the speed its own field's
  //     circulation gives it (Stokes: the curl's flux through the disc, taken round the rim), with golden-angle
  //     motes carried in by the field (pull = negative divergence, swirl = curl). Its brightness is the field's
  //     energy through the disc (a Simpson integral of the radial profile).
  // Deform a model: f works in the root's own space; each geometry keeps its rest positions, so a deformation never
  // accumulates, and f = null puts it back. A geometry shared by parts posed differently (a chain's links) is left.
  const R3D_M = new THREE.Matrix4(), R3D_MI = new THREE.Matrix4(), R3D_V = new THREE.Vector3();
  function r3dDeform(root, f) {
    root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), seen = new Map();
    root.traverse(o => { if (!o.isMesh || !o.geometry) return; const g = o.geometry, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); const had = seen.get(g); if (had && !had.m.equals(m)) had.shared = true; else if (!had) seen.set(g, { m, shared: false }); });
    for (const [g, S] of seen) {
      if (S.shared) continue;
      const P = g.attributes.position;
      if (!f) { if (g.userData.bent) { P.array.set(g.userData.rest); P.needsUpdate = true; g.userData.bent = false; } continue; }
      if (!g.userData.rest) g.userData.rest = Float32Array.from(P.array);
      const rest = g.userData.rest, a = P.array; R3D_M.copy(S.m); R3D_MI.copy(S.m).invert();
      for (let i = 0; i < rest.length; i += 3) {
        R3D_V.set(rest[i], rest[i + 1], rest[i + 2]).applyMatrix4(R3D_M);
        const q = f([R3D_V.x, R3D_V.y, R3D_V.z]); R3D_V.set(q[0], q[1], q[2]).applyMatrix4(R3D_MI);
        a[i] = R3D_V.x; a[i + 1] = R3D_V.y; a[i + 2] = R3D_V.z;
      }
      P.needsUpdate = true; g.userData.bent = true;
    }
  }
  // the ring's twist while it wobbles (ring.wobble is 1 on a hit and dies away)
  function r3dRingTwist(M, t) {
    const w = ring.wobble || 0, s = w > 0.02 ? 0.55 * w * Math.sin(t * 38) : 0;
    r3dDeform(M, Math.abs(s) > 0.01 ? MC.D.twist(s) : null);
  }
  // Morty's twist with his squash (along < 1 squashed, > 1 stretched)
  function r3dSkullTwist(spin, along) {
    const s = clamp((1 - along) * 1.6, -0.9, 0.9);
    r3dDeform(spin, Math.abs(s) > 0.02 ? MC.D.twist(s) : null);
  }
  // the post's bend: along its length (y, −½ … ½ in the shaft's own units), curving sideways
  function r3dPostBend(shaft, t) {
    const w = ring.wobble || 0, k = w > 0.02 ? 0.9 * w * Math.sin(t * 24) : 0;
    if (Math.abs(k) < 0.01) { r3dDeform(shaft, null); return; }
    const B = MC.D.bend(k);
    r3dDeform(shaft, ([x, y, z]) => { const q = B([y + 0.5, -x, z]); return [-q[1], q[0] - 0.5, q[2]]; });
  }
  // ── the portal: a rose of light turning in its own field, and golden-angle motes drawn in
  const R3D_PORTAL = { pull: 0.5, swirl: 1.6, core: 0.12, motes: 89 };   // (89: a Fibonacci count, so the golden angle fills the disc evenly)
  function r3dPortalModel() {
    if (R3D.cache.portal) return R3D.cache.portal;
    // the rose drawn as its petal edges (the curves at t = 1 and t = 0.6 along the whole winding): lines of light over
    // the dark of the portal, not a filled surface that would wash it out
    const g = new THREE.Group(), pts = [];
    for (const tt of [1, 0.6]) for (let i = 0; i < 2400; i++) { const th = MC.ROSE.from + (MC.ROSE.to - MC.ROSE.from) * i / 2399, p = MC.rosePoint(th, tt); pts.push(p[0], p[1], p[2]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const petals = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc9a8ff, transparent: true, opacity: 0.5, depthWrite: false }));
    const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf2ecff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    const P = MC.phyllotaxis(R3D_PORTAL.motes, 1 / Math.sqrt(R3D_PORTAL.motes)); motes.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(P.length * 3), 3));
    g.add(petals, motes); Object.assign(g.userData, { petals, motes, seeds: P, age: P.map((_, i) => i / P.length) });
    // the field's circulation round the rim (Stokes: = the flux of its curl through the disc), and its energy
    const F = MC.portalField(R3D_PORTAL.pull, R3D_PORTAL.swirl, R3D_PORTAL.core);
    g.userData.spin = MC.circulation(F, [0, 0], 1) / TAU;   // (turns per second)
    g.userData.energy = MC.simpson(r => { const v = F([r, 0]); return Math.hypot(v[0], v[1]) * r; }, 0, 1) * TAU;
    return (R3D.cache.portal = g);
  }
  // drawn at the portal ring's centre p (screen), r its radius in pixels, k how open it is (0 … 1)
  function r3dPortal(p, r, k, t) {
    if (!r3dOn() || k <= 0.02) return false;
    const M = r3dPortalModel(), U = M.userData, F = MC.portalField(R3D_PORTAL.pull, R3D_PORTAL.swirl, R3D_PORTAL.core);
    const pos = U.motes.geometry.attributes.position, n = U.seeds.length;
    for (let i = 0; i < n; i++) {   // each mote rides the field in from the rim, and is born again at the rim when it reaches the heart
      U.age[i] = (U.age[i] + 0.004 + 0.003 * (i % 3)) % 1;
      const [sx, sy] = U.seeds[i], a0 = Math.atan2(sy, sx), rr = (1 - U.age[i]) * 0.95 + 0.05, v = F([rr, 0]), ang = a0 + U.age[i] * 6 + Math.atan2(v[1], -v[0]) * 0.2;
      pos.setXYZ(i, rr * Math.cos(ang), rr * Math.sin(ang), 0.05 * Math.sin(i + t));
    }
    pos.needsUpdate = true;
    U.petals.rotation.z = -t * U.spin * TAU; U.motes.rotation.z = -t * U.spin * TAU * 0.5;
    U.petals.material.opacity = (0.15 + 0.35 * k) * clamp(U.energy / 4, 0.4, 1);
    M.rotation.set(0, 0, 0); M.scale.set(k, k, k * 0.6);
    r3dPlace(M, p.x, p.y, r, 1); M.scale.multiplyScalar(0.92);
    return r3dDraw(M, { x: p.x - r * 1.2, y: p.y - r * 1.2, w: r * 2.4, h: r * 2.4 }, 0, 1);   // (at once: its petals and motes move inside it)
  }
