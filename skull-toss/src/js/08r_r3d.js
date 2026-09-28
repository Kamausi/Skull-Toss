  // ───────────────────────── v68: the 3D renderer (in progress: off unless asked for) ─────────────────────────
  // The owner's call (2026-09-28): the graphics go from 2D to real 3D, in the 1930s cartoon style (toon shading, ink
  // outlines, the print), and nothing ships until every map is done. Until then the 3D renderer is switched on only by
  // ?r3d in the address (or R3D.force from the dev hooks); the deployed game still paints in 2D.
  //
  // How it's built, so it can be done a piece at a time without breaking anything:
  //   - Three.js (src/vendor/three.js, see tools/vendor) renders into an offscreen WebGL canvas.
  //   - Each converted thing is drawn "in place": where the 2D code drew it, the 3D model is posed in camera space at
  //     the same screen spot and size, rendered inside a scissor box round it, and the box is copied into the 2D frame
  //     under whatever transform the 2D code had (a squash, a shy ring's turn, the water's mirror all still apply).
  //     So the painter's order, the rostrum camera, the aim, the physics and every test stay exactly as they were,
  //     and a model only has to look right, not be placed twice.
  //   - The camera is a pinhole at the eye looking down the lane, with its centre on the horizon (HY), so a model's
  //     perspective matches the 2D projection's: x = W/2 + F·X/Z, y = HY − F·Y/Z.
  //   - The look: MeshToonMaterial with a three-step ramp (lit, half, shadow) and an ink hull drawn a fixed number of
  //     pixels outside each model's silhouette, so a far model's line is as thick as a near one's, like a cel. Only faces
  //     seen edge-on are pushed (a flat piece's back isn't slid out from behind it).
  const R3D = { force: null, ok: null, gl: null, canvas: null, scene: null, cam: null, key: null, fill: null, ramp: null, inkU: null, drawn: 0, fails: 0, ids: 0, cache: {} };
  const r3dAsked = (() => { try { return /[?&]r3d(=1|&|$)/.test(location.search); } catch (e) { return false; } })();
  const r3dOn = () => !R3D.capturing && !WATER.reflecting && (R3D.force == null ? r3dAsked : R3D.force) && r3dReady();   // (while a live piece is being captured, everything inside it draws in 2D)
  const r3dKey = (o, pre) => pre + (o.__r3d || (o.__r3d = ++R3D.ids));   // a lasting key for a thing in the world
  function r3dReady() {
    if (R3D.ok !== null) return R3D.ok;
    R3D.ok = false;
    if (typeof THREE === "undefined") return false;
    try {
      const canvas = document.createElement("canvas");
      const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
      gl.setClearColor(0x000000, 0); gl.autoClear = false; gl.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
      const key = new THREE.DirectionalLight(0xfff4e0, 2.3); key.position.set(-1.1, 1.6, 1.4);   // the map's key light, up and to the left, from behind the camera
      const fill = new THREE.HemisphereLight(0xcfd8ff, 0x3a2a20, 0.9);
      scene.add(key, fill);
      const ramp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);   // shadow, half, lit
      ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
      Object.assign(R3D, { gl, canvas, scene, cam, key, fill, ramp, inkU: { uInk: { value: 2 }, uRes: { value: new THREE.Vector2(1, 1) } } });
      R3D.ok = true; r3dResize();
    } catch (e) { Debug.warn("RENDER", e, "08r_r3d:init"); R3D.ok = false; }
    return R3D.ok;
  }
  // the camera: a pinhole at the eye, its centre moved from the middle of the screen to the horizon
  function r3dResize() {
    if (!R3D.ok || !W) return;
    R3D.gl.setPixelRatio(R3D.pr = Math.min(DPR, 1.5) * R3D_RCM.scale); R3D.gl.setSize(W, H, false);   // (a touch softer than the 2D print on a sharp screen: the 3D is the heavier half; and lower still if the frame can't afford it: 08rf_r3d_budget.js)
    const fullH = 2 * Math.max(HY, H - HY), c = R3D.cam;
    c.fov = 2 * Math.atan(fullH / 2 / F) * 180 / Math.PI; c.aspect = W / fullH;
    c.setViewOffset(W, fullH, 0, fullH / 2 - HY, W, H); c.updateProjectionMatrix();
    R3D.inkU.uRes.value.set(W, H);
  }
  // where a screen point sits in camera space at the depth that makes a world radius R come out r pixels
  function r3dPlace(obj, x, y, r, R) {
    const Z = F * R / Math.max(0.01, r);
    obj.position.set((x - W / 2) * Z / F, -(y - HY) * Z / F, -Z);
    return Z;
  }
  // ── materials: toon, and the ink hull (pushed out along the normal in screen space, a fixed number of pixels)
  function r3dToon(color, o = {}) { return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: R3D.ramp, ...o }); }
  function r3dInk() {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(INK), side: THREE.BackSide });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, R3D.inkU);
      sh.vertexShader = "uniform float uInk; uniform vec2 uRes;\n" + sh.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\n  vec3 nV = normalize(normalMatrix * normal); vec2 nC = (projectionMatrix * vec4(nV, 0.0)).xy; float nL = length(nC); nC = nC / max(nL, 1e-5) * clamp(nL * 3.0, 0.0, 1.0);\n  gl_Position.xy += nC * uInk * gl_Position.w * 2.0 / uRes;");
    };
    return m;
  }
  function r3dInked(geo, mat) {   // a model and its ink hull, sharing the geometry
    const g = new THREE.Group(), body = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, R3D.cache.ink || (R3D.cache.ink = r3dInk()));
    ink.renderOrder = -1; g.add(ink, body); g.userData.body = body; return g;
  }
  // ── drawing. A hero piece with 2D drawn over it (Morty under his hat, the ring under its sparkle) is drawn at once:
  // rendered into its box and copied into the 2D frame under the 2D canvas's current transform. Everything else (the
  // scenery, the cast) is deferred: queued as it's met, then rendered together, depth-tested, and copied in one go
  // at the next hero piece or flush point (r3dFlush), so a street of two hundred set pieces costs one copy, not two
  // hundred. The queue keeps the 2D painter's order between flushes.
  const R3D_Q = { list: [], x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  function r3dBox(box) {
    const x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y)), x1 = Math.min(W, Math.ceil(box.x + box.w)), y1 = Math.min(H, Math.ceil(box.y + box.h));
    return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
  }
  // the batch goes in as one scene: each queued model stands in as a clone (sharing its geometry and materials) posed
  // by its own matrix, and a faded one wears copies of its materials at that opacity (in tenths), so the whole queue
  // is a single render call
  const R3D_POOL = new Map(), R3D_FADE = new Map();
  function r3dFaded(mat, a) {
    const key = mat.uuid + ":" + a; let m = R3D_FADE.get(key);
    if (!m) { m = mat.clone(); m.transparent = true; m.opacity = a / 10; m.depthWrite = a > 6; R3D_FADE.set(key, m); if (mat.onBeforeCompile) m.onBeforeCompile = mat.onBeforeCompile; }
    if (mat.map && m.map !== mat.map) m.map = mat.map;
    return m;
  }
  function r3dStandIn(root, a, used) {
    const key = root.uuid + ":" + a, pool = R3D_POOL.get(key) || (R3D_POOL.set(key, []), R3D_POOL.get(key)), n = used.get(key) || 0;
    used.set(key, n + 1);
    if (pool[n] && pool[n].userData.kids !== root.children.length) pool.length = n;   // (a live piece re-cut since: stand it in again)
    if (!pool[n]) {
      const c = root.clone(); c.userData.kids = root.children.length;
      if (a < 10) c.traverse(o => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(m => r3dFaded(m, a)) : r3dFaded(o.material, a); });
      pool[n] = c;
    }
    return pool[n];
  }
  function r3dRender(entries, x0, y0, x1, y1) {
    const gl = R3D.gl, t0 = performance.now();
    gl.setScissorTest(true); gl.setScissor(x0, H - y1, x1 - x0, y1 - y0); gl.clear(true, true, false);
    if (entries.length === 1 && !entries[0].m) {   // a hero piece: itself, as posed (cut by clipping planes if it has any)
      const E = entries[0]; R3D.inkU.uInk.value = E.ink; R3D.scene.add(E.root); gl.clippingPlanes = E.clip || R3D_NOCLIP;
      try { gl.render(R3D.scene, R3D.cam); } finally { R3D.scene.remove(E.root); gl.clippingPlanes = R3D_NOCLIP; }
      R3D.drawn++;
    } else {
      const batch = R3D.batch || (R3D.batch = new THREE.Group()), used = new Map(); batch.clear();
      let ink = 0;
      for (const E of entries) {
        const a = Math.max(1, Math.min(10, Math.round(E.alpha * 10))), c = r3dStandIn(E.root, a, used);
        c.matrixAutoUpdate = false; c.matrix.copy(E.m); c.matrixWorldNeedsUpdate = true; batch.add(c); ink += E.ink;
      }
      R3D.inkU.uInk.value = ink / entries.length; R3D.scene.add(batch);
      try { gl.render(R3D.scene, R3D.cam); } finally { R3D.scene.remove(batch); batch.clear(); }
      R3D.drawn += entries.length;
    }
    ctx.drawImage(R3D.canvas, x0 * R3D.pr, y0 * R3D.pr, (x1 - x0) * R3D.pr, (y1 - y0) * R3D.pr, x0, y0, x1 - x0, y1 - y0);
    R3D_RCM.t3d += performance.now() - t0;   // (the 3D's share of the frame: 08rf_r3d_budget.js)
  }
  function r3dFlush() {
    const Q = R3D_Q; if (!Q.list.length) return;
    const list = Q.list; Q.list = [];
    const b = [Q.x0, Q.y0, Q.x1, Q.y1]; Q.x0 = Q.y0 = 1e9; Q.x1 = Q.y1 = -1e9;
    try { r3dRender(list, ...b); } catch (e) { if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08r_r3d:flush"); }
  }
  const R3D_NOCLIP = [];
  function r3dDraw(root, box, inkPx = 2, alpha = 1, defer = false, clip = null) {
    const B = r3dBox(box); if (!B) return false;
    if (defer) {
      root.updateMatrix(); const Q = R3D_Q;
      Q.list.push({ root, m: root.matrix.clone(), ink: inkPx, alpha });
      Q.x0 = Math.min(Q.x0, B[0]); Q.y0 = Math.min(Q.y0, B[1]); Q.x1 = Math.max(Q.x1, B[2]); Q.y1 = Math.max(Q.y1, B[3]);
      return true;
    }
    r3dFlush();   // (whatever was queued goes down first: the painter's order holds)
    try {
      const g = ctx, a = g.globalAlpha; g.globalAlpha = a * alpha;
      r3dRender([{ root, m: null, ink: inkPx, alpha: 1, clip }], ...B);
      g.globalAlpha = a;
      return true;
    } catch (e) { if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08r_r3d:draw"); return false; }
  }
  // the 2D canvas draws in CSS pixels under a DPR transform; the copied box is in those same CSS pixels, so it lands
  // where the 2D drawing would have
