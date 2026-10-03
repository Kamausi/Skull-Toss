  // ───────────────────────── v71: the world (the owner's Wilds of Aether engine, in Skull Toss) ─────────────────────────
  // The owner's call (2026-10-03): upgrade the game with the Wilds of Aether engine before the visual overhaul. This is
  // its world layer, brought over: one lit scene, rendered once a frame before anything else 3D, with
  //   - the terrain foundation: a height field coloured per vertex by masks (in Wilds: meadow, forest, the wet band and
  //     rock on slopes; here each map's own ground gradient, its hill colour where the land rises, rock where it's steep,
  //     the stage light at the ring, and a low mottle of value noise), lit by a hemisphere and a shadow-casting key;
  //   - the road as its own ribbon over it, so it keeps its width at any distance;
  //   - the map's fog, so the far land goes into the painted horizon (the sky and the skyline stay matte paintings);
  //   - water where the map has open water (Wilds' physical plane), the land under it sunk to a bed.
  // It has to agree with the 2D world wherever the two meet, so it's built from the same functions. The height is the
  // land's own (06h_land.js: landH, the road's bend landCx, flat within nine metres), and each vertex goes where the 2D
  // camera (04c_camera.js project) draws that point, at the depth r3dPlace would give a model there. So the multiplane
  // parallax, the rostrum camera, the road's yaw and the projector's weave all carry over, and a model standing on the
  // ground meets it. It writes the frame's depth (08r_r3d.js), so the 3D pieces drawn after it go behind a crest.
  //
  // The colour is calibrated so flat, unshadowed ground comes out exactly the painted plate's colour: the hemisphere
  // gives WORLD_FILL of it and the key the rest, both divided by π (Three's lights are physical: a Lambert surface under
  // irradiance E returns albedo·E/π). Slopes turned to the key come up brighter, slopes turned away and shadows go down
  // toward the fill. The world's materials are toneMapped: false by default, like the cel family, so the painted
  // palettes hold; R3D_WORLD.filmic sends them through the renderer's ACES curve instead (r3dFilmic in a dev build).
  const R3D_WORLD = { on: true, filmic: false, ok: false, f: { D: 0, base: 0, yaw: 0 }, scene: null, sun: null, hemi: null, land: null, road: null, water: null, key: "", look: "", drawn: false, frames: 0, ms: 0, sunDir: null };
  const WORLD_GRID = { NC: 56, NR: 56, NEAR: 14 }, WORLD_ROAD_NC = 4, WORLD_FILL = 0.55, WORLD_ZFAR = 300;
  const WORLD_LANE = { dirt: ["rgba(120,92,62,.3)", 0.95], flagstone: ["rgba(70,60,86,.5)", 1.0], boardwalk: ["#5A3E26", 0.7], sand: ["rgba(236,196,140,.3)", 0.95], rails: ["rgba(40,30,24,.5)", 0.8], void: ["rgba(160,120,255,.16)", 0.65], seabed: ["rgba(120,92,62,.3)", 1.5], furrows: ["rgba(150,110,70,.25)", 0.8], bones: ["rgba(120,92,62,.3)", 0.95] };
  const WORLD_RIDGES = [[46, 0.9, 1], [34, 0.7, 2], [26, 0.55, 3]];   // the plate's painted hills (05_layers.js buildGround), for a map whose land is flat
  const wSrgb = c => c / 255;
  const wLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));   // (colours are mixed as the 2D canvas mixes them, in sRGB, then handed to the GPU linear)
  const wMix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const wRgba = s => { const c = rgbaOf(s); return [wSrgb(c[0]), wSrgb(c[1]), wSrgb(c[2]), c[3]]; };
  // a grid of (nc + 1) × (nr + 1) vertices, rows near to far, columns left to right, faces up
  function r3dWorldGrid(nc, nr) {
    const g = new THREE.BufferGeometry(), n = (nc + 1) * (nr + 1), idx = [];
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) { const a = j * (nc + 1) + i, b = a + 1, c = a + nc + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    g.setIndex(idx);
    for (const k of ["position", "normal", "color"]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return g;
  }
  // where the 2D camera draws a world point, as a camera-space position: on the same pixel, at the depth F / s that
  // r3dPlace gives a model there
  function r3dWorldPut(arr, k, x, y, z) {
    const p = project(x, y, z), s = Math.max(1e-4, p.s);
    arr[k] = (p.x - W / 2) / s; arr[k + 1] = -(p.y - HY) / s; arr[k + 2] = -F / s;
  }
  // (Wilds' land is MeshStandardMaterial at roughness 0.96, meant matte. Here the key is the moon, ahead of the camera,
  // and the land is seen at a grazing angle toward it, where even a rough surface's Fresnel sheen floods it grey; so
  // the land takes the matte surface it was meant to be, a Lambert, which is also what the calibration assumes)
  function r3dWorldMat(o) { return new THREE.MeshLambertMaterial({ vertexColors: true, toneMapped: R3D_WORLD.filmic, ...o }); }
  function r3dWorldBuild() {
    if (R3D_WORLD.ok) return true;
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 1), hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;   // (one cascade, 1024²: docs/PRODUCTION-AUDIT.md CC-001)
    const sc = sun.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 1; sc.far = 160;
    scene.add(sun, sun.target, hemi);
    const { NC, NR } = WORLD_GRID;
    // the land: the near rows (flat, where the play happens) don't write depth, so nothing that hangs below the ground
    // there (the slingshot's handle) is cut; the rest does, so a crest hides what's beyond it
    const landGeo = r3dWorldGrid(NC, NR), mats = [r3dWorldMat({ depthWrite: false }), r3dWorldMat()];
    const land = new THREE.Mesh(landGeo, mats); land.receiveShadow = true; land.castShadow = true; land.frustumCulled = false; land.name = "WorldLand";
    const roadGeo = r3dWorldGrid(WORLD_ROAD_NC, NR), road = new THREE.Mesh(roadGeo, r3dWorldMat({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
    road.receiveShadow = true; road.frustumCulled = false; road.renderOrder = 1; road.name = "WorldRoad";
    // water. Wilds' is a translucent physical plane with a clear coat; under a low moon ahead of the camera its sheen
    // floods it white at the grazing angles this camera sees it at (as Wilds' land's does), and a translucent plane is
    // drawn after everything opaque, over the boardwalk. So here it's matte and opaque, the painted water's own colours
    // (05c_scene_ground.js paintWater over the ground), drawn after the land and before the road and the dressing; the
    // 2D sheens and the moon's path still play over it (08l_water.js). Its own shader (Fresnel, Beer–Lambert: the visual
    // direction, docs/PRODUCTION-AUDIT.md §5) is the overhaul's.
    const waterGeo = r3dWorldGrid(28, 24), water = new THREE.Mesh(waterGeo, r3dWorldMat({ depthWrite: false }));
    water.receiveShadow = true; water.frustumCulled = false; water.renderOrder = 0.5; water.visible = false; water.name = "WorldWater";
    const root = new THREE.Group(); root.name = "WorldRoot"; root.add(land, road, water); scene.add(root);
    Object.assign(R3D_WORLD, { ok: true, scene, sun, hemi, root, land, road, water, rows: new Float32Array(NR + 1), split: 0 });
    return true;
  }
  // the rows: evenly spaced on the screen (so equally fine everywhere it's seen), from below the frame's foot to the
  // horizon; and the palette, when the map or the screen changes
  function r3dWorldLayout() {
    const B = bleed(), key = `${W}|${H}|${HY}|${F}|${CAMY}|${sceneMap}|${R3D_WORLD.filmic}`;
    if (key === R3D_WORLD.key) return;
    R3D_WORLD.key = key;
    // the play's flat ground (to where the land may start to rise) gets NEAR rows, evenly spaced on the screen; the land
    // beyond gets the rest, each a fixed step further than the last (×1.09 or so), so a hill forty metres off is still
    // a few rows deep
    const { NC, NR, NEAR } = WORLD_GRID, rows = R3D_WORLD.rows, zcFoot = (CAMY * F) / Math.max(1, H + B - HY), zc0 = Math.max(0.6, zcFoot * 0.8), zcS = Math.max(zc0 + 1, LAND_NEAR - 1 + CAM_BACK);
    for (let j = 0; j <= NEAR; j++) rows[j] = 1 / (1 / zc0 + (1 / zcS - 1 / zc0) * (j / NEAR));
    for (let j = NEAR + 1; j <= NR; j++) rows[j] = zcS * Math.pow(WORLD_ZFAR / zcS, (j - NEAR) / (NR - NEAR));
    const split = NEAR;   // (where the land may start to rise)
    const geo = R3D_WORLD.land.geometry; geo.clearGroups(); geo.addGroup(0, split * NC * 6, 0); geo.addGroup(split * NC * 6, (NR - split) * NC * 6, 1);
    R3D_WORLD.split = split;
    const L = look(), lane = WORLD_LANE[L.lane] || WORLD_LANE.dirt;
    R3D_WORLD.pal = {
      ground: L.ground.map(c => wRgba(c)), hills: (L.hills.length ? L.hills : [L.ground[0]]).map(c => wRgba(c)), light: wRgba(L.light || "rgba(0,0,0,0)"),
      lane: wRgba(lane[0]), laneNear: lane[1], none: L.lane === "none", water: !!(L.ambient && L.ambient.water),
      rock: wMix(wRgba(L.hills[2] || L.ground[1]), [0.42, 0.41, 0.39], 0.45), bed: wMix(wRgba(L.ground[2]), [0.16, 0.27, 0.3], 0.5)
    };
    for (const m of [...R3D_WORLD.land.material, R3D_WORLD.road.material, R3D_WORLD.water.material]) if (m.toneMapped !== R3D_WORLD.filmic) { m.toneMapped = R3D_WORLD.filmic; m.needsUpdate = true; }
  }
  // the frame's track (set by r3dWorldUpdate): where the road's middle is at z, and the ground's height there
  const wCx = z => { const f = R3D_WORLD.f; return LAND.on && z > LAND_NEAR - 1 ? (landCx(f.D + z) - landCx(f.D) - f.yaw * z) * landKC(z) : 0; };
  const wY = (z, u, x) => r3dWorldH(R3D_WORLD.f.D, R3D_WORLD.f.base, z, u, x);
  // the ground plate's own gradient (05_layers.js buildGround), at a screen height
  function r3dWorldGrad(y) {
    const G = R3D_WORLD.pal.ground, t = clamp((y - HY) / Math.max(1, H + bleed() - HY), 0, 1);
    return t < 0.3 ? wMix(G[0], G[1], t / 0.3) : t < 0.7 ? wMix(G[1], G[2], (t - 0.3) / 0.4) : wMix(G[2], G[3], (t - 0.7) / 0.3);
  }
  // the land's height where the 2D draws it (06h_land.js landSlices), plus the plate's painted hills on a flat map
  function r3dWorldH(D, base, z, u, x) {
    let y = 0;
    if (LAND.on && !LAND.flat) { const kh = landKH(z); if (kh) y = (landH(D + z, u) - base) * kh; }
    else if (!R3D_WORLD.pal.water) {
      const zc = z + CAM_BACK;
      for (const [zr, amp, seed] of WORLD_RIDGES) y = Math.max(y, amp * (0.55 + 0.45 * Math.sin(x * 0.42 + seed * 2)) * smooth(clamp((zc - (zr - 9)) / 9, 0, 1)));
    }
    return R3D_WORLD.pal.water ? y - 0.42 : y;   // (under open water the land is a bed)
  }
  function r3dWorldUpdate() {
    r3dWorldLayout();
    const WD = R3D_WORLD, P = WD.pal, { NC, NR } = WORLD_GRID, rows = WD.rows;
    const D = landD(), base = LAND.on && !LAND.flat ? landH(D, 0) : 0, yaw = LAND.on ? roadYaw() : 0, PH = pathHalf(), cx = wCx;
    WD.f = { D, base, yaw };
    // ── the land
    const lg = WD.land.geometry, pos = lg.attributes.position.array, nrm = lg.attributes.normal, col = lg.attributes.color.array;
    const x0 = -0.3 * W, x1 = 1.3 * W;
    for (let j = 0; j <= NR; j++) {
      const zc = rows[j], z = zc - CAM_BACK, c = cx(z);
      for (let i = 0; i <= NC; i++) { const x = ((x0 + (x1 - x0) * i / NC) - W / 2) * zc / F; r3dWorldPut(pos, (j * (NC + 1) + i) * 3, x, r3dWorldH(D, base, z, x - c, x), z); }
    }
    lg.attributes.position.needsUpdate = true; lg.computeVertexNormals();
    const lp = projectBase(0, 0, RING_Z), poolR = U * 0.7, LT = P.light, H0 = P.hills;
    for (let j = 0; j <= NR; j++) {
      const zc = rows[j], z = zc - CAM_BACK, c = cx(z), g = r3dWorldGrad(projectBase(0, 0, z).y), mottle = clamp(1 - (zc - 30) / 50, 0, 1) * 0.075;
      for (let i = 0; i <= NC; i++) {
        const v = j * (NC + 1) + i, k = v * 3, x = ((x0 + (x1 - x0) * i / NC) - W / 2) * zc / F, u = x - c, y = r3dWorldH(D, base, z, u, x) + (P.water ? 0.42 : 0);
        let rgb = g;
        if (y > 0.02) rgb = wMix(rgb, H0[0], LAND.flat ? clamp(y / 0.5, 0, 1) * 0.85 : clamp(y / 3, 0, 1) * 0.5);   // (the map's hill colour comes up through the land where it rises; on a flat map, the plate's painted hills)
        const slope = 1 - clamp(nrm.getY(v), 0, 1); if (slope > 0.19) rgb = wMix(rgb, P.rock, smooth(clamp((slope - 0.19) / 0.27, 0, 1)) * 0.8);   // (Wilds: exposed stone belongs to the slope)
        if (P.water) rgb = wMix(rgb, P.bed, 0.6);
        const bp = projectBase(x, 0, z), dx = bp.x - lp.x, dy = (bp.y - lp.y) / 0.32, pool = 1 - Math.hypot(dx, dy) / poolR;   // (the stage light where the ring lives)
        if (pool > 0) rgb = wMix(rgb, LT, LT[3] * pool);
        const m = mottle ? 1 + MC.noise(u * 0.55, (D + z) * 0.55, 7319) * mottle : 1;   // (Wilds' micro-variation, fixed to the land so it doesn't crawl)
        col[k] = wLin(clamp(rgb[0] * m, 0, 1)); col[k + 1] = wLin(clamp(rgb[1] * m, 0, 1)); col[k + 2] = wLin(clamp(rgb[2] * m, 0, 1));
      }
    }
    lg.attributes.color.needsUpdate = true;
    // ── the road: a ribbon over the land, the lane's own colour over the ground under it, fading out far off
    const rg = WD.road.geometry, rp = rg.attributes.position.array, rc = rg.attributes.color.array;
    WD.road.visible = !P.none;
    if (!P.none) {
      for (let j = 0; j <= NR; j++) {
        const zc = rows[j], z = zc - CAM_BACK, c = cx(z), half = z < RING_Z + 1.5 ? P.laneNear - (P.laneNear - PH) * clamp(z / (RING_Z + 1.5), 0, 1) : PH;
        const walk = look().lane === "boardwalk" ? (z <= WALK_END ? 1 : z < PATH_FROM ? 0 : pathIn(z)) : 1;   // (the boardwalk stops short of the ring, in open water, and the road comes in past it)
        const a = P.lane[3] * clamp((150 - z) / 60, 0, 1), g = r3dWorldGrad(projectBase(0, 0, z).y), lift = P.water ? 0.47 : 0, hw = half * walk;   // (a gap is the ribbon narrowed to nothing, not faded: under it is water)
        for (let i = 0; i <= WORLD_ROAD_NC; i++) {
          const u = -hw + (2 * hw * i) / WORLD_ROAD_NC, k = (j * (WORLD_ROAD_NC + 1) + i) * 3, rgb = wMix(g, P.lane, a);
          r3dWorldPut(rp, k, c + u, r3dWorldH(D, base, z, u, c + u) + lift, z);
          rc[k] = wLin(rgb[0]); rc[k + 1] = wLin(rgb[1]); rc[k + 2] = wLin(rgb[2]);
        }
      }
      rg.attributes.position.needsUpdate = rg.attributes.color.needsUpdate = true; rg.computeVertexNormals();
    }
    // ── water: flat, out to the horizon
    WD.water.visible = P.water;
    if (P.water) {
      const wg = WD.water.geometry, wp = wg.attributes.position.array, n = 28, m = 24;
      const wc = wg.attributes.color.array, top = HY + 1, bot = H + bleed();
      const WG = [[0, [120, 150, 160, 0.28]], [0.18, [40, 70, 86, 0.18]], [0.55, [10, 20, 30, 0.1]], [1, [30, 56, 70, 0.16]]];   // (paintWater's wash, top to bottom)
      const wash = y => { const t = clamp((y - top) / Math.max(1, bot - top), 0, 1); let i = 0; while (i < WG.length - 2 && t > WG[i + 1][0]) i++; const [ta, a] = WG[i], [tb, b] = WG[i + 1], k = clamp((t - ta) / (tb - ta), 0, 1); return a.map((v, q) => v + (b[q] - v) * k); };
      for (let j = 0; j <= m; j++) {
        const zc = rows[Math.round(j * NR / m)], z = zc - CAM_BACK, by = projectBase(0, 0, z).y, wv = wash(by), rgb = wMix(r3dWorldGrad(by), [wv[0] / 255, wv[1] / 255, wv[2] / 255], wv[3]);
        for (let i = 0; i <= n; i++) { const k = (j * (n + 1) + i) * 3; r3dWorldPut(wp, k, ((x0 + (x1 - x0) * i / n) - W / 2) * zc / F, 0, z); wc[k] = wLin(rgb[0]); wc[k + 1] = wLin(rgb[1]); wc[k + 2] = wLin(rgb[2]); }
      }
      wg.attributes.position.needsUpdate = wg.attributes.color.needsUpdate = true; wg.computeVertexNormals();
    }
    r3dWorldLights();
    r3dScatterUpdate();   // (the instanced dressing on the land: 08rj_r3d_scatter.js)
  }
  // the key comes from the moon, where it hangs in the painted sky (so the land is lit from where its light is), else
  // from up and to the left behind the camera like the cel key; the fill is the map's sky over its ground. Both are
  // scaled so flat ground in the open is exactly the plate's colour (see the top).
  function r3dWorldLights() {
    const WD = R3D_WORLD, L = look(), sky = L.sky || ["#261826", "#D08A48"];
    let dir = new THREE.Vector3(-0.45, 0.62, 0.64);
    if (moon.r && moon.kind !== "screen") dir.set((moon.x - W / 2) / F, (HY - moon.y) / F, -1);
    dir.normalize(); if (dir.y < 0.3) { dir.y = 0.3; dir.normalize(); }
    WD.sunDir = dir;
    const target = new THREE.Vector3(0, -CAMY, -(RING_Z + CAM_BACK + 10));
    WD.sun.target.position.copy(target); WD.sun.position.copy(target).addScaledVector(dir, 70); WD.sun.target.updateMatrixWorld();
    const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, norm = c => c.multiplyScalar(1 / Math.max(1e-3, lum(c)));
    WD.sun.color.copy(norm(new THREE.Color(L.moonColor || "#F2E7C9").lerp(new THREE.Color(0xffffff), 0.75)));   // (a hint of the moon's colour: the plate's palette leads)
    WD.sun.intensity = ((1 - WORLD_FILL) * Math.PI) / dir.y;
    WD.hemi.color.copy(norm(new THREE.Color(sky[sky.length - 1]).lerp(new THREE.Color(0xffffff), 0.75)));
    WD.hemi.groundColor.copy(new THREE.Color(L.ground[2]).lerp(new THREE.Color(0x404040), 0.5)).multiplyScalar(1.4);
    WD.hemi.intensity = WORLD_FILL * Math.PI;
    if (WD.look !== sceneMap + "|" + R3D_WORLD.filmic) {   // the fog: the far land goes into the horizon's colour
      WD.look = sceneMap + "|" + R3D_WORLD.filmic;
      const fc = new THREE.Color(L.ground[0]).lerp(new THREE.Color(sky[sky.length - 1]), 0.45);
      WD.scene.fog = new THREE.FogExp2(fc, 0.0085);
    }
  }
  // the frame's first 3D render: the world, into the whole WebGL canvas, copied in as the ground. Returns false (and the
  // 2D plate is painted instead) when the 3D renderer or the world is off.
  function r3dWorldDraw() {
    R3D_WORLD.drawn = false;
    if (!R3D_WORLD.on || !r3dOn()) return false;
    const gl = R3D.gl, t0 = performance.now();
    try {
      r3dWorldBuild(); r3dWorldUpdate();
      gl.setScissorTest(false); gl.clear(true, true, false); R3D.fresh = false; R3D.clears++;
      gl.shadowMap.needsUpdate = true;
      gl.render(R3D_WORLD.scene, R3D.cam);
      ctx.save(); baseXform(ctx); ctx.drawImage(R3D.canvas, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, HY - U * 0.05, 0, HY + U * 0.1);   // (the plate's haze along the horizon)
      g.addColorStop(0, "rgba(200,210,225,0)"); g.addColorStop(0.45, "rgba(200,210,225,.1)"); g.addColorStop(1, "rgba(200,210,225,0)");
      ctx.fillStyle = g; ctx.fillRect(0, HY - U * 0.05 + camBase.y, W, U * 0.15); ctx.restore();
      R3D.renders++; R3D_WORLD.drawn = true; R3D_WORLD.frames++;
    } catch (e) { if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08ri_r3d_world:draw"); R3D_WORLD.drawn = false; }
    const dt = performance.now() - t0, C = R3D_RCM.cost; R3D_WORLD.ms = dt;
    R3D_RCM.t3d += dt; C["render: world"] = (C["render: world"] || 0) + dt; C["render: world ktri"] = (C["render: world ktri"] || 0) + gl.info.render.triangles / 1000;
    return R3D_WORLD.drawn;
  }
  // checks for the spec: (1) where a land vertex lands on the screen through the 3D camera, against where the 2D camera
  // draws the same world point (they must agree to a fraction of a pixel); (2) flat open ground comes out its painted
  // colour (the calibration above): a near vertex's colour against the rendered pixel there, with the dressing hidden
  function r3dWorldProbe() {
    const WD = R3D_WORLD; if (!WD.drawn) return null;
    const { NC, NR } = WORLD_GRID, pos = WD.land.geometry.attributes.position.array, v = new THREE.Vector3(), x0 = -0.3 * W, x1 = 1.3 * W, f = WD.f;
    let worst = 0, n = 0;
    for (let j = 2; j <= NR; j += 5) for (let i = 12; i <= NC - 12; i += 7) {
      const k = (j * (NC + 1) + i) * 3, zc = WD.rows[j], z = zc - CAM_BACK, x = ((x0 + (x1 - x0) * i / NC) - W / 2) * zc / F, y = r3dWorldH(f.D, f.base, z, x - wCx(z), x), p = project(x, y, z);
      v.set(pos[k], pos[k + 1], pos[k + 2]).project(R3D.cam);
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; worst = Math.max(worst, Math.hypot(sx - p.x, sy - p.y)); n++;
    }
    return { worst, n };
  }
  function r3dWorldCalib() {
    const WD = R3D_WORLD; if (!WD.drawn) return null;
    // (a vertex on the flat, on the screen, left of the road)
    const { NC, NEAR } = WORLD_GRID, j = NEAR - 3, i = 17, k = (j * (NC + 1) + i) * 3, pos = WD.land.geometry.attributes.position.array, col = WD.land.geometry.attributes.color.array;
    const on = R3D_SCATTER.on; R3D_SCATTER.on = false;
    const gl = R3D.gl; r3dWorldUpdate(); gl.setScissorTest(false); gl.clear(true, true, false); gl.shadowMap.needsUpdate = true; gl.render(WD.scene, R3D.cam);
    const v = new THREE.Vector3(pos[k], pos[k + 1], pos[k + 2]).project(R3D.cam), px = Math.round((v.x + 1) / 2 * W * R3D.pr), py = Math.round((v.y + 1) / 2 * H * R3D.pr), out = new Uint8Array(4);
    gl.getContext().readPixels(px, py, 1, 1, gl.getContext().RGBA, gl.getContext().UNSIGNED_BYTE, out);
    R3D_SCATTER.on = on;
    const enc = c => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
    const want = [enc(col[k]), enc(col[k + 1]), enc(col[k + 2])], got = [out[0], out[1], out[2]];
    return { want, got, err: Math.max(...want.map((w, q) => Math.abs(w - got[q]))), at: [px, py] };
  }
  function r3dWorldState() {
    const WD = R3D_WORLD; if (!WD.ok) return { on: WD.on, ok: false };
    const lg = WD.land.geometry;
    return { on: WD.on, ok: true, drawn: WD.drawn, frames: WD.frames, ms: +WD.ms.toFixed(2), filmic: WD.filmic, verts: lg.attributes.position.count, tris: lg.index.count / 3, split: WD.split,
      road: WD.road.visible, water: WD.water.visible, fog: WD.scene.fog ? "#" + WD.scene.fog.color.getHexString() : null, sun: WD.sunDir ? WD.sunDir.toArray().map(v => +v.toFixed(3)) : null,
      sunI: +WD.sun.intensity.toFixed(3), fillI: +WD.hemi.intensity.toFixed(3), shadow: WD.sun.castShadow ? WD.sun.shadow.mapSize.x : 0 };
  }
