  // ───────────────────────── v69 3D: the bosses, modelled (the kit) ─────────────────────────
  // The owner: "Bosses fully modeled". Each of the sixteen is built as a model, not cut out of its drawing: round
  // heads, bodies and trunks (spheres, lathes, tubes), flat things (wings, capes, hat brims, clock faces) extruded
  // with bevels, and faces with the studio's pie-cut eyes. It's all toon-lit and inked like the rest of the 3D.
  // Every part is written in the drawing's own terms (metres, x right, y DOWN, z toward the camera), so a model reads
  // against its 2D drawing line for line. A model is posed each frame from the boss's own state (its wingbeat, tell,
  // hurt, anger, phase, death) and drawn where the drawing was: the same place, turn, squash and fade.
  const RB = { mats: new Map(), flat: new Map() };
  const rbMat = col => { let m = RB.mats.get(col); if (!m) RB.mats.set(col, (m = r3dToon(col))); return m; };
  const rbFlat = (col, o = {}) => { const k = col + JSON.stringify(o); let m = RB.flat.get(k); if (!m) RB.flat.set(k, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col), ...o }))); return m; };
  const RBG = {};   // shared unit shapes
  const rbGeo = () => RBG.sph || Object.assign(RBG, {
    sph: new THREE.SphereGeometry(1, 26, 18), cyl: new THREE.CylinderGeometry(1, 1, 1, 18), cone: new THREE.CylinderGeometry(0, 1, 1, 18),
    disc: new THREE.CylinderGeometry(1, 1, 1, 28).rotateX(Math.PI / 2), pie: new THREE.CircleGeometry(1, 24, 1.3, TAU - 0.7), circ: new THREE.CircleGeometry(1, 24),
    torus: new THREE.TorusGeometry(1, 0.09, 8, 28), box: new THREE.BoxGeometry(1, 1, 1)
  }).sph;
  // a part: inked (its hull a few pixels out) unless it's ink itself
  function rbAdd(par, geo, col, x = 0, y = 0, z = 0, ink = true) {
    rbGeo();
    const g = ink ? r3dInked(geo, rbMat(col)) : new THREE.Mesh(geo, rbFlat(col));
    g.position.set(x, -y, z); par.add(g); return g;
  }
  const rbPivot = (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, -y, z); par.add(g); return g; };
  const rbEll = (par, x, y, rx, ry, rz, col, z = 0, ink = true) => { const g = rbAdd(par, (rbGeo(), RBG.sph), col, x, y, z, ink); g.scale.set(rx, ry, rz); return g; };
  const rbBox = (par, cx, cy, w, h, d, col, z = 0) => { const g = rbAdd(par, (rbGeo(), RBG.box), col, cx, cy, z); g.scale.set(w, h, d); return g; };
  const rbRect = (par, x, y, w, h, d, col, z = 0) => rbBox(par, x + w / 2, y + h / 2, w, h, d, col, z);   // (as the drawing's rect: top-left and size)
  const rbDisc = (par, x, y, r, h, col, z = 0, ink = true) => { const g = rbAdd(par, (rbGeo(), RBG.disc), col, x, y, z, ink); g.scale.set(r, r, h); return g; };   // (its face toward the camera)
  // a cylinder from a to b ([x, y, z] in the drawing's terms), radius r; re-posed with rbLimb
  function rbCyl(par, a, b, r, col, cone = false) { const g = rbAdd(par, (rbGeo(), cone ? RBG.cone : RBG.cyl), col); rbLimb(g, a, b, r); return g; }
  function rbLimb(g, a, b, r) { r3dLimb(g, new THREE.Vector3(a[0], -a[1], a[2] || 0), new THREE.Vector3(b[0], -b[1], b[2] || 0), r); }
  const rbDot = (par, x, y, r, col, z = 0) => rbEll(par, x, y, r, r, r * 0.6, col, z);
  // the drawing's path commands, with y turned up; sd mirrors it left for right
  function rbShape(draw, sd = 1) {
    const S = new THREE.Shape(), X = x => x * sd;
    draw({
      moveTo: (x, y) => S.moveTo(X(x), -y), lineTo: (x, y) => S.lineTo(X(x), -y),
      quadraticCurveTo: (cx, cy, x, y) => S.quadraticCurveTo(X(cx), -cy, X(x), -y),
      bezierCurveTo: (a, b, c, d, x, y) => S.bezierCurveTo(X(a), -b, X(c), -d, X(x), -y),
      ellipse: (cx, cy, rx, ry, rot = 0) => S.absellipse(X(cx), -cy, rx, ry, 0, TAU, false, -rot * sd),
      arc: (cx, cy, r, a0 = 0, a1 = TAU) => (sd > 0 ? S.absarc(cx, -cy, r, -a0, -a1, true) : S.absarc(-cx, -cy, r, Math.PI + a0, Math.PI + a1, false)),   // (y turned up reverses it; a mirror reverses it back)
      poly: pts => { pts.forEach(([x, y], i) => (i ? S.lineTo(X(x), -y) : S.moveTo(X(x), -y))); }
    });
    return S;
  }
  // a flat piece with thickness (a wing, a cape, a brim), extruded from a drawing's path and bevelled round the edge
  function rbSlab(par, draw, depth, col, z = 0, sd = 1, bevel = true) {
    const b = Math.min(0.03, depth * 0.3), geo = new THREE.ExtrudeGeometry(rbShape(draw, sd), { depth, curveSegments: 10, bevelEnabled: bevel, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2 });
    geo.translate(0, 0, -depth / 2);
    return rbAdd(par, geo, col, 0, 0, z);
  }
  // a turned piece (a trunk, a cloak, a hat): prof [[radius, y], …] top to bottom in the drawing's terms
  function rbLathe(par, prof, col, x = 0, y = 0, z = 0, segs = 28, sz = 1) {
    const g = rbAdd(par, new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(Math.max(0.001, r), -yy)), segs), col, x, y, z); g.scale.z = sz; return g;
  }
  // a tube along a curve through points ([x, y, z]); or a quadratic from a through c to b
  function rbTube(par, pts, r, col, closed = false) { const C = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, -y, z || 0)), closed); return rbAdd(par, new THREE.TubeGeometry(C, Math.max(8, pts.length * 6), r, 8, closed), col); }
  function rbQTube(par, a, c, b, r, col) { const C = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a[0], -a[1], a[2] || 0), new THREE.Vector3(c[0], -c[1], c[2] || 0), new THREE.Vector3(b[0], -b[1], b[2] || 0)); return rbAdd(par, new THREE.TubeGeometry(C, 16, r, 8, false), col); }
  // an arm that moves: shoulder → elbow → hand, two cylinders and a joint, re-posed by rbArm.set
  function rbArm(par, r, col) {
    const up = rbCyl(par, [0, 0], [0, 1], r, col), lo = rbCyl(par, [0, 0], [0, 1], r, col), el = rbDot(par, 0, 0, r, col);
    return { set: (a, e, h) => { rbLimb(up, a, e, r); rbLimb(lo, e, h, r * 0.95); el.position.set(e[0], -e[1], e[2] || 0); el.scale.set(r, r, r); }, show: v => { up.visible = lo.visible = el.visible = v; } };
  }
  const rbArc = (p0, c, p1, k) => { const u = 1 - k; return [u * u * p0[0] + 2 * u * k * c[0] + k * k * p1[0], u * u * p0[1] + 2 * u * k * c[1] + k * k * p1[1], (p0[2] || 0) * u + (p1[2] || 0) * k]; };
  // the studio's white glove: a palm and three fingers
  function rbGlove(par, x, y, r, z = 0) { const g = rbPivot(par, x, y, z); rbEll(g, 0, 0, r, r, r * 0.8, "#F7F1DF"); for (let k = 0; k < 3; k++) rbEll(g, r * (-0.5 + k * 0.5), -r * 0.8, r * 0.38, r * 0.38, r * 0.34, "#F7F1DF"); return g; }
  // a gear: n teeth between radius r1 and r2
  function rbGear(par, x, y, n, r1, r2, depth, col, z = 0) {
    const g = rbPivot(par, x, y, z);
    rbSlab(g, s => s.poly(Array.from({ length: n * 2 }, (_, k) => { const a = (k / (n * 2)) * TAU, r = k % 2 ? r1 : r2; return [Math.cos(a) * r, Math.sin(a) * r]; })), depth, col);
    return g;
  }
  // where the front of an ellipsoid (radii rx, ry, rz) is at (x, y)
  const rbFront = (rx, ry, rz, x, y) => rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2));
  // the pie-cut eye: a cream ball, a black pupil with its wedge of light cut out; squeezed to a slit when hurt,
  // X'd out when beaten. set({ look, shut, dead })
  function rbEye(par, x, y, rx, ry, z = 0, o = {}) {
    rbGeo();
    const g = rbPivot(par, x, y, z), d = rx * (o.depth || 0.55), ball = rbEll(g, 0, 0, rx, ry, d, o.white || CREAM);
    const pup = new THREE.Mesh(RBG.pie, rbFlat(o.pupil || INK, { side: THREE.DoubleSide })); g.add(pup);
    const X = new THREE.Group(); for (const s of [-1, 1]) { const b = new THREE.Mesh(RBG.box, rbFlat(INK)); b.scale.set(rx * 1.3, Math.max(0.012, ry * 0.14), 0.01); b.rotation.z = s * Math.atan2(ry, rx) * 0.8; X.add(b); } X.position.z = d + 0.004; X.visible = false; g.add(X);
    const E = { g, set: ({ look = 0, shut = false, dead = false, size = 1 } = {}) => {
      ball.scale.set(rx, shut ? ry * 0.25 : ry, d); X.visible = !!dead; pup.visible = !shut && !dead;
      if (pup.visible) { const px = look * rx * 0.3, py = -ry * 0.15; pup.scale.set(rx * 0.45 * size, ry * 0.6 * size, 1); pup.position.set(px, py, rbFront(rx, ry, d, px, py) + 0.004); }
    } };
    E.set(); return E;
  }
  // ── the registry the models fill (08rh_r3d_bosses.js): R3D_BOSSES[kind][part] = { build(M, U), pose(U, B, x) }
  const R3D_BOSSES = {};
  function r3dBossPart(kind, part) {
    const key = "boss:" + kind + ":" + part; let M = R3D.cache[key];
    if (M !== undefined) return M || null;
    const S = R3D_BOSSES[kind] && R3D_BOSSES[kind][part]; if (!S) return null;
    M = new THREE.Group(); M.userData = {};
    try { S.build(M, M.userData); } catch (e) { if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08rg_r3d_bosskit:build"); R3D.cache[key] = false; return null; }   // (it stays 2D)
    const bb = new THREE.Box3().setFromObject(M); let reach = 0;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) reach = Math.max(reach, Math.hypot(x, y));
    M.userData.reach = Math.max(reach, M.userData.reachMin || 0);
    M.userData.foot = bb.min.y; M.userData.half = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));   // (where it meets the ground, and how wide it is there: its contact shadow)
    return (R3D.cache[key] = M);
  }
  const r3dBossModelled = B => !!(B && R3D_BOSSES[B.kind]);
  // draw one part where withBody would have painted it: P its place in the world (with rot, sc and alpha), p its
  // projection, x anything the drawing worked out that the pose needs. The squash, the hurt and the bounce on twos
  // are the drawing's.
  function r3dBoss(B, P, p, part = "body", x = {}) {
    if (!r3dOn() || !R3D_BOSSES[B.kind] || !R3D_BOSSES[B.kind][part]) return false;
    const M = r3dBossPart(B.kind, part); if (!M) return false;
    try { R3D_BOSSES[B.kind][part].pose(M.userData, B, x); } catch (e) { if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08rg_r3d_bosskit:pose"); return false; }
    r3dContactShadow(B, P, M, part);
    const k = 1 / p.s, hurt = B.hurt || 0, bounce = x.still ? 1 : 1 + Math.sin(bt(B) * 6) * 0.015, sc = P.sc || 1;
    M.position.set((p.x - W / 2) * k, -(p.y - HY) * k, -F * k);
    M.rotation.set(0, 0, -(P.rot || 0));
    M.scale.set(sc * (bounce + hurt * 0.06) * (x.sx || 1), sc * (1 / bounce - hurt * 0.05) * (x.sy || 1), sc);
    const R = M.userData.reach * sc * p.s * Math.max(Math.abs(x.sx || 1), Math.abs(x.sy || 1)) * 1.25 + 10;
    return r3dDraw(M, { x: p.x - R, y: p.y - R, w: R * 2, h: R * 2 }, clamp(0.05 * p.s, 1.3, 3.2), P.alpha == null ? 1 : P.alpha, false, x.clip);
  }
  // (Phase 1, docs/PRODUCTION-AUDIT.md §5) a soft contact shadow under each modelled boss, so a model stands on the
  // ground or hovers over it instead of floating in the painting: the same rule as Morty's (BLUEPRINT.shadow.skull), the
  // higher its lowest point the smaller and fainter the shadow, slid along the light. Once a frame per boss, and never
  // for the ones up to their necks in water.
  const R3D_WET = /^(gator|madame)$/, R3D_SHADOWED = /^(body|head|house)$/;
  function r3dContactShadow(B, P, M, part) {
    if (R3D_WET.test(B.kind) || !R3D_SHADOWED.test(part) || B.__shAt === R3D_RCM.now) return;
    B.__shAt = R3D_RCM.now;
    const sc = P.sc || 1, h = Math.max(0, P.y + M.userData.foot * sc), g = project(P.x + shadowShift(h), 0, P.z);
    if (g.y > H + 20 || g.y < 0) return;
    const S = BLUEPRINT.shadow.skull, k = 1 / (1 + h * S.height), rx = M.userData.half * sc * g.s * (0.55 + 0.45 * k), op = (S.opacity[0] + (S.opacity[1] - S.opacity[0]) * k) * (P.alpha == null ? 1 : P.alpha) * (B.dead ? 0.6 : 1);
    if (rx < 1 || op < 0.02) return;
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rx);
    gr.addColorStop(0, `rgba(0,0,0,${op})`); gr.addColorStop(0.7, `rgba(0,0,0,${op * 0.6})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(g.x, g.y, rx, rx * 0.24, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  // the shots the end bosses throw, modelled: a clod, a bat, a bone, mud, a pin, a gear, a frame of film, a seed
  const R3D_SHOTS = {
    seed: M => { rbEll(M, 0, 0, 0.75, 1.15, 0.45, "#F4E6BE"); rbTube(M, [[0, -0.8, 0.46], [0, 0, 0.5], [0, 0.8, 0.46]], 0.05, "#A07838"); },
    clod: M => { rbEll(M, 0, 0, 1, 0.9, 0.9, "#6A4A2E"); for (let i = 0; i < 5; i++) { const a = i * 1.3; rbEll(M, Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.4, 0.35, 0.4, "#5A3A22", 0.4); } },
    bat: M => { rbEll(M, 0, 0, 0.45, 0.5, 0.4, "#2A1A2E"); for (const sd of [-1, 1]) rbSlab(M, s => { s.moveTo(0.3, -0.1); s.quadraticCurveTo(0.9, -0.8, 1.4, -0.4); s.quadraticCurveTo(1.1, 0, 1.2, 0.2); s.quadraticCurveTo(0.8, 0, 0.3, 0.25); }, 0.08, "#2A1A2E", 0, sd); for (const sd of [-1, 1]) rbDot(M, sd * 0.16, -0.12, 0.09, "#FF5A3A", 0.38); },
    bone: M => { rbCyl(M, [-1.05, 0], [1.05, 0], 0.2, "#E4DAC4"); for (const e of [-1, 1]) for (const g of [-1, 1]) rbDot(M, e * 1.1, g * 0.22, 0.28, "#E4DAC4"); },
    mud: M => { rbEll(M, 0, 0, 1, 1, 0.85, "#5A4A2A"); rbEll(M, -0.3, -0.3, 0.32, 0.3, 0.3, "#7A6A3A", 0.62); },
    pin: M => { rbLathe(M, [[0.001, -1.3], [0.25, -1.1], [0.3, -0.7], [0.2, -0.35], [0.45, 0.3], [0.5, 0.7], [0.35, 1.15], [0.001, 1.2]], CREAM); rbLathe(M, [[0.23, -0.32], [0.26, -0.12]], RED); },
    gear: M => { rbGear(M, 0, 0, 8, 0.8, 1.05, 0.35, GOLD); rbDisc(M, 0, 0, 0.3, 0.42, "#6A4A2E"); },
    frame: M => { rbBox(M, 0, 0, 2, 1.5, 0.12, "#141414"); rbBox(M, 0, 0, 1.2, 0.9, 0.14, "#F2E7C9"); for (const sy of [-1, 1]) for (let i = 0; i < 4; i++) rbBox(M, -0.76 + i * 0.5, sy * 0.62, 0.18, 0.12, 0.16, "#3A3A3A"); }
  };
  function r3dShotModel(kind) {
    const key = "shot:" + (R3D_SHOTS[kind] ? kind : "seed"); let M = R3D.cache[key];
    if (!M) { M = new THREE.Group(); R3D_SHOTS[R3D_SHOTS[kind] ? kind : "seed"](M); R3D.cache[key] = M; }
    return M;
  }
  // one shot, at its place: r its radius on screen, rot its spin; batched with the rest of the scene (deferred)
  function r3dShot(kind, x, y, r, rot) {
    if (!r3dOn()) return false;
    const M = r3dShotModel(kind), k = SEED_R * 1.3 / Math.max(0.3, r);   // (metres a pixel at its depth)
    M.position.set((x - W / 2) * k, -(y - HY) * k, -F * k); M.rotation.set(rot * 0.4, rot * 0.7, -rot); M.scale.setScalar(SEED_R * 1.3);
    return r3dDraw(M, { x: x - r * 2.2 - 4, y: y - r * 2.2 - 4, w: r * 4.4 + 8, h: r * 4.4 + 8 }, clamp(r * 0.18, 1, 2.2), 1, true);
  }
