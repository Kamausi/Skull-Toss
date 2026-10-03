  // ───────────────────────── v60: depth lanes ─────────────────────────
  // Studied from OlliOlli World and Klonoa (a 2.5D stage reads its depth through scale, haze and parallax while the
  // play stays in its plane): on the maps that teach distance, the first half's ring stands in one of three lanes down
  // the throw, near, middle or far (src/maps/*.json: ring.lanes). Which one is the run's own, keyed by the seed and the
  // hit, so a miss throws at the same ring again and a replay sees the same lanes; it's fixed as the skull settles, so
  // it never moves under a throw. The throw's physics doesn't change: the ring is nearer or further along the same lane,
  // so a near ring wants a flatter throw and a far one a higher, longer one. It reads as depth: the further ring is drawn
  // smaller and hazier, its post walks down the lane to it, a pair of stakes marks each lane on the ground with the live
  // one lit, the camera's lean with the aim slides a near ring further than a far one (04c_camera.js), and a whistle
  // climbs or falls as the ring moves back or forward.
  const LANE = { i: -1, z: null, stage: 0, at: -9 };
  function laneDef() { const L = stageDef().map.ring.lanes; return L && Array.isArray(L.z) ? L : null; }
  // which lane the ring wants for the hit it's on (−1: none here, now)
  function laneIndex() {
    const L = laneDef(); if (!L || game.state === "title" || game.phase !== "A" || boss || ring.frozen || attrOn() || portalOpen()) return -1;
    if (ring.mode !== "line" && ring.mode !== "static") return -1;
    const h = game.stageHits || 0; if (h < (L.from || 0)) return -1;
    let x = ((game.seed || 0) ^ Math.imul(game.stage || 1, 0x9E3779B1) ^ Math.imul(h + 1, 0x85EBCA6B)) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x2C1B3C6D) >>> 0; x ^= x >>> 12;
    return (x >>> 0) % L.z.length;
  }
  // the depth the ring stands at now (ringZ0, 07n_environment.js): the lane fixed at the last settle, while lanes are live
  const laneZNow = () => (LANE.z != null && LANE.stage === game.stage && laneIndex() >= 0 ? LANE.z : null);
  function lanesAfterThrow(quiet = false) {   // (settleThrow: the next ring's lane; it glides there and says which way)
    const i = laneIndex(), z = i < 0 ? null : laneDef().z[i], before = ring.z;
    const moved = z != null && (LANE.z == null || LANE.stage !== game.stage || Math.abs(z - LANE.z) > 1e-6);
    LANE.i = i; LANE.z = z; LANE.stage = game.stage;
    if (!moved || quiet) return;
    LANE.at = game.time; ring.glide = { from: { x: ring.x, y: ring.y, z: ring.z }, t: 0, dur: 0.45 };
    if (Math.abs(z - before) > 0.3) {
      Sound.toon(z > before ? "whistleUp" : "whistleDown", panOf(ring.x));
      const p = project(ring.x, ring.y, z); caption(z > before ? t("lane.far") : t("lane.near"), p.x, p.y - ring.rc * p.s - U * 0.06);
    }
  }
  // how far back the live lane is, 0 (near) … 1 (far), for the haze
  function laneDepth() { const L = laneDef(); if (!L || laneZNow() == null) return -1; const a = L.z[0], b = L.z[L.z.length - 1]; return clamp((ring.z - a) / Math.max(0.1, b - a), 0, 1); }
  function drawLaneHaze(p, r, lw) {   // (drawRing, 08c_scene.js: a far ring sits in the air's own haze)
    const k = laneDepth(); if (k <= 0.02) return;
    const L = mapData(game.stage || 1).sheet.lighting;
    ctx.save(); ctx.globalAlpha *= 0.34 * k; ctx.strokeStyle = (L && L.ambient) || "#39405A"; ctx.lineWidth = lw * 1.25;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // the stakes: a pair to each lane at the lane's edges, the live one's lanterns lit (drawn behind the ring)
  function drawLanes() {
    const L = laneDef(); if (!L || laneIndex() < 0 || game.state === "title") return;
    const live = laneZNow(), fresh = clamp((game.time - LANE.at) / 0.45, 0, 1);
    for (const z of L.z) for (const sd of [-1, 1]) {
      const x = sd * 1.95, g = project(x, 0, z), top = project(x, 0.62, z), s = g.s, on = live != null && Math.abs(z - live) < 1e-6;
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 0.07 * s); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.strokeStyle = "#D9CBA3"; ctx.lineWidth = Math.max(1, 0.04 * s); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      const lr = Math.max(2.5, 0.07 * s);
      if (on) { const gl = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, lr * 5); gl.addColorStop(0, `rgba(255,209,89,${0.55 * fresh})`); gl.addColorStop(1, "rgba(255,209,89,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(top.x, top.y, lr * 5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = on ? GOLD : "#4A4438"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, lr * 0.35);
      ctx.beginPath(); ctx.arc(top.x, top.y, lr, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
