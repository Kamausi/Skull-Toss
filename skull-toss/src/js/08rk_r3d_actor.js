  // ───────────────────────── v71: the character pipeline (Wilds of Aether's, for Skull Toss's cast) ─────────────────────────
  // Wilds builds its characters procedurally, to production rules, and this is that pipeline for the models still to
  // come (Morty's face as geometry, the cast, the wildlife, the shopkeeper; the bosses' kit, 08rg, already follows most
  // of it):
  //   - one recipe, three levels of detail, each counted against a triangle budget (Wilds: LOD0 15–35k for a hero);
  //     the level is chosen by how tall the model stands on the screen, not by distance (this renderer's distances are
  //     the 2D camera's), with a dead zone so it doesn't flicker (as the complexity manager does: 08rf_r3d_budget.js);
  //   - two material classes per character, not one per part: the surface (the cel family: toon ramp, the rim, ink)
  //     and the metal (a toon with a narrow bright band, the house look's specular);
  //   - faceted planes: every triangle owns its vertices, its colour shaded by a vertical gradient (darker toward the
  //     foot) and a little per-face noise, so the forms read as carved, the way Wilds' concept sheets do;
  //   - a small procedural surface atlas (bone, cloth, leather, wood), so the surfaces carry grain at no texture cost;
  //   - an articulated rig, a hierarchy of joints from a table (Wilds: pelvis, spine, neck, head, shoulders, elbows,
  //     wrists, hips, knees), posed by angles;
  //   - the face as geometry: socket, white, iris, pupil and highlight discs, brows, nose and mouth, stacked by polygon
  //     offset so they never fight the head, placed by ratios of the head's own bounds (a wider head carries its
  //     features with it), and run by a face controller (blink, gaze that never looks through the skull, expressions);
  //   - a contact shadow under each one.
  // Wilds lights its characters with a studio rig on a layer of their own. In Three.js a light on a layer lights
  // everything a camera on that layer sees, so that rig also lights its land; here the characters are rendered in the
  // cel scene and the land in the world's, so each keeps its own light.
  const R3D_ACTOR = { atlas: null, metalRamp: null, faceMats: new Map(), budgets: { 0: [15000, 35000], 1: [5000, 15000], 2: [1200, 5000] } };
  // ── the surface atlas: four regions painted by seeded noise (Wilds' paintAtlasRegion), 512² (one texture for all)
  const ACTOR_REGIONS = { bone: [0, 0, 0.5, 0.5], leather: [0.5, 0, 0.5, 0.5], cloth: [0, 0.5, 0.5, 0.5], wood: [0.5, 0.5, 0.5, 0.5] };
  function r3dActorAtlas() {
    if (R3D_ACTOR.atlas) return R3D_ACTOR.atlas;
    const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N; const g = cv.getContext("2d"), h = N / 2;
    const paint = (x0, y0, base, light, dark, kind) => {
      g.fillStyle = base; g.fillRect(x0, y0, h, h);
      if (kind === "cloth") { g.lineWidth = 1; for (const [c, a, dy, k] of [[light, 0.15, 7, 22], [dark, 0.1, 9, -17]]) { g.globalAlpha = a; g.strokeStyle = c; for (let y = y0; y < y0 + h; y += dy) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + h, y + k / 2); g.stroke(); } } }
      else if (kind === "wood") { g.lineWidth = 1.2; for (let i = 0; i < 70; i++) { g.globalAlpha = 0.12; g.strokeStyle = i % 2 ? light : dark; const y = y0 + scRand(i, 21) * h; g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + h * 0.3, y + (scRand(i, 22) - 0.5) * 8, x0 + h * 0.7, y + (scRand(i, 23) - 0.5) * 8, x0 + h, y); g.stroke(); } }
      else { const n = kind === "leather" ? 450 : 350, big = kind === "leather"; for (let i = 0; i < n; i++) { const px = x0 + scRand(i, 51 + big) * h, py = y0 + scRand(i, 91 + big) * h, r = (big ? 1 : 0.6) + scRand(i, 151) * (big ? 4 : 1.8); g.globalAlpha = big ? 0.1 : 0.055; g.fillStyle = i % 2 ? light : dark; g.beginPath(); g.ellipse(px, py, r * (big ? 1.7 : 1), r, scRand(i, 201) * Math.PI, 0, TAU); g.fill(); } }
      g.globalAlpha = 1;
    };
    paint(0, 0, "#f2eee4", "#ffffff", "#c9bba9", "bone"); paint(h, 0, "#9f9588", "#c7b9a8", "#6e6256", "leather");
    paint(0, h, "#aaaaaa", "#d7d7d7", "#777777", "cloth"); paint(h, h, "#8a8580", "#b0aaa2", "#5a5550", "wood");
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return (R3D_ACTOR.atlas = t);
  }
  // ── the two material classes (shared by every part of every character that uses them)
  function r3dActorSurface() { return R3D.cache.actorSurface || (R3D.cache.actorSurface = r3dToon(0xffffff, { vertexColors: true, map: r3dActorAtlas() })); }
  function r3dActorMetal() {
    if (R3D.cache.actorMetal) return R3D.cache.actorMetal;
    const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);   // (dark, mid, mid, and a narrow lit band)
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
    void ramp; return (R3D.cache.actorMetal = r3dToon(0xffffff, { vertexColors: true, metal: 0.8, rough: 0.34 }));   // (v74: a metal, not a narrow toon band)
  }
  // ── faceted shading: every triangle its own vertices and colour (Wilds' tintHeroGeometry), UVs into its region
  const ACTOR_PROFILES = { bone: [0.95, 1.035, 0.014], cloth: [0.89, 1.045, 0.03], leather: [0.86, 1.035, 0.038], wood: [0.83, 1.055, 0.045], metal: [0.9, 1.06, 0.02] };
  function r3dActorTint(geo, color, region = "cloth") {
    if (geo.index) geo = geo.toNonIndexed();
    geo.computeVertexNormals();
    const p = geo.attributes.position, n = p.count, base = new THREE.Color(color), cols = new Float32Array(n * 3), [lo, hi, noise] = ACTOR_PROFILES[region] || ACTOR_PROFILES.cloth;
    let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const span = Math.max(1e-4, y1 - y0), seed = Math.floor(base.getHex() % 997) + 211;
    for (let t = 0; t < n; t += 3) {
      const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, v = clamp((cy - y0) / span, 0, 1), k = (lo + (hi - lo) * v) * (1 + (scHash(t + 17, seed) - 0.5) * noise);
      for (let j = 0; j < 3 && t + j < n; j++) { const i = (t + j) * 3; cols[i] = clamp(base.r * k, 0, 1); cols[i + 1] = clamp(base.g * k, 0, 1); cols[i + 2] = clamp(base.b * k, 0, 1); }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const uv = geo.attributes.uv, box = ACTOR_REGIONS[region] || ACTOR_REGIONS.cloth;
    if (uv && region !== "metal") { for (let i = 0; i < uv.count; i++) uv.setXY(i, box[0] + uv.getX(i) * box[2], box[1] + uv.getY(i) * box[3]); uv.needsUpdate = true; }
    return geo;
  }
  // a part (Wilds' hPart): tinted geometry on the right class, placed, scaled and turned under its joint
  function r3dActorPart(parent, geo, color, region, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], name = "") {
    const metal = region === "metal", m = new THREE.Mesh(r3dActorTint(geo, color, region), metal ? r3dActorMetal() : r3dActorSurface());
    m.name = name; m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot); m.frustumCulled = false; parent.add(m); return m;
  }
  // shapes Wilds builds its forms from (beside the boss kit's): a lathe from a profile, and prisms that taper
  function r3dLathe(profile, segments = 24) { const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments); g.computeVertexNormals(); return g; }
  function r3dTaper(bottomW, topW, h, bottomD, topD, middle = null) {   // a box narrowing from its foot to its top (and through a waist, if given: [w, d, at])
    const rings = middle ? [[bottomW, bottomD, 0], [middle[0], middle[1], h * middle[2]], [topW, topD, h]] : [[bottomW, bottomD, 0], [topW, topD, h]], v = [], idx = [];
    for (const [w, d, y] of rings) v.push(-w / 2, y, -d / 2, w / 2, y, -d / 2, w / 2, y, d / 2, -w / 2, y, d / 2);
    for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < 4; s++) { const a = r * 4 + s, b = r * 4 + (s + 1) % 4, c = a + 4, d = b + 4; idx.push(a, b, d, a, d, c); }
    const top = (rings.length - 1) * 4; idx.push(0, 2, 1, 0, 3, 2, top, top + 1, top + 2, top, top + 2, top + 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // ── the rig: joints from a table, [name, parent, x, y, z]; posed by angles, back to rest in one call
  function r3dRig(table, name = "Rig") {
    const root = new THREE.Group(); root.name = name; const joints = { root };
    for (const [j, parent, x, y, z] of table) { const g = new THREE.Group(); g.name = j; g.position.set(x, y, z); (joints[parent] || root).add(g); joints[j] = g; }
    const rest = Object.fromEntries(Object.entries(joints).map(([k, g]) => [k, g.rotation.clone()]));
    return {
      root, joints,
      pose(angles) { for (const [k, a] of Object.entries(angles)) { const g = joints[k]; if (g) g.rotation.set(a[0] || 0, a[1] || 0, a[2] || 0); } },
      rest() { for (const [k, r] of Object.entries(rest)) joints[k].rotation.copy(r); }
    };
  }
  const ACTOR_BIPED = [   // Wilds' hero hierarchy (metres, standing on y = 0)
    ["pelvis", "root", 0, 1.08, 0], ["spine", "pelvis", 0, 0.23, 0], ["neck", "spine", 0, 0.595, 0], ["head", "neck", 0, 0.224, 0.018],
    ["leftArm", "spine", -0.378, 0.375, 0], ["leftElbow", "leftArm", 0, -0.25, 0], ["leftHand", "leftElbow", 0, -0.448, 0],
    ["rightArm", "spine", 0.378, 0.375, 0], ["rightElbow", "rightArm", 0, -0.25, 0], ["rightHand", "rightElbow", 0, -0.448, 0],
    ["leftLeg", "pelvis", -0.168, -0.172, 0], ["leftKnee", "leftLeg", 0, -0.515, 0], ["rightLeg", "pelvis", 0.168, -0.172, 0], ["rightKnee", "rightLeg", 0, -0.515, 0]
  ];
  // Wilds' walk cycle on any biped rig (the legs and arms swing opposite, the knees and elbows follow; idle settles back)
  function r3dRigWalk(rig, t, moving, rate = 10.5) {
    const J = rig.joints, w = Math.sin(t * rate), settle = (g, k) => { if (g) g.rotation.x *= k; };
    if (!J.leftLeg) return;
    if (moving) {
      J.leftLeg.rotation.x = w * 0.5; J.rightLeg.rotation.x = -w * 0.5; J.leftKnee.rotation.x = Math.max(0, -w) * 0.42; J.rightKnee.rotation.x = Math.max(0, w) * 0.42;
      J.leftArm.rotation.x = -w * 0.34; J.rightArm.rotation.x = w * 0.34; J.leftElbow.rotation.x = 0.1 + Math.max(0, w) * 0.14; J.rightElbow.rotation.x = 0.1 + Math.max(0, -w) * 0.14;
    } else { settle(J.leftLeg, 0.76); settle(J.rightLeg, 0.76); settle(J.leftKnee, 0.72); settle(J.rightKnee, 0.72); settle(J.leftArm, 0.78); settle(J.rightArm, 0.78); J.leftElbow.rotation.x = J.rightElbow.rotation.x = 0.08; }
    if (J.spine) J.spine.scale.y = 1 + Math.sin(t * 2) * 0.008;   // (breathing)
    if (J.head) J.head.rotation.y = Math.sin(t * 0.72) * 0.025;
  }
  // ── levels of detail: one recipe built at each level, its triangles counted against the budget; shown by height on
  // the screen (px), with a 15% dead zone either side of each threshold
  const actorTris = root => { let n = 0; root.traverse(o => { if (!o.isMesh || !o.geometry) return; const g = o.geometry; n += g.index ? g.index.count / 3 : g.attributes.position.count / 3; }); return Math.round(n); };
  function r3dActorLOD(build, { px = [180, 70], budgets = R3D_ACTOR.budgets, name = "Actor" } = {}) {
    const root = new THREE.Group(); root.name = name + "_LOD";
    const levels = [0, 1, 2].map(l => { const b = build(l), mesh = b.mesh || b; mesh.visible = l === 0; root.add(mesh); const tris = actorTris(mesh), [lo, hi] = budgets[l] || [0, Infinity]; return { level: l, mesh, rig: b.rig || null, face: b.face || null, tris, inBudget: tris >= lo && tris <= hi }; });
    let cur = 0;
    return {
      root, levels,
      get level() { return cur; },
      pick(h) {   // h: the model's height on the screen, in px
        const up = l => (l === 0 ? Infinity : px[l - 1] * 1.15), down = l => (l === 2 ? -Infinity : px[l] * 0.85);
        while (cur > 0 && h > up(cur)) cur--;
        while (cur < 2 && h < down(cur)) cur++;
        levels.forEach(L => (L.mesh.visible = L.level === cur));
        return cur;
      },
      each(fn) { levels.forEach(L => fn(L)); }
    };
  }
  // ── a contact shadow (Wilds' createContactShadow): a soft dark disc under the feet, in the world, on the ground
  function r3dContactShadowMesh(owner, sx = 0.82, sz = 0.56, opacity = 0.24) {
    let tex = R3D.cache.contactTex;
    if (!tex) { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 5, 64, 64, 61); g.addColorStop(0, "rgba(20,16,12,1)"); g.addColorStop(0.48, "rgba(20,16,12,.5)"); g.addColorStop(1, "rgba(20,16,12,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); tex = R3D.cache.contactTex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ toneMapped: false, map: tex, transparent: true, opacity, depthWrite: false }));
    m.name = "ContactShadow"; m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1; owner.add(m); return m;
  }
  // ── the face as geometry
  // its layout, by ratios of the head's own bounds (Wilds' calculateHeroFaceLayout)
  function r3dFaceLayout(head) {
    const g = head.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox, s = head.scale, w = (b.max.x - b.min.x) * s.x, h = (b.max.y - b.min.y) * s.y, d = (b.max.z - b.min.z) * s.z, minY = head.position.y + b.min.y * s.y, frontZ = head.position.z + b.max.z * s.z;
    return { width: w, height: h, depth: d, frontZ, eyeX: w * 0.18, eyeY: minY + h * 0.615, browY: minY + h * 0.785, noseY: minY + h * 0.515, mouthY: minY + h * 0.325,
      socketR: h * 0.091, whiteR: h * 0.083, irisR: h * 0.049, pupilR: h * 0.028, glintR: h * 0.0092, browW: w * 0.193, browH: h * 0.05, noseR: w * 0.04, noseL: h * 0.091,
      mouthSX: w / 0.445, mouthSY: h / 0.438, travelX: w * 0.018, travelY: h * 0.014 };
  }
  // flat colour, never lit, stacked over the head by polygon offset (the higher the order, the nearer)
  function r3dFaceMat(color, order = 1) {
    const k = color + "_" + order; let m = R3D_ACTOR.faceMats.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ toneMapped: false, color, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order }); R3D_ACTOR.faceMats.set(k, m); }
    return m;
  }
  const ACTOR_FACE = { socket: 0xb77a5e, white: 0xf4efe7, iris: 0x3a302c, pupil: 0x2a2525, glint: 0xffffff, brow: 0x543629, mouth: 0x965c52, nose: 0xcf815f };
  function r3dFace(head, layout, { colors = ACTOR_FACE, seg = 24, rnd = Math.random } = {}) {
    const face = new THREE.Group(); face.name = "Face"; (head.parent || head).add(face);   // (beside the head, in its joint's space: the layout is in that space)
    const L = layout, C = colors, F_ = { sockets: [], whites: [], irises: [], pupils: [], glints: [], brows: [], mouth: null, nose: null };
    const disc = (r, n, col, order, x, y, dz, sx = 1, sy = 1, name = "") => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, n), r3dFaceMat(col, order)); m.name = name; m.position.set(x, y, L.frontZ + dz); m.scale.set(sx, sy, 1); m.renderOrder = 100 + order; m.frustumCulled = false; face.add(m); m.userData.baseScaleY = sy; return m; };
    for (const sx of [-1, 1]) {
      const x = sx * L.eyeX, side = sx < 0 ? "L" : "R";
      F_.sockets.push(disc(L.socketR, seg, C.socket, 1, x, L.eyeY, 0.014, 1.1, 0.88, "EyeSocket" + side));
      F_.whites.push(disc(L.whiteR, seg, C.white, 2, x, L.eyeY + 0.001, 0.018, 1, 0.78, "EyeWhite" + side));
      F_.irises.push(disc(L.irisR, Math.max(12, seg * 0.72 | 0), C.iris, 3, x, L.eyeY, 0.02, 0.84, 0.98, "Iris" + side));
      F_.pupils.push(disc(L.pupilR, Math.max(10, seg * 0.55 | 0), C.pupil, 4, x, L.eyeY, 0.022, 0.82, 1, "Pupil" + side));
      F_.glints.push(disc(L.glintR, 8, C.glint, 5, x - L.width * 0.011, L.eyeY + L.height * 0.023, 0.023, 1, 1, "EyeGlint" + side));
      const brow = new THREE.Mesh(new THREE.BoxGeometry(L.browW, L.browH, 0.018), r3dFaceMat(C.brow, 6)); brow.name = "Brow" + side; brow.position.set(x, L.browY, L.frontZ + 0.014); brow.rotation.z = sx < 0 ? 0.15 : -0.15; brow.renderOrder = 106; face.add(brow); F_.brows.push(brow);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(L.noseR, L.noseL, 5), r3dFaceMat(C.nose, 1)); nose.name = "Nose"; nose.position.set(0, L.noseY, L.frontZ + 0.014); nose.rotation.x = Math.PI / 2; face.add(nose); F_.nose = nose;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.052, 0, 0), new THREE.Vector3(0, -0.025, 0), new THREE.Vector3(0.052, 0, 0));
    const mouth = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.005, 4, false), r3dFaceMat(C.mouth, 2)); mouth.name = "Mouth"; mouth.position.set(0, L.mouthY, L.frontZ + 0.013); mouth.scale.set(0.54 * L.mouthSX, 0.34 * L.mouthSY, 1); mouth.renderOrder = 102; face.add(mouth); F_.mouth = mouth;
    return { group: face, features: F_, controller: r3dFaceController(face, L, F_, rnd) };
  }
  // what each expression does to the brows, the eyes and the mouth: Wilds' three, and the faces of Skull Toss's pose
  // library (04d_visual.js), so a modelled face can take any face the game asks for
  //   lift (brow height, × head height), tilt (brow turn, + inward/down), open (eyes), mx/my (mouth width/height), up (mouth lift)
  const ACTOR_EXPR = {
    neutral: {}, focus: { lift: -0.012, tilt: 0.085, mx: 1.12, my: 0.74 }, surprise: { lift: 0.028, tilt: -0.08, mx: 0.78, my: 1.22, up: 0.01 },
    mood: {}, aim: { lift: -0.01, tilt: 0.07, open: 0.85, mx: 0.9, my: 0.7 }, strain: { lift: -0.016, tilt: 0.12, open: 0.6, mx: 1.2, my: 0.6 },
    happy: { lift: 0.008, mx: 1.25, my: 1.15, up: 0.004 }, gleeful: { lift: 0.014, mx: 1.4, my: 1.4, up: 0.006 }, excited: { lift: 0.02, open: 1.1, mx: 1.3, my: 1.5 },
    triumph: { lift: 0.012, tilt: 0.04, mx: 1.35, my: 1.25 }, perfect: { lift: 0.016, open: 0.7, mx: 1.3, my: 1.1 }, fear: { lift: 0.03, tilt: -0.12, open: 1.15, mx: 0.7, my: 1.3 },
    ouch: { lift: -0.006, tilt: 0.1, open: 0.35, mx: 1.1, my: 0.9 }, ko: { open: 0.08, mx: 0.9, my: 0.5 }, dizzy: { lift: 0.006, tilt: -0.05, open: 0.75, mx: 0.85, my: 0.9 },
    deadpan: { lift: -0.006, open: 0.55, mx: 1, my: 0.35 }, confused: { lift: 0.012, tilt: -0.06, mx: 0.8, my: 0.8 }, angry: { lift: -0.014, tilt: 0.16, open: 0.8, mx: 1.05, my: 0.6 }
  };
  // the controller (Wilds' buildProceduralFaceController): blinks at random intervals (visual, so Math.random is fine:
  // it can't touch a replay), follows a target with the irises only while it's in front of the face, and lays the
  // expression over both
  function r3dFaceController(face, L, F_, rnd = Math.random) {
    const base = { iris: F_.irises.map(o => o.position.clone()), pupil: F_.pupils.map(o => o.position.clone()), glint: F_.glints.map(o => o.position.clone()), brow: F_.brows.map(o => ({ y: o.position.y, rz: o.rotation.z })), mouth: F_.mouth.position.clone(), mouthS: F_.mouth.scale.clone() };
    const eyes = [...F_.whites, ...F_.irises, ...F_.pupils, ...F_.glints], tw = new THREE.Vector3(), tl = new THREE.Vector3();
    let next = 2.1 + rnd() * 3.7, el = 0, blinking = false, expr = "neutral", blinks = 0, gaze = [0, 0];
    const open = () => (ACTOR_EXPR[expr].open == null ? 1 : ACTOR_EXPR[expr].open);
    function blink(dt) {
      let k = 1;
      if (!blinking) { next -= dt; if (next <= 0) { blinking = true; el = 0; } }   // (as in Wilds, a blink starts on the frame after its wait runs out, so one long frame can't swallow it)
      else { el += dt; const p = Math.min(1, el / 0.135); k = Math.max(0.08, 1 - Math.sin(Math.PI * p)); if (p >= 1) { blinking = false; blinks++; next = 2 + rnd() * 4.2; k = 1; } }
      const o = open() * k;
      eyes.forEach(e => (e.scale.y = e.userData.baseScaleY * o)); F_.sockets.forEach(e => (e.scale.y = e.userData.baseScaleY * (0.3 + 0.7 * Math.min(1, o))));
    }
    function look(target) {
      let gx = 0, gy = 0;
      if (target) {
        face.updateWorldMatrix(true, false); tl.copy(tw.copy(target)); face.worldToLocal(tl);
        const dx = tl.x, dy = tl.y - L.eyeY, dz = tl.z - L.frontZ;
        if (dz > 0.04) { gx = clamp(dx / Math.max(0.35, dz), -1, 1) * L.travelX; gy = clamp(dy / Math.max(0.45, dz), -1, 1) * L.travelY; }   // (only in front: behind the head, the eyes go back to the middle instead of looking through the skull)
      }
      gaze = [gx, gy];
      for (let i = 0; i < F_.irises.length; i++) { F_.irises[i].position.set(base.iris[i].x + gx, base.iris[i].y + gy, base.iris[i].z); F_.pupils[i].position.set(base.pupil[i].x + gx, base.pupil[i].y + gy, base.pupil[i].z); F_.glints[i].position.set(base.glint[i].x + gx, base.glint[i].y + gy, base.glint[i].z); }
      const E = ACTOR_EXPR[expr], vert = clamp(gy / Math.max(1e-4, L.travelY), -1, 1);
      F_.brows.forEach((b, i) => { const s = i === 0 ? -1 : 1, B = base.brow[i]; b.position.y = B.y + vert * L.height * 0.012 + (E.lift || 0) * L.height; b.rotation.z = B.rz + (E.tilt || 0) * s; });
      F_.mouth.position.copy(base.mouth); F_.mouth.position.y += (E.up || 0) * L.height; F_.mouth.scale.set(base.mouthS.x * (E.mx || 1), base.mouthS.y * (E.my || 1), base.mouthS.z);
    }
    return {
      update(dt, target) { blink(dt); look(target); },
      setExpression(name) { expr = ACTOR_EXPR[name] ? name : "neutral"; return expr; },
      get expression() { return expr; }, get blinks() { return blinks; }, get gaze() { return gaze.slice(); }, get blinking() { return blinking; }, layout: L
    };
  }
