  // ───────────────────────── v68 3D: Morty (the skull) ─────────────────────────
  // Morty is a modelled head: a cranium and a jaw-deep face shell, toon-lit and inked. His face is still his: every
  // expression, socket, skin, paint job and set of teeth is the 2D drawing's, painted each frame onto the shell's
  // front (a canvas texture, projected straight on), so all of Morty's acting carries over as it is. The 3D gives
  // him a round, lit head that turns and tumbles; his squash and stretch, his spin and his fade are the 2D rig's.
  const R3D_SK = { tex: 512, span: 1.36 };   // (v70: 512 so his face stays crisp at hero size on a sharp phone; it was magnified at 256)   // the texture covers ±span skull radii round his centre
  // bone takes the light brighter than the scenery's paint: his face keeps the 2D drawing's white in the lit and half
  // bands, and only turns to the shadow band where it faces away (the sockets' walls, the far cheek)
  function r3dBoneRamp() {
    if (R3D.boneRamp) return R3D.boneRamp;
    const t = new THREE.DataTexture(new Uint8Array([140, 140, 140, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return (R3D.boneRamp = t);
  }
  function r3dSkullModel() {
    if (R3D.cache.skull) return R3D.cache.skull;
    const cv = document.createElement("canvas"); cv.width = cv.height = R3D_SK.tex;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const cranium = new THREE.SphereGeometry(1, 36, 28);
    const back = r3dToon("#F7F1DF", { gradientMap: r3dBoneRamp() });
    // the face shell: the front of an ellipsoid reaching down past the jaw, its UVs projected straight from the front
    const shell = new THREE.SphereGeometry(1, 96, 72, 0, Math.PI, 0, Math.PI);   // (v72: finer, so the sockets' edges, darkened per vertex, stay clean)
    const pos = shell.attributes.position, uv = shell.attributes.uv, S = R3D_SK.span;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      y = y * 1.12 - 0.12; x *= 0.97; z = z * 0.92 + 0.05;   // (a little longer than the cranium: the jaw hangs below it)
      if (z > 0) z = Math.max(0.02, z + r3dSkullRelief(x, -y) * Math.min(1, z * 2.5));   // (the face sculpted: ASSET-001, docs/PRODUCTION-AUDIT.md)
      pos.setXYZ(i, x, y, z);
      uv.setXY(i, 0.5 + x / (2 * S), 0.5 + y / (2 * S));   // (projected straight on, so the painted face lands on its sculpt)
    }
    shell.computeVertexNormals();
    const smooth = shell.clone(), sp = smooth.attributes.position;   // (the same shell before the sculpt, for the ink line)
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i); if (z > 0.02) sp.setZ(i, z - r3dSkullRelief(x, -y) * Math.min(1, z * 2.5)); }
    smooth.computeVertexNormals();
    const faceMat = new THREE.MeshToonMaterial({ toneMapped: false, map: tex, gradientMap: r3dBoneRamp(), transparent: true, alphaTest: 0.5 }); faceMat.onBeforeCompile = r3dRim;
    const head = new THREE.Group(), tilt = new THREE.Group(), squash = new THREE.Group(), spin = new THREE.Group();
    const craniumG = r3dInked(cranium, back); craniumG.scale.set(0.86, 0.86, 0.84); craniumG.position.set(0, 0.1, -0.26);   // (set back behind the face, so the sculpted hollows (the sockets, the nose) never have the back of his head showing through them)
    const face = new THREE.Group(), ink = new THREE.Mesh(smooth, R3D.cache.ink || (R3D.cache.ink = r3dInk())); ink.renderOrder = -1;
    face.add(ink, new THREE.Mesh(shell, faceMat));   // (v70: the face carries his outline, from the unsculpted shape, so the ink rings his head and never creases into the hollows; the cranium's is set back behind it)
    spin.add(craniumG, face); squash.add(spin); tilt.add(squash); head.add(tilt);
    Object.assign(head.userData, { cv, g: cv.getContext("2d"), tex, back, spin, squash, tilt, oldFace: face, cranium: craniumG });
    spin.add(r3dFaceBuild(head, shell, smooth, tex));   // (v72: the face as geometry, 08rm_r3d_mortyface.js; the v70 projected face above is the fallback for looks not yet built)
    return (R3D.cache.skull = head);
  }
  // (Phase 3, ASSET-001) the face sculpted, in skull radii with y down, where the 2D rig draws it (SOCK and the nose
  // come from the skull's own artwork, 08a_skull.js): the eye sockets and the nose are real hollows, the brow ridge
  // over the sockets and the cheekbones under them stand out. The painted face is projected straight on, so its ink
  // lies in the hollows and the toon light shades them; how far the surface moves, in skull radii, toward the camera
  const R3D_NOSE = (() => { const b = artBox(shapeOf("nose", false)); return { x: ((b.x0 + b.x1) / 2 - ART_CX) * ART_K, y: ((b.y0 + b.y1) / 2 - ART_CY) * ART_K, rx: (b.x1 - b.x0) / 2 * ART_K, ry: (b.y1 - b.y0) / 2 * ART_K }; })();
  const r3dBump = (x, y, cx, cy, rx, ry) => { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; return d < 1 ? (1 - d) * (1 - d) : 0; };
  function r3dSkullRelief(x, y) {
    let dz = 0;
    for (const s of SOCK) {
      dz -= 0.2 * r3dBump(x, y, s.x, s.y, s.rx * 1.08, s.ry * 1.08);                            // the socket
      dz += 0.05 * r3dBump(x, y, s.x, s.y - s.ry * 1.05, s.rx * 1.3, s.ry * 0.55);             // the brow ridge over it
      dz += 0.06 * r3dBump(x, y, s.x * 1.28, s.y + s.ry * 1.25, s.rx * 0.75, s.ry * 0.6);      // the cheekbone under it, outboard
    }
    dz -= 0.1 * r3dBump(x, y, R3D_NOSE.x, R3D_NOSE.y, R3D_NOSE.rx * 1.15, R3D_NOSE.ry * 1.1);   // the nose
    return dz;
  }
  // drawn where drawSkull would have drawn him on the stage: x, y his centre and r his radius, in pixels; o the 2D
  // rig's pose (ang, a and dir for the squash, alpha, face, jaw, t, look)
  function r3dSkull(x, y, r, o = {}) {
    const M = r3dSkullModel(), D = M.userData, n = R3D_SK.tex, S = R3D_SK.span, look = o.look || cos;
    const Sk = SKINS[look.skull] || SKINS.bone, pal = (Sk.flick && Sk.flick(o.t || 0)) || Sk;
    // his face: as geometry (v72), or for a look not yet built, his drawing upright and unsquashed on the shell (the model does the turning and the squash)
    if (r3dHeadFrame(M, o, look, r)) { /* v73: the owner's skull and eyes (08rp_r3d_mortyhead.js) */ } else if (!r3dFaceFrame(M, o, look)) { D.g.setTransform(1, 0, 0, 1, 0, 0); D.g.clearRect(0, 0, n, n); drawSkull(D.g, n / 2, n / 2, n / (2 * S), { ...o, look: { ...look, wings: "none" }, ang: 0, a: 1, dir: 0, alpha: 1 }); }   // (his wings are their own piece, behind him)
    if (WINGS[look.wings]) {   // the wings: a live piece behind the head, posed as the 2D rig poses them
      const along0 = clamp(o.a == null ? 1 : o.a, 0.35, 1.9), perp0 = 1 / Math.pow(along0, 0.62), d0 = o.dir || 0;
      r3dCapture("wings", { x: x - r * 3.4, y: y - r * 3.4, w: r * 6.8, h: r * 6.8, auto: true }, F * SKULL_R / Math.max(0.5, r) + SKULL_R * 0.6, 0.02, () => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(d0); ctx.scale(along0, perp0); ctx.rotate(-d0); ctx.rotate(o.ang || 0); ctx.scale(r, r); ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha; drawBodyBehind(ctx, look, o.t || 0); ctx.restore();
      }, 1, 360);
    }
    D.tex.needsUpdate = true;
    D.back.color.set(pal.base || "#F7F1DF");
    // the pose: the 2D squash along its direction, the spin, and a turn of the head so it reads round
    const along = clamp(o.a == null ? 1 : o.a, 0.35, 1.9), perp = 1 / Math.pow(along, 0.62), dir = o.dir || 0, ang = o.ang || 0;
    D.tilt.rotation.set(0, 0, -dir); D.squash.rotation.set(0, 0, 0); D.squash.scale.set(along, perp, Math.sqrt(along * perp));
    D.spin.rotation.set(0.12 * Math.sin(ang * 0.5), 0.28 * Math.sin(ang), -ang + dir);
    r3dSkullTwist(D.spin, along);   // (v68: a contact's squash wrings him: 08re_r3d_math.js)
    r3dPlace(M, x, y, r, SKULL_R);
    M.lookAt(0, 0, 0);   // (he faces the camera wherever he is, as the drawing does; the light still falls from the map's side)
    M.scale.set(SKULL_R * 1.06, SKULL_R, SKULL_R);
    const pad = r * 1.7 + 6;
    return r3dDraw(M, { x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 }, Math.max(1.4, r * (D.head && D.head.root.visible ? 0.04 : 0.07)), o.alpha == null ? 1 : o.alpha);   // (v73: the skull's outline thinner: it has a real silhouette, jaw and cheekbones)
  }
