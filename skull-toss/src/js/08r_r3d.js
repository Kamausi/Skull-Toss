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
  //     pixels outside each model's silhouette, so a far model's line is as thick as a near one's, like a cel.
  const R3D = { force: null, ok: null, gl: null, canvas: null, scene: null, cam: null, key: null, fill: null, ramp: null, inkU: null, drawn: 0, fails: 0, ids: 0, cache: {} };
  const r3dAsked = (() => { try { return /[?&]r3d(=1|&|$)/.test(location.search); } catch (e) { return false; } })();
  const r3dOn = () => (R3D.force == null ? r3dAsked : R3D.force) && r3dReady();
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
    R3D.gl.setPixelRatio(DPR); R3D.gl.setSize(W, H, false);
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
        "#include <project_vertex>\n  vec3 nV = normalize(normalMatrix * normal); vec2 nC = (projectionMatrix * vec4(nV, 0.0)).xy; nC = nC / max(length(nC), 1e-5);\n  gl_Position.xy += nC * uInk * gl_Position.w * 2.0 / uRes;");
    };
    return m;
  }
  function r3dInked(geo, mat) {   // a model and its ink hull, sharing the geometry
    const g = new THREE.Group(), body = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, R3D.cache.ink || (R3D.cache.ink = r3dInk()));
    ink.renderOrder = -1; g.add(ink, body); g.userData.body = body; return g;
  }
  // ── render one model into its box and copy the box into the 2D frame, under the 2D canvas's current transform
  function r3dDraw(root, box, inkPx = 2, alpha = 1) {
    const gl = R3D.gl, x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y)), x1 = Math.min(W, Math.ceil(box.x + box.w)), y1 = Math.min(H, Math.ceil(box.y + box.h));
    if (x1 <= x0 || y1 <= y0) return false;
    try {
      R3D.inkU.uInk.value = inkPx;
      R3D.scene.add(root);
      gl.setScissorTest(true); gl.setScissor(x0, H - y1, x1 - x0, y1 - y0); gl.clear(true, true, false);
      gl.render(R3D.scene, R3D.cam);
      R3D.scene.remove(root);
      const g = ctx, a = g.globalAlpha; g.globalAlpha = a * alpha;
      g.drawImage(R3D.canvas, x0 * DPR, y0 * DPR, (x1 - x0) * DPR, (y1 - y0) * DPR, x0, y0, x1 - x0, y1 - y0);
      g.globalAlpha = a; R3D.drawn++;
      return true;
    } catch (e) { R3D.scene.remove(root); if (R3D.fails++ < 3) Debug.warn("RENDER", e, "08r_r3d:draw"); return false; }
  }
  // the 2D canvas draws in CSS pixels under a DPR transform; r3dDraw's destination box is in those same CSS pixels,
  // so it lands where the 2D drawing would have, and the water's mirror pass mirrors it like anything else
