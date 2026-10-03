// v73: bakes the owner's models (src/models/source) into src/models/*.bin, which the build embeds (src/build.py
// MODEL_EMBED) and 08ro_r3d_models.js reads: morty-head.bin (Morty's head and eyes) and slingshot.bin.
//   node tools/model-bake.mjs
// The skull (human-skull.glb, a Fab free pack: five detail levels side by side, plus a text plate) gives two levels,
// "hero" (SM_HumanSkull_v1) and "low" (SM_HumanSkull_v3). Each is welded, set upright with its chin at y = 0, centred
// left-right and front-back, and scaled to a height of 1. Its pieces come apart by connectivity: the cranium (the
// largest), the mandible (the next), and every tooth on its own, sorted into the upper and lower rows by height and
// numbered left to right. Each vertex gets an ambient occlusion value (how much of the sky over it the skull itself
// hides, from 96 directions, by orthographic depth maps), so the sockets, the nose and the gaps between the teeth come
// out dark in any skin's colours. The eye (low-poly-eye.glb) gives its eyeball (the iris mesh, with its UVs) and its
// cornea, scaled to a radius of 1 and facing +z, and its colour map, cut down to 512 px.
// Layout: u32 header length, the header (JSON), then each array 4-byte aligned at the offset the header names.
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import zlib from "node:zlib";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(root, "src/models/source"), OUT = path.join(root, "src/models/morty-head.bin"), OUT_SLING = path.join(root, "src/models/slingshot.bin");

