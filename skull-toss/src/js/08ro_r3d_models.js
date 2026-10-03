  // ───────────────────────── v73: the owner's models, baked and embedded ─────────────────────────
  // The owner supplied three models for the overhaul (src/models/source, provenance in its MANIFEST.json): a human
  // skull for Morty's head, an eye for his eyes, and a slingshot. tools/model-bake.mjs bakes them into compact binaries
  // (src/models/*.bin: positions quantised to 16 bits, the pieces split apart, the skull's ambient occlusion per
  // vertex, the eye's map cut to 512 px), which the build embeds as MODEL_EMBED. Here they're read back into geometry,
  // once, the first time a model is asked for. Each piece gets its own vertices (the squash-twist deformer bends each
  // geometry's positions in place, so pieces mustn't share them).
  const R3D_MODELS = { bins: {}, geo: {} };
  function r3dModelBin(name) {
    if (name in R3D_MODELS.bins) return R3D_MODELS.bins[name];
    let out = null;
    try {
      const b64 = typeof MODEL_EMBED !== "undefined" && MODEL_EMBED && MODEL_EMBED[name];
      if (b64) {
        const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        const hl = new DataView(u.buffer).getUint32(0, true);
        out = { head: JSON.parse(new TextDecoder().decode(u.subarray(4, 4 + hl))), buf: u.buffer, base: 4 + hl };
      }
    } catch (e) { out = null; }
    return (R3D_MODELS.bins[name] = out);
  }
  const r3dBinArr = (B, T, off, n) => new T(B.buf, B.base + off, n);
  function r3dBinPos(B, off, n, mn, mx) {   // 16-bit positions back to floats over their bounds
    const q = r3dBinArr(B, Int16Array, off, n * 3), out = new Float32Array(n * 3);
    for (let i = 0; i < out.length; i++) { const c = i % 3; out[i] = mn[c] + ((q[i] + 32767) / 65534) * (mx[c] - mn[c]); }
    return out;
  }
  // one piece of a shared vertex buffer as its own geometry: its vertices gathered, its triangles renumbered
  function r3dBinPiece(P, idx, extra = {}) {
    const map = new Map(), pos = [], tri = new Uint32Array(idx.length), ex = Object.fromEntries(Object.keys(extra).map(k => [k, []]));
    for (let t = 0; t < idx.length; t++) {
      const v = idx[t]; let j = map.get(v);
      if (j == null) { j = pos.length / 3; map.set(v, j); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); for (const k in extra) { const [A, n] = extra[k]; for (let c = 0; c < n; c++) ex[k].push(A[v * n + c]); } }
      tri[t] = j;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    for (const k in extra) g.setAttribute(k, new THREE.Float32BufferAttribute(ex[k], extra[k][1]));
    g.setIndex(new THREE.BufferAttribute(pos.length / 3 > 65535 ? tri : Uint16Array.from(tri), 1)); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  // the skull: per detail level, its pieces (cranium, mandible, each tooth) with an "ao" attribute (0 open sky … 1 hidden)
  function r3dSkullParts(lod) {
    const key = "skull:" + lod; if (R3D_MODELS.geo[key] !== undefined) return R3D_MODELS.geo[key];
    const B = r3dModelBin("morty-head"), L = B && B.head.skull.lods.find(l => l.name === lod);
    if (!L) return (R3D_MODELS.geo[key] = null);
    const P = r3dBinPos(B, L.pos, L.nv, L.min, L.max), ao = Float32Array.from(r3dBinArr(B, Uint8Array, L.ao, L.nv), v => v / 255);
    const parts = L.parts.map(p => ({ ...p, geo: r3dBinPiece(P, r3dBinArr(B, Uint16Array, p.idx, p.count), { ao: [ao, 1] }) }));
    return (R3D_MODELS.geo[key] = { parts, hinge: L.hinge, tris: L.tris });
  }
  // the eye: its ball (with UVs, for its map) and its cornea, radius 1, looking down +z; and the map
  function r3dEyeParts() {
    if (R3D_MODELS.geo.eye !== undefined) return R3D_MODELS.geo.eye;
    const B = r3dModelBin("morty-head"), E = B && B.head.eye; if (!E) return (R3D_MODELS.geo.eye = null);
    const part = q => {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(r3dBinPos(B, q.pos, q.nv, q.min, q.max), 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(Float32Array.from(r3dBinArr(B, Int8Array, q.nor, q.nv * 3), v => v / 127), 3));
      if (q.uv != null) g.setAttribute("uv", new THREE.Float32BufferAttribute(Float32Array.from(r3dBinArr(B, Uint16Array, q.uv, q.nv * 2), v => v / 65535), 2));
      g.setIndex(new THREE.BufferAttribute(r3dBinArr(B, Uint16Array, q.idx, q.count).slice(), 1)); g.computeBoundingSphere(); return g;
    };
    const img = new Image(), tex = new THREE.Texture(img);
    img.onload = () => { tex.needsUpdate = true; };
    img.src = URL.createObjectURL(new Blob([new Uint8Array(B.buf, B.base + E.tex.off, E.tex.len)], { type: E.tex.mime }));
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;   // (glTF's UVs: no flip)
    return (R3D_MODELS.geo.eye = { ball: part(E.ball), cornea: part(E.cornea), tex });
  }
  // the slingshot: frame, pouch, the wraps at the tips and the ties at the pouch; anchors in its units (tips 1 apart)
  function r3dSlingParts() {
    if (R3D_MODELS.geo.sling !== undefined) return R3D_MODELS.geo.sling;
    const B = r3dModelBin("slingshot"); if (!B) return (R3D_MODELS.geo.sling = null);
    const parts = {};
    for (const [k, q] of Object.entries(B.head.parts)) parts[k] = r3dBinPiece(r3dBinPos(B, q.pos, q.nv, q.min, q.max), r3dBinArr(B, Uint16Array, q.idx, q.count));
    return (R3D_MODELS.geo.sling = { parts, anchors: B.head.anchors });
  }
  function r3dModelsStatus() {
    const s = {}; for (const n of ["morty-head", "slingshot"]) { const B = r3dModelBin(n); s[n] = B ? { bytes: B.buf.byteLength, provenance: B.head.provenance } : null; }
    return s;
  }
