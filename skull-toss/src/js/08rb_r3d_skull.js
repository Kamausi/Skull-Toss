  // ───────────────────────── v68 3D: Morty (the skull) ─────────────────────────
  // Morty is a modelled head: a cranium and a jaw-deep face shell, toon-lit and inked. His face is still his: every
  // expression, socket, skin, paint job and set of teeth is the 2D drawing's, painted each frame onto the shell's
  // front (a canvas texture, projected straight on), so all of Morty's acting carries over as it is. The 3D gives
  // him a round, lit head that turns and tumbles; his squash and stretch, his spin and his fade are the 2D rig's.
  const R3D_SK = { tex: 256, span: 1.36 };   // the texture covers ±span skull radii round his centre
  function r3dSkullModel() {
    if (R3D.cache.skull) return R3D.cache.skull;
    const cv = document.createElement("canvas"); cv.width = cv.height = R3D_SK.tex;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const cranium = new THREE.SphereGeometry(1, 36, 28);
    const back = r3dToon("#F7F1DF");
    // the face shell: the front of an ellipsoid reaching down past the jaw, its UVs projected straight from the front
    const shell = new THREE.SphereGeometry(1, 40, 32, 0, Math.PI, 0, Math.PI);
    const pos = shell.attributes.position, uv = shell.attributes.uv, S = R3D_SK.span;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      y = y * 1.12 - 0.12; x *= 0.97; z = z * 0.92 + 0.05;   // (a little longer than the cranium: the jaw hangs below it)
      pos.setXYZ(i, x, y, z);
      uv.setXY(i, 0.5 + x / (2 * S), 0.5 + y / (2 * S));
    }
    shell.computeVertexNormals();
    const faceMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: R3D.ramp, transparent: true, alphaTest: 0.5 });
    const head = new THREE.Group(), tilt = new THREE.Group(), squash = new THREE.Group(), spin = new THREE.Group();
    const craniumG = r3dInked(cranium, back); craniumG.scale.set(0.86, 0.86, 0.84); craniumG.position.y = 0.1;
    const face = new THREE.Mesh(shell, faceMat);
    spin.add(craniumG, face); squash.add(spin); tilt.add(squash); head.add(tilt);
    Object.assign(head.userData, { cv, g: cv.getContext("2d"), tex, back, spin, squash, tilt });
    return (R3D.cache.skull = head);
  }
  // drawn where drawSkull would have drawn him on the stage: x, y his centre and r his radius, in pixels; o the 2D
  // rig's pose (ang, a and dir for the squash, alpha, face, jaw, t, look)
  function r3dSkull(x, y, r, o = {}) {
    const M = r3dSkullModel(), D = M.userData, n = R3D_SK.tex, S = R3D_SK.span, look = o.look || cos;
    const Sk = SKINS[look.skull] || SKINS.bone, pal = (Sk.flick && Sk.flick(o.t || 0)) || Sk;
    // his face, drawn upright and unsquashed (the model does the turning and the squash)
    D.g.setTransform(1, 0, 0, 1, 0, 0); D.g.clearRect(0, 0, n, n);
    drawSkull(D.g, n / 2, n / 2, n / (2 * S), { ...o, look: { ...look, wings: "none" }, ang: 0, a: 1, dir: 0, alpha: 1 });   // (his wings are their own piece, behind him)
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
    r3dPlace(M, x, y, r, SKULL_R);
    M.lookAt(0, 0, 0);   // (he faces the camera wherever he is, as the drawing does; the light still falls from the map's side)
    M.scale.set(SKULL_R * 1.06, SKULL_R, SKULL_R);
    const pad = r * 1.7 + 6;
    return r3dDraw(M, { x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 }, Math.max(1.4, r * 0.07), o.alpha == null ? 1 : o.alpha);
  }
