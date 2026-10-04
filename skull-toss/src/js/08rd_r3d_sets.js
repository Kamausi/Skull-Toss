  // ───────────────────────── v68 3D: set pieces (the scenery, as a 1930s studio built it) ─────────────────────────
  // The Fleischer studio shot its cartoons in front of real miniature sets: flat painted pieces with thickness,
  // standing in depth, lit, and turning past the camera as it tracked. The scenery here is built the same way. Each
  // painted piece (a tree, a barn, a headstone, a lair) is cut out along its own outline and given real depth: its
  // painting on the front and back, its cut edge round the sides in the piece's own dark tone, lit by the map's key
  // light and inked. As the road bends and Morty travels, the pieces turn and their sides show, like a set.
  // The outline is traced once per piece from the painting's alpha (marching squares, then simplified), so every piece
  // of art the game has, and any added later, becomes a set piece with no hand modelling.
  const R3D_SETS = { res: 200, depth: 0.12, step: 2 };   // (whether a piece's depth can be seen at all is the runtime complexity manager's call: r3dWorth, 08rf_r3d_budget.js)
  // the outline of the opaque part of an image: the longest boundary loop, in pixels (marching squares on a grid)
  function r3dTrace(g, w, h, step) {
    const d = g.getImageData(0, 0, w, h).data, cols = Math.floor(w / step) + 2, rows = Math.floor(h / step) + 2;
    const on = (i, j) => { const x = (i - 1) * step, y = (j - 1) * step; return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 96; };
    const G = new Uint8Array(cols * rows); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) G[j * cols + i] = on(i, j) ? 1 : 0;
    const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? 0 : G[j * cols + i]);
    // Moore-neighbour boundary following from the first filled cell, for every separate blob; keep the biggest
    const seen = new Uint8Array(cols * rows), loops = [];
    const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (!at(i, j) || at(i - 1, j) || seen[j * cols + i]) continue;
      const loop = []; let ci = i, cj = j, dir = 6, guard = cols * rows * 4;
      do {
        loop.push([(ci - 1) * step, (cj - 1) * step]); seen[cj * cols + ci] = 1;
        let found = false;
        for (let k = 0; k < 8; k++) { const nd = (dir + 6 + k) % 8, ni = ci + N8[nd][0], nj = cj + N8[nd][1]; if (at(ni, nj)) { ci = ni; cj = nj; dir = nd; found = true; break; } }
        if (!found) break;
      } while ((ci !== i || cj !== j) && --guard > 0);
      if (loop.length > 8) loops.push(loop);
    }
    loops.sort((a, b) => b.length - a.length);
    return loops;
  }
  // a piece's cut edge is its own paint in shadow: the average of its opaque pixels, darkened
  function r3dEdgeTone(g, w, h, k = 0.55) {
    const d = g.getImageData(0, 0, w, h).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    return n ? new THREE.Color(r / n / 255 * k, gg / n / 255 * k, b / n / 255 * k).convertSRGBToLinear() : new THREE.Color(0x2a2018);
  }
  function r3dSimplify(pts, eps) {   // Ramer–Douglas–Peucker
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      let best = -1, bd = 0;
      for (let i = a + 1; i < b; i++) { const dd = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (dd > bd) { bd = dd; best = i; } }
      if (bd > eps && best > 0) { keep[best] = 1; st.push([a, best], [best, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  // a set piece from any painting: paint(g) draws it in canvas units into a cw × ch box with its foot at foot
  // (null if this frame's build budget is spent: it's cut later, the most visible first, and stays painted till then)
  function r3dSetPiece(key, cw, ch, foot, paint, edge = "#2A2018", prio = R3D_RCM.E) {
    if (R3D.cache["set:" + key]) return R3D.cache["set:" + key];
    if (!r3dMayBuild(key, prio, () => r3dSetPiece(key, cw, ch, foot, paint, edge, Infinity))) return null;
    const t0 = performance.now(), q = R3D_SETS.res / Math.max(cw, ch), w = Math.max(8, Math.ceil(cw * q)), h = Math.max(8, Math.ceil(ch * q));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.scale(q, q); paint(g); g.setTransform(1, 0, 0, 1, 0, 0);
    const loops = r3dTrace(g, w, h, R3D_SETS.step);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const grp = new THREE.Group(), face = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, map: tex, transparent: true, alphaTest: 0.35 }), side = r3dToon(edge);
    side.color.copy(r3dEdgeTone(g, w, h));   // (edge: kept as the fallback when a painting has no solid pixels)
    // the cut: every blob big enough (a tree's crown and its trunk are one; a cluster of pumpkins several), each extruded
    const depth = R3D_SETS.depth * Math.min(cw, ch * 0.8);
    for (const L of loops.slice(0, 6)) {
      if (L.length < 12) continue;
      const P = r3dSimplify(L, 1.1).map(([x, y]) => new THREE.Vector2(x / q - foot[0], -(y / q - foot[1])));
      if (P.length < 3) continue;
      const shape = new THREE.Shape(P);
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
      geo.translate(0, 0, -depth / 2);
      // the caps' UVs are the shape's own coordinates: map them onto the painting
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + foot[0]) / cw, 1 - (-pos.getY(i) + foot[1]) / ch);
      const mesh = new THREE.Mesh(geo, [face, side]), ink = new THREE.Mesh(geo, R3D.cache.ink || (R3D.cache.ink = r3dInk()));
      ink.renderOrder = -1; grp.add(ink, mesh);
    }
    grp.userData = { cw, ch, foot, depth }; r3dBuilt(t0);
    return (R3D.cache["set:" + key] = grp);
  }
  // draw one: its foot at screen (x, y), sc pixels per canvas unit at the foot's depth; turn (radians about the
  // vertical) sets how it stands to the lane; alpha fades it
  function r3dDrawSet(M, x, y, sc, o = {}) {
    if (!M) return false;
    const U = M.userData, metresPerUnit = o.mpu || 0.01 * (o.mul || 1), Z = F * metresPerUnit / Math.max(1e-4, sc);
    M.position.set((x - W / 2) * Z / F, -(y - HY) * Z / F, -Z);
    M.rotation.set(0, o.turn || 0, o.tilt ? -o.tilt : 0);
    M.scale.set(metresPerUnit * (o.flip || 1), metresPerUnit * (o.sy || 1), metresPerUnit);
    const hw = U.cw * sc, hh = U.ch * sc;
    return r3dDraw(M, { x: x - hw - 8, y: y - hh - 8, w: hw * 2 + 16, h: hh + U.depth * sc + 24 }, Math.max(1, Math.min(2.2, sc * 3)), o.alpha == null ? 1 : o.alpha, !o.now);
  }
  // a prop reacting to a hit (bending, shaking, falling: 07n_environment.js) is drawn by the 2D code until it settles
  const r3dReacting = k => !!(k.react && game.time - k.react.t0 < 1.3);
  // ── live set pieces: anything the 2D code draws fresh every frame (the cat, the owls and deer, the fish, the
  // targets, the obstacles, the bosses) becomes a cut-out with depth the same way, captured as it's drawn. The 2D
  // drawing is run into an offscreen copy of the stage (the global ctx swapped for a moment, as the water's mirror
  // does), the box round it is lifted off, its outline is traced (re-cut 12 times a second, as the old cartoons
  // animated on twos) and it's stood up at its own depth: lit, inked, with sides. box: the screen rect it fits in;
  // zc: its distance from the camera (F / p.s); thick: how deep it is, in metres.
  const R3D_LIVE = { cv: null, g: null, fps: 12, maxPx: 240 };
  // (what each live piece costs, painting and cutting included, for tools/perf3d.mjs: 08rf_r3d_budget.js)
  function r3dCapture(key, box, zc, thick, draw, alpha, maxPx) {
    const t0 = performance.now();
    try { return r3dCapture0(key, box, zc, thick, draw, alpha, maxPx); }
    finally { const k = key.replace(/[:\d]+$/, ""), C = R3D_RCM.cost; C[k] = (C[k] || 0) + performance.now() - t0; }
  }
  function r3dCapture0(key, box, zc, thick, draw, alpha = 1, maxPx = R3D_LIVE.maxPx) {
    if (!R3D_LIVE.cv) { R3D_LIVE.cv = document.createElement("canvas"); R3D_LIVE.g = R3D_LIVE.cv.getContext("2d", { willReadFrequently: true }); }
    const C = R3D_LIVE.cv; let x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y)), x1 = Math.min(W, Math.ceil(box.x + box.w)), y1 = Math.min(H, Math.ceil(box.y + box.h));
    if (x1 - x0 < 3 || y1 - y0 < 3) return false;
    // (the runtime complexity manager, 08rf_r3d_budget.js) a piece that isn't protected is 3D only while its depth shows,
    // and is painted and cut again only as often as it's worth (on twos while there's room); in between it keeps its
    // last painting and moves with its box, so its texture isn't sent to the GPU every frame
    let w3 = 1;
    if (!box.auto && !R3D_KEEP.test(key)) {
      w3 = r3dLiveWorth(key, thick * F / Math.max(0.1, zc)); if (w3 <= 0) return false;
      const P0 = R3D.cache["live:" + key], bw0 = x1 - x0, bh0 = y1 - y0;
      if (P0 && P0.frame === Math.floor(performance.now() / 1000 * r3dTraceHz(key, bw0 * bh0 / (W * H))) && Math.abs(bw0 - P0.bw) <= Math.max(2, P0.bw * 0.06) && Math.abs(bh0 - P0.bh) <= Math.max(2, P0.bh * 0.06)) {
        const k = zc / F; P0.grp.position.set((x0 - W / 2) * k, -(y0 - HY) * k, -zc); P0.grp.scale.set(k, k, k);
        return r3dDraw(P0.grp, { x: x0 - 6, y: y0 - 6, w: P0.bw + 12, h: P0.bh + 12 }, 1.4, alpha * w3, true) && w3 >= 1;
      }
    }
    const tc = performance.now();
    if (C.width !== Math.round(W * DPR) || C.height !== Math.round(H * DPR)) { C.width = Math.round(W * DPR); C.height = Math.round(H * DPR); }
    const g = R3D_LIVE.g, main = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(x0 * DPR - 2, y0 * DPR - 2, (x1 - x0) * DPR + 4, (y1 - y0) * DPR + 4);
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    ctx = g;
    R3D.capturing = true;
    try { g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); draw(); g.restore(); } finally { ctx = main; R3D.capturing = false; }
    // (a box given as the whole screen is tightened to what was actually drawn, from a small probe of it)
    if (box.auto) {
      const pw = 96, ph = Math.max(8, Math.round(96 * (y1 - y0) / (x1 - x0))), PR = R3D_LIVE.probe || (R3D_LIVE.probe = document.createElement("canvas"));
      PR.width = pw; PR.height = ph; const pg = PR.getContext("2d", { willReadFrequently: true }); pg.clearRect(0, 0, pw, ph); pg.drawImage(C, x0 * DPR, y0 * DPR, (x1 - x0) * DPR, (y1 - y0) * DPR, 0, 0, pw, ph);
      const d = pg.getImageData(0, 0, pw, ph).data; let a0 = pw, b0 = ph, a1 = -1, b1 = -1;
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) if (d[(j * pw + i) * 4 + 3] > 20) { if (i < a0) a0 = i; if (i > a1) a1 = i; if (j < b0) b0 = j; if (j > b1) b1 = j; }
      if (a1 < 0) return true;   // (nothing drawn: nothing to show)
      const sx = (x1 - x0) / pw, sy = (y1 - y0) / ph, nx0 = Math.max(x0, Math.floor(x0 + (a0 - 1) * sx)), ny0 = Math.max(y0, Math.floor(y0 + (b0 - 1) * sy));
      x1 = Math.min(x1, Math.ceil(x0 + (a1 + 2) * sx)); y1 = Math.min(y1, Math.ceil(y0 + (b1 + 2) * sy)); x0 = nx0; y0 = ny0;
    }
    // the piece: its painting (downsampled for the texture and the trace), re-cut on twos
    let P = R3D.cache["live:" + key];
    const bw = x1 - x0, bh = y1 - y0, q = Math.min(1, maxPx / Math.max(bw, bh)) * DPR, tw = Math.max(4, Math.round(bw * q)), th = Math.max(4, Math.round(bh * q));
    if (!P) { const cv = document.createElement("canvas"), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; P = R3D.cache["live:" + key] = { cv, pg: cv.getContext("2d", { willReadFrequently: true }), tex, grp: new THREE.Group(), frame: -1, face: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, map: tex, transparent: true, alphaTest: 0.42 }), side: r3dToon("#231A14"), bw: 0, bh: 0 }; }
    if (P.cv.width !== tw || P.cv.height !== th) { P.cv.width = tw; P.cv.height = th; P.tex.dispose(); P.tex = new THREE.CanvasTexture(P.cv); P.tex.colorSpace = THREE.SRGBColorSpace; P.face.map = P.tex; P.frame = -1; }
    P.pg.setTransform(1, 0, 0, 1, 0, 0); P.pg.clearRect(0, 0, tw, th); P.pg.drawImage(C, x0 * DPR, y0 * DPR, bw * DPR, bh * DPR, 0, 0, tw, th); P.tex.needsUpdate = true;
    const frame = Math.floor(performance.now() / 1000 * r3dTraceHz(key, bw * bh / (W * H)));   // (on twos while there's room: 08rf_r3d_budget.js)
    if (frame !== P.frame || Math.abs(bw - P.bw) > 2 || Math.abs(bh - P.bh) > 2) {
      P.frame = frame; P.bw = bw; P.bh = bh;
      for (const ch of P.grp.children.slice()) { if (ch.geometry && ch.userData.own) ch.geometry.dispose(); P.grp.remove(ch); }
      const loops = r3dTrace(P.pg, tw, th, 2), sx = bw / tw, sy = bh / th, dz = thick * F / Math.max(0.1, zc);   // (in screen pixels at its depth)
      P.side.color.copy(r3dEdgeTone(P.pg, tw, th));
      for (const L of loops.slice(0, 5)) {
        if (L.length < 10) continue;
        const pts = r3dSimplify(L, 1.1).map(([x, y]) => new THREE.Vector2(x * sx, -y * sy)); if (pts.length < 3) continue;
        const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: dz, bevelEnabled: false, steps: 1 }); geo.translate(0, 0, -dz / 2);
        const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / bw, 1 + pos.getY(i) / bh);
        const m = new THREE.Mesh(geo, [P.face, P.side]), ink = new THREE.Mesh(geo, R3D.cache.ink || (R3D.cache.ink = r3dInk())); m.userData.own = true; ink.renderOrder = -1;
        P.grp.add(ink, m);
      }
    }
    // stand it up: its box's top-left corner at (x0, y0) on screen, one pixel = zc / F metres at its depth
    const k = zc / F; P.grp.position.set((x0 - W / 2) * k, -(y0 - HY) * k, -zc); P.grp.scale.set(k, k, k); P.grp.rotation.set(0, 0, 0);
    R3D_RCM.t3d += performance.now() - tc;
    return r3dDraw(P.grp, { x: x0 - 6, y: y0 - 6, w: bw + 12, h: bh + 12 }, 1.4, alpha * w3, true) && w3 >= 1;
  }
  // a live piece round a point in the world: p its projection, ext [left, up, right, down] in metres about it
  function r3dLiveAt(key, p, ext, thick, draw, alpha = 1) {
    const s = p.s; return r3dCapture(key, { x: p.x - ext[0] * s, y: p.y - ext[1] * s, w: (ext[0] + ext[2]) * s, h: (ext[1] + ext[3]) * s }, F / s, thick, draw, alpha);
  }
  // a piece round Morty (his hat, his wings): x, y and r his screen centre and radius; ext its reach in Morty-radii
  function r3dNearMorty(key, x, y, r, ext, thick, draw) {
    if (!r3dOn()) { draw(); return; }
    const zc = F * SKULL_R / Math.max(0.5, r);
    r3dFlush();   // (it's drawn over him, so it goes down on its own, on fresh depth: 08r_r3d.js)
    if (!r3dCapture(key, { x: x - r * ext, y: y - r * ext, w: r * ext * 2, h: r * ext * 2, auto: true }, zc, thick, draw, 1, 320)) { draw(); return; }
    R3D.over = true; try { r3dFlush(); } finally { R3D.over = false; }
  }
  // a whole 2D drawing pass (a boss, the anchor overhead, an attraction's booth) as one live piece at depth z
  function r3dWrap(key, z, thick, draw, maxPx = 420) {
    if (!r3dOn()) { draw(); return; }
    const q = project(0, 1, z); if (!r3dCapture(key, { x: 0, y: 0, w: W, h: H, auto: true }, F / q.s, thick, draw, 1, maxPx)) draw();
  }
