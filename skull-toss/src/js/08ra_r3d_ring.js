  // ───────────────────────── v68 3D: the ring ─────────────────────────
  // The ring as a real torus in its cosmetic's colour, toon-lit and inked. The styles keep their character: a hoop
  // is banded, a chain is links, bones are knuckled, thorns have spikes, fire and the portals glow from inside.
  // Everything round it (its light, its fire, its seal, its hanger, its wings) is still the 2D drawing's.
  function r3dRingModel(id, tubeK) {
    const key = `ring:${id}:${tubeK.toFixed(3)}`;
    if (R3D.cache[key]) return R3D.cache[key];
    const R = RINGS[id] || RINGS.hoop, g = new THREE.Group(), style = R.style;
    const body = r3dToon(RING_ART[id] && style === "hoop" ? "#D93A2B" : R.color, style === "fire" || style === "portal" ? { emissive: new THREE.Color(R.color), emissiveIntensity: 0.35 } : {});
    const torus = new THREE.TorusGeometry(1, tubeK, 14, 72);
    if (style === "chain") {   // links round the circle, alternating flat and edge-on
      const n = 18, link = new THREE.TorusGeometry(tubeK * 1.8, tubeK * 0.45, 8, 16);
      for (let i = 0; i < n; i++) { const a = i / n * TAU, L = r3dInked(link, body); L.position.set(Math.cos(a), Math.sin(a), 0); L.rotation.z = a + Math.PI / 2; L.scale.set(1.35, 1, 1); if (i % 2) L.rotation.x = Math.PI / 2; g.add(L); }
    } else {
      g.add(r3dInked(torus, body));
      if (style === "hoop") {   // the lifebuoy: four white quarters and a rope round the outside, like the painted one
        const white = r3dToon("#F4EEE2"), rope = r3dToon("#D8C39A");
        for (let i = 0; i < 4; i++) { const Q = r3dInked(new THREE.TorusGeometry(1, tubeK * 1.015, 14, 10, 0.52), white); Q.rotation.z = i * Math.PI / 2 - 0.26; g.add(Q); }
        const R1 = r3dInked(new THREE.TorusGeometry(1 + tubeK * 0.98, tubeK * 0.11, 6, 120), rope); g.add(R1);
      } else if (style === "bones") {   // knuckles
        const kn = new THREE.SphereGeometry(tubeK * 1.35, 10, 8);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, K = r3dInked(kn, body); K.position.set(Math.cos(a), Math.sin(a), 0); g.add(K); }
      } else if (style === "thorn") {   // spikes outward and forward
        const sp = new THREE.ConeGeometry(tubeK * 0.7, tubeK * 3, 6);
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + 0.2, S = r3dInked(sp, body), out = i % 2 ? 1 : 0; S.position.set(Math.cos(a) * (1 + tubeK * (out ? 1.6 : 0)), Math.sin(a) * (1 + tubeK * (out ? 1.6 : 0)), out ? 0 : tubeK * 1.6); S.rotation.z = a - Math.PI / 2; if (!out) S.rotation.x = Math.PI / 2; g.add(S); }
      } else if (style === "portal") {   // a swirl of light inside the hole
        const disc = new THREE.Mesh(new THREE.RingGeometry(0.55, 1 - tubeK, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(R.color), transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
        g.add(disc);
      }
    }
    g.userData.body = body; g.userData.base = body.color.clone();
    return (R3D.cache[key] = g);
  }
  // drawn where drawRingShape would have been: p.x, p.y the centre, r the radius and lw the tube's width, in pixels
  function r3dRing(x, y, r, lw, id, t, flash = 0) {
    // the tube as the 2D ring draws it: a painted ring (the lifebuoy) is far fatter than its catching tube, from the
    // hole's edge (r − lw/2, where the skull is caught) out to its painted rim
    const art = RING_ART[id], inner = Math.max(1, r - lw / 2), outer = art ? inner + (ringOuter(r, lw, id) - inner) * 0.8 : r + lw / 2;   // (the painted rim counts its rope; the tube stops inside it)
    const major = (inner + outer) / 2, tubeK = clamp(Math.round(((outer - inner) / 2 / major) * 200) / 200, 0.02, 0.4), M = r3dRingModel(id, tubeK), R = RINGS[id] || RINGS.hoop;
    r = major;
    const body = M.userData.body, flick = R.flicker ? 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3) : 1;
    body.color.copy(M.userData.base).multiplyScalar(flick).lerp(new THREE.Color(0xfff8ec), clamp(flash, 0, 1) * 0.8);
    const Z = r3dPlace(M, x, y, r, 1); M.scale.setScalar(1);
    M.rotation.set(0, 0, R.style === "chain" || R.style === "bones" || R.style === "thorn" ? t * 0.15 : 0);   // (a studded ring turns slowly, so it reads as solid)
    void Z;
    const pad = r * (1 + tubeK * 2.2) + 8;
    return r3dDraw(M, { x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 }, Math.max(1.5, r * 0.018));
  }
