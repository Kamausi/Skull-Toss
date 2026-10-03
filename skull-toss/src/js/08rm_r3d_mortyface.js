  // ───────────────────────── v72: Morty's face as geometry (ASSET-001, passes 2 and 3) ─────────────────────────
  // The owner's directive (2026-10-03): every asset regenerated, not 2D drawings rendered into 3D. Morty's face was his
  // 2D drawing projected onto a sculpted shell (v70). Now it's built:
  //   - the skin is the shell's surface texture, UV-mapped like any 3D material: the skin's colour, its pattern, any
  //     paint job, and the dark of the sculpted hollows (the sockets, which swell, take their lids and push up their
  //     cheeks as the 2D rig's do, the nose and the mouth), painted by the 2D rig in its surface mode (08a_skull.js,
  //     o.surface) without pupils, brows, teeth or face pieces, and with the jaw at rest (the jaw's own mesh carries
  //     its part). A first try darkened the hollows per vertex; the edges came out stepped, so the dark is material;
  //   - the pupils (pie, tiny, giant, crossed), the glyph eyes (x, star, spiral, shut, happy, screwed shut) and the
  //     brows are meshes, set into the hollows and driven by the same face state (faceFor: lx, ly, pupil, lids, brows);
  //   - the teeth are meshes, one per tooth from the artwork's dividers, each its own height and place along the grin's
  //     curve (read from the artwork's column above it), inked, in the skin's tooth colour (gold, fangs, one, toothless
  //     and the jaw shapes too);
  //   - the jaw is its own part of the shell, hinged where the artwork's jaw hinges, dropping with the rig's jaw value
  //     (0.42 skull radii a unit, as the 2D) and swinging a little, with a dark mouth behind it.
  // Looks that draw their own eyes or face pieces (the pumpkin, radio and flaming skulls' eyes, the ice skull's jaw,
  // the five skulls with a glow behind, masks, glasses, hair, beards, and eye and teeth cosmetics not listed above)
  // keep the v70 projected face until their own pass; r3dFaceGeomOK says which.
  const MF = { masks: null, N: 256 };
  const MF_EYES = { pie: 1, tiny: 1, giant: 1, crossed: 1, sleepy: 1 }, MF_GLYPHS = { x: 1, star: 1, spiral: 1, closed: 1, happy: 1, squeeze: 1 }, MF_TEETH = { grin: 1, toothless: 1, tiny: 1, big: 1, jumbo: 1, gold: 1, fangs: 1, one: 1 };
  function r3dFaceGeomOK(look, f) {
    const S = SKINS[look.skull] || SKINS.bone;
    if (S.eyes || S.jawTop || S.behind) return false;
    if (MASKS[look.mask] || HAIR[look.hair] || GLASSES[look.glasses] || BEARD[look.beard] || MOUSTACHES[look.beard]) return false;
    if (!MF_EYES[look.eyes || "pie"] || !MF_TEETH[look.teeth || "grin"]) return false;
    return !(f && f.glyph && !MF_GLYPHS[f.glyph]);
  }
  // the artwork's shapes, rasterised once into coverage maps over its 1000-unit square (antialiased, so the edges of a
  // socket fall softly across the shell's triangles)
  function r3dFaceMasks() {
    if (MF.masks) return MF.masks;
    const N = MF.N, cv = document.createElement("canvas"); cv.width = cv.height = N; const g = cv.getContext("2d", { willReadFrequently: true });
    const raster = paths => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N); g.setTransform(N / 1000, 0, 0, N / 1000, 0, 0); g.fillStyle = "#fff"; for (const p of paths) g.fill(p); const d = g.getImageData(0, 0, N, N).data, m = new Float32Array(N * N); for (let i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] / 255; return m; };
    return (MF.masks = { jaw: raster([JAW_BONE, MOUTH]), upper: raster([shapeOf("teeth-upper", false)]), lower: raster([shapeOf("teeth-lower", false)]) });
  }
  function mfSample(m, ax, ay) {   // bilinear, in art units
    const N = MF.N, u = ax * N / 1000 - 0.5, v = ay * N / 1000 - 0.5, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : m[y * N + x]);
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  }
  const mfArt = (X, Yd) => [X / ART_K + ART_CX, Yd / ART_K + ART_CY];   // skull units (y down) → art units
  // the shell's front surface: how far forward it stands at (X, Yup), sculpt included (the shell's own build, 08rb)
  function r3dShellZ(X, Yup) {
    const x0 = X / 0.97, y0 = (Yup + 0.12) / 1.12, r2 = x0 * x0 + y0 * y0;
    if (r2 >= 1) return 0.05;
    const z = 0.92 * Math.sqrt(1 - r2) + 0.05;
    return Math.max(0.02, z + r3dSkullRelief(X, -Yup) * Math.min(1, z * 2.5));
  }
  // the split: the jaw's triangles (below the mouth's top, inside the artwork's jaw and mouth) become their own mesh,
  // hinged on the artwork's hinge. (Split at the hinge line itself, the strip of cranium between it and the mouth went
  // down with the jaw as a pale band; in the 2D that strip is the cranium's and stays.)
  const MF_HINGE = () => -(BOX.jaw.y0 - ART_CY) * ART_K;   // (y up, skull units)
  function r3dFaceSplit(geo) {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, UV = g.attributes.uv, M = r3dFaceMasks(), hinge = BOX.mouth.y0;
    const up = { p: [], uv: [] }, jw = { p: [], uv: [] };
    for (let t = 0; t < P.count; t += 3) {
      const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, [ax, ay] = mfArt(cx, -cy);
      const D = ay > hinge && mfSample(M.jaw, ax, ay) > 0.5 ? jw : up;
      for (let j = 0; j < 3; j++) { D.p.push(P.getX(t + j), P.getY(t + j), P.getZ(t + j)); D.uv.push(UV.getX(t + j), UV.getY(t + j)); }
    }
    const make = D => { const G = new THREE.BufferGeometry(); G.setAttribute("position", new THREE.Float32BufferAttribute(D.p, 3)); G.setAttribute("uv", new THREE.Float32BufferAttribute(D.uv, 2)); G.computeVertexNormals(); return G; };
    return { upper: make(up), jaw: make(jw) };
  }
  // the parts, built once with the head (08rb r3dSkullModel calls this)
  function r3dFaceBuild(head, shell, smooth, tex) {
    const D = head.userData, hY = MF_HINGE();
    const mat = new THREE.MeshToonMaterial({ toneMapped: false, map: tex, gradientMap: r3dBoneRamp(), transparent: true, alphaTest: 0.5 }); mat.onBeforeCompile = r3dRim;
    const S = r3dFaceSplit(shell), K = r3dFaceSplit(smooth), ink = r3dInk(); ink.map = tex; ink.alphaTest = 0.5;   // (the outline cut by the skin's own silhouette, so it rings the skull and not the shell's ellipsoid)
    const geom = new THREE.Group(); geom.name = "MortyFace";
    const inkU = new THREE.Mesh(K.upper, ink); inkU.renderOrder = -1;
    geom.add(inkU, new THREE.Mesh(S.upper, mat));
    // the jaw: hinged on the artwork's hinge line, its children set so the hinge is its origin
    const jaw = new THREE.Group(); jaw.name = "MortyJaw"; jaw.position.set(0, hY, 0);
    const jawBody = new THREE.Group(); jawBody.position.set(0, -hY, 0);
    const inkJ = new THREE.Mesh(K.jaw, ink); inkJ.renderOrder = -1;
    jawBody.add(inkJ, new THREE.Mesh(S.jaw, mat)); jaw.add(jawBody); geom.add(jaw);
    // the mouth behind: dark, where the jaw leaves a gap as it drops
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, color: 0x111111 })); back.name = "MouthBack"; back.renderOrder = -2;   // (sized each frame to the gap: r3dFacePose)
    geom.add(back);
    // the teeth: one box per tooth between the artwork's dividers
    const teeth = { upper: [], lower: [] }, toothMat = r3dToon("#F7F1DF", { gradientMap: r3dBoneRamp() }), goldMat = r3dToon(GOLD, { gradientMap: r3dBoneRamp() });
    const Mk = r3dFaceMasks();
    for (const row of ["upper", "lower"]) {
      const E = TEETH[row], box = BOX[row], parent = row === "upper" ? geom : jawBody;
      for (let i = 0; i < E.length - 1; i++) {
        const w = (E[i + 1] - E[i]) * ART_K; if (w < 0.02) continue;
        // this tooth's own top and bottom: where the artwork's tooth row covers its middle column (the grin curves, so the row's box is taller than any tooth)
        const cxA = (E[i] + E[i + 1]) / 2; let t0 = Infinity, t1 = -Infinity;
        for (let ay = box.y0 - 4; ay <= box.y1 + 4; ay += 2) if (mfSample(Mk[row], cxA, ay) > 0.5) { t0 = Math.min(t0, ay); t1 = Math.max(t1, ay); }
        if (!isFinite(t0)) continue;
        const x = (cxA - ART_CX) * ART_K, h = (t1 - t0) * ART_K, y = -((t0 + t1) / 2 - ART_CY) * ART_K, z = r3dShellZ(x, y), T = r3dInked(new THREE.BoxGeometry(w * 0.88, h, 0.035), toothMat);
        T.position.set(x, y, z + 0.004); T.rotation.y = Math.atan2(x, 1.1); T.userData.i = i; T.userData.n = E.length - 1; parent.add(T); teeth[row].push(T);
      }
    }
    const fangs = [1, TEETH.upper.length - 2].map(i => { const fx = (TEETH.upper[i] - ART_CX) * ART_K, fy = -((BOX.upper.y0 + BOX.upper.y1) / 2 - ART_CY) * ART_K, G = r3dInked(new THREE.ConeGeometry(0.045, 0.2, 8), toothMat); G.rotation.x = Math.PI; G.position.set(fx, fy - 0.1, r3dShellZ(fx, fy) + 0.02); G.visible = false; geom.add(G); return G; });
    // the eyes and brows (placed each frame)
    const flat = c => new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(c), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const pieGeo = new THREE.CircleGeometry(1, 40, 1.25, TAU - 0.7), disc = new THREE.CircleGeometry(1, 32);
    const eye = () => { const g = new THREE.Group(); const pie = new THREE.Mesh(pieGeo, flat("#F2E7C9")), ball = new THREE.Mesh(disc, flat("#F2E7C9")), dot = new THREE.Mesh(disc, flat("#111111")); dot.position.z = 0.002; g.add(pie, ball, dot); g.userData = { pie, ball, dot }; geom.add(g); return g; };
    const bar = c => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02), flat(c)); geom.add(m); return m; };
    const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.45 : 1; i ? starShape.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : starShape.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); }
    const spiralPts = []; for (let k = 0; k <= 40; k++) { const a = k * 0.42, rr = 0.01 + k * 0.0048; spiralPts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)); }
    const spiralGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), 80, 0.022, 5, false), starGeo = new THREE.ShapeGeometry(starShape);
    const glyph = () => {
      const g = new THREE.Group(), x1 = bar("#F2E7C9"), x2 = bar("#F2E7C9"); geom.remove(x1, x2); g.add(x1, x2);
      const star = new THREE.Mesh(starGeo, flat(MUSTARD)), spiral = new THREE.Mesh(spiralGeo, flat("#F2E7C9")), line = new THREE.Mesh(new THREE.BufferGeometry(), flat("#111111"));
      g.add(star, spiral, line); g.userData = { x1, x2, star, spiral, line, key: "" }; geom.add(g); return g;
    };
    Object.assign(D, { geom, faceMat: mat, jaw, jawBody, teeth, fangs, toothMat, goldMat, mouthBack: back, eyes: [eye(), eye()], brows: [bar("#111111"), bar("#111111")], glyphs: [glyph(), glyph()], hY, mY: -(BOX.mouth.y0 - ART_CY) * ART_K });
    return geom;
  }
  // the sockets this face has (drawSockets' own rule: they swell from their inner edges, lids drop, cheeks push up)
  function r3dFaceSocks(f, look) {
    const sleepy = (look.eyes || "pie") === "sleepy" ? 0.42 : 0;
    return SOCK.map((s, i) => {
      const k = i ? f.sockR : f.sockL, kx = 1 + (k - 1) * 0.55, px = s.x + (i ? -1 : 1) * s.rx * 0.9, cx = px + (s.x - px) * kx;
      return { ...s, k, kx, px, x: cx, rx: s.rx * kx, ry: s.ry * k, lid: Math.max(i ? f.lidR : f.lidL, f.blink, sleepy), low: i ? f.lowR : f.lowL, i };
    });
  }
  const mfShut = f => f.glyph === "closed" || f.glyph === "happy" || f.glyph === "squeeze";
  // the eyes, brows, teeth and jaw for this frame
  function r3dFacePose(D, f, look, pal, t, jawV) {
    const socks = r3dFaceSocks(f, look), eyes = look.eyes || "pie", shut = mfShut(f), Z = (x, yd, dz) => r3dShellZ(x, -yd) + dz;
    socks.forEach((s, i) => {
      const E = D.eyes[i], G = D.glyphs[i], g = f.glyph || ({ x: "x", star: "star", spiral: "spiral" })[eyes] || null;
      let px = s.x + f.lx * s.rx * 0.38, py = s.y + 0.03 + f.ly * s.ry * 0.36; if (eyes === "crossed" && !f.glyph) px = s.x + (i ? -1 : 1) * s.rx * 0.36;
      const rp = 0.15 * f.pupil, lidY = s.y - s.ry + s.lid * 2 * s.ry, lowY = s.low > 0.01 ? s.y + s.ry - s.low * 2 * s.ry : Infinity;
      E.visible = !g; G.visible = !!g;
      if (!g) {   // a pupil, cut to what the lid and the cheek leave showing (as the 2D clips it to the socket)
        const ry0 = eyes === "giant" ? rp * 1.55 : eyes === "tiny" ? rp * 0.45 : rp, rx0 = eyes === "giant" ? rp * 1.35 : eyes === "tiny" ? rp * 0.45 : rp * 0.78;
        const top = Math.max(py - ry0, lidY), bot = Math.min(py + ry0, lowY), h = (bot - top) / 2;
        E.visible = h > 0.004;
        if (E.visible) {
          const cy = (top + bot) / 2, U = E.userData; E.position.set(px, -cy, Z(px, cy, 0.022)); E.scale.set(rx0, h, 1);
          U.pie.visible = eyes === "pie" || eyes === "crossed" || eyes === "sleepy"; U.ball.visible = eyes === "tiny" || eyes === "giant"; U.dot.visible = eyes === "giant";
          for (const m of [U.pie, U.ball]) m.material.color.set(pal.pupil); U.dot.scale.setScalar(0.37); U.dot.position.set(f.lx * 0.2, -f.ly * 0.2, 0.002); U.dot.material.color.set(pal.socket);
        }
      } else {
        const U = G.userData; U.x1.visible = U.x2.visible = g === "x"; U.star.visible = g === "star"; U.spiral.visible = g === "spiral"; U.line.visible = shut;
        if (shut) {   // eyes shut: an ink curve on the skull where the socket would be
          G.position.set(0, 0, 0); G.rotation.set(0, 0, 0); G.scale.set(1, 1, 1);
          const key = g + s.x.toFixed(3) + s.ry.toFixed(3);
          if (U.key !== key) {
            U.key = key; const w = s.rx * 0.62, pts = [];
            if (g === "squeeze") { const sd = i ? -1 : 1, hh = s.ry * 0.42; pts.push([s.x - sd * w, s.y - hh], [s.x + sd * w * 0.55, s.y + 0.02], [s.x - sd * w, s.y + hh + 0.04]); }
            else { const c = g === "closed" ? [0.04, 0.18] : [0.1, -0.16]; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([s.x - w + 2 * w * u, s.y + c[0] + (c[1] - c[0]) * 2 * u * (1 - u)]); } }   // (drawSockets' quadratic: ends at c[0], pulled toward c[1])
            U.line.geometry.dispose(); U.line.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, -y, Z(x, y, 0.025)))), 24, 0.04, 5, false);
          }
          U.line.material.color.set(pal.socket);
        } else {
          G.position.set(px, -py, Z(px, py, 0.025)); G.scale.set(1, 1, 1);
          if (g === "x") { for (const [m, a] of [[U.x1, Math.PI / 4], [U.x2, -Math.PI / 4]]) { m.scale.set(0.34, 0.065, 1); m.rotation.z = a; m.position.set(0, 0, 0); m.material.color.set(pal.pupil); } }
          if (g === "star") { U.star.scale.setScalar(0.2); U.star.rotation.z = Math.sin(t * 6) * 0.2; }
          if (g === "spiral") { U.spiral.rotation.z = -t * 7 * (i ? 1 : -1); U.spiral.material.color.set(pal.pupil); }
        }
      }
      // the brow, when the face has one
      const B = D.brows[i]; B.visible = !!f.brow;
      if (f.brow) {
        const b = f.brow[i], side = i ? 1 : -1, y = s.y - s.ry - 0.12, x0 = s.x - side * 0.14, y0 = y - b * 0.1, x1 = s.x + side * 0.16, y1 = y + b * 0.05, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        B.position.set(mx, -my, Z(mx, my, 0.03)); B.scale.set(Math.hypot(x1 - x0, y1 - y0), 0.09, 1); B.rotation.z = Math.atan2(-(y1 - y0), x1 - x0); B.material.color.set(pal.line);
      }
    });
    // the teeth and the jaw
    const id = look.teeth || "grin", js = JAW_SHAPE[id] || [1, 1], tooth = pal.tooth || pal.base;
    D.toothMat.color.set(tooth);
    for (const row of ["upper", "lower"]) for (const T of D.teeth[row]) {
      const n = T.userData.n, i = T.userData.i; T.visible = id !== "toothless" && (id !== "one" || (row === "upper" && i === Math.floor((n - 1) / 2)));
      T.userData.body.material = id === "gold" && row === "upper" && i === Math.min(1, n - 1) ? D.goldMat : D.toothMat;
    }
    for (const G of D.fangs) G.visible = id === "fangs";
    const up = id === "big" ? [1.12, 1.04] : [1, 1]; for (const T of D.teeth.upper) T.scale.set(up[0], up[1], 1);
    const drop = jawV * 0.42 * js[1];
    D.jaw.position.set(f.skew || 0, D.hY - drop, 0); D.jaw.rotation.set(-0.1 * jawV, 0, 0); D.jaw.scale.set(js[0], js[1], 1);
    // the mouth behind fills only the gap the jaw opens, between the hinge and where the jaw has dropped to, the mouth's width
    const mw = (BOX.mouth.x1 - BOX.mouth.x0) * ART_K * 0.92, gap = drop + 0.04;
    D.mouthBack.visible = drop > 0.02;   // (idle's 0.02 jaw opens nothing you can see) D.mouthBack.scale.set(mw, gap, 1); D.mouthBack.position.set(f.skew || 0, D.mY - gap / 2 + 0.02, r3dShellZ(0, D.mY) - 0.12); D.mouthBack.material.color.set(pal.socket);
  }
  // per frame, from r3dSkull: the skin painted alone, the face's masks, the parts posed. Returns false to fall back.
  function r3dFaceFrame(M, o, look) {
    const D = M.userData, f = o.face || faceFor("idle", o.t || 0);
    if (!D.geom || !r3dFaceGeomOK(look, f)) { if (D.geom) D.geom.visible = false; D.oldFace.visible = true; return false; }
    const Sk = SKINS[look.skull] || SKINS.bone, pal = (Sk.flick && Sk.flick(o.t || 0)) || Sk, n = R3D_SK.tex, S = R3D_SK.span;
    D.g.setTransform(1, 0, 0, 1, 0, 0); D.g.clearRect(0, 0, n, n);
    drawSkull(D.g, n / 2, n / 2, n / (2 * S), { ...o, look: { ...look, wings: "none" }, ang: 0, a: 1, dir: 0, alpha: 1, surface: true });
    D.tex.needsUpdate = true;
    r3dFacePose(D, f, look, pal, o.t || 0, clamp(o.jaw == null ? f.jawT : o.jaw, 0, 1.1));
    D.geom.visible = true; D.oldFace.visible = false; R3D_SK.geomFrames = (R3D_SK.geomFrames || 0) + 1;
    return true;
  }
