  // ───────────────────────── v73: Morty's glasses as models (COS-GLASSES, the overhaul's second asset) ─────────────────────────
  // The twelve pairs (08i_body.js GLASSES) were drawn over his face. Now each is built: its frames inked tubes round
  // the lens's own outline (the 2D's shapes: circle, rounded box, aviator drop, heart, star), tinted lenses, a bridge,
  // and arms running back to his temples; the monocle with its chain, the goggles with their strap round his head,
  // the bandit's mask wrapped onto the skull's surface, the visor glowing. They sit over his sockets and follow them
  // as they swell (faceSocks' rule), a little in front of the face, and turn and squash with his head.
  const GL = { cache: new Map(), zf: null, temple: 0.98 };   // (zf: the face's front surface, z at (x, y up): the v72 shell's, or v73's skull's)
  const GL_STYLE = {   // shape, lens colour and opacity, frame colour, frame width (the 2D's line width, skull units), options
    round: ["circle", "#C8E6FF", 0.16, "#C49A42", 0.05], shades: ["box", "#15131A", 0.92, "#15131A", 0.08], nerd: ["box", "#C8E6FF", 0.14, "#1E1C22", 0.13, { tape: true }],
    threed: ["box", ["#DC323C", "#46C8E6"], 0.7, "#F4F0E6", 0.1], heart: ["heart", "#F578AA", 0.75, "#E8505B", 0.06], aviator: ["drop", "#8C5A28", 0.8, "#D8B45A", 0.045],
    star: ["star", "#FFDC50", 0.8, "#E8505B", 0.06, { glare: false }], monocle: ["circle", "#C8E6FF", 0.18, "#D8B45A", 0.055, { mono: true }],
    goggles: ["circle", "#4E9C78", 0.85, "#C49A42", 0.12, { arms: false, strap: true }], bandit: ["bandit"], visor: ["visor"]
  };
  // the lens outlines, in units of the lens radius, y down (as the 2D draws them)
  function glOutline(shape) {
    const P = [], quad = (a, c, b, n = 10) => { for (let i = 1; i <= n; i++) { const u = i / n; P.push([(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]]); } };
    const cub = (a, c1, c2, b, n = 14) => { for (let i = 1; i <= n; i++) { const u = i / n, v = 1 - u; P.push([v ** 3 * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * b[0], v ** 3 * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * b[1]]); } };
    if (shape === "circle") for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; P.push([Math.cos(a), Math.sin(a)]); }
    else if (shape === "box") { const w = 1.1, h = 0.82, k = 0.42; for (const [cx, cy, a0] of [[w - k, -h + k, -Math.PI / 2], [w - k, h - k, 0], [-w + k, h - k, Math.PI / 2], [-w + k, -h + k, Math.PI]]) for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; P.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); } }
    else if (shape === "drop") { P.push([-1.05, -0.7], [1.05, -0.7]); quad([1.05, -0.7], [1.15, 0.5], [0.2, 1.0]); quad([0.2, 1.0], [-1.1, 0.9], [-1.05, -0.7]); P.pop(); }
    else if (shape === "heart") { P.push([0, 1]); cub([0, 1], [-1.6, -0.1], [-0.8, -1.3], [0, -0.45]); cub([0, -0.45], [0.8, -1.3], [1.6, -0.1], [0, 1]); P.pop(); }
    else if (shape === "star") for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.52 : 1) * 1.35; P.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return P;
  }
  const glV = (x, yd, z) => new THREE.Vector3(x, -yd, z);
  const glTube = (pts, r, mat, closed = false) => r3dInked(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, "centripetal"), Math.max(8, pts.length * 3), r, 6, closed), mat);
  const glFlat = (c, a) => new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(c), transparent: a < 1, opacity: a, depthWrite: a >= 1, side: THREE.DoubleSide });
  // how far in front of the face a lens sits: clear of the skull round its rim
  const glZ = (x, yd, r) => Math.max(GL.zf(x - r, -yd), GL.zf(x + r, -yd), GL.zf(x, -yd + r), GL.zf(x, -yd - r), GL.zf(x, -yd)) + 0.05;
  function r3dGlassesModel(id, socks) {
    const st = GL_STYLE[id]; if (!st) return null;
    const g = new THREE.Group(); g.name = "Glasses_" + id;
    const S = socks[0].x < socks[1].x ? socks : [socks[1], socks[0]], [L, R] = S, lr = s => Math.max(s.rx, s.ry) * 1.12, rl = lr(L), rr2 = lr(R), y = (L.y + R.y) / 2;
    if (st[0] === "bandit") {   // a black band with the sockets showing through, wrapped onto the skull
      const sh = new THREE.Shape(), q = (cx, cy, x, yy) => sh.quadraticCurveTo(cx, -cy, x, -yy);
      sh.moveTo(L.x - rl * 1.8, -(y - rl * 0.6)); q(0, y - rl * 1.5, R.x + rl * 1.8, y - rl * 0.6); q(R.x + rl * 1.6, y + rl * 0.9, R.x + rl * 0.3, y + rl * 1.1); q(0, y + rl * 0.5, L.x - rl * 0.3, y + rl * 1.1); q(L.x - rl * 1.6, y + rl * 0.9, L.x - rl * 1.8, y - rl * 0.6);
      for (const s of S) { const h = new THREE.Path(); h.absellipse(s.x, -s.y, s.rx * 0.95, s.ry * 0.95, 0, TAU, true); sh.holes.push(h); }
      const geo = new THREE.ShapeGeometry(sh, 24), P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) P.setZ(i, GL.zf(P.getX(i), P.getY(i)) + (GL.zf === r3dShellZ ? 0.025 : 0.05));   // (onto the face's curve)
      geo.computeVertexNormals(); g.add(r3dInked(geo, r3dToon("#15131A")));
      for (const sd of [-1, 1]) { const x0 = sd * (Math.abs(R.x) + rl * 1.7); g.add(glTube([glV(x0, y - rl * 0.5, GL.zf(x0, -(y - rl * 0.5)) + 0.02), glV(sd * (Math.abs(R.x) + rl * 2.4), y + rl * 0.2, 0.25), glV(sd * (Math.abs(R.x) + rl * 2.1), y + rl * 1.2, 0.05)], 0.035, r3dToon("#15131A"))); }
      return g;
    }
    if (st[0] === "visor") {   // a neon visor across both sockets
      const x0 = L.x - rl * 1.4, x1 = R.x + rl * 1.4, h = rl * 1.2, k = rl * 0.6, pts = [];
      for (const [cx, cy, a0] of [[x1 - k, y - h / 2 + k, -Math.PI / 2], [x1 - k, y + h / 2 - k, 0], [x0 + k, y + h / 2 - k, Math.PI / 2], [x0 + k, y - h / 2 + k, Math.PI]]) for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
      const z = Math.max(...pts.map(([x, yy]) => GL.zf(x, -yy))) + 0.04, sh = new THREE.Shape(pts.map(([x, yy]) => new THREE.Vector2(x, -yy)));
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(sh), glFlat("#50F0FF", 0.5)); lens.position.z = z; lens.renderOrder = 4; g.add(lens); g.userData.pulse = lens.material;
      g.add(glTube(pts.map(([x, yy]) => glV(x, yy, z)), 0.03, r3dToon("#50F0FF"), true));
      const glare = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - rl * 1.0, 0.035, 0.005), glFlat("#FFFFFF", 0.8)); glare.position.set((x0 + x1) / 2, -(y - rl * 0.25), z + 0.01); g.add(glare);
      return g;
    }
    const [shape, lensCol, alpha, frameCol, w, o = {}] = st, frame = r3dToon(frameCol), out = glOutline(shape), lenses = o.mono ? [R] : [L, R];
    lenses.forEach((s, i) => {
      const r = lr(s), z = glZ(s.x, s.y, r * 1.1), pts = out.map(([u, v]) => [s.x + u * r, s.y + v * r]);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, yy]) => new THREE.Vector2(x, -yy)))), glFlat(Array.isArray(lensCol) ? lensCol[o.mono ? 1 : i] : lensCol, alpha));
      lens.position.z = z; lens.renderOrder = 4; g.add(lens);
      g.add(glTube(pts.map(([x, yy]) => glV(x, yy, z)), w * 0.5, frame, true));
      if (o.glare !== false) { const gl = new THREE.Mesh(new THREE.BoxGeometry(r * 0.6, 0.045, 0.005), glFlat("#FFFFFF", 0.6)); gl.position.set(s.x - r * 0.35, -(s.y - r * 0.28), z + 0.01); gl.rotation.z = Math.PI / 4 + 0.2; g.add(gl); }
      s.z = z;
    });
    if (o.mono) {   // the chain, hanging from the lens
      const r = rr2; g.add(glTube([0, 0.25, 0.5, 0.75, 1].map(u => { const a = [R.x + r * 0.7, R.y + r * 0.7], c = [R.x + r * 1.4, R.y + r * 2.4], b = [R.x + r * 0.4, R.y + r * 3.2]; return glV((1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1], R.z - u * 0.08); }), 0.014, frame));
      return g;
    }
    // the bridge over the nose, and the arms back to the temples (or the goggles' strap)
    const bz = (L.z + R.z) / 2 + 0.02;
    g.add(glTube([glV(L.x + rl * 0.9, L.y - rl * 0.25, L.z), glV((L.x + R.x) / 2, (L.y + R.y) / 2 - rl * 0.6, bz), glV(R.x - rr2 * 0.9, R.y - rr2 * 0.25, R.z)], w * 0.5, frame));
    if (o.arms !== false) for (const [s, r, sd] of [[L, rl, -1], [R, rr2, 1]]) g.add(glTube([glV(s.x + sd * r * 1.05, s.y - r * 0.2, s.z), glV(s.x + sd * r * 1.55, s.y - r * 0.4, s.z - 0.12), glV(sd * GL.temple, s.y - r * 0.45, 0.02)], w * 0.45, frame));
    if (o.strap) { const strap = r3dToon("#5A3A22"); for (const [s, r, sd] of [[L, rl, -1], [R, rr2, 1]]) g.add(glTube([glV(s.x + sd * r * 1.15, s.y, s.z - 0.02), glV(sd * GL.temple * 0.94, s.y - 0.04, 0.35), glV(sd * GL.temple * 1.02, s.y - 0.08, -0.1)], 0.07, strap)); }
    if (o.tape) { const T = r3dInked(new THREE.BoxGeometry(0.18, 0.2, 0.06), r3dToon("#F4F0E6")); T.position.set((L.x + R.x) / 2, -((L.y + R.y) / 2 - rl * 0.35), bz + 0.01); g.add(T); }
    return g;
  }
  // per frame: the pair this look wears, built for these sockets (rebuilt only when the sockets change size or place)
  function r3dGlassesPose(D, look, socks, t, zf = r3dShellZ, temple = 0.98) {
    const id = GLASSES[look.glasses] ? look.glasses : null;
    if (!id) { if (D.glasses) D.glasses.visible = false; return; }
    const key = id + "|" + (zf === r3dShellZ ? "shell" : "head") + "|" + socks.map(s => [s.x, s.y, s.rx, s.ry].map(v => v.toFixed(2)).join(",")).join("|");
    if (D.glassesKey !== key) {
      if (D.glasses) { D.geom.remove(D.glasses); D.glasses.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== R3D.cache.ink) o.material.dispose && o.material.dispose(); } }); }
      GL.zf = zf; GL.temple = temple; D.glasses = r3dGlassesModel(id, socks); D.glassesKey = key; if (D.glasses) D.geom.add(D.glasses);
    }
    if (!D.glasses) return;
    D.glasses.visible = true;
    if (D.glasses.userData.pulse) D.glasses.userData.pulse.opacity = 0.35 + 0.25 * (0.75 + 0.25 * Math.sin(t * 4));   // (the visor breathes, as the 2D's does)
  }
