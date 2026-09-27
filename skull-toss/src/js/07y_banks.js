  // ───────────────────────── v60: what things are made of, and the rings a throw has to bank into ─────────────────────────
  // Studied from Peggle and Holedown (a bank is a shot you plan, and the aim line shows the bounce), Super Stickman Golf 3
  // (every surface has a feel: sticky, springy, dead) and Worms (a material you can read by looking at it):
  //   surfaces     everything a skull bounces off is made of something, and the material decides the bounce: how much of
  //                the speed into it comes back (e, restitution) and how much along it is lost (f, friction), and how it
  //                sounds and what it sheds. Metal gives back nearly all of it, bone most, stone less, mud almost none;
  //                ghost-glass gives back more than it got. The urns, the bank boards and a map's ground are each one.
  //   bank boards  a slab standing lengthwise beside the lane (a headstone, a gilded plaque): a skull that meets its face
  //                bounces off it exactly (the flight finds the moment it touches, as it does the ring and the ground,
  //                and the aim guide shows the bounce)
  //   Bank Rings   a board can seal the ring: every few rings its window fills with a gilt film and a pip for each bank
  //                it wants; a throw that has banked that often (off a board or an urn) goes through, any other bounces
  //                off the film. The lane's aim reaches at most 0.47 m across per metre of depth, too little for a
  //                board-to-board double bank before the ring, so where a ring wants two, the second is an urn.
  const SURFACES = {
    bone:  { e: 0.85, f: 0.10, bits: "#EDE3C8", fx: "dot" },
    stone: { e: 0.65, f: 0.20, bits: "#9A9488", fx: "dot" },
    metal: { e: 0.95, f: 0.05, bits: "#FFE39A", fx: "spark" },
    ghost: { e: 1.10, f: 0.00, bits: "#BFF5E8", fx: "puff" },
    mud:   { e: 0.20, f: 0.60, bits: "#4A3A22", fx: "dot" }
  };
  const surf = m => SURFACES[m] || SURFACES.stone;
  // off a surface with unit normal n (facing the skull): the speed into it comes back × e, the speed along it × (1 − f)
  function surfaceBounce(v, n, mat) {
    const S = surf(mat), vn = v.x * n.x + v.y * n.y + v.z * n.z; if (vn >= 0) return { ...v };
    const k = 1 - S.f;
    return { x: (v.x - vn * n.x) * k - S.e * vn * n.x, y: (v.y - vn * n.y) * k - S.e * vn * n.y, z: (v.z - vn * n.z) * k - S.e * vn * n.z };
  }
  // a chain of banks climbs: two semitones a bounce, so the third in a row is audibly higher than the first
  const chainPitch = n => Math.pow(2, (2 * Math.min(8, Math.max(0, n - 1))) / 12);
  function surfaceBits(mat, x, y, r, n = 6) {
    const S = surf(mat);
    for (let i = 0; i < n; i++) {
      if (S.fx === "spark" || S.fx === "puff") { spawnBit(S.fx, x, y, r); const q = particles[particles.length - 1]; if (q) q.color = S.bits; continue; }
      particles.push({ kind: "dot", x, y, rot: rand(0, TAU), vr: rand(-6, 6), vx: rand(-0.12, 0.12) * U, vy: -U * rand(0.04, 0.16), life: rand(0.35, 0.6), max: 0.6, size: rand(1.5, 3.2), color: S.bits, g: mat === "mud" ? 1.4 : 1, a: 1 });
    }
  }
  // a surface answers: its sound (higher up a chain), its bits, and the bounce's little shake
  function surfaceHit(mat, P, strength = 1, chain = 1) {
    const p = project(P.x, P.y, P.z), pan = panOf(P.x);
    Sound.surface(mat, strength, pan, chainPitch(chain));
    surfaceBits(mat, p.x, p.y, SKULL_R * p.s, mat === "mud" ? 8 : 6);
    VisualSystem.triggerImpact("bounce", { at: p, strength: clamp(0.4 + 0.4 * surf(mat).e, 0.4, 0.9), pan });
  }
  // the map's ground: what the skull lands on once the throw is decided (none named: packed earth, which bounces like stone)
  const groundMat = () => (game.state === "title" ? null : mapData(game.stage || 1).ground || null);

  // ── the boards: at [x, z] the middle of its face, len along the lane, y [low, high], yaw (degrees: its far end swung in
  // toward the lane), slide [amp, period] (in and out, a moving bank), mat, seal { need, every }
  const BANK = { next: null, was: 0, openAt: -9, sealAt: -9 };
  function boardAt(I, T = OB.t) {
    const side = I.at[0] < 0 ? -1 : 1, yaw = ((I.yaw || 0) * Math.PI) / 180;
    let x = I.at[0]; if (I.slide) x += side * I.slide[0] * Math.sin((TAU * T) / I.slide[1]);
    const n = { x: -side * Math.cos(yaw), y: 0, z: -Math.sin(yaw) };   // (the face looks in toward the lane)
    return { x, z: I.at[1], n, tx: -n.z, tz: n.x, side };
  }
  const banksLive = () => OB.list.some(I => I.kind === "bank" && !obStandsAside(I));
  // when does an arc (p, v, across-accel ax, gravity g) first touch this board's face between t0 and t1? The face's
  // plane, pushed out by the skull's radius; a touch outside the slab's edges passes it by.
  function boardTouch(I, B, p, v, ax, g, t0, t1) {
    const A = 0.5 * ax * B.n.x, Bq = v.x * B.n.x + v.z * B.n.z, C = (p.x - B.x) * B.n.x + (p.z - B.z) * B.n.z - SKULL_R;
    if ((A * t0 + Bq) * t0 + C <= 0) return Infinity;   // (at it already, or behind it)
    let t = Infinity;
    if (Math.abs(A) < 1e-12) { if (Bq < 0) t = -C / Bq; }
    else { const disc = Bq * Bq - 4 * A * C; if (disc >= 0) { const r = Math.sqrt(disc); for (const x of [(-Bq - r) / (2 * A), (-Bq + r) / (2 * A)].sort((a, b) => a - b)) if (x > t0 + 1e-12) { t = x; break; } } }
    if (!(t <= t1)) return Infinity;
    const qx = p.x + v.x * t + 0.5 * ax * t * t, qy = p.y + v.y * t - 0.5 * g * t * t, qz = p.z + v.z * t;
    const along = (qx - B.x) * B.tx + (qz - B.z) * B.tz;
    return Math.abs(along) <= I.len / 2 && qy >= I.y[0] && qy <= I.y[1] ? t : Infinity;
  }
  // the flight's event (07_game.js, updateFlight): the earliest touch of any board in this step, in the arc's own time
  function bankTime(s, span) {
    BANK.next = null; if (s.crossed || s.resting || !OB.list.length) return Infinity;
    let best = Infinity;
    for (const I of OB.list) if (I.kind === "bank" && !obStandsAside(I)) { const t = boardTouch(I, boardAt(I), s.p0, s.v0, s.ax || 0, skullG(s), s.t, s.t + span); if (t < best) { best = t; BANK.next = I; } }
    return best;
  }
  const bankOff = (B, u, mat) => { const w = surfaceBounce(u, B.n, mat); return { x: w.x, y: w.y, z: Math.max(0.5, w.z) }; };
  function bankBounce(s, I) {   // (the flight has been rebased to the touch)
    const B = boardAt(I);
    s.v0 = bankOff(B, s.v0, I.mat); s.p0 = { x: s.p0.x + B.n.x * 1e-6, y: s.p0.y, z: s.p0.z + B.n.z * 1e-6 };
    s.banked = (s.banked || 0) + 1; s.spin = -s.spin * 1.2 - 1.5; I.hitAt = OB.t;
    surfaceHit(I.mat, s.p0, Math.hypot(s.v0.x, s.v0.y, s.v0.z) / IMPACT_REF, s.banked);
    const p = project(s.p0.x, s.p0.y, s.p0.z);
    impact(s.banked > 1 ? `${t("bank.word")} ×${s.banked}` : t("bank.word"), p.x, p.y - U * 0.07, { fill: GOLD, text: INK, scale: 0.5, bits: false });
    bankProgress(s);
  }
  // the aim guide's step (forcedPath, 07m_obstacles.js): the same touch within one step from p with velocity u
  function bankStep(p, u, wx, G, h, T) {
    let best = Infinity, hit = null;
    for (const I of OB.list) if (I.kind === "bank" && !obStandsAside(I)) { const B = boardAt(I, T), t = boardTouch(I, B, p, u, wx, G, 0, h); if (t < best) { best = t; hit = [I, B]; } }
    if (!hit) return null;
    const t = best, [I, B] = hit, q = { x: p.x + u.x * t + 0.5 * wx * t * t, y: p.y + u.y * t - 0.5 * G * t * t, z: p.z + u.z * t };
    return { t, p: { x: q.x + B.n.x * 1e-6, y: q.y, z: q.z + B.n.z * 1e-6 }, u: bankOff(B, { x: u.x + wx * t, y: u.y - G * t, z: u.z }, I.mat) };
  }

  // ── Bank Rings: which ring is sealed. A board's seal counts from its arrival, so the first rings with a board up are
  // free (a look at it first), then every `every`th wants `need` banks. A miss leaves the count where it was: that
  // ring stays sealed until it's banked in.
  const obHits = () => { const h = game.stageHits || 0; return game.phase === "B" ? h - (arcadeLike() ? STAGE_MINI : STAGE_LOOSE) : h; };
  function bankSeal() {
    if (!OB.list.length || game.state === "title" || boss) return 0;
    let need = 0; const h = obHits();
    for (const I of OB.list) if (I.kind === "bank" && I.seal && !obStandsAside(I)) { const k = h - (I.from || 0), e = I.seal.every || 1; if (k >= 0 && k % e === e - 1) need = Math.max(need, I.seal.need || 1); }
    return need;
  }
  const sealHolds = s => (s.seal || 0) > (s.banked || 0);
  function bankProgress(s) {   // a bank that makes the count: the film opens with a ding
    if (s.seal && s.banked === s.seal) { BANK.openAt = game.time; Sound.toon("ding", panOf(ring.x)); const p = project(ring.x, ring.y, ring.z); caption(t("bank.open"), p.x, p.y - ring.rc * p.s - U * 0.05); }
  }
  // (hitRing, 07_game.js: through a sealed window without the banks, the film throws it back)
  function sealBounce(s, rp, at) {
    s.v0 = { x: s.v0.x * 0.3 + (s.p0.x - rp.x) * 2, y: 1.4, z: -Math.abs(s.v0.z) * 0.3 }; BANK.sealAt = game.time;
    Sound.surface("metal", 0.8, panOf(rp.x), 0.75); VisualSystem.triggerImpact("rim", { at, hit: project(s.p0.x, s.p0.y, rp.z), strength: 0.8, pan: panOf(rp.x) });
    resolve("sealed", at);
  }
  // v62 (the owner: the Adventure must be finishable): a sealed ring waits for its bank. It glides to where a bank off
  // the live board can reach it (a metre out on the board's side, at the ring's own height and depth) and holds there
  // till the film opens, so the puzzle is finding the bank on the guide, not catching a narrow moment of the swing; and
  // a throw straight into it bounces off the film without costing a skull (RESULT.sealed.safe, 07_game.js)
  const PARK = { at: null };
  function sealPark() {
    const I = OB.list.find(o => o.kind === "bank" && o.seal && !obStandsAside(o)); if (!I) return null;
    return { x: (I.at[0] < 0 ? -1 : 1) * 1.0, y: RING_Y, z: RING_Z };
  }
  function parkRing(on) {
    const to = on ? sealPark() : null;
    if (!!to === !!PARK.at) return;
    ring.glide = { from: { x: ring.x, y: ring.y, z: ring.z }, t: 0, dur: 0.6 }; PARK.at = to;
  }
  function banksAfterThrow() {   // (settleThrow: a sealed ring coming up says so)
    const need = bankSeal(); parkRing(need > 0);
    if (need && !BANK.was) { const p = project(ring.x, ring.y, ring.z); caption(need > 1 ? `${t("bank.seal")} ×${need}` : t("bank.seal"), p.x, p.y - ring.rc * p.s - U * 0.06); Sound.toon("ding", panOf(ring.x)); }
    BANK.was = need;
  }
  // the film: a gilt skin across the window, a pip for each bank it wants (lit as they land), gone the moment it opens
  function drawSeal(p, r, lw) {
    const flying = game.state === "flying", need = flying ? skull.seal || 0 : game.state === "ready" || game.state === "aiming" ? bankSeal() : 0;
    if (!need) return;
    const got = flying ? Math.min(need, skull.banked || 0) : 0, open = got >= need ? clamp((game.time - BANK.openAt) / 0.3, 0, 1) : 0;
    if (open >= 1) return;
    const ri = Math.max(4, r - lw * 0.45), shake = game.time - BANK.sealAt < 0.35 ? Math.sin(game.time * 70) * ri * 0.04 : 0, a = 1 - open;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x + shake, p.y);
    const g = ctx.createRadialGradient(-ri * 0.3, -ri * 0.35, ri * 0.1, 0, 0, ri); g.addColorStop(0, "rgba(255,236,170,.42)"); g.addColorStop(0.75, "rgba(227,182,75,.26)"); g.addColorStop(1, "rgba(227,182,75,.5)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ri * (1 + open * 0.3), 0, TAU); ctx.fill();
    const sw = ((game.time * 0.6) % 1) * TAU; ctx.strokeStyle = "rgba(255,248,220,.55)"; ctx.lineWidth = Math.max(1.5, ri * 0.05); ctx.beginPath(); ctx.arc(0, 0, ri * 0.82, sw, sw + 0.9); ctx.stroke();
    // the glyph: a skull's path off a board and in, in ink
    ctx.strokeStyle = "rgba(26,20,16,.7)"; ctx.lineWidth = Math.max(2, ri * 0.08); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-ri * 0.5, ri * 0.25); ctx.lineTo(ri * 0.35, -ri * 0.3); ctx.lineTo(-ri * 0.05, -ri * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ri * 0.45, -ri * 0.5); ctx.lineTo(ri * 0.45, -ri * 0.05); ctx.stroke();
    for (let i = 0; i < need; i++) {   // the pips
      const x = (i - (need - 1) / 2) * ri * 0.34, y = ri * 0.52, lit = i < got;
      ctx.fillStyle = lit ? GOLD : "rgba(26,20,16,.35)"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, ri * 0.03);
      ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, ri * 0.1), 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  const BOARD_LOOK = {
    stone: { face: "#827D72", edge: "#5E5A52", top: "#A09A8C" },
    metal: { face: "#C49A42", edge: "#8A6A26", top: "#FFE39A" },
    bone:  { face: "#E6DBC0", edge: "#B8AA88", top: "#F7EFDC" },
    ghost: { face: "rgba(160,240,225,.28)", edge: "rgba(200,255,245,.8)", top: "rgba(220,255,250,.5)" },
    mud:   { face: "#5A4428", edge: "#3A2A16", top: "#6E5634" }
  };
  Object.assign(OB_DRAW, {
    bank(I) {   // the slab: its face toward the lane, its top edge, and what it's made of; it flashes when a skull meets it
      const B = boardAt(I), L = BOARD_LOOK[I.mat] || BOARD_LOOK.stone, hl = I.len / 2, th = 0.12;
      const at = (u, v, back = 0) => project(B.x + B.tx * (u - 0.5) * I.len - B.n.x * back * th, I.y[0] + (I.y[1] - I.y[0]) * v, B.z + B.tz * (u - 0.5) * I.len - B.n.z * back * th);
      const quad = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); };
      obShadow(B.x, B.z, 0.25 + hl * 0.2);
      const p00 = at(0, 0), p10 = at(1, 0), p11 = at(1, 1), p01 = at(0, 1), s = (p00.s + p10.s) / 2;
      ctx.lineWidth = Math.max(1.5, 0.025 * s);
      ctx.fillStyle = L.top; quad(p01, p11, at(1, 1, 1), at(0, 1, 1)); ctx.fill(); ctx.stroke();   // (the top edge)
      ctx.fillStyle = L.face; quad(p00, p10, p11, p01); ctx.fill();
      if (I.mat === "metal") { const g = ctx.createLinearGradient(p01.x, p01.y, p10.x, p10.y); g.addColorStop(0, "rgba(255,240,190,.45)"); g.addColorStop(0.5, "rgba(255,240,190,0)"); g.addColorStop(1, "rgba(255,240,190,.25)"); ctx.fillStyle = g; quad(p00, p10, p11, p01); ctx.fill();
        ctx.fillStyle = "#6A4E1A"; for (const [u, v] of [[0.06, 0.08], [0.94, 0.08], [0.06, 0.92], [0.94, 0.92]]) { const q = at(u, v); ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, 0.03 * q.s), 0, TAU); ctx.fill(); } }
      else if (I.mat === "stone") { ctx.strokeStyle = L.edge; ctx.lineWidth = Math.max(1, 0.02 * s); for (const v of [0.62, 0.5, 0.38]) { const a = at(0.2, v), b = at(0.8 - (v === 0.5 ? 0.15 : 0), v); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        const c0 = at(0.5, 0.86), c1 = at(0.5, 0.7), c2 = at(0.44, 0.8), c3 = at(0.56, 0.8); ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.moveTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.stroke(); ctx.strokeStyle = INK; }
      else if (I.mat === "bone") { ctx.strokeStyle = L.edge; ctx.lineWidth = Math.max(1, 0.025 * s); for (let u = 0.15; u < 0.9; u += 0.14) { const a = at(u, 0.1), b = at(u, 0.9); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } ctx.strokeStyle = INK; }
      else if (I.mat === "ghost") { ctx.shadowColor = "rgba(190,255,240,.8)"; ctx.shadowBlur = 12; ctx.strokeStyle = L.edge; }
      else if (I.mat === "mud") { ctx.fillStyle = L.edge; for (let u = 0.1; u < 0.95; u += 0.17) { const a = at(u, 0.02), b = at(u, 0.02 + 0.08 * (1 + Math.sin(u * 17 + OB.t))); ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1.5, 0.025 * b.s), 0, TAU); ctx.fill(); ctx.fillRect(a.x - 1, b.y, 2, a.y - b.y); } }
      quad(p00, p10, p11, p01); ctx.stroke(); ctx.shadowBlur = 0;
      const k = clamp((OB.t - I.hitAt) / 0.3, 0, 1);
      if (k < 1) { ctx.fillStyle = `rgba(255,250,230,${0.6 * (1 - k)})`; quad(p00, p10, p11, p01); ctx.fill(); }
      if (I.seal && bankSeal() && game.state !== "flying") { ctx.strokeStyle = `rgba(255,209,89,${0.5 + 0.4 * Math.sin(game.time * 5)})`; ctx.lineWidth = Math.max(2, 0.04 * s); quad(p00, p10, p11, p01); ctx.stroke(); }   // (a sealed ring points at its board)
    }
  });
  Object.assign(OB_CAT, { bank: "Deflector" });
