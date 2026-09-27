  // ───────────────────────── v60: under the sea, the throw moves through water ─────────────────────────
  // The Drowned Theater teaches Water, so on a map with a water medium (src/maps/*.json: medium) the whole throw is
  // under water, not only a miss that falls in (08l_water.js). Studied from Song of the Deep (things drift and float)
  // and Angry Birds Space (the aim guide shows the field's curve rather than a straight line):
  //   drag       the water eats the throw's speed across and up/down, exp(−k·dt) a step (time-scaled, so a step at
  //              240 Hz or a replay gives the same flight); along the lane it keeps its pace, so every throw still
  //              reaches the ring plane when it always did
  //   buoyancy   the skull weighs about half as much (the medium's g), so a throw floats higher and falls slower
  //   currents   an undertow running across the stalls: a steady push while the skull is in it, swelling and easing
  //              on a slow tide the player can learn (never random)
  //   jets       a vent in the sea bed that bursts a column of water upward on a beat; it fizzes first
  //   air pockets trapped air under the balconies: inside one the throw flies as it does on dry land (full weight,
  //              no drag)
  // The flight, the aim guide, Skull Sense and the spec's aim all step the same model (forcedPath, 07m_obstacles.js).
  // Only the throw's physics changes: the ring still judges every throw, and nothing here steers toward it.
  const SEA = { g: 0.5, drag: [0.6, 0.8] };
  const mediumDef = () => {
    if (game.state === "title" || attrOn()) return null;
    const M = mapData(game.stage || 1).medium; return M && M.kind === "water" ? M : null;
  };
  const waterFlight = () => !!mediumDef();
  function pocketAt(I, T = OB.t) { let [x, y, z] = I.at; if (I.drift) x += I.drift[0] * Math.sin((TAU * T) / I.drift[1]); return { x, y, z }; }
  function inPocket(P, T = OB.t) {
    for (const I of OB.list) if (I.kind === "pocket" && !obStandsAside(I)) { const c = pocketAt(I, T); if (Math.hypot(P.x - c.x, P.y - c.y, P.z - c.z) < I.r) return true; }
    return false;
  }
  // one step of the water on velocity u at point P: damps u in place and returns this step's gravity (g0: the throw's own)
  function mediumStep(u, P, g0, dt, T = OB.t, pockets = true) {
    const M = mediumDef(); if (!M || (pockets && inPocket(P, T))) return g0;
    const d = M.drag || SEA.drag; u.x *= Math.exp(-d[0] * dt); u.y *= Math.exp(-d[1] * dt);
    return g0 * (M.g != null ? M.g : SEA.g);
  }
  // the aim still means where the throw crosses the ring plane, as it does under a Gravity Flip (aimVelocity, 04_state.js):
  // in still water the launch is solved through the drag and the buoyancy, stepped exactly as the flight is. The
  // crossing is linear in the launch, so two runs give it; the undertow, the vents and the pockets are the player's to read.
  const WAIM = { key: "", k: null };
  function waterAim(AX, AY) {
    const M = mediumDef(); if (!M) return null;
    const T = flightT(), g0 = gNow(), wx = windNow(), vz = RING_Z / T, dt = SIM_STEP, key = `${T}|${g0}|${wx}|${M.g}|${M.drag}`;
    if (WAIM.key !== key) {
      const run = (vx, vy) => {
        let p = { x: 0, y: START_Y, z: 0 }, u = { x: vx, y: vy, z: vz };
        for (let i = 0; i < 4000; i++) {
          const G = mediumStep(u, p, g0, dt, 0, false), q = { x: p.x + u.x * dt + 0.5 * wx * dt * dt, y: p.y + u.y * dt - 0.5 * G * dt * dt, z: p.z + u.z * dt };
          u = { x: u.x + wx * dt, y: u.y - G * dt, z: u.z };
          if (q.z >= RING_Z) { const f = (RING_Z - p.z) / (q.z - p.z); return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f }; }
          p = q;
        }
        return p;
      };
      const c0 = run(0, 0), c1 = run(1, 1); WAIM.key = key; WAIM.k = { ax: c0.x, bx: c1.x - c0.x, ay: c0.y, by: c1.y - c0.y };
    }
    const K = WAIM.k; return { x: (AX - K.ax) / K.bx, y: (AY - K.ay) / K.by, z: vz };
  }
  // (called at the top of each flight step, after the obstacles' push: exactly and replayably, like obstaclePush)
  function waterPush(s, dt) {
    if (!waterFlight() || s.resting || s.hang > 0 || s.sub || s.vine || s.rew) return;
    rebase(s, s.t); const u = { ...s.v0 }, was = s.g;
    s.g = mediumStep(u, s.pos, s.g0 != null ? s.g0 : G, dt); s.v0 = u;
    const air = s.g === (s.g0 != null ? s.g0 : G);
    if (air && was !== s.g && s.flightTime > 0.02) { const p = project(s.pos.x, s.pos.y, s.pos.z); spawnBit("bubble", p.x, p.y, SKULL_R * p.s); Sound.toon("pop", panOf(s.pos.x)); }   // (in or out of a pocket: a pop of air)
    s.wet = !air;
  }
  // a current's strength now (its slow tide: min … 1) and a jet's (0 … 1, with its fizz before it fires)
  const currentK = (I, T = OB.t) => { if (!I.swell) return 1; const [per, lo] = I.swell; return lo + (1 - lo) * (0.5 + 0.5 * Math.sin((TAU * (T + (I.phase || 0))) / per)); };
  function jetOn(I, T = OB.t) { const [on, off] = I.pulse, per = on + off, u = (((T + (I.phase || 0)) % per) + per) % per; return u < on ? Math.min(1, u / 0.12, (on - u) / 0.2) : 0; }
  function jetTell(I, T = OB.t) { const [on, off] = I.pulse, per = on + off, u = (((T + (I.phase || 0)) % per) + per) % per; return u >= per - 0.5 ? (u - (per - 0.5)) / 0.5 : 0; }
  function waterForce(I, P, T) {   // (obstacleForce's share for the water's own things)
    if (I.kind === "current") { const [x0, x1, y0, y1, z0, z1] = I.box; if (P.x > x0 && P.x < x1 && P.y > y0 && P.y < y1 && P.z > z0 && P.z < z1) { const k = currentK(I, T); return [I.push[0] * k, I.push[1] * k]; } }
    else if (I.kind === "jet") { const on = jetOn(I, T); if (on > 0 && Math.abs(P.x - I.at[0]) < I.w && Math.abs(P.z - I.at[1]) < I.w && P.y < I.h) return [I.push[0] * on, I.push[1] * on]; }
    return null;
  }
  function jetsUpdate(I) {   // a burst: a gush of sound when it starts
    const [on, off] = I.pulse, k = Math.floor((OB.t + (I.phase || 0)) / (on + off));
    if (I.fired == null || I.fired < 0) I.fired = k;
    if (k > I.fired && jetOn(I) > 0) { I.fired = k; if (game.state !== "title") Sound.toon("splash", panOf(I.at[0])); }
  }
  Object.assign(OB_DRAW, {
    current(I) {   // streams of motes and trailing weed running across the stalls, thicker as the tide swells
      const [x0, x1, y0, y1, z0, z1] = I.box, k = currentK(I), dir = Math.sign(I.push[0]) || 1, n = 14;
      ctx.lineWidth = 2; ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const u = ((OB.t * (0.18 + 0.2 * k) + i * 0.29) % 1), y = y0 + (y1 - y0) * ((i * 0.618) % 1), z = z0 + (z1 - z0) * ((i * 0.37) % 1);
        const xa = dir > 0 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u, len = 0.3 + 0.35 * k, wig = Math.sin(OB.t * 3 + i) * 0.04;
        const a = project(xa, y + wig, z), b = project(xa + dir * len, y + wig * 0.5 + I.push[1] * 0.03, z), fade = Math.sin(u * Math.PI);
        ctx.strokeStyle = `rgba(170,235,225,${(0.3 + 0.45 * k) * fade})`; ctx.lineWidth = Math.max(2, 0.03 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (i % 3 === 0) { ctx.fillStyle = `rgba(230,255,245,${0.5 * fade})`; ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1, 0.025 * b.s), 0, TAU); ctx.fill(); }
      }
      for (let i = 0; i < 3; i++) {   // weed on the sea bed at the stream's edge, bending with it
        const x = x0 + (x1 - x0) * (0.2 + i * 0.3), z = z1, g = project(x, 0, z), top = project(x + dir * (0.2 + 0.25 * k), 0.7, z);
        ctx.strokeStyle = "#2E5A40"; ctx.lineWidth = Math.max(2, 0.05 * g.s); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.quadraticCurveTo(g.x, (g.y + top.y) / 2, top.x, top.y); ctx.stroke();
      }
    },
    jet(I) {   // a brass vent in the sand; it fizzes, then a column of water gushes up
      const [x, z] = I.at, g = project(x, 0, z), s = g.s, on = jetOn(I), tl = jetTell(I), sh = tl > 0 ? Math.sin(OB.t * 60) * 0.01 * s : 0;
      ctx.fillStyle = "#6A5230"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g.x + sh, g.y, I.w * s, I.w * 0.35 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(20,12,6,.7)"; ctx.lineWidth = 1.5; for (const u of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(g.x + sh + u * I.w * s, g.y - I.w * 0.28 * s); ctx.lineTo(g.x + sh + u * I.w * s, g.y + I.w * 0.28 * s); ctx.stroke(); }
      const bub = (y, a, r) => { const p = project(x + Math.sin(y * 9 + OB.t * 4) * I.w * 0.5, y, z); ctx.globalAlpha = a; ctx.strokeStyle = "rgba(230,255,250,.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, r * p.s), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; };
      if (tl > 0) for (let i = 0; i < 5; i++) bub(((OB.t * 1.5 + i * 0.2) % 1) * 0.7, 0.8 * tl, 0.03);   // the fizz: the tell
      if (on > 0.02) {
        const top = project(x, I.h * on, z), grd = ctx.createLinearGradient(0, g.y, 0, top.y); grd.addColorStop(0, `rgba(200,245,240,${0.45 * on})`); grd.addColorStop(1, "rgba(200,245,240,0)");
        ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(g.x - I.w * s, g.y); ctx.lineTo(top.x - I.w * 0.5 * top.s, top.y); ctx.lineTo(top.x + I.w * 0.5 * top.s, top.y); ctx.lineTo(g.x + I.w * s, g.y); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 9; i++) bub(((OB.t * 2.4 + i * 0.113) % 1) * I.h * on, on, 0.04 + (i % 3) * 0.015);
      }
    },
    pocket(I) {   // a silvery dome of trapped air, wobbling, with the light caught in it
      const c = pocketAt(I), p = project(c.x, c.y, c.z), r = I.r * p.s, wob = Math.sin(OB.t * 2.2) * 0.04;
      const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r); g.addColorStop(0, "rgba(255,255,255,.28)"); g.addColorStop(0.7, "rgba(210,240,255,.1)"); g.addColorStop(1, "rgba(210,240,255,.3)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (1 + wob), r * (1 - wob), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(235,250,255,.75)"; ctx.lineWidth = Math.max(1.5, r * 0.03); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.ellipse(p.x - r * 0.42, p.y - r * 0.42, r * 0.12, r * 0.22, -0.7, 0, TAU); ctx.fill();
    }
  });
  Object.assign(OB_CAT, { current: "Deflector", jet: "Deflector", pocket: "Trigger" });