function glb(fn) {
  const b = fs.readFileSync(fn), L = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + L).toString()), o = 20 + L, bin = b.slice(o + 8, o + 8 + b.readUInt32LE(o));
  const acc = i => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const es = T.BYTES_PER_ELEMENT, stride = v.byteStride || n * es, base = (v.byteOffset || 0) + (a.byteOffset || 0), out = new T(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin[["readFloatLE", "readUInt32LE", "readUInt16LE", "readUInt8"][[Float32Array, Uint32Array, Uint16Array, Uint8Array].indexOf(T)]](base + k * stride + c * es);
    return out;
  };
  const image = i => { const v = j.bufferViews[j.images[i].bufferView]; return bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const mesh = name => { const m = j.meshes.find(m => m.name.includes(name)); if (!m) throw new Error("no mesh " + name); const p = m.primitives[0]; return { P: acc(p.attributes.POSITION), N: p.attributes.NORMAL != null ? acc(p.attributes.NORMAL) : null, UV: p.attributes.TEXCOORD_0 != null ? acc(p.attributes.TEXCOORD_0) : null, I: acc(p.indices), mat: p.material }; };
  return { j, mesh, image };
}
function weld(P, I) {
  const map = new Map(), pos = [], re = new Int32Array(P.length / 3);
  for (let i = 0; i < re.length; i++) { const k = Math.round(P[i * 3] * 1e4) + "," + Math.round(P[i * 3 + 1] * 1e4) + "," + Math.round(P[i * 3 + 2] * 1e4); let id = map.get(k); if (id == null) { id = pos.length / 3; map.set(k, id); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } re[i] = id; }
  const idx = []; for (let t = 0; t < I.length; t += 3) { const a = re[I[t]], b = re[I[t + 1]], c = re[I[t + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
function components(nv, idx) {
  const par = Int32Array.from({ length: nv }, (_, i) => i), f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = f(idx[t]); par[f(idx[t + 1])] = a; par[f(idx[t + 2])] = a; }
  return Int32Array.from({ length: nv }, (_, i) => f(i));
}
function normals(pos, idx) {
  const N = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]], e1 = [0, 1, 2].map(k => pos[b * 3 + k] - pos[a * 3 + k]), e2 = [0, 1, 2].map(k => pos[c * 3 + k] - pos[a * 3 + k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) N[v * 3 + k] += n[k];
  }
  for (let v = 0; v < N.length / 3; v++) { const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1; for (let k = 0; k < 3; k++) N[v * 3 + k] /= l; }
  return N;
}
// ambient occlusion by orthographic depth maps: a vertex sees the sky in direction d if nothing of the skull stands
// in front of it along d
function occlusion(pos, idx, nor, nd = 96, R = 224) {
  const nv = pos.length / 3, seen = new Float32Array(nv), tot = new Float32Array(nv), cen = [0, 0.5, 0], rad = 0.62, eps = 2.5 * (2 * rad / R);
  for (let s = 0; s < nd; s++) {
    const y = 1 - (2 * (s + 0.5)) / nd, r = Math.sqrt(1 - y * y), ph = s * Math.PI * (3 - Math.sqrt(5)), d = [Math.cos(ph) * r, y, Math.sin(ph) * r];
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = norm(cross(up, d)), v = cross(d, u);
    const px = new Float32Array(nv), py = new Float32Array(nv), pz = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { const p = [pos[i * 3] - cen[0], pos[i * 3 + 1] - cen[1], pos[i * 3 + 2] - cen[2]]; px[i] = (dot(p, u) / rad * 0.5 + 0.5) * R; py[i] = (dot(p, v) / rad * 0.5 + 0.5) * R; pz[i] = dot(p, d); }
    const Z = new Float32Array(R * R).fill(-1e9);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2], x0 = Math.max(0, Math.floor(Math.min(px[a], px[b], px[c]))), x1 = Math.min(R - 1, Math.ceil(Math.max(px[a], px[b], px[c]))), y0 = Math.max(0, Math.floor(Math.min(py[a], py[b], py[c]))), y1 = Math.min(R - 1, Math.ceil(Math.max(py[a], py[b], py[c])));
      const den = (py[b] - py[c]) * (px[a] - px[c]) + (px[c] - px[b]) * (py[a] - py[c]); if (Math.abs(den) < 1e-12) continue;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const X = xx + 0.5, Y = yy + 0.5, w0 = ((py[b] - py[c]) * (X - px[c]) + (px[c] - px[b]) * (Y - py[c])) / den, w1 = ((py[c] - py[a]) * (X - px[c]) + (px[a] - px[c]) * (Y - py[c])) / den, w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const z = w0 * pz[a] + w1 * pz[b] + w2 * pz[c], k = yy * R + xx; if (z > Z[k]) Z[k] = z;
      }
    }
    for (let i = 0; i < nv; i++) {
      const w = nor[i * 3] * d[0] + nor[i * 3 + 1] * d[1] + nor[i * 3 + 2] * d[2]; if (w <= 0.02) continue;
      const xx = Math.min(R - 1, Math.max(0, Math.floor(px[i]))), yy = Math.min(R - 1, Math.max(0, Math.floor(py[i])));
      tot[i] += w; if (pz[i] >= Z[yy * R + xx] - eps) seen[i] += w;
    }
  }
  return Uint8Array.from({ length: nv }, (_, i) => Math.round(255 * (1 - (tot[i] ? seen[i] / tot[i] : 1))));
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };

const chunks = []; let off = 0;
const put = arr => { const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), o = off; chunks.push(buf); off += buf.length; const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } return o; };
const quant = (P, mn, mx) => Int16Array.from(P, (v, i) => Math.round(((v - mn[i % 3]) / (mx[i % 3] - mn[i % 3] || 1)) * 65534 - 32767));
const bounds = P => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i++) { mn[i % 3] = Math.min(mn[i % 3], P[i]); mx[i % 3] = Math.max(mx[i % 3], P[i]); } return { mn, mx }; };

