  // ───────────────────────── v68 3D: set pieces (the scenery, as a 1930s studio built it) ─────────────────────────
  // The Fleischer studio shot its cartoons in front of real miniature sets: flat painted pieces with thickness,
  // standing in depth, lit, and turning past the camera as it tracked. The scenery here is built the same way. Each
  // painted piece (a tree, a barn, a headstone, a lair) is cut out along its own outline and given real depth: its
  // painting on the front and back, its cut edge round the sides in the piece's own dark tone, lit by the map's key
  // light and inked. As the road bends and Morty travels, the pieces turn and their sides show, like a set.
  // The outline is traced once per piece from the painting's alpha (marching squares, then simplified), so every piece
  // of art the game has, and any added later, becomes a set piece with no hand modelling.
  const R3D_SETS = { res: 200, depth: 0.12, step: 2 };
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
  function r3dSetPiece(key, cw, ch, foot, paint, edge = "#2A2018") {
    if (R3D.cache["set:" + key]) return R3D.cache["set:" + key];
    const q = R3D_SETS.res / Math.max(cw, ch), w = Math.max(8, Math.ceil(cw * q)), h = Math.max(8, Math.ceil(ch * q));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.scale(q, q); paint(g); g.setTransform(1, 0, 0, 1, 0, 0);
    const loops = r3dTrace(g, w, h, R3D_SETS.step);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const grp = new THREE.Group(), face = new THREE.MeshToonMaterial({ map: tex, gradientMap: R3D.ramp, transparent: true, alphaTest: 0.35 }), side = r3dToon(edge);
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
    grp.userData = { cw, ch, foot, depth };
    return (R3D.cache["set:" + key] = grp);
  }
  // draw one: its foot at screen (x, y), sc pixels per canvas unit at the foot's depth; turn (radians about the
  // vertical) sets how it stands to the lane; alpha fades it
  function r3dDrawSet(M, x, y, sc, o = {}) {
    const U = M.userData, metresPerUnit = o.mpu || 0.01 * (o.mul || 1), Z = F * metresPerUnit / Math.max(1e-4, sc);
    M.position.set((x - W / 2) * Z / F, -(y - HY) * Z / F, -Z);
    M.rotation.set(0, o.turn || 0, o.tilt ? -o.tilt : 0);
    M.scale.set(metresPerUnit * (o.flip || 1), metresPerUnit * (o.sy || 1), metresPerUnit);
    const hw = U.cw * sc, hh = U.ch * sc;
    return r3dDraw(M, { x: x - hw - 8, y: y - hh - 8, w: hw * 2 + 16, h: hh + U.depth * sc + 24 }, Math.max(1, Math.min(2.2, sc * 3)), o.alpha == null ? 1 : o.alpha);
  }
  // a prop reacting to a hit (bending, shaking, falling: 07n_environment.js) is drawn by the 2D code until it settles
  const r3dReacting = k => !!(k.react && game.time - k.react.t0 < 1.3);
