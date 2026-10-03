  // ───────────────────────── v68 3D: the slingshot ─────────────────────────
  // The wooden slingshot as a model: a turned handle, two arms up to capped tips, the bands as rubber tubes from the
  // tips to the pouch, and the leather pouch cupped behind Morty. It's posed from the same anchor points the painted
  // launcher uses (its tips, its seat, the pouch the pull drags about), so the pull, the twang and the bands' stretch
  // all read exactly as before. (A launcher from the Vault still draws in 2D for now.)
  function r3dLimb(m, a, b, rad) {   // stretch a unit cylinder (height 1, along y) from a to b
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(rad, Math.max(1e-4, L), rad);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  function r3dLauncherModel() {
    if (R3D.cache.sling) return R3D.cache.sling;
    const g = new THREE.Group(), wood = r3dToon("#8A5C34"), dark = r3dToon("#5A3A22"), tip = r3dToon("#F2E7C9"), band = r3dToon("#A94332");
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14), ball = new THREE.SphereGeometry(1, 14, 10);
    const part = (geo, mat) => { const P = r3dInked(geo, mat); g.add(P); return P; };
    const U = { handle: part(cyl, wood), armL: part(cyl, wood), armR: part(cyl, wood), fork: part(ball, wood), wrap: part(cyl, dark),
      tipL: part(ball, tip), tipR: part(ball, tip), bandL: part(cyl, band), bandR: part(cyl, band), pouch: part(new THREE.SphereGeometry(1, 18, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.55), dark) };
    U.pouch.userData.body.material = dark.clone(); U.pouch.userData.body.material.side = THREE.DoubleSide;
    Object.assign(g.userData, U, { band });
    // v73: the owner's slingshot (08ro_r3d_models.js): its frame with the cord wraps at its tips, and its leather pouch
    // with the ties at its ends, in place of the turned handle, arms, caps and the cupped pouch above. The bands stay
    // the game's own, stretched from the tips to the pouch each frame (the model's hang slack).
    const SL = r3dSlingParts();
    if (SL) {
      const cord = r3dToon("#3A2A1C"), leather = r3dToon("#6A4429"); leather.side = THREE.DoubleSide;
      const frame = new THREE.Group(), pouch = new THREE.Group(); frame.name = "SlingFrame"; pouch.name = "SlingPouch"; frame.matrixAutoUpdate = false; pouch.matrixAutoUpdate = false;
      frame.add(r3dInked(SL.parts.frame, wood), r3dInked(SL.parts.tipL, cord), r3dInked(SL.parts.tipR, cord));
      pouch.add(r3dInked(SL.parts.pouch, leather), r3dInked(SL.parts.tieL, cord), r3dInked(SL.parts.tieR, cord));
      g.add(frame, pouch); for (const k of ["handle", "armL", "armR", "fork", "wrap", "tipL", "tipR", "pouch"]) U[k].visible = false;
      Object.assign(g.userData, { model: { frame, pouch, A: SL.anchors } });
    }
    return (R3D.cache.sling = g);
  }
  // sx, sy the seat; r Morty's radius at rest; tl, tr the band tips and pl, pr the pouch ends, all in screen pixels
  function r3dLauncher(sx, sy, r, off, fy, tl, tr, pl, pr, bandId) {
    const M = r3dLauncherModel(), U = M.userData, Z = F * SKULL_R * 1.12 / Math.max(0.01, r);
    const P = (x, y, dz = 0) => new THREE.Vector3((x - W / 2) * Z / F, -(y - HY) * Z / F, -Z + dz);
    const k = Z / F, w = r * k;   // one Morty-radius, in metres at his depth
    const tipL = P(tl.x, tl.y), tipR = P(tr.x, tr.y), fork = P(sx, sy + fy + r * 1.75, w * 0.1), base = P(sx, sy + fy + r * 3.55, w * 0.2);
    M.position.set(0, 0, 0); M.rotation.set(0, 0, 0); M.scale.setScalar(1);
    r3dLimb(U.handle, base, fork, w * 0.16); r3dLimb(U.wrap, P(sx, sy + fy + r * 2.3, w * 0.12), P(sx, sy + fy + r * 3.3, w * 0.15), w * 0.18);
    r3dLimb(U.armL, fork, tipL, w * 0.13); r3dLimb(U.armR, fork, tipR, w * 0.13);
    U.fork.position.copy(fork); U.fork.scale.setScalar(w * 0.17);
    for (const [T, p] of [[U.tipL, tipL], [U.tipR, tipR]]) { T.position.copy(p); T.scale.setScalar(w * 0.16); }
    const pouchL = P(pl.x, pl.y, w * 0.25), pouchR = P(pr.x, pr.y, w * 0.25);
    r3dLimb(U.bandL, tipL, pouchL, w * 0.075); r3dLimb(U.bandR, tipR, pouchR, w * 0.075);
    const S = BANDS[bandId] || BANDS.classic; U.band.color.set(S.core || "#A94332");
    const pc = P(sx + off.x, sy + off.y + r * 0.72, w * 0.45); U.pouch.position.copy(pc); U.pouch.scale.set(w * 0.8, w * 0.32, w * 0.45); U.pouch.rotation.set(0, 0, 0);
    if (U.model) {   // (v73) the model's frame on the tips and the handle's foot, its pouch on the pouch's ends
      const A = U.model.A, mid = tipL.clone().add(tipR).multiplyScalar(0.5), ex = tipR.clone().sub(tipL), sc = ex.length(); ex.normalize();
      const down = mid.clone().sub(base), hl = down.length(), ey = down.clone().addScaledVector(ex, -down.dot(ex)).normalize(), ez = new THREE.Vector3().crossVectors(ex, ey);
      const ky = clamp(hl / (sc * Math.abs(A.base[1])), 0.7, 1.4), m = new THREE.Matrix4().makeBasis(ex.multiplyScalar(sc), ey.multiplyScalar(sc * ky), ez.multiplyScalar(sc)).setPosition(mid);
      U.model.frame.matrix.copy(m);
      const tL = new THREE.Vector3(...A.tieL), tR = new THREE.Vector3(...A.tieR), px = pouchR.clone().sub(pouchL), ps = Math.max(1e-4, px.length() / Math.max(1e-4, Math.hypot(tR.x - tL.x, tR.y - tL.y))); px.normalize();
      const py = new THREE.Vector3(0, 1, 0).addScaledVector(px, -px.y).normalize(), pz = new THREE.Vector3().crossVectors(px, py), pm = new THREE.Matrix4().makeBasis(px.multiplyScalar(ps), py.multiplyScalar(ps), pz.multiplyScalar(ps));
      const tieMid = tL.clone().add(tR).multiplyScalar(0.5).applyMatrix4(pm); pm.setPosition(pouchL.clone().add(pouchR).multiplyScalar(0.5).sub(tieMid).add(new THREE.Vector3(0, 0, -w * 0.15)));
      U.model.pouch.matrix.copy(pm);
    }
    const x0 = Math.min(tl.x, pl.x, sx - r * 2) - 12, x1 = Math.max(tr.x, pr.x, sx + r * 2) + 12, y0 = Math.min(tl.y, tr.y, sy + off.y - r) - 12, y1 = sy + fy + r * 3.8;
    return r3dDraw(M, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, Math.max(1.5, r * 0.06));
  }
  // ── the ring's post: a turned wooden pole on an iron foot, capped where it meets the ring (the default pole; a
  // pole from the Vault still draws in 2D for now)
  function r3dPostModel() {
    if (R3D.cache.post) return R3D.cache.post;
    const g = new THREE.Group(), wood = r3dToon("#7A5230"), iron = r3dToon("#3A3A40");
    const shaft = r3dInked(new THREE.CylinderGeometry(1, 1, 1, 14), wood), foot = r3dInked(new THREE.BoxGeometry(1, 1, 1), iron), cap = r3dInked(new THREE.CylinderGeometry(1, 1, 1, 14), iron);
    g.add(shaft, foot, cap); Object.assign(g.userData, { shaft, foot, cap });
    return (R3D.cache.post = g);
  }
  function r3dPost(x, top, bottom, pw) {
    if (bottom <= top) return false;
    const M = r3dPostModel(), U = M.userData, Z = F * POST_HALF * 2 / Math.max(0.01, pw), k = Z / F;
    const P = (px, py) => new THREE.Vector3((px - W / 2) * k, -(py - HY) * k, -Z), a = P(x, bottom), b = P(x, top), w = pw * k;
    M.position.set(0, 0, 0); M.rotation.set(0, 0, 0); M.scale.setScalar(1);
    r3dLimb(U.shaft, a, b, w * 0.5); r3dPostBend(U.shaft, game.time);   // (v68: it bends as the ring it holds shakes)
    U.foot.position.copy(a); U.foot.scale.set(w * 3.4, w * 0.9, w * 2.4); U.cap.position.copy(b); U.cap.scale.set(w * 0.62, w * 0.5, w * 0.62);
    return r3dDraw(M, { x: x - pw * 3, y: top - pw, w: pw * 6, h: bottom - top + pw * 2 }, 1.6);
  }