const SK = glb(path.join(SRC, "human-skull.glb")), lods = [];
for (const [name, meshName] of [["hero", "SM_HumanSkull_v1_"], ["low", "SM_HumanSkull_v3_"]]) {
  const m = SK.mesh(meshName), W = weld(m.P, m.I), nv = W.pos.length / 3, b = bounds(W.pos);
  const cx = (b.mn[0] + b.mx[0]) / 2, cz = (b.mn[2] + b.mx[2]) / 2, H = b.mx[1] - b.mn[1];
  for (let i = 0; i < nv; i++) { W.pos[i * 3] = (W.pos[i * 3] - cx) / H; W.pos[i * 3 + 1] = (W.pos[i * 3 + 1] - b.mn[1]) / H; W.pos[i * 3 + 2] = (W.pos[i * 3 + 2] - cz) / H; }
  const lab = components(nv, W.idx), groups = new Map();
  for (let t = 0; t < W.idx.length; t += 3) { const r = lab[W.idx[t]]; if (!groups.has(r)) groups.set(r, []); groups.get(r).push(W.idx[t], W.idx[t + 1], W.idx[t + 2]); }
  const G = [...groups.entries()].map(([r, tri]) => { const vs = new Set(tri); let sx = 0, sy = 0, sz = 0; for (const v of vs) { sx += W.pos[v * 3]; sy += W.pos[v * 3 + 1]; sz += W.pos[v * 3 + 2]; } return { tri, nv: vs.size, c: [sx / vs.size, sy / vs.size, sz / vs.size] }; }).sort((a, b) => b.nv - a.nv);
  const [cran, mand, ...teeth] = G;
  // the two rows: each tooth belongs to the bone it sits closest to (the maxilla's, the cranium's; or the mandible's)
  const vsOf = tri => [...new Set(tri)], cv = vsOf(cran.tri), mv = vsOf(mand.tri);
  const near = (vs, bone) => { let m = 1e9; for (const a of vs) for (const b of bone) { const d = (W.pos[a * 3] - W.pos[b * 3]) ** 2 + (W.pos[a * 3 + 1] - W.pos[b * 3 + 1]) ** 2 + (W.pos[a * 3 + 2] - W.pos[b * 3 + 2]) ** 2; if (d < m) m = d; } return m; };
  for (const T of teeth) { const vs = vsOf(T.tri); T.upper = near(vs, cv) < near(vs, mv); }
  const split = teeth.length ? (Math.min(...teeth.filter(T => T.upper).map(T => T.c[1])) + Math.max(...teeth.filter(T => !T.upper).map(T => T.c[1]))) / 2 : 0;
  const parts = [{ name: "cranium", kind: "cranium", tri: cran.tri }, { name: "mandible", kind: "mandible", tri: mand.tri }];
  for (const row of ["upper", "lower"]) teeth.filter(T => T.upper === (row === "upper")).sort((a, b) => a.c[0] - b.c[0]).forEach((T, i, A) => parts.push({ name: `tooth-${row}-${i}`, kind: "tooth", row, i, n: A.length, c: T.c.map(v => +v.toFixed(5)), tri: T.tri }));
  const nor = normals(W.pos, W.idx), ao = occlusion(W.pos, W.idx, nor), q = bounds(W.pos);
  const L = { name, nv, tris: W.idx.length / 3, min: q.mn, max: q.mx, pos: put(quant(W.pos, q.mn, q.mx)), ao: put(ao), parts: parts.map(p => ({ name: p.name, kind: p.kind, row: p.row, i: p.i, n: p.n, c: p.c, count: p.tri.length, idx: put(Uint16Array.from(p.tri)) })) };
  // where the mandible hinges: the top of its back quarter (the condyles, not the coronoid processes ahead of them)
  const MV = [...new Set(mand.tri)]; let z0 = 1e9, z1 = -1e9; for (const v of MV) { z0 = Math.min(z0, W.pos[v * 3 + 2]); z1 = Math.max(z1, W.pos[v * 3 + 2]); }
  let my = -1e9, mz = 0; for (const v of MV) if (W.pos[v * 3 + 2] < z0 + (z1 - z0) * 0.25 && W.pos[v * 3 + 1] > my) { my = W.pos[v * 3 + 1]; mz = W.pos[v * 3 + 2]; }
  L.hinge = [0, +(my - 0.015).toFixed(5), +mz.toFixed(5)]; L.toothSplit = +split.toFixed(5);
  lods.push(L);
  console.log(name, "verts", nv, "tris", L.tris, "teeth", teeth.length, "upper", parts.filter(p => p.row === "upper").length, "ao mean", (ao.reduce((s, v) => s + v, 0) / nv / 255).toFixed(3), "hinge", L.hinge);
}

