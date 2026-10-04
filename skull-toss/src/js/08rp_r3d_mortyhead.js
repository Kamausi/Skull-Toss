  // ───────────────────────── v73: Morty's head is the owner's skull, his eyes the owner's eye ─────────────────────────
  // The owner's calls (2026-10-03): "Use the skull for Morty's head" and "Use this for his eyes". The sculpted sphere
  // and its painted or built face (v70, v72) give way to the supplied models (08ro_r3d_models.js):
  //   - the cranium, the mandible and the 28 teeth are the skull's own pieces; the mandible and its teeth hinge on its
  //     condyles and open with the rig's jaw; each tooth can be hidden, gilded or lengthened, so the teeth cosmetics
  //     (toothless, one, gold, fangs, tiny, big, jumbo) and the jaw shapes are real;
  //   - the bone takes the skin's colour, the skin's pattern projected straight on as before, and the dark of the
  //     skull's own hollows from its baked occlusion, in the skin's socket colour (the eye sockets, the nose, the gaps
  //     between the teeth): any skin reads on the real skull;
  //   - an eyeball sits in each socket: the eye's own mesh and map, with its cornea over it. It looks where the face
  //     looks, swells and shrinks with the sockets as the 2D's do (fear, shock), crosses, and is covered by lids in the
  //     skin's colour that close for blinks, sleep and the shut and happy eyes, and push up from below for the cheeks;
  //   - the glyph eyes (x, star, spiral) stand in the empty socket in place of the eyeball; brows are ink bars on the
  //     brow ridge; glasses sit over the real sockets (08rn_r3d_glasses.js, given this head's surface);
  //   - two levels (the skull's v1 for hero size, v3 when he's small), picked by his size on screen with a dead zone.
  // Looks this head doesn't carry yet (masks, hair, beards, the eyes and jaws some skins draw themselves, the glow behind
  // five skins, eye and teeth cosmetics not listed) keep the v72 built face; r3dHeadOK says which.
  const MH = { s: 2.75, y: -1.58, z: -0.06, eye: { x: 0.118, y: 0.548, z: 0.236, r: 0.066 }, lod: "hero", depth: null };
  const MH_EYES = { pie: 1, tiny: 1, giant: 1, crossed: 1, sleepy: 1, x: 1, star: 1, spiral: 1 }, MH_GLYPHS = { x: 1, star: 1, spiral: 1, closed: 1, happy: 1, squeeze: 1 };
  const MH_TEETH = { grin: 1, toothless: 1, tiny: 1, big: 1, jumbo: 1, gold: 1, fangs: 1, one: 1 };
  const mhX = x => x * MH.s, mhY = y => y * MH.s + MH.y, mhZ = z => z * MH.s + MH.z;   // the skull's units (height 1, chin at 0) → skull radii
  function r3dHeadOK(look, f) {
    if (!r3dSkullParts("hero") || !r3dEyeParts()) return false;
    const S = SKINS[look.skull] || SKINS.bone;
    if (S.eyes || S.jawTop || S.behind) return false;
    if (MASKS[look.mask] || HAIR[look.hair] || BEARD[look.beard] || MOUSTACHES[look.beard]) return false;
    if (!MH_EYES[look.eyes || "pie"] || !MH_TEETH[look.teeth || "grin"]) return false;
    return !(f && f.glyph && !MH_GLYPHS[f.glyph]);
  }
  // the bone: toon-lit, the skin's colour (or its pattern), darkened toward the socket colour where the baked occlusion
  // says the skull hides its own sky
  function r3dBoneMat(color) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, color: new THREE.Color(color) });
    m.userData.sock = { value: new THREE.Color("#111111") }; m.userData.ao = { value: new THREE.Vector2(0.5, 0.9) };
    m.onBeforeCompile = sh => {
      sh.uniforms.uSock = m.userData.sock; sh.uniforms.uAo = m.userData.ao;
      sh.vertexShader = "attribute float ao; varying float vAo;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vAo = ao;");
      sh.fragmentShader = "uniform vec3 uSock; uniform vec2 uAo; varying float vAo;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uSock, smoothstep(uAo.x, uAo.y, vAo));");
    };
    m.customProgramCacheKey = () => "mortybone";
    return m;
  }
  // the head's front surface, for the pieces set on it (brows, glasses): the cranium's nearest z at (X, Y), skull radii
  function r3dHeadZ(X, Yup) {
    const D = MH.depth; if (!D) return 0.5;
    const u = (X - D.x0) / (D.x1 - D.x0) * D.n - 0.5, v = (D.y1 - Yup) / (D.y1 - D.y0) * D.n - 0.5, i = Math.max(0, Math.min(D.n - 1, Math.round(u))), j = Math.max(0, Math.min(D.n - 1, Math.round(v)));
    const z = D.z[j * D.n + i]; return z > -50 ? z : 0.2;
  }
  function r3dHeadDepth(geo) {   // rasterise the cranium's front, once
    const n = 96, x0 = -1.1, x1 = 1.1, y0 = -1.6, y1 = 1.2, Z = new Float32Array(n * n).fill(-99), P = geo.attributes.position, I = geo.index.array;
    const sx = i => (mhX(P.getX(i)) - x0) / (x1 - x0) * n, sy = i => (y1 - mhY(P.getY(i))) / (y1 - y0) * n;
    for (let t = 0; t < I.length; t += 3) {
      const v = [I[t], I[t + 1], I[t + 2]].map(i => [sx(i), sy(i), mhZ(P.getZ(i))]);
      const den = (v[1][1] - v[2][1]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][1] - v[2][1]); if (Math.abs(den) < 1e-9) continue;
      for (let yy = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1]))); yy <= Math.min(n - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1]))); yy++)
        for (let xx = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0]))); xx <= Math.min(n - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0]))); xx++) {
          const X = xx + 0.5, Y = yy + 0.5, a = ((v[1][1] - v[2][1]) * (X - v[2][0]) + (v[2][0] - v[1][0]) * (Y - v[2][1])) / den, b = ((v[2][1] - v[0][1]) * (X - v[2][0]) + (v[0][0] - v[2][0]) * (Y - v[2][1])) / den, c = 1 - a - b;
          if (a < -0.02 || b < -0.02 || c < -0.02) continue; const z = a * v[0][2] + b * v[1][2] + c * v[2][2], k = yy * n + xx; if (z > Z[k]) Z[k] = z;
        }
    }
    // the outer envelope: each cell the highest within three cells round it, so pieces laid on the face (the bandit's
    // mask, brows, the glasses' rims) ride over the sockets and the nose instead of sinking into them
    const E = new Float32Array(n * n).fill(-99);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let m = -99; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < n && b < n) m = Math.max(m, Z[b * n + a]); } E[j * n + i] = m; }
    MH.depth = { n, x0, x1, y0, y1, z: E };
  }
  // (v73 gave the head an outline-only ink; v74 has no ink at all, on the owner's call)
  const mhInked = (geo, mat) => r3dInked(geo, mat);
  // one detail level of the head
  function r3dHeadLevel(lod, mats) {
    const S = r3dSkullParts(lod), g = new THREE.Group(); g.name = "MortyHead_" + lod;
    const hinge = S.hinge, jaw = new THREE.Group(), jawBody = new THREE.Group(); jaw.name = "MortyMandible"; jaw.position.set(hinge[0], hinge[1], hinge[2]); jawBody.position.set(-hinge[0], -hinge[1], -hinge[2]); jaw.add(jawBody); g.add(jaw);
    const teeth = { upper: [], lower: [] };
    for (const p of S.parts) {
      if (p.kind === "cranium") { const m = mhInked(p.geo, mats.bone, mats); m.name = "Cranium"; g.add(m); g.userData.cranium = p.geo; }
      else if (p.kind === "mandible") jawBody.add(mhInked(p.geo, mats.bone, mats));
      else {   // a tooth, pivoting on its own centre so it can be scaled where it stands
        const piv = new THREE.Group(), m = mhInked(p.geo, mats.tooth, mats); piv.position.set(p.c[0], p.c[1], p.c[2]); m.position.set(-p.c[0], -p.c[1], -p.c[2]); piv.add(m);
        Object.assign(piv.userData, { row: p.row, i: p.i, n: p.n, body: m.userData.body }); (p.row === "upper" ? g : jawBody).add(piv); teeth[p.row].push(piv);
      }
    }
    for (const row of ["upper", "lower"]) teeth[row].sort((a, b) => a.userData.i - b.userData.i);
    Object.assign(g.userData, { jaw, teeth, tris: S.tris });
    return g;
  }
  function r3dHeadEye(mats, side) {
    const E = r3dEyeParts(), g = new THREE.Group(); g.name = "MortyEye" + side;
    // (the eye's cornea, a clear shell over the ball, darkened the eye it covered in the cel render; a catch light
    // stands for its shine, fixed to the socket so it stays put as the eye looks about)
    const look = new THREE.Group(), ball = new THREE.Mesh(E.ball, mats.eye), cornea = new THREE.Mesh(E.cornea, mats.cornea); cornea.visible = false; look.add(ball, cornea); g.add(look);
    const glint = new THREE.Mesh(mats.glintGeo || (mats.glintGeo = new THREE.CircleGeometry(0.17, 16)), mats.glint); glint.position.set(-0.32, 0.36, 0.99); glint.renderOrder = 4; glint.visible = false; g.add(glint);   // (v74: the eye's own gloss takes the light; no drawn catch light)
    const lidGeo = mats.lidGeo || (mats.lidGeo = [new THREE.SphereGeometry(1.1, 28, 10, 0, TAU, 0, Math.PI / 2), new THREE.SphereGeometry(1.1, 28, 10, 0, TAU, Math.PI / 2, Math.PI / 2)]);
    const up = mhInked(lidGeo[0], mats.lid, mats), low = mhInked(lidGeo[1], mats.lid, mats); g.add(up, low);
    // the glyph eyes, standing in the socket in place of the eyeball (drawn flat, facing out)
    const flat = c => new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(c) });
    const glyph = new THREE.Group(), x1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02), flat("#F2E7C9")), x2 = new THREE.Mesh(x1.geometry, x1.material);
    const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.45 : 1; i ? starShape.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : starShape.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); }
    const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), flat(MUSTARD)), spPts = []; for (let k = 0; k <= 40; k++) { const a = k * 0.42, rr = 0.03 + k * 0.022; spPts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)); }
    const spiral = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spPts), 80, 0.09, 5, false), flat("#F2E7C9"));
    glyph.add(x1, x2, star, spiral); g.add(glyph);
    Object.assign(g.userData, { look, ball, cornea, glint, up, low, glyph, x1, x2, star, spiral });
    return g;
  }
  // the head, built once and kept inside the v68 head's spin (08rb r3dSkullModel)
  function r3dHeadBuild(M) {
    const D = M.userData; if (D.head) return D.head;
    const E = r3dEyeParts();
    const mats = { bone: r3dBoneMat("#F7F1DF"), tooth: r3dBoneMat("#F7F1DF"), gold: r3dBoneMat(GOLD), lid: r3dToon("#F7F1DF", {}),
      // (the eye plain until its map has decoded: r3dHeadFrame)
      eye: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, color: 0xf4efe6 }), cornea: new THREE.MeshPhongMaterial({ toneMapped: false, color: 0xffffff, transparent: true, opacity: 0.16, shininess: 140, specular: 0xffffff, depthWrite: false }), glint: new THREE.MeshBasicMaterial({ toneMapped: false, color: 0xfffcec, transparent: true, opacity: 0.85 }) };
    // (v74) real surfaces: matte bone, glossier enamel, a gold cap that's metal, wet eyes that take the sky's light
    mats.bone.roughness = 0.74; mats.tooth.roughness = 0.4; mats.gold.roughness = 0.26; mats.gold.metalness = 1; mats.lid.roughness = 0.74; mats.eye.roughness = 0.16;
    mats.tooth.userData.ao.value.set(0.55, 0.95); mats.gold.userData.ao.value.set(0.55, 0.95);
    const root = new THREE.Group(); root.name = "MortyHead"; root.scale.setScalar(MH.s); root.position.set(0, MH.y, MH.z);
    const levels = { hero: r3dHeadLevel("hero", mats), low: r3dHeadLevel("low", mats) }; root.add(levels.hero, levels.low);
    const eyes = [r3dHeadEye(mats, "L"), r3dHeadEye(mats, "R")]; root.add(...eyes);
    const brows = [0, 1].map(() => { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02), r3dToon("#2A1E18", { rough: 0.9 })); D.spin.add(b); return b; });
    r3dHeadDepth(levels.hero.userData.cranium);
    D.spin.add(root);
    return (D.head = { root, levels, eyes, brows, mats, key: "" });
  }
  // the skin's pattern, painted flat in skull units onto the head's canvas (no face: the skull has its own)
  function r3dHeadSkin(D, Sk, pal) {
    const H = D.head, n = R3D_SK.tex, S = R3D_SK.span, has = !!Sk.detail;
    if (has) {
      D.g.setTransform(1, 0, 0, 1, 0, 0); D.g.fillStyle = pal.base; D.g.fillRect(0, 0, n, n);
      D.g.setTransform(n / (2 * S), 0, 0, n / (2 * S), n / 2, n / 2); try { Sk.detail(D.g, 0); } catch (e) { /* a pattern that wants the 2D rig's state draws nothing */ }
      D.tex.needsUpdate = true;
    }
    const m = H.mats.bone; if (!!m.map !== has) { m.map = has ? D.tex : null; m.needsUpdate = true; }
    m.color.set(has ? "#FFFFFF" : pal.base);
  }
  // per frame, from r3dSkull: false (and the head hidden) when this look keeps the v72 face
  function r3dHeadFrame(M, o, look, r) {
    const D = M.userData, f = o.face || faceFor("idle", o.t || 0), ok = !R3D_SK.noHead && r3dHeadOK(look, f);
    if (!ok) { if (D.head) D.head.root.visible = false; if (D.head) D.head.brows.forEach(b => (b.visible = false)); D.cranium.visible = true; return false; }
    const H = r3dHeadBuild(M), t = o.t || 0, Sk = SKINS[look.skull] || SKINS.bone, pal = (Sk.flick && Sk.flick(t)) || Sk;
    const EP = r3dEyeParts(); if (!H.mats.eye.map && EP.tex.image && EP.tex.image.complete && EP.tex.image.naturalWidth) { H.mats.eye.map = EP.tex; H.mats.eye.color.set(0xffffff); EP.tex.needsUpdate = true; H.mats.eye.needsUpdate = true; }
    H.root.visible = true; D.cranium.visible = false; D.oldFace.visible = false; if (D.geom) D.geom.visible = false;
    // the detail level: hero above 30 px of radius, the light one below 24 (between, whichever it had)
    if (r > 30) MH.lod = "hero"; else if (r < 24) MH.lod = "low";
    H.levels.hero.visible = MH.lod === "hero"; H.levels.low.visible = MH.lod === "low";
    const L = H.levels[MH.lod].userData;
    // the skin
    r3dHeadSkin(D, Sk, pal);
    for (const m of [H.mats.bone, H.mats.tooth, H.mats.gold]) m.userData.sock.value.set(pal.socket || "#111111");
    H.mats.tooth.color.set(pal.tooth || pal.hi || pal.base); H.mats.lid.color.set(pal.base);
    // the jaw: open with the rig's jaw, shaped by the teeth's jaw shape, sliding with the face's skew
    const id = look.teeth || "grin", js = JAW_SHAPE[id] || [1, 1], jawV = clamp(o.jaw == null ? f.jawT : o.jaw, 0, 1.1);
    for (const lv of [H.levels.hero, H.levels.low]) { const J = lv.userData.jaw; J.rotation.set(jawV * 0.5, 0, 0); J.scale.set(js[0], js[1], 1); J.position.x = (f.skew || 0) / MH.s; }
    // the teeth
    for (const lv of [H.levels.hero, H.levels.low]) for (const row of ["upper", "lower"]) {
      const T = lv.userData.teeth[row], n = T.length, mid = n / 2;
      T.forEach((P, i) => {
        P.visible = id !== "toothless" && (id !== "one" || (row === "upper" && i === Math.floor(mid)));
        P.userData.body.material = id === "gold" && row === "upper" && i === Math.floor(mid) + 1 ? H.mats.gold : H.mats.tooth;
        const fang = id === "fangs" && row === "upper" && (i === Math.floor(mid) - 3 || i === Math.floor(mid) + 2), k = id === "tiny" ? 0.7 : id === "jumbo" ? 1.3 : id === "big" && row === "upper" ? 1.15 : 1;
        P.scale.set(k, fang ? 1.9 : k, k); P.position.y = P.userData.y0 == null ? (P.userData.y0 = P.position.y) : P.userData.y0; if (fang) P.position.y -= 0.012;
      });
    }
    // the eyes
    const socks = r3dFaceSocks(f, look), eyes = look.eyes || "pie", g0 = f.glyph || ({ x: "x", star: "star", spiral: "spiral" })[eyes] || null;
    const sleepy = eyes === "sleepy" ? 0.42 : 0, size = eyes === "giant" ? 1.3 : eyes === "tiny" ? 0.62 : 1;
    H.eyes.forEach((G, i) => {
      const s = socks[i], side = i ? 1 : -1, U = G.userData, k = s.k || 1, er = MH.eye.r * size * (0.75 + 0.25 * Math.pow(k, 1.6));
      G.position.set(side * MH.eye.x, MH.eye.y, MH.eye.z + (er - MH.eye.r) * 0.8); G.scale.setScalar(er);
      const glyph = g0 && !(g0 === "closed" || g0 === "happy" || g0 === "squeeze") ? g0 : null;
      U.look.visible = !glyph; U.glyph.visible = !!glyph;
      let lx = f.lx || 0; if (eyes === "crossed" && !f.glyph) lx = i ? -0.8 : 0.8;
      U.look.rotation.set(clamp(f.ly || 0, -1, 1) * 0.42, clamp(lx, -1, 1) * 0.5, 0);
      // the lids: the upper closes from above (blinks, sleep, shut eyes), the lower pushes up from the cheek
      let lid = Math.max(i ? f.lidR : f.lidL, f.blink || 0, sleepy), low = (i ? f.lowR : f.lowL) || 0;
      if (g0 === "closed" || g0 === "squeeze") lid = 1; if (g0 === "happy") { lid = Math.max(lid, 0.55); low = Math.max(low, 0.5); }
      if (glyph) { lid = 0; low = 0; }
      U.up.visible = lid > 0.02; U.low.visible = low > 0.02;
      U.up.rotation.set(Math.asin(clamp(2 * lid - 1, -1, 1)), 0, 0); U.low.rotation.set(-Math.asin(clamp(2 * low - 1, -1, 1)), 0, 0);
      if (glyph) {
        U.glyph.position.set(0, 0, 0.6); U.glyph.rotation.set(0, 0, 0);
        U.x1.visible = U.x2.visible = glyph === "x"; U.star.visible = glyph === "star"; U.spiral.visible = glyph === "spiral";
        if (glyph === "x") for (const [m, a] of [[U.x1, Math.PI / 4], [U.x2, -Math.PI / 4]]) { m.scale.set(1.9, 0.38, 1); m.rotation.z = a; m.material.color.set(pal.pupil || "#F2E7C9"); }
        if (glyph === "star") { U.star.scale.setScalar(1.1); U.star.rotation.z = Math.sin(t * 6) * 0.2; }
        if (glyph === "spiral") { U.spiral.rotation.z = -t * 7 * (i ? 1 : -1); U.spiral.material.color.set(pal.pupil || "#F2E7C9"); }
      }
      // the brow, on the ridge over the socket
      const B = H.brows[i]; B.visible = !!f.brow;
      if (f.brow) {
        const b = f.brow[i], bx = mhX(side * MH.eye.x), by = mhY(MH.eye.y + 0.1), x0 = bx - side * 0.16, x1 = bx + side * 0.18, y0 = by + b * 0.1, y1 = by - b * 0.05, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        B.position.set(mx, my, r3dHeadZ(mx, my) + 0.03); B.scale.set(Math.hypot(x1 - x0, y1 - y0), 0.08, 3); B.rotation.set(0, 0, Math.atan2(y1 - y0, x1 - x0)); B.material.color.set(pal.line || "#2A1E18");
      }
    });
    // glasses, over this head's sockets (in skull radii), sitting on its surface
    if (typeof r3dGlassesPose === "function") {
      const gs = [0, 1].map(i => { const side = i ? 1 : -1, er = MH.eye.r * MH.s * 1.25; return { x: mhX(side * MH.eye.x), y: -mhY(MH.eye.y), rx: er, ry: er }; });
      H.gl = H.gl || { geom: D.spin }; r3dGlassesPose(H.gl, look, gs, t, r3dHeadZ, 0.34 * MH.s);   // (the arms back to this skull's temples)
    }
    R3D_SK.headFrames = (R3D_SK.headFrames || 0) + 1;
    return true;
  }
  function r3dHeadState() {
    const M = R3D.cache.skull, H = M && M.userData.head; if (!H) return null;
    const L = H.levels[MH.lod].userData, vis = o => o.visible;
    return { on: H.root.visible, lod: MH.lod, tris: L.tris, frames: R3D_SK.headFrames || 0, jaw: +L.jaw.rotation.x.toFixed(4), upper: L.teeth.upper.filter(vis).length, lower: L.teeth.lower.filter(vis).length,
      gold: L.teeth.upper.filter(T => T.userData.body.material === H.mats.gold).length, fangs: L.teeth.upper.filter(T => T.scale.y > 1.5).length,
      eyes: H.eyes.map(E => ({ ball: E.userData.look.visible, glyph: E.userData.glyph.visible ? ["x1", "star", "spiral"].find(k => E.userData[k].visible) : null, lid: E.userData.up.visible ? +E.userData.up.rotation.x.toFixed(3) : null, scale: +E.scale.x.toFixed(4) })),
      brows: H.brows.map(vis), glasses: H.gl && H.gl.glasses && H.gl.glasses.visible ? H.gl.glasses.name.slice(8) : null, eyeMap: !!(r3dEyeParts() && r3dEyeParts().tex.image && r3dEyeParts().tex.image.complete) };
  }
