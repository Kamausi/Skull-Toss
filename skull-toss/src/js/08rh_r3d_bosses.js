  // ───────────────────────── v69 3D: the sixteen bosses, modelled ─────────────────────────
  // Each boss's parts in its drawing's terms (07d_boss.js, 07f_bosses.js): build once, pose every frame. The drawing
  // still decides where the boss is, which side of the ring it's on, its ropes, beams and ripples, and its death; the
  // model is what stands there.
  const rbEyes = (U, B, look = 0) => { for (const E of U.eyes || []) E.set({ look, shut: B.hurt > 0.3 && !B.dead, dead: B.dead }); };
  const rbSwap = (g, geo) => { for (const c of g.children) if (c.geometry) c.geometry = geo; };   // (an inked part's body and ink share one geometry)
  const rbCache = (U, key, q, make) => { const C = U[key] || (U[key] = new Map()); let g = C.get(q); if (!g) C.set(q, (g = make(q))); return g; };
  const shapeGeo = (draw, depth, sd = 1) => { const b = Math.min(0.03, depth * 0.3), geo = new THREE.ExtrudeGeometry(rbShape(draw, sd), { depth, curveSegments: 10, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2 }); geo.translate(0, 0, -depth / 2); return geo; };
  Object.assign(R3D_BOSSES, {
    // ── the mini-bosses
    batbaron: { body: {
      build(M, U) {
        U.wings = [-1, 1].map(sd => { const pv = rbPivot(M, 0, 0, -0.06); pv.userData.sd = sd;
          rbSlab(pv, s => { s.moveTo(0.2, -0.1); s.quadraticCurveTo(0.7, -0.75, 1.3, -0.55); s.quadraticCurveTo(1.15, -0.25, 1.2, -0.05); s.quadraticCurveTo(0.95, -0.2, 0.85, 0.08); s.quadraticCurveTo(0.6, -0.1, 0.5, 0.15); s.quadraticCurveTo(0.35, 0.0, 0.2, 0.15); }, 0.05, "#3A2A4A", 0, sd);
          for (const [a, b] of [[[0.25, -0.05], [1.25, -0.52]], [[0.25, -0.02], [0.88, 0.06]]]) rbCyl(pv, [a[0] * sd, a[1], 0.03], [b[0] * sd, b[1], 0.03], 0.012, "#2A1E36");   // (the finger bones)
          return pv; });
        rbEll(M, 0, 0, 0.32, 0.38, 0.3, "#4A3A5A");
        for (const sd of [-1, 1]) rbSlab(M, s => s.poly([[0.12, -0.3], [0.28, -0.62], [0.3, -0.25]]), 0.08, "#4A3A5A", 0, sd);
        const fz = x => rbFront(0.32, 0.38, 0.3, x, -0.1);
        U.eyes = [rbEye(M, -0.11, -0.1, 0.09, 0.11, fz(-0.11) - 0.03), rbEye(M, 0.11, -0.1, 0.09, 0.11, fz(0.11) - 0.03)];
        const mono = rbAdd(M, (rbGeo(), RBG.torus), "#2A2A30", 0.11, -0.1, fz(0.11) + 0.02); mono.scale.setScalar(0.13);   // the monocle, on its chain
        rbCyl(M, [0.23, -0.05, fz(0.23) + 0.02], [0.26, 0.2, fz(0.2) + 0.01], 0.008, "#C8A040");
        rbQTube(M, [-0.1, 0.12, fz(0.1)], [0, 0.18, fz(0) + 0.02], [0.1, 0.12, fz(0.1)], 0.018, INK);
        for (const sd of [-1, 1]) rbCyl(M, [sd * 0.045, 0.13, fz(0.05)], [sd * 0.035, 0.22, fz(0.05) + 0.01], 0.02, CREAM, true);
        rbCyl(M, [0, -0.62], [0, -0.38], 0.12, "#1A1A1E"); rbCyl(M, [0, -0.4], [0, -0.365], 0.22, "#1A1A1E");   // the top hat
      },
      pose(U, B, x) { const flap = B.dead ? 1 : wingFlap(bt(B), x.tell); for (const w of U.wings) w.rotation.z = w.userData.sd * (0.25 + flap * 0.35); rbEyes(U, B); }
    } },
    owl: { body: {
      build(M, U) {
        rbEll(M, 0, 0, 0.38, 0.45, 0.34, "#D8CCB0");
        for (let i = 0; i < 4; i++) { const y = 0.02 + i * 0.08; rbTube(M, [-0.22, 0, 0.22].map((xx, k) => [xx, y + (k === 1 ? 0.06 : 0), rbFront(0.38, 0.45, 0.34, xx, y) + 0.005]), 0.01, "#8A806A"); }
        for (const sd of [-1, 1]) rbSlab(M, s => { s.moveTo(0.36, -0.1); s.quadraticCurveTo(0.52, 0.2, 0.3, 0.42); s.quadraticCurveTo(0.3, 0.1, 0.36, -0.1); }, 0.14, "#B8AC90", 0.06, sd);
        const H = U.head = rbPivot(M, 0, -0.42, 0);
        rbEll(H, 0, 0, 0.34, 0.28, 0.3, "#E4DAC4");
        for (const sd of [-1, 1]) rbSlab(H, s => s.poly([[0.18, -0.2], [0.3, -0.42], [0.3, -0.16]]), 0.08, "#E4DAC4", 0, sd);
        U.big = []; U.eyes = [];
        for (const sd of [-1, 1]) {   // the great round eyes (yellow irises), and pie eyes for when he's hurt or beaten
          const z = rbFront(0.34, 0.28, 0.3, sd * 0.14, 0) - 0.02, g = rbPivot(H, sd * 0.14, 0, z);
          rbDisc(g, 0, 0, 0.12, 0.05, "#1A1A10"); const iris = new THREE.Mesh(RBG.circ, rbFlat("#E8D84A")); iris.scale.setScalar(0.06); iris.position.z = 0.03; g.add(iris);
          U.big.push(g); const E = rbEye(H, sd * 0.14, 0, 0.1, 0.1, z); E.g.visible = false; U.eyes.push(E);
        }
        rbCyl(H, [0, 0.08, 0.28], [0, 0.2, 0.36], 0.05, "#C49A42", true);   // the beak
      },
      pose(U, B, x) { U.head.position.y = 0.42 + (x.hoot || 0) * 0.05; const big = !B.dead && B.hurt < 0.3; for (const g of U.big) g.visible = big; for (const E of U.eyes) E.g.visible = !big; rbEyes(U, B); }
    } },
    gator: { body: {
      build(M, U) {
        U.neck = rbCyl(M, [0, 0.2], [0, -1], 0.28, "#4A7A4A"); U.belly = rbEll(M, 0, -0.5, 0.12, 0.42, 0.06, "#8AAA6A", 0.26);
        const H = U.head = rbPivot(M, 0, -1, 0);
        rbEll(H, 0, 0.02, 0.3, 0.12, 0.3, "#4A7A4A");
        rbEll(H, 0, -0.04, 0.46, 0.1, 0.56, "#4A7A4A", 0.2); rbEll(H, 0, -0.14, 0.38, 0.12, 0.46, "#4A7A4A", 0.12);   // the long snout
        for (let i = -3; i <= 3; i++) { const xx = i * 0.11, zz = 0.2 + 0.54 * Math.sqrt(Math.max(0, 1 - (xx / 0.46) ** 2)); rbCyl(H, [xx, -0.1, zz], [xx, 0.0, zz + 0.01], 0.035, CREAM, true); }
        U.eyes = [];
        for (const sd of [-1, 1]) { rbEll(H, sd * 0.16, -0.22, 0.11, 0.1, 0.1, "#4A7A4A", 0.05); U.eyes.push(rbEye(H, sd * 0.16, -0.24, 0.08, 0.09, 0.1)); }
        rbCyl(H, [0, -0.4], [0, -0.36], 0.3, "#D8B87A"); rbCyl(H, [0, -0.52], [0, -0.38], 0.18, "#D8B87A"); rbCyl(H, [0, -0.44], [0, -0.39], 0.185, RED);   // the straw boater
      },
      pose(U, B, x) {
        const top = Math.max(0.1, x.topY || 1); rbLimb(U.neck, [0, 0.2], [0, -top], 0.28);
        U.belly.position.y = top * 0.5; U.belly.scale.set(0.12, top * 0.42, 0.06); U.head.position.y = top;
        U.eyes[0].set({ look: 0.5, shut: B.hurt > 0.3 && !B.dead, dead: B.dead }); U.eyes[1].set({ look: -0.5, shut: B.hurt > 0.3 && !B.dead, dead: B.dead });
      }
    } },
    jester: { body: {
      build(M, U) {
        rbRect(M, -0.45, -0.7, 0.9, 0.7, 0.9, "#A94332");
        for (let i = 0; i < 3; i++) rbSlab(M, s => s.poly([[-0.45 + i * 0.3, -0.7], [-0.3 + i * 0.3, 0], [-0.15 + i * 0.3, -0.7]]), 0.02, CREAM, 0.46, 1, false);
        rbCyl(M, [0.45, -0.35], [0.6, -0.35], 0.03, "#8A8E96");
        const C = U.crank = rbPivot(M, 0.6, -0.35, 0); rbCyl(C, [0, 0], [0, 0.18], 0.025, "#8A8E96"); rbCyl(C, [0, 0.18], [0.1, 0.18], 0.03, INK);
        U.spring = rbPivot(M, 0, -0.7, 0); U.springMesh = null;
        const H = U.head = rbPivot(M, 0, -1.5, 0);
        rbEll(H, 0, -0.2, 0.26, 0.26, 0.26, "#F2E7C9");
        U.eyes = [rbEye(H, -0.1, -0.25, 0.07, 0.09, 0.2), rbEye(H, 0.1, -0.25, 0.07, 0.09, 0.2)];
        rbDot(H, 0, -0.15, 0.05, RED, 0.26);
        rbTube(H, Array.from({ length: 7 }, (_, i) => { const a = 0.2 + (i / 6) * (Math.PI - 0.4); return [Math.cos(a) * 0.14, -0.08 + Math.sin(a) * 0.14, 0.21]; }), 0.014, INK);
        for (const [sd, col] of [[-1, "#356B68"], [1, "#C49A42"]]) { rbSlab(H, s => { s.moveTo(0, -0.42); s.quadraticCurveTo(0.3, -0.62, 0.42, -0.36); s.lineTo(0.1, -0.4); }, 0.16, col, 0, sd); rbDot(H, sd * 0.42, -0.34, 0.05, GOLD); }
      },
      pose(U, B, x) {
        const top = Math.min(-0.9, x.top || -1.5), L = Math.round((-0.7 - top) * 20) / 20;
        const geo = rbCache(U, "coils", L, len => { const pts = []; for (let i = 0; i <= 7 * 24; i++) { const a = (i / 24) * TAU; pts.push(new THREE.Vector3(Math.cos(a) * 0.14, (i / (7 * 24)) * len, Math.sin(a) * 0.14)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 7 * 24, 0.022, 6, false); });
        if (!U.springMesh) U.springMesh = rbAdd(U.spring, geo, "#8A8E96"); else rbSwap(U.springMesh, geo);
        U.head.position.y = -top; U.crank.rotation.x = -B.t * (x.tell ? 18 : 2); rbEyes(U, B);
      }
    } },
    scarecrow: { body: {
      build(M, U) {
        rbCyl(M, [0, 0], [0, -2.7], 0.07, "#6A4A2E");
        const A = U.arms = rbPivot(M, 0, -2.4, 0);
        rbCyl(A, [-1.2, 0], [1.2, 0], 0.07, "#6A4A2E");
        rbSlab(A, s => s.poly([[-0.5, -0.12], [0.5, -0.12], [0.58, 1.0], [-0.58, 1.0]]), 0.36, "#6A5A7A", 0.06);
        rbRect(A, -0.2, 0.2, 0.18, 0.2, 0.02, "#4A3A5A", 0.26); rbRect(A, 0.12, 0.5, 0.2, 0.16, 0.02, "#4A3A5A", 0.26);
        for (const sd of [-1, 1]) rbSlab(A, s => s.poly([[1.2, -0.05], [1.42, 0.08], [1.35, -0.1], [1.45, -0.2], [1.2, -0.12]]), 0.08, GOLD, 0, sd);
        const H = U.head = rbPivot(A, 0, -0.45, 0.04);
        rbEll(H, 0, 0, 0.38, 0.38, 0.34, "#D8B87A");
        U.stitch = rbPivot(H, 0, 0, 0);
        for (const sd of [-1, 1]) for (const r of [-1, 1]) { const b = rbBox(U.stitch, sd * 0.14, -0.05, 0.15, 0.03, 0.02, INK, rbFront(0.38, 0.38, 0.34, sd * 0.14, -0.05)); b.rotation.z = r * 0.7; }
        U.eyes = [rbEye(H, -0.14, -0.05, 0.08, 0.08, 0.3), rbEye(H, 0.14, -0.05, 0.08, 0.08, 0.3)];
        rbTube(H, Array.from({ length: 7 }, (_, i) => { const xx = -0.18 + i * 0.06, yy = 0.15 + (i % 2) * 0.05; return [xx, yy, rbFront(0.38, 0.38, 0.34, xx, yy) + 0.005]; }), 0.012, INK);
        const hat = rbPivot(H, 0, 0, 0); hat.rotation.z = 0.1;
        rbCyl(hat, [0, -0.345], [0, -0.3], 0.55, "#3A2A1E"); rbLathe(hat, [[0.001, -0.75], [0.19, -0.75], [0.28, -0.34], [0.001, -0.34]], "#3A2A1E");
      },
      pose(U, B, x) { const sw = x.sway || 0, soft = B.dead || B.hurt > 0.3; U.arms.rotation.z = -sw * 0.12; U.head.rotation.z = sw * 0.2; U.stitch.visible = !soft; for (const E of U.eyes) E.g.visible = soft; rbEyes(U, B); }
    } },
    cuckoo: {
      house: { build(M) {
        rbSlab(M, s => s.poly([[-1.35, 1.9], [-1.35, -0.6], [0, -1.5], [1.35, -0.6], [1.35, 1.9]]), 0.8, "#6A4A2E");
        for (const sd of [-1, 1]) rbCyl(M, [0, -1.62, 0], [sd * 1.52, -0.52, 0], 0.08, "#4A3020");   // (the roof's eaves)
        rbDisc(M, 0, 0.9, 1.15, 0.12, "#F2E2B8", 0.44);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; rbDot(M, Math.sin(a) * 1.0, 0.9 - Math.cos(a) * 1.0, 0.045, INK, 0.5); }
        rbRect(M, -0.25, -0.95, 0.5, 0.4, 0.1, "#2A1A10", 0.4);
        for (const sd of [-1, 1]) { const l = rbEll(M, sd * 0.9, -0.95, 0.35, 0.12, 0.06, "#8A5A30", 0.42); l.rotation.z = -sd * 0.5; }
      }, pose() {} },
      bird: { build(M, U) {
        rbEll(M, 0, 0, 0.26, 0.2, 0.2, "#E3B64B"); rbEll(M, 0.18, -0.16, 0.15, 0.15, 0.14, "#E3B64B");
        U.beak = rbCyl(M, [0.3, -0.14], [0.48, -0.12], 0.05, "#E8893A", true);
        U.eyes = [rbEye(M, 0.22, -0.2, 0.05, 0.06, 0.1)];
        rbSlab(M, s => s.poly([[-0.24, -0.02], [-0.42, -0.12], [-0.36, 0.04]]), 0.06, "#C49A42");
      }, pose(U, B, x) { rbLimb(U.beak, [0.3, -0.14], [0.48 + (x.tell ? 0.1 : 0), -0.12], 0.05); for (const E of U.eyes) E.set({ look: 1, shut: B.hurt > 0.3 }); } }
    },
    projectionist: { body: {
      build(M, U) {
        for (const sd of [-1, 1]) { rbCyl(M, [sd * 0.22, -1.4], [sd * 0.22, -0.05], 0.1, "#2A2A35"); rbEll(M, sd * 0.24, -0.05, 0.16, 0.07, 0.2, "#111", 0.06); }
        rbLathe(M, [[0.001, -2.8], [0.5, -2.8], [0.46, -1.4], [0.001, -1.4]], "#7A1E1E", 0, 0, 0, 24, 0.6);
        for (let i = 0; i < 4; i++) rbDot(M, 0, -2.6 + i * 0.3, 0.05, GOLD, 0.29);
        for (const sd of [-1, 1]) { rbQTube(M, [sd * 0.48, -2.7], [sd * 0.8, -2.2], [sd * 0.6, -1.7], 0.07, "#7A1E1E"); rbGlove(M, sd * 0.6, -1.65, 0.1, 0.05); }
        rbBox(M, 0, -3.19, 0.84, 0.72, 0.6, "#3A3E46");
        rbCyl(M, [0.4, -3.2, 0.1], [0.6, -3.2, 0.1], 0.14, "#1A1A1E");
        const lens = new THREE.Mesh(RBG.circ, rbFlat("#FFF4D6")); lens.scale.setScalar(0.08); lens.position.set(0.61, 3.2, 0.1); lens.rotation.y = Math.PI / 2; M.add(lens);
        U.reels = [-1, 1].map(sd => { const pv = rbPivot(M, sd * 0.25, -3.78, 0); pv.userData.sd = sd; rbDisc(pv, 0, 0, 0.24, 0.08, "#8A8E96"); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; rbDisc(pv, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.06, 0.09, "#3A3E46", 0.01); } return pv; });
        U.eyes = [rbEye(M, -0.18, -3.25, 0.08, 0.1, 0.31)];
      },
      pose(U, B, x) { for (const r of U.reels) r.rotation.z = -B.t * (x.tell ? 12 : 3) * r.userData.sd; rbEyes(U, B, 1); }
    } },
    // ── the end bosses
    undertaker: { body: {
      build(M, U) {
        for (const sd of [-1, 1]) { rbCyl(M, [sd * 0.28, -1.9], [sd * 0.28, -0.05], 0.12, "#1E1E26"); rbEll(M, sd * 0.3, -0.05, 0.28, 0.1, 0.2, "#111", 0.08); }
        rbSlab(M, s => s.poly([[-0.62, -1.7], [-0.5, -3.5], [0.5, -3.5], [0.62, -1.7], [0.2, -1.95], [-0.2, -1.95]]), 0.55, "#2A2A35");
        rbSlab(M, s => s.poly([[-0.12, -3.5], [0, -2.9], [0.12, -3.5]]), 0.02, "#E4DAC4", 0.3, 1, false);
        rbQTube(M, [-0.5, -3.35], [-0.95, -2.6], [-0.8, -2.0], 0.08, "#2A2A35"); rbGlove(M, -0.8, -1.95, 0.13, 0.05);
        U.arm = rbArm(M, 0.08, "#2A2A35"); U.hand = rbGlove(M, 1.15, -3.0, 0.13, 0.05);
        const H = rbPivot(M, 0, -3.85, 0);
        rbEll(H, 0, 0, 0.3, 0.42, 0.3, "#C8C8B8");
        U.eyes = [rbEye(H, -0.12, -0.1, 0.08, 0.1, 0.24), rbEye(H, 0.12, -0.1, 0.08, 0.1, 0.24)];
        rbSlab(H, s => s.poly([[0, -0.02], [0.12, 0.12], [0, 0.12]]), 0.06, "#B8B8A8", 0.3);
        U.mouth = rbQTube(H, [-0.12, 0.24, 0.24], [0, 0.18, 0.27], [0.12, 0.24, 0.24], 0.014, INK);
        rbCyl(H, [0, -0.39], [0, -0.33], 0.42, "#141418"); rbCyl(H, [0, -0.98], [0, -0.34], 0.28, "#141418"); rbCyl(H, [0, -0.52], [0, -0.43], 0.285, "#A94332");   // Morty's top hat
      },
      pose(U, B, x) { const h = x.heave || 0; U.arm.set([0.5, -3.35], [0.9, -3.3 - h * 0.25], [1.15, -3.0 - h * 0.4]); U.hand.position.set(1.15, 3.0 + h * 0.4, 0.05); rbEyes(U, B); }
    } },
    count: { body: {
      build(M, U) {
        U.cape = rbAdd(M, new THREE.BufferGeometry(), "#1A0A1E", 0, 0, -0.2); U.lining = rbAdd(M, new THREE.BufferGeometry(), "#6A1E2A", 0, 0, -0.06); U.reachMin = 4.3;
        rbSlab(M, s => s.poly([[-0.4, -3.2], [-0.35, -0.4], [0.35, -0.4], [0.4, -3.2]]), 0.45, "#2A2A35");
        rbSlab(M, s => s.poly([[-0.16, -3.2], [0, -2.4], [0.16, -3.2]]), 0.02, CREAM, 0.24, 1, false);
        for (const sd of [-1, 1]) rbSlab(M, s => s.poly([[0, -3.12], [0.22, -3.24], [0.22, -3.0]]), 0.05, RED, 0.27, sd); rbDot(M, 0, -3.12, 0.05, RED, 0.29);   // Morty's bow tie
        const H = rbPivot(M, 0, -3.62, 0);
        rbEll(H, 0, 0, 0.3, 0.38, 0.3, "#B8D0B0"); rbEll(H, 0, -0.2, 0.31, 0.24, 0.31, "#141418", -0.01);
        rbSlab(H, s => s.poly([[-0.1, -0.2], [0, -0.03], [0.1, -0.2]]), 0.04, "#141418", 0.27, 1, false);   // the widow's peak
        for (const sd of [-1, 1]) rbSlab(H, s => s.poly([[0.28, -0.05], [0.45, -0.22], [0.3, 0.08]]), 0.05, "#B8D0B0", 0, sd);
        U.eyes = [rbEye(H, -0.12, 0, 0.08, 0.09, 0.24), rbEye(H, 0.12, 0, 0.08, 0.09, 0.24)];
        rbQTube(H, [-0.14, 0.2, 0.22], [0, 0.28, 0.25], [0.14, 0.2, 0.22], 0.014, INK);
        for (const sd of [-1, 1]) rbCyl(H, [sd * 0.075, 0.22, 0.24], [sd * 0.05, 0.34, 0.25], 0.025, CREAM, true);
      },
      pose(U, B, x) {
        const sp = Math.round((x.spread || 1.2) * 10) / 10;
        rbSwap(U.cape, rbCache(U, "capes", sp, s1 => shapeGeo(s => { s.moveTo(0, -3.4); s.quadraticCurveTo(-s1, -3.0, -s1 * 1.1, -0.2); for (let i = 0; i < 4; i++) s.quadraticCurveTo(-s1 * (0.9 - i * 0.25), -0.5, -s1 * (0.8 - i * 0.25), -0.05); s.lineTo(s1 * 0.2, -0.05); for (let i = 0; i < 4; i++) s.quadraticCurveTo(s1 * (0.35 + i * 0.25), -0.5, s1 * (0.45 + i * 0.25), -0.05); s.quadraticCurveTo(s1, -3.0, 0, -3.4); }, 0.22)));
        rbSwap(U.lining, rbCache(U, "linings", sp, s1 => shapeGeo(s => { s.moveTo(-0.45, -3.1); s.quadraticCurveTo(-s1 * 0.8, -2.2, -s1 * 0.85, -0.4); s.lineTo(s1 * 0.85, -0.4); s.quadraticCurveTo(s1 * 0.8, -2.2, 0.45, -3.1); }, 0.04)));
        rbEyes(U, B);
      }
    } },
    marrowroot: { body: {
      build(M, U) {
        const prof = [[1.3, 0], [0.92, -0.35], [0.78, -1.0], [0.75, -2.0], [0.84, -3.0], [0.8, -3.6], [0.6, -4.2], [0.001, -4.46]], rAt = y => { for (let i = 1; i < prof.length; i++) if (y >= prof[i][1]) { const a = prof[i - 1], b = prof[i], k = (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; } return 0.5; }, SZ = 0.8;
        const fz = (xx, yy) => Math.sqrt(Math.max(0, rAt(yy) ** 2 - xx * xx)) * SZ;
        rbLathe(M, prof, "#D8CCB0", 0, 0, 0, 30, SZ);
        for (let i = 0; i < 6; i++) { const y = -0.8 - i * 0.55; rbTube(M, [-0.6, -0.3, 0, 0.3, 0.6].map(xx => [xx, y + 0.1 * (1 - (xx / 0.6) ** 2), fz(xx, y) + 0.01]), 0.012, "#7A7060"); }
        for (const [sd, y, L] of [[-1, 4.0, 1.4], [1, 4.3, 1.7], [-1, 3.2, 1.1], [1, 3.4, 0.9]]) {
          rbQTube(M, [sd * 0.5, -y], [sd * L * 0.6, -y - 0.5], [sd * L, -y - 0.2], 0.08, "#D8CCB0");
          for (let k = 0; k < 2; k++) rbEll(M, sd * L * (0.5 + k * 0.35), -y + 0.15, 0.05, 0.14, 0.05, "#E4DAC4");
        }
        rbCyl(M, [-0.9, -2.4, 0.5], [-1.6, -1.3, 0.5], 0.04, "#3A2A1E"); rbTube(M, Array.from({ length: 6 }, (_, i) => { const a = Math.PI + (i / 5) * Math.PI; return [-1.62 + Math.cos(a) * 0.12, -1.25 + Math.sin(a) * 0.12, 0.5]; }), 0.04, "#3A2A1E");   // Morty's cane
        U.glow = [];
        for (const sd of [-1, 1]) { const z = fz(sd * 0.3, -3.1); rbEll(M, sd * 0.3, -3.1, 0.17, 0.22, 0.06, "#1A1A10", z - 0.02); const g = new THREE.Mesh(RBG.circ, rbFlat("#AAF060")); g.scale.setScalar(0.07); g.position.set(sd * 0.3, 3.08, z + 0.05); M.add(g); U.glow.push(g); }
        U.mouth = rbSlab(M, s => { s.moveTo(-0.4, -2.4); for (let i = 0; i <= 8; i++) s.lineTo(-0.4 + i * 0.1, -2.4 + (i % 2 ? 0.12 : 0)); s.lineTo(0.4, -2.2); s.quadraticCurveTo(0, -1.9, -0.4, -2.2); }, 0.05, "#1A1A10", fz(0, -2.25) + 0.01, 1, false);
      },
      pose(U, B, x) { const on = !B.dead && B.hurt < 0.3; for (const g of U.glow) g.visible = on; U.mouth.position.y = x.tell ? -0.1 : 0; }
    } },
    madame: { body: {
      build(M, U) {
        const prof = [[0.001, -2.85], [0.9, -2.62], [1.42, -1.7], [1.6, -0.6], [1.62, 0.1], [0.001, 0.1]], SZ = 0.72, rAt = y => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const a = prof[i - 1], b = prof[i], k = (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; } return 1.6; };
        const fz = (xx, yy) => Math.sqrt(Math.max(0, rAt(yy) ** 2 - xx * xx)) * SZ;
        rbLathe(M, prof, "#5A4A2A", 0, 0, 0, 30, SZ);
        for (let i = 0; i < 7; i++) { const xx = -1.3 + i * 0.43, yy = -0.5 - (i % 3) * 0.3, s = rbEll(M, xx, yy, 0.12, 0.06, 0.03, "#3A2A18", fz(xx, yy)); s.rotation.z = -0.4; }
        U.weeds = [];
        for (let i = 0; i < 12; i++) { const xx = -1.1 + i * 0.2, pv = rbPivot(M, xx, -2.6, fz(xx, -2.6)); rbQTube(pv, [0, 0, 0.02], [0, 0.7, fz(xx, -2.0) - fz(xx, -2.6) + 0.04], [-0.1, 1.2 + (i % 3) * 0.2, fz(xx, -1.4) - fz(xx, -2.6) + 0.04], 0.035, "#4A6A3A"); U.weeds.push(pv); }
        U.eyes = [rbEye(M, -0.35, -2.0, 0.17, 0.2, fz(-0.35, -2.0) - 0.06), rbEye(M, 0.35, -2.0, 0.17, 0.2, fz(0.35, -2.0) - 0.06)];
        for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) rbCyl(M, [sd * (0.25 + k * 0.1), -2.18, fz(0.3, -2.18) + 0.03], [sd * (0.25 + k * 0.12), -2.34, fz(0.3, -2.2) + 0.06], 0.012, INK);
        U.mouth = rbEll(M, 0, -1.45, 0.3, 0.14, 0.06, "#8A2A3A", fz(0, -1.45) - 0.01);
        for (const sd of [-1, 1]) { rbRect(M, sd * 1.2 - 0.12, -1.9, 0.24, 0.3, 0.1, "#F2E7C9", fz(sd * 1.2, -1.75) * 0.3 + 0.35); rbRect(M, sd * 1.2 - 0.12, -1.66, 0.24, 0.06, 0.11, INK, fz(sd * 1.2, -1.75) * 0.3 + 0.35); }   // Morty's spats
      },
      pose(U, B, x) { const g = x.gargle || 0; U.mouth.scale.set(0.3 + g * 0.05, 0.14 + (x.spit ? 0.12 : 0) + g * 0.05, 0.06); U.weeds.forEach((w, i) => { w.rotation.z = Math.sin(B.t + i) * 0.06; }); rbEyes(U, B); }
    } },
    ringmaster: { body: {
      build(M, U) {
        for (const sd of [-1, 1]) { rbCyl(M, [sd * 0.3, -1.2], [sd * 0.3, -0.08], 0.14, "#F2E7C9"); rbEll(M, sd * 0.32, -0.05, 0.3, 0.12, 0.22, "#111", 0.08); }
        rbEll(M, 0, -2.1, 0.95, 1.05, 0.75, "#A94332");
        for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const yy = -2.6 + i * 0.35; rbDot(M, sd * 0.25, yy, 0.06, GOLD, rbFront(0.95, 1.05, 0.75, 0.25, yy + 2.1)); }
        for (const sd of [-1, 1]) rbSlab(M, s => s.poly([[0.3, -1.2], [0.9, -0.8], [0.5, -1.4]]), 0.06, "#7E2A22", 0.4, sd);
        rbQTube(M, [0.75, -2.75, 0.2], [0.95, -2.6, 0.3], [1.0, -2.45, 0.3], 0.09, "#A94332");
        const Bt = U.baton = rbPivot(M, 1.0, -2.4, 0.3); rbCyl(Bt, [0, 0.3], [0, -0.9], 0.03, "#1A1A1A"); rbDot(Bt, 0, -1.0, 0.1, GOLD);
        rbGlove(M, 1.0, -2.4, 0.13, 0.36);
        rbQTube(M, [-0.8, -2.5, 0.1], [-1.2, -2.1, 0.2], [-1.05, -1.8, 0.2], 0.09, "#A94332"); rbGlove(M, -1.05, -1.75, 0.13, 0.22);
        const H = rbPivot(M, 0, -3.4, 0);
        rbEll(H, 0, 0, 0.36, 0.36, 0.34, "#E8C8A0");
        U.eyes = [rbEye(H, -0.13, -0.08, 0.08, 0.1, 0.28), rbEye(H, 0.13, -0.08, 0.08, 0.1, 0.28)];
        rbSlab(H, s => { s.moveTo(0, 0.08); s.quadraticCurveTo(-0.35, 0.02, -0.45, -0.1); s.quadraticCurveTo(-0.3, 0.18, 0, 0.14); s.quadraticCurveTo(0.3, 0.18, 0.45, -0.1); s.quadraticCurveTo(0.35, 0.02, 0, 0.08); }, 0.07, "#3A2A1E", 0.33);
        rbCyl(H, [0, -0.34], [0, -0.26], 0.46, "#141418"); rbCyl(H, [0, -0.95], [0, -0.3], 0.3, "#141418"); rbCyl(H, [0, -0.46], [0, -0.37], 0.305, GOLD);
        rbQTube(M, [-0.2, -3.05, 0.3], [0, -2.6, 0.62], [0.2, -3.05, 0.3], 0.008, INK); rbBox(M, 0, -2.62, 0.12, 0.2, 0.06, "#C8CCD4", 0.66);   // Morty's whistle
      },
      pose(U, B, x) { U.baton.rotation.z = -(x.twirl || 0) * TAU * 2; rbEyes(U, B); }
    } },
    clockking: { body: {
      build(M, U) {
        rbSlab(M, s => s.poly([[-0.8, 0], [-0.95, -3.2], [0.95, -3.2], [0.8, 0]]), 0.75, "#6A4A2E");
        rbRect(M, -0.4, -1.8, 0.8, 1.4, 0.04, "#2A1A10", 0.38);
        const P = U.pend = rbPivot(M, 0, -1.75, 0.41); rbCyl(P, [0, 0], [0, 1.0], 0.022, INK); rbDisc(P, 0, 1.05, 0.15, 0.06, GOLD);
        rbDisc(M, 0, -3.9, 0.85, 0.3, "#F2E2B8", 0.05); const rim = rbAdd(M, RBG.torus, "#6A4A2E", 0, -3.9, 0.2); rim.scale.set(0.86, 0.86, 1.4);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; rbDot(M, Math.sin(a) * 0.72, -3.9 - Math.cos(a) * 0.72, 0.035, INK, 0.21); }
        U.eyes = [rbEye(M, -0.28, -4.1, 0.13, 0.15, 0.2), rbEye(M, 0.28, -4.1, 0.13, 0.15, 0.2)];
        U.hands = [-1, 1].map(sd => rbCyl(M, [0, -3.62, 0.24], [sd * 0.4, -3.5, 0.24], 0.04, INK));
        U.gears = Array.from({ length: 5 }, (_, i) => rbGear(M, -0.6 + i * 0.3, -4.85, 6, 0.11, 0.15, 0.08, GOLD, 0.05));
        rbDisc(M, -1.1, -2.2, 0.22, 0.06, "#C8CCD4", 0.3); rbCyl(M, [-1.1, -2.2, 0.34], [-1.1, -2.36, 0.34], 0.012, INK); rbCyl(M, [-1.1, -2.2, 0.34], [-0.98, -2.2, 0.34], 0.012, INK);   // Morty's pocket watch
        rbQTube(M, [-0.9, -2.9, 0.1], [-1.3, -2.6, 0.2], [-1.1, -2.4, 0.25], 0.08, "#6A4A2E");
      },
      pose(U, B, x) {
        U.pend.rotation.z = -Math.sin(B.t * 3) * 0.35; U.gears.forEach((g, i) => { g.rotation.z = -B.t * (i % 2 ? 1 : -1); });
        U.hands.forEach((h, i) => rbLimb(h, [0, -3.62, 0.24], [(i ? 1 : -1) * 0.4, -3.5 - (x.tell ? 0.1 : 0), 0.24], 0.04)); rbEyes(U, B);
      }
    } },
    reaper: { body: {
      build(M, U) {
        const prof = [[0.001, -4.5], [0.35, -4.3], [0.55, -3.8], [0.8, -3.0], [0.95, -2.0], [1.05, -1.0], [1.1, 0], [0.001, 0]], SZ = 0.7;
        const rAt = y => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const a = prof[i - 1], b = prof[i], k = (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; } return 1; };
        rbLathe(M, prof, "#141414", 0, 0, 0, 30, SZ);
        for (let y = -3.5; y < 0; y += 0.3) for (const sd of [-1, 1]) { const xx = sd * (0.72 + y * 0.08), r = rAt(y + 0.08); if (Math.abs(xx) >= r) continue; rbBox(M, xx, y + 0.08, 0.12, 0.16, 0.03, "#3A3A3A", Math.sqrt(r * r - xx * xx) * SZ); }   // the cloak is film stock, sprocket holes and all
        rbEll(M, 0, -3.55, 0.42, 0.5, 0.4, "#0A0A0A");
        rbEll(M, 0, -3.45, 0.26, 0.3, 0.2, "#E4DAC4", 0.24);
        U.glow = [];
        for (const sd of [-1, 1]) { rbEll(M, sd * 0.1, -3.5, 0.07, 0.09, 0.03, INK, 0.42); const g = new THREE.Mesh(RBG.circ, rbFlat("#FF5A3A")); g.scale.setScalar(0.03); g.position.set(sd * 0.1, 3.5, 0.46); M.add(g); U.glow.push(g); }
        rbCyl(M, [0.95, -0.2, 0.45], [0.75, -4.4, 0.45], 0.04, "#2A1E14");
        U.blade = rbSlab(M, s => { s.moveTo(0.75, -4.4); s.quadraticCurveTo(0.0, -4.9, -0.7, -4.2); s.quadraticCurveTo(-0.1, -4.5, 0.72, -4.2); }, 0.04, "#C8CCD4", 0.45);
        const sh = new THREE.Group(); for (const [x0, y0, sx, sy] of [[-1.5, -2.2, 0.36, 0.36], [-1.5, -1.8, 0.22, 0.11]]) { const m = new THREE.Mesh(RBG.sph, rbFlat("#0A0A12", { transparent: true, opacity: 0.55, depthWrite: false })); m.position.set(x0, -y0, 0); m.scale.set(sx, sy, 0.2); sh.add(m); } M.add(sh);   // Morty's shadow, held captive at his side
      },
      pose(U, B, x) { for (const g of U.glow) g.visible = !B.dead; const m = rbMat((x.glint || 0) > 0.2 ? "#FFFFFF" : "#C8CCD4"); for (const c of U.blade.children) if (c !== U.blade.children[0]) c.material = m; }
    } }
  });
  // ── the Crow King: posed from drawCrow's own numbers (R = half a metre: his drawing is in R)
  const CK = 0.5;
  function crowLid(rx, ry, sd, squint, anger) {   // the heavy upper lid: the eye, cut off below a line sloping down to the middle
    const top = -ry, outerY = top + ry * 2 * squint * 0.55, innerY = top + ry * 2 * Math.min(0.92, squint * (1.1 + 0.45 * anger));
    const lineY = x => outerY + (innerY - outerY) * ((sd * rx * 1.2 - x) / (2 * sd * rx * 1.2)), inside = p => p[1] <= lineY(p[0]);
    const E = Array.from({ length: 48 }, (_, i) => [Math.cos((i / 48) * TAU) * rx, Math.sin((i / 48) * TAU) * ry]), out = [];
    for (let i = 0; i < E.length; i++) {   // (Sutherland–Hodgman against the one half-plane)
      const a = E[i], b = E[(i + 1) % E.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const fa = a[1] - lineY(a[0]), fb = b[1] - lineY(b[0]), t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out.length >= 3 ? new THREE.ShapeGeometry(rbShape(s => s.poly(out))) : null;
  }
  Object.assign(R3D_BOSSES, { crow: { body: {
    build(M, U) {
      U.wings = [-1, 1].map(sd => { const pv = rbPivot(M, 0, 0, -0.08); pv.userData.sd = sd;
        rbSlab(pv, s => { s.moveTo(0.6 * CK, -0.2 * CK); s.bezierCurveTo(1.5 * CK, -1.3 * CK, 2.4 * CK, -0.9 * CK, 2.5 * CK, -0.4 * CK); for (let i = 0; i < 4; i++) s.quadraticCurveTo(CK * (2.3 - i * 0.35), -CK * (0.1 - i * 0.02), CK * (2.2 - i * 0.4), CK * (0.2 + i * 0.06)); s.quadraticCurveTo(1.1 * CK, 0.4 * CK, 0.6 * CK, 0.3 * CK); }, 0.06, "#3C3A4C", 0, sd);
        for (let i = 0; i < 3; i++) rbCyl(pv, [0.8 * CK * sd, -0.05 * CK, 0.035], [CK * (1.9 - i * 0.35) * sd, -CK * (0.35 - i * 0.12), 0.035], 0.008, "#8A84A8");
        return pv; });
      U.legs = [-1, 1].map(() => rbArm(M, 0.07 * CK, "#E3B64B"));
      rbEll(M, 0, 0, 0.85 * CK, CK, 0.8 * CK, "#2B2B33"); const sh = rbEll(M, -0.25 * CK, -0.35 * CK, 0.3 * CK, 0.2 * CK, 0.08, "#3A3A46", rbFront(0.85 * CK, CK, 0.8 * CK, -0.25 * CK, -0.35 * CK) - 0.03); sh.rotation.z = 0.5;
      const F0 = (x, y) => rbFront(0.85 * CK, CK, 0.8 * CK, x, y);
      U.face = rbPivot(M, 0, 0, 0); U.eye = [];
      for (const sd of [-1, 1]) {
        const ex = sd * 0.3 * CK, ey = -0.3 * CK, rx = 0.22 * CK, ry = 0.27 * CK, z = F0(ex, ey) - 0.02, g = rbPivot(U.face, ex, ey, z);
        const ball = rbEll(g, 0, 0, rx, ry, rx * 0.5, CREAM), pup = new THREE.Mesh(RBG.pie, rbFlat(INK, { side: THREE.DoubleSide })); g.add(pup);
        const lid = new THREE.Mesh(new THREE.BufferGeometry(), rbFlat("#2B2B33", { side: THREE.DoubleSide })); lid.position.z = rx * 0.5 + 0.006; g.add(lid);
        const brow = new THREE.Mesh(new THREE.BufferGeometry(), rbFlat("#4C4860", { side: THREE.DoubleSide })); brow.position.z = rx * 0.5 + 0.01; g.add(brow);
        const X = new THREE.Group(); for (const s of [-1, 1]) { const b = new THREE.Mesh(RBG.box, rbFlat(INK)); b.scale.set(rx * 1.2, 0.012, 0.01); b.rotation.z = s * 0.7; X.add(b); } X.position.z = rx * 0.5 + 0.006; g.add(X);
        U.eye.push({ sd, rx, ry, g, ball, pup, lid, brow, X });
      }
      const bz = F0(0, 0.05 * CK);
      U.mouth = rbEll(M, 0, 0.1 * CK, 0.2 * CK, 0.14 * CK, 0.05, "#1C0B10", bz - 0.02);
      U.upper = rbSlab(M, s => { const hw = 0.22 * CK, top = -0.15 * CK, seam = 0.13 * CK; s.moveTo(0, top); s.quadraticCurveTo(hw * 0.7, top + (seam - top) * 0.35, hw, seam); s.lineTo(-hw, seam); s.quadraticCurveTo(-hw * 0.7, top + (seam - top) * 0.35, 0, top); }, 0.18 * CK, "#E3B64B", bz + 0.03);
      U.lowerPv = rbPivot(M, 0, 0.13 * CK, bz + 0.02); U.lower = rbAdd(U.lowerPv, new THREE.BufferGeometry(), "#C99A3A");
      const cr = U.crown = rbPivot(M, 0.05 * CK, -0.95 * CK, 0.05);
      rbSlab(cr, s => s.poly([[-0.42 * CK, 0.1 * CK], [-0.45 * CK, -0.35 * CK], [-0.2 * CK, -0.1 * CK], [0, -0.45 * CK], [0.2 * CK, -0.1 * CK], [0.45 * CK, -0.35 * CK], [0.42 * CK, 0.1 * CK]]), 0.1 * CK, GOLD);
      rbDot(cr, 0, -0.02 * CK, 0.07 * CK, RED, 0.03);
    },
    pose(U, B, x) {
      const q = x.q, dying = x.dying || 0, hurtK = B.hurt, tellK = q.tell ? Math.sin(q.tell * Math.PI) : 0, shock = B.dead ? 1 : 0;
      const anger = shock ? 0 : clamp(0.65 + 0.35 * (1 - B.hp / B.max) + 0.45 * tellK, 0, 1.3), squint = shock ? 0 : Math.max(hurtK > 0.3 ? 0.85 : 0, 0.18 + 0.2 * anger);
      for (const w of U.wings) w.rotation.z = w.userData.sd * (0.2 + x.flap * 0.5);
      U.face.position.y = -tellK * CK * 0.05;
      for (const E of U.eye) {
        const out = B.dead && dying > 0.7; E.X.visible = out; E.pup.visible = !out;
        if (!out) { const pr = CK * (shock ? 0.045 : 0.075); E.pup.scale.set(pr, pr * 1.3, 1); E.pup.position.set(-E.sd * CK * 0.03, -CK * (shock ? 0 : 0.07), E.rx * 0.5 * 0.8); }
        E.ball.scale.set(E.rx, E.ry + shock * 0.05 * CK, E.rx * 0.5);
        const lq = Math.round(squint * 20) / 20 + ":" + Math.round(anger * 10) / 10;
        const lg = rbCache(U, "lid" + E.sd, lq, () => (squint > 0 ? crowLid(E.rx, E.ry, E.sd, squint, anger) : null)); E.lid.visible = !!lg; if (lg) E.lid.geometry = lg;
        const bq = shock + ":" + Math.round(anger * 10) / 10;
        E.brow.geometry = rbCache(U, "brow" + E.sd, bq, () => {   // the feathered brow: heavy and pressed down at the middle end, lifted outside
          const ix = -E.sd * CK * 0.2, ox = E.sd * CK * 0.27, top = -E.ry, iy = shock ? top - CK * 0.2 : top + CK * (0.05 + 0.06 * anger), oy = shock ? top - CK * 0.13 : top - CK * (0.15 + 0.03 * anger), ti = CK * 0.1, to = CK * 0.05;
          return new THREE.ShapeGeometry(rbShape(s => { s.moveTo(ix, iy + ti * 0.5); s.lineTo(ix + E.sd * CK * 0.02, iy - ti * 0.7); s.quadraticCurveTo((ix + ox) / 2, (iy + oy) / 2 - ti * 0.9, ox, oy - to); s.lineTo(ox + E.sd * CK * 0.05, oy + to * 0.2); s.quadraticCurveTo((ix + ox) / 2, (iy + oy) / 2 + ti * 0.3, ix, iy + ti * 0.5); }));
        });
      }
      const open = shock ? 0.75 : q.tell ? crowJaw(q.tell) : hurtK * 0.45, oq = Math.round(clamp(open, -0.2, 1.1) * 20) / 20;
      rbSwap(U.lower, rbCache(U, "jaw", oq, o => shapeGeo(s => { const hw = 0.22 * CK, lhw = hw * 0.86 * (1 + Math.max(0, o) * 0.1), L = CK * 0.25 * (1 + Math.max(0, o) * 0.3); s.moveTo(-lhw, 0); s.lineTo(lhw, 0); s.quadraticCurveTo(lhw * 0.55, L * 0.6, 0, L); s.quadraticCurveTo(-lhw * 0.55, L * 0.6, -lhw, 0); }, 0.16 * CK)));
      U.lowerPv.position.y = -(0.13 * CK + Math.max(0, open) * CK * 0.32 + Math.min(0, open) * CK * 0.12); U.lowerPv.rotation.x = Math.max(0, open) * 0.35;
      U.mouth.visible = open > 0.03; U.mouth.scale.y = 0.14 * CK * Math.max(0.3, open);
      U.crown.rotation.z = -(-0.15 + (1 - B.hp / B.max) * 0.5 + (B.dead ? dying * 3 : 0)); U.crown.position.y = 0.95 * CK + (B.dead ? dying * CK * 3 : 0);
      for (let i = 0; i < 2; i++) { const sd = i ? 1 : -1, leg = U.legs[i]; leg.show(x.ringDy != null); if (x.ringDy == null) continue; leg.set([sd * CK * 0.3, CK * 0.7, 0], [sd * CK * 0.7, x.ringDy * 0.5, 0], [sd * CK * 0.22, x.ringDy - CK * 0.05, 0]); }
    }
  } } });
  // drawn instead of drawCrow's painting: p his projection; the rest is drawCrow's pose
  function r3dCrow(B, p, pose) {
    if (!r3dOn()) return false;
    const s = p.s, P = { x: 0, y: 0, z: 0, rot: pose.rot, alpha: 1 };
    return r3dBoss(B, P, p, "body", { ...pose, ringDy: pose.ringDy == null ? null : pose.ringDy / s, still: true, sx: pose.sx, sy: pose.sy });
  }
  // ── the Pumpkin King: the head (ribs, stem, crown, vine arms), the carved grin round the ring, and his eyes, the
  // targets, each drawn at its exact place so a throw at a glowing eye is a throw at the eye
  const PKR = 1.4;
  Object.assign(R3D_BOSSES, { pumpkin: {
    head: {
      build(M, U) {
        const cols = ["#D9692A", "#E8803A", "#F09046", "#E8803A", "#D9692A"];
        U.roll = rbPivot(M, 0, 0, 0);
        for (let i = 0; i < 5; i++) { const k = Math.abs(i - 2); rbEll(U.roll, (i - 2) * 0.36 * PKR, 0, (0.55 - k * 0.04) * PKR, 0.9 * PKR, 0.78 * PKR * (1 - k * 0.12), cols[i], -k * 0.12); }
        rbQTube(U.roll, [-0.1 * PKR, -0.8 * PKR], [-0.05 * PKR, -1.2 * PKR], [0.18 * PKR, -1.22 * PKR], 0.07 * PKR, "#5A6B2A");
        rbSlab(U.roll, s => { const pts = [[-0.45, -0.82]]; for (let k = 0; k <= 4; k++) pts.push([-0.45 + k * 0.225, k % 2 ? -1.0 : -1.16]); pts.push([0.45, -0.82]); s.poly(pts.map(([a, b]) => [a * PKR, b * PKR])); }, 0.08 * PKR, GOLD, 0.35 * PKR);
        U.arms = [-1, 1].map(sd => ({ sd, arm: rbArm(M, 0.06 * PKR, "#5E7A36"), glove: rbGlove(M, sd * 1.35 * PKR, -0.7 * PKR, 0.15 * PKR, 0.1) }));
        U.cheeks = [-1, 1].map(sd => { const c = rbEll(M, sd * 0.5, 0.4, 0.2, 0.14, 0.08, "#FF9678", 0.95 * PKR); c.userData.sd = sd; return c; });
        U.reachMin = 2.5 * PKR;
      },
      pose(U, B, x) {
        U.roll.rotation.z = -(B.roll || 0);
        for (const A of U.arms) { const w = Math.sin(x.tt * 3 + A.sd) * PKR * 0.15, a = [A.sd * 0.9 * PKR, 0.3 * PKR, 0], e = [A.sd * 1.5 * PKR, -0.05 * PKR + w * 0.5, 0], h = [A.sd * 1.35 * PKR, -0.65 * PKR + w, 0]; A.arm.set(a, e, h); A.glove.position.set(h[0], -h[1] + 0.02, 0.1); }
        for (const c of U.cheeks) { c.visible = x.puff > 0.1; if (c.visible) { c.position.set(x.mouthDx + c.userData.sd * x.cheekDx, -x.mouthDy + x.cheekDy, 0.95 * PKR); c.scale.set(0.16 * PKR * (1 + x.puff), 0.11 * PKR * (1 + x.puff), 0.08); } }
      }
    },
    grin: {   // the carved hole round the ring: a jagged dark rim, and the fire in his throat
      build(M, U) {
        U.hole = new THREE.Mesh(new THREE.ShapeGeometry(rbShape(s => s.poly(Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * TAU, r = k % 2 ? 1.08 : 1.28; return [Math.cos(a) * r * 1.25, Math.sin(a) * r]; })))), rbFlat("#1A0A04", { side: THREE.DoubleSide }));
        M.add(U.hole); const rim = rbAdd(M, RBG.torus, "#C0561E"); rim.scale.set(1.62, 1.3, 2.2); rim.position.z = -0.02;
        U.fire = new THREE.Mesh(RBG.circ, new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color("#FFB84A"), transparent: true, opacity: 0.35, depthWrite: false })); U.fire.position.set(0, -0.6, 0.01); U.fire.scale.set(0.8, 0.25, 1); M.add(U.fire);
      },
      pose(U, B, x) { U.fire.material.color.set(x.angry ? "#FFD04A" : "#FFB84A"); U.fire.material.opacity = 0.35 * x.fl; }
    },
    eyeOpen: {   // a glowing bull's-eye under an angry dark brow
      build(M, U) {
        U.brow = new THREE.Mesh(new THREE.BufferGeometry(), rbFlat(INK, { side: THREE.DoubleSide })); U.brow.position.z = -0.01; M.add(U.brow);
        U.rings = [[0.85, "#FFB84A"], [0.55, "#1A0A04"], [0.28, "#FFB84A"]].map(([k, c], i) => { const m = new THREE.Mesh(RBG.circ, new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(c), transparent: true })); m.scale.setScalar(k); m.position.z = 0.01 + i * 0.01; m.position.y = 0.05; M.add(m); return m; });
        U.reachMin = 1.4;
      },
      pose(U, B, x) {
        U.brow.geometry = rbCache(U, "browGeo", x.angry ? 1 : 0, a => new THREE.ShapeGeometry(rbShape(s => s.poly([[-1.25, a ? -1.1 : -0.7], [1.25, a ? -0.2 : -0.7], [0, 1.1]]))));   // (the same on both eyes, as drawn)
        for (const m of [U.rings[0], U.rings[2]]) { m.material.color.set(x.glow); m.material.opacity = x.fl; }
      }
    },
    eyeShut: {   // screwed shut: a curved lid and three lashes (and in the last phase a glowing glare)
      build(M, U) {
        rbQTube(M, [-1, 0], [0, 0.5], [1, 0], 0.17, INK); for (let k = -1; k <= 1; k++) rbCyl(M, [k * 0.5, 0.1], [k * 0.6, 0.5], 0.06, INK);
        U.glare = new THREE.Mesh(RBG.box, new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color("#FFD04A"), transparent: true })); U.glare.scale.set(2.2, 0.6, 0.01); M.add(U.glare);
      },
      pose(U, B, x) { U.glare.visible = !!x.glare; if (x.glare) { U.glare.material.color.set(x.glow); U.glare.material.opacity = x.fl; U.glare.position.set(0, 0.125, -0.02); U.glare.rotation.z = x.side ? -0.2 : 0.2; } }
    }
  } });
  // drawn in drawPumpkin's place: c the head's projection, m where the ring (his mouth) is, and drawPumpkin's numbers
  function r3dPumpkin(B, c, o) {
    if (!r3dOn()) return false;
    const split = o.split, sx = o.bounce + o.puff * 0.08, sy = 1 / o.bounce - B.hurt * 0.04;
    const drawHead = (h) => {
      const P = { x: 0, y: 0, z: 0, rot: h ? h * split * 0.35 : 0, alpha: 1 }, pp = { x: c.x + (h ? h * split * PKR * c.s * 0.5 : 0), y: c.y + (h ? split * PKR * c.s * 0.1 : 0), s: c.s };
      let clip = null;
      if (h) { const n = new THREE.Vector3(h, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -P.rot), k = 1 / pp.s, o3 = new THREE.Vector3((pp.x - W / 2) * k, -(pp.y - HY) * k, -F * k); clip = [new THREE.Plane().setFromNormalAndCoplanarPoint(n, o3)]; }
      const md = { mouthDx: (o.mouth.x - c.x) / c.s, mouthDy: (o.mouth.y - c.y) / c.s, cheekDx: o.mr * 1.9 / c.s, cheekDy: o.mr * 0.1 / c.s };
      r3dBoss(B, P, pp, "head", { tt: o.tt, puff: o.puff, ...md, still: true, sx, sy, clip });
    };
    for (const h of split ? [-1, 1] : [0]) drawHead(h);
    const mo = o.mouth;   // the grin, at the ring (its jagged hole o.hole pixels round it)
    if (!B.dead) r3dBoss(B, { x: 0, y: 0, z: 0, alpha: 1 }, { x: mo.x, y: mo.y, s: mo.s }, "grin", { angry: o.angry, fl: o.fl, still: true, sx: o.hole / mo.s, sy: o.hole / mo.s });
    for (const e of o.eyes) {   // the targets, each exactly where the throw is judged
      const part = e.shut ? "eyeShut" : "eyeOpen";
      if (B.dead && !e.shut) continue;
      r3dBoss(B, { x: 0, y: 0, z: 0, alpha: 1 }, { x: e.x, y: e.y, s: e.s }, part, { angry: o.angry, glow: o.glow, fl: o.fl, side: e.i, glare: e.glare, still: true, sx: e.r / e.s, sy: e.r / e.s });
    }
    return true;
  }