const EY = glb(path.join(SRC, "low-poly-eye.glb")), eye = {};
for (const [k, nm] of [["ball", "eye_iris"], ["cornea", "eye_cornea"]]) {
  const m = EY.mesh(nm), b = bounds(m.P), R = 1.2850494;   // (the cornea's radius: the eye at radius 1)
  const P = Float32Array.from(m.P, v => v / R), q = bounds(P);
  eye[k] = { nv: m.P.length / 3, count: m.I.length, min: q.mn, max: q.mx, pos: put(quant(P, q.mn, q.mx)), nor: put(Int8Array.from(m.N, v => Math.round(v * 127))), uv: m.UV ? put(Uint16Array.from(m.UV, v => Math.round(Math.min(1, Math.max(0, v)) * 65535))) : null, idx: put(Uint16Array.from(m.I)) };
  void b;
}
const tmp = path.join(root, "src/models/.eye-src.jpg"), small = path.join(root, "src/models/.eye-512.jpg");
fs.writeFileSync(tmp, EY.image(EY.j.textures[EY.j.materials.find(m => m.name === "M_eye_iris").pbrMetallicRoughness.baseColorTexture.index].source));
execFileSync("python3", ["-c", `from PIL import Image; Image.open(${JSON.stringify(tmp)}).convert("RGB").resize((512, 512), Image.LANCZOS).save(${JSON.stringify(small)}, quality=86)`]);
const jpg = fs.readFileSync(small); fs.unlinkSync(tmp); fs.unlinkSync(small);
eye.tex = { off: put(new Uint8Array(jpg)), len: jpg.length, mime: "image/jpeg" };

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "MANIFEST.json"), "utf8"));
function writeBin(file, head) {
  const header = Buffer.from(JSON.stringify(head)), pad = (4 - ((4 + header.length) % 4)) % 4, hl = Buffer.alloc(4); hl.writeUInt32LE(header.length + pad);
  fs.writeFileSync(file, Buffer.concat([hl, header, Buffer.alloc(pad, 32), ...chunks]));
  console.log("wrote", path.relative(root, file), fs.statSync(file).size, "bytes");
  chunks.length = 0; off = 0;
}
writeBin(OUT, { v: 1, skull: { lods }, eye, provenance: { "human-skull.glb": manifest["human-skull.glb"], "low-poly-eye.glb": manifest["low-poly-eye.glb"] } });

