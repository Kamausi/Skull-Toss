  // ───────────────────────── v71: the scatter (Wilds of Aether's instanced environment pass) ─────────────────────────
  // Wilds dresses its land in instanced sets: one InstancedMesh, so one draw call, for every copy of a thing, placed by
  // a seeded hash (deterministic), under ecological rules (how dense by distance band, never on steep ground or in the
  // water, clear of the paths), each copy with its own scale, turn, lean and colour. The same here, on Skull Toss's
  // track. The track moves, so a set is laid out in cells along it: cell c (cellLen metres of road) holds its copies,
  // seeded by c alone, so a tuft stays where it was put as the road goes by, and only the cells in view are placed.
  // Each copy goes where the 2D camera draws its foot (r3dWorldPut), at its true size (at the depth F / s, a world
  // metre comes out s pixels, as in 2D).
  //
  // The sets (each map takes the ones its look asks for):
  //   grass   Wilds' blade tufts, in the map's grass colours: what the painted plate's inked ticks were
  //   rocks   on slopes and by the road, in the map's stone (Wilds' rock fallback: a faceted dodecahedron)
  //   lane    the road's own dressing as geometry: rail ties and rails, boardwalk planks and their posts, flagstones
  // Grass and the lane don't write depth (they lie on the ground and must never cut the slingshot or a boss's feet);
  // rocks do, and keep out of the play's nine metres.
  const R3D_SCATTER = { on: true, sets: null, map: -1, counts: {}, placed: 0 };
  const scHash = (x, z, seed = 7319) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed, 1442695041)) | 0; n ^= n >>> 13; n = Math.imul(n, 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967295; };
  const scRand = (i, salt = 0) => scHash((i * 92821 + salt * 68917) | 0, (i * 31337 - salt * 9187) | 0, 7319 + salt * 101);   // (Wilds' envRand)
  // Wilds' grass tuft: thin blades round a centre, each a triangle leaning out
  function scBladeGeometry(blades = 5, height = 0.42, radius = 0.11, width = 0.045) {
    const verts = [], idx = [];
    for (let b = 0; b < blades; b++) {
      const a = b / blades * TAU, dx = Math.cos(a), dz = Math.sin(a), sx = -dz * width * 0.5, sz = dx * width * 0.5, o = radius * (0.18 + (b % 3) * 0.12), ox = dx * o, oz = dz * o, k = verts.length / 3;
      verts.push(ox + sx, 0, oz + sz, ox - sx, 0, oz - sz, ox + dx * width * 0.12 + dx * height * 0.18, height, oz + dz * width * 0.12 + dz * height * 0.18);
      idx.push(k, k + 1, k + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const scMat = o => new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, toneMapped: R3D_WORLD.filmic, ...o });   // (matte, like the land: 08ri_r3d_world.js)
  // a set: its mesh, how its track is cut into cells, and the rule that places a cell's copies (null: nothing there)
  // (place must depend on the seed alone, never on where the camera is, or a cell laid out from further down the road
  // would differ from the same cell laid out here; what depends on the camera, how far off the copy is, goes in show)
  function scSet(name, geo, mat, max, cellLen, per, zMin, zMax, place, cast = false, show = null) {
    const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.name = "Scatter_" + name; mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.renderOrder = 3;   // (after the land, the water and the road: a set that doesn't write depth must come after the ground it lies on)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { name, mesh, max, cellLen, per, zMin, zMax, place, show, cells: new Map() };
  }
  function scCell(S, c) {   // a cell's copies, worked out once (seeded by the set and the cell)
    let A = S.cells.get(c); if (A) return A;
    A = []; const salt = S.name.length * 131 + S.name.charCodeAt(0);
    for (let n = 0; n < S.per; n++) { const r = k => scRand(c * 977 + n * 13 + k, salt), P = S.place(c, n, r); if (P) A.push(P); }
    S.cells.set(c, A); return A;
  }
  // the land's slope where the track was laid (static: the land's own height, before it eases in near the camera)
  const scSlope = (d, u) => { if (!LAND.on || LAND.flat) return 0; const e = 0.6, a = landH(d, u - e), b = landH(d, u + e), c = landH(d - e, u), f = landH(d + e, u); return 1 - 1 / Math.hypot((b - a) / (2 * e), (f - c) / (2 * e), 1); };
  function r3dScatterBuild() {
    const L = look(), R = R3D_SCATTER; R.map = sceneMap; R.counts = {};
    if (R.sets) for (const S of R.sets) { R3D_WORLD.root.remove(S.mesh); S.mesh.dispose(); S.mesh.material.dispose(); if (S.own) S.mesh.geometry.dispose(); }
    R.sets = [];
    const lane = L.lane, PH = pathHalf(), rgb = s => new THREE.Color(s), G = L.grass || [];
    const roadHalf = z => (z < RING_Z + 1.5 ? 0.95 : PH);   // (the near lane is a little wider: 05c_scene_ground.js)
    if (G.length && !(L.ambient && L.ambient.water)) {   // grass: thicker near, thinning toward the far land, never on the road
      const cols = [rgb(G[0]), rgb(G[1] || G[0]), rgb(G[0]).lerp(rgb(L.ground[1]), 0.35), rgb(G[1] || G[0]).lerp(new THREE.Color(0xffffff), 0.08)];
      const S = scSet("grass", scBladeGeometry(5, 0.34, 0.09, 0.04), scMat({ side: THREE.DoubleSide, depthWrite: false }), 900, 1.5, 14, -0.5, 60, (c, n, r) => {
        const d = c * 1.5 + r(1) * 1.5, u = (r(2) * 2 - 1) * 14;
        if (Math.abs(u) < PH + 0.12 || scSlope(d, u) > 0.3) return null;
        return { d, u, keep: r(3), s: 0.55 + r(4) * 0.8, rot: r(5) * TAU, tilt: (r(6) - 0.5) * 0.25, col: cols[(r(7) * cols.length) | 0] };
      }, false, (P, z) => P.keep <= clamp(1 - z / 70, 0.25, 1) * 0.85 && Math.abs(P.u) >= roadHalf(z) + 0.12);   // (thicker near, thinning off; off the lane, wider near)
      S.own = true; R.sets.push(S);
    }
    if (LAND.on && !LAND.flat) {   // rocks: where the land is steep, and a few by the road; clear of the play
      const pal = [L.hills[2] || L.ground[1], L.hills[1] || L.ground[1], "#6e746c", "#7b7d73"].map(s => rgb(s).lerp(new THREE.Color(0x76736c), 0.4));
      const S = scSet("rocks", new THREE.DodecahedronGeometry(0.34, 0), scMat({}), 160, 6, 4, LAND_NEAR, 120, (c, n, r) => {
        const d = c * 6 + r(1) * 6, u = (r(2) * 2 - 1) * 26, sl = scSlope(d, u), roadside = Math.abs(Math.abs(u) - PH - 1.2) < 0.8;
        if (Math.abs(u) < PH + 0.5 || r(3) > clamp(sl * 2.2 + (roadside ? 0.25 : 0), 0, 0.9)) return null;
        const h = 0.25 + r(4) * 0.9; return { d, u, s: [0.7 + h, 0.5 + h * 0.6, 0.7 + h], lift: 0.08, rot: r(5) * TAU, tilt: (r(6) - 0.5) * 0.3, col: pal[(r(7) * pal.length) | 0] };
      }, true);
      S.own = true; R.sets.push(S);
    }
    // the lane's dressing, as geometry: what the painted plate drew in lines
    const gap = z => lane === "boardwalk" && z > WALK_END && z < PATH_FROM;   // (the boardwalk stops short of the ring, which stands in open water: 05c_scene_ground.js)
    const along = (name, geo, col, step, per, fn, max = 520) => {
      const S = scSet(name, geo, scMat({ depthWrite: false }), max, step, per, -0.6, 70, (c, n, r) => { const P = fn(c, n, r); if (P && !P.col) P.col = new THREE.Color(col); return P; }, false, (P, z) => !gap(z));
      S.own = true; S.flat = true; R.sets.push(S);
    };
    if (lane === "rails") {
      along("ties", new THREE.BoxGeometry(1.5, 0.07, 0.2), 0x3a2a1e, 0.7, 1, (c, n, r) => ({ d: c * 0.7, u: (r(1) - 0.5) * 0.06, s: 1, rot: (r(2) - 0.5) * 0.06, col: new THREE.Color(0x3a2a1e).multiplyScalar(0.85 + r(3) * 0.3) }));
      along("rails", new THREE.BoxGeometry(0.06, 0.07, 0.72), 0xb8ae9a, 0.7, 2, (c, n) => ({ d: c * 0.7 + 0.35, u: n ? 0.48 : -0.48, s: 1, y: 0.06, heading: true }));
    } else if (lane === "boardwalk") {
      along("planks", new THREE.BoxGeometry(1.36, 0.05, 0.26), 0x5a3e26, 0.3, 1, (c, n, r) => ({ d: c * 0.3, u: (r(1) - 0.5) * 0.04, s: 1, y: 0.05, rot: (r(2) - 0.5) * 0.05, col: new THREE.Color(0x5a3e26).multiplyScalar(0.8 + r(3) * 0.35) }));
      along("posts", new THREE.CylinderGeometry(0.06, 0.07, 0.6, 7), 0x3a2818, 2, 2, (c, n) => ({ d: c * 2, u: n ? 0.7 : -0.7, s: 1, y: -0.22 }));
    } else if (lane === "flagstone") {
      along("slabs", new THREE.BoxGeometry(0.5, 0.05, 0.48), 0x463e52, 0.55, 3, (c, n, r) => ({ d: c * 0.55 + (r(1) - 0.5) * 0.04, u: (n - 1) * 0.55 + (r(2) - 0.5) * 0.05, s: [0.9 + r(3) * 0.15, 1, 0.9 + r(4) * 0.15], rot: (r(5) - 0.5) * 0.12, col: new THREE.Color(0x463e52).multiplyScalar(0.8 + r(6) * 0.4) }), 600);
    }
    for (const S of R.sets) R3D_WORLD.root.add(S.mesh);
  }
  const SC_M = { m: null, q: null, p: null, s: null, e: null };
  function r3dScatterUpdate() {
    const R = R3D_SCATTER;
    if (!R.sets || R.map !== sceneMap) { if (!SC_M.m) { SC_M.m = new THREE.Matrix4(); SC_M.q = new THREE.Quaternion(); SC_M.p = new THREE.Vector3(); SC_M.s = new THREE.Vector3(); SC_M.e = new THREE.Euler(); } r3dScatterBuild(); }
    const D = R3D_WORLD.f.D, arr = [0, 0, 0], water = R3D_WORLD.pal.water; R.placed = 0;
    for (const S of R.sets) {
      S.mesh.visible = R.on;
      if (!R.on) continue;
      const c0 = Math.floor((D + S.zMin) / S.cellLen), c1 = Math.floor((D + S.zMax) / S.cellLen);
      for (const k of S.cells.keys()) if (k < c0 - 1) S.cells.delete(k);   // (the cells behind the camera are gone)
      let n = 0;
      for (let c = c1; c >= c0 && n < S.max; c--) {   // far to near: the sets that don't write depth paint in that order
        for (const P of scCell(S, c)) {
          if (n >= S.max) break;
          const z = P.d - D; if (z < S.zMin || z > S.zMax || (S.show && !S.show(P, z))) continue;
          const cx = wCx(z), x = cx + P.u, y = wY(z, P.u, x) + (S.flat && water ? 0.42 : 0) + (P.y || 0) + (P.lift || 0) * (Array.isArray(P.s) ? P.s[1] : P.s);   // (the lane's dressing stands on the water, not the bed under it)
          r3dWorldPut(arr, 0, x, y, z);
          let rot = P.rot || 0; if (P.heading || S.flat) rot -= Math.atan(wCx(z + 0.5) - wCx(z - 0.5));   // (along the road as it bends: a box's length turns from −Z, the way ahead, toward the bend)
          SC_M.p.set(arr[0], arr[1], arr[2]); SC_M.e.set(P.tilt || 0, rot, 0); SC_M.q.setFromEuler(SC_M.e);
          if (Array.isArray(P.s)) SC_M.s.set(P.s[0], P.s[1], P.s[2]); else SC_M.s.setScalar(P.s || 1);
          SC_M.m.compose(SC_M.p, SC_M.q, SC_M.s); S.mesh.setMatrixAt(n, SC_M.m);
          if (P.col) S.mesh.setColorAt(n, P.col);
          if (!n) S.first = P;   // (the first copy drawn, for the spec: where it was put on the track)
          n++;
        }
      }
      S.mesh.count = n; S.mesh.instanceMatrix.needsUpdate = true; if (S.mesh.instanceColor) S.mesh.instanceColor.needsUpdate = true;
      R.counts[S.name] = n; R.placed += n;
      if (S.mesh.material.toneMapped !== R3D_WORLD.filmic) { S.mesh.material.toneMapped = R3D_WORLD.filmic; S.mesh.material.needsUpdate = true; }
    }
  }