// ── the slingshot (slingshot.obj.gz, a 3ds Max export: one group of eight loose pieces, no material) ──
// The frame (the Y-fork and handle), the leather pouch, the cord wraps at the fork's tips and at the pouch's ends, and
// two rubber bands modelled hanging slack. The bands aren't kept: the game stretches its bands from the tips to the
// pouch every frame (08rc_r3d_launcher.js). Units: the distance between the two tip wraps is 1, the origin midway
// between them, x to the right, y up. The wraps are dense (13-25 thousand triangles each), so they're simplified by
// vertex clustering; the frame and pouch keep every triangle.
{
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(SRC, "slingshot.obj.gz"))).toString().split("\n"), P = [], I = [];
  for (const l of lines) { if (l.startsWith("v ")) P.push(...l.trim().split(/\s+/).slice(1, 4).map(Number)); else if (l.startsWith("f ")) { const v = l.trim().split(/\s+/).slice(1).map(q => parseInt(q) - 1); for (let i = 1; i < v.length - 1; i++) I.push(v[0], v[i], v[i + 1]); } }
  const Wd = weld(new Float32Array(P), new Uint32Array(I)), nv = Wd.pos.length / 3, lab = components(nv, Wd.idx), groups = new Map();
  for (let t = 0; t < Wd.idx.length; t += 3) { const r = lab[Wd.idx[t]]; if (!groups.has(r)) groups.set(r, []); groups.get(r).push(Wd.idx[t], Wd.idx[t + 1], Wd.idx[t + 2]); }
  const G = [...groups.values()].map(tri => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const v of tri) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], Wd.pos[v * 3 + c]); mx[c] = Math.max(mx[c], Wd.pos[v * 3 + c]); } return { tri, mn, mx, c: [0, 1, 2].map(k => (mn[k] + mx[k]) / 2), h: mx[1] - mn[1], w: mx[0] - mn[0] }; });
  const frame = G.reduce((a, b) => (b.mn[1] < a.mn[1] ? b : a)), rest = G.filter(g => g !== frame);
  const bands = rest.filter(g => g.h > frame.h * 0.4), small = rest.filter(g => !bands.includes(g));
  const top = small.filter(g => g.c[1] > frame.mx[1] + 2), pouch = top.reduce((a, b) => (b.w > a.w ? b : a)), ties = top.filter(g => g !== pouch).sort((a, b) => a.c[0] - b.c[0]);
  const tips = small.filter(g => !top.includes(g)).sort((a, b) => a.c[0] - b.c[0]);
  if (tips.length !== 2 || ties.length !== 2 || bands.length !== 2) throw new Error("slingshot pieces not as expected");
  const o = [(tips[0].c[0] + tips[1].c[0]) / 2, (tips[0].c[1] + tips[1].c[1]) / 2, (tips[0].c[2] + tips[1].c[2]) / 2], U = Math.hypot(tips[1].c[0] - tips[0].c[0], tips[1].c[1] - tips[0].c[1]);
  const norm1 = q => [(q[0] - o[0]) / U, (q[1] - o[1]) / U, (q[2] - o[2]) / U].map(v => +v.toFixed(5));
  // one piece: its own vertices, normalised, optionally clustered (cell in normalised units)
  const piece = (g, cell) => {
    const map = new Map(), pos = [], idx = [], key = v => { const p = norm1([Wd.pos[v * 3], Wd.pos[v * 3 + 1], Wd.pos[v * 3 + 2]]); const k = cell ? p.map(x => Math.round(x / cell)).join(",") : String(v); let id = map.get(k); if (id == null) { id = { i: pos.length, s: [0, 0, 0], n: 0 }; map.set(k, id); pos.push(id); } id.s = id.s.map((a, c) => a + p[c]); id.n++; return id.i; };
    for (let t = 0; t < g.tri.length; t += 3) { const a = key(g.tri[t]), b = key(g.tri[t + 1]), c = key(g.tri[t + 2]); if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
    const flat = new Float32Array(pos.length * 3); pos.forEach((q, i) => { for (let c = 0; c < 3; c++) flat[i * 3 + c] = q.s[c] / q.n; });
    const q = bounds(flat); return { nv: pos.length, count: idx.length, min: q.mn, max: q.mx, pos: put(quant(flat, q.mn, q.mx)), idx: put(Uint16Array.from(idx)) };
  };
  const parts = { frame: piece(frame, 0), pouch: piece(pouch, 0), tipL: piece(tips[0], 0.014), tipR: piece(tips[1], 0.014), tieL: piece(ties[0], 0.014), tieR: piece(ties[1], 0.014) };
  const anchors = { tipL: norm1(tips[0].c), tipR: norm1(tips[1].c), base: norm1([frame.c[0], frame.mn[1], frame.c[2]]), fork: norm1([frame.c[0], frame.mn[1] + (frame.mx[1] - frame.mn[1]) * 0.55, frame.c[2]]), pouch: norm1(pouch.c), tieL: norm1(ties[0].c), tieR: norm1(ties[1].c),
    bandR: +((bands.reduce((s, g) => s + Math.min(g.mx[2] - g.mn[2], 9), 0) / 2) / U * 0.05).toFixed(5) };
  for (const [k, v] of Object.entries(parts)) console.log("sling", k, "verts", v.nv, "tris", v.count / 3);
  console.log("sling anchors", JSON.stringify(anchors));
  writeBin(OUT_SLING, { v: 1, parts, anchors, provenance: { "slingshot.obj.gz": manifest["slingshot.obj.gz"] } });
}
