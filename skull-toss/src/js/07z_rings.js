  // ───────────────────────── v60: ring personalities, and the ring's audio tells ─────────────────────────
  // Studied from Thumper (every change is heard before it's seen) and Yoku (a target with a character you learn). In the
  // third act on four maps the ring gets a character (src/maps/*.json: ring.personality). Each runs on the simulation's
  // own clock (so a replay sees it the same), the flight judges the ring where its character put it, and each is told
  // before it matters:
  //   timid       the Whistling Woods: as a throw arrives it flinches along its line, away from the skull, and holds
  //               there till the throw's done. Aimed at, it trembles and ticks nervously. Lead it further.
  //   shy         the Drowned Theater: on a beat it turns edge-on and back, so its window narrows across. A whirr first.
  //   decoy       the Black Marsh: a will-o'-the-wisp ring hangs above the real one, on the other side; it has no post
  //               and no reflection, and it flickers. Through it is a miss.
  //   aggressive  the Clockwork Caves: on a beat it lunges along its line at 2.2 times its pace (v62: was three). A whirr first.
  // And while you aim, a ring on its line ticks softly just before it turns round, so its rhythm can be heard.
  const PERS = { t: 0, off: 0, fl: 0, nerve: 0, nerveT: 0, was: null, lastTell: -1, lastRev: 0, cutWas: 0, tells: 0 };
  const SHY = { per: 3.2, turn: [2.2, 2.9], yaw: 1.25 }, LUNGE = { per: 2.6, at: [2.1, 2.5], rate: 2.2 }, TIMID = { reach: 2.2, dart: 0.32 }, DECOY = { up: 1.05, x: -0.8 };
  const TELL_LEAD = 1.0;   // v62: the whirr comes a whole second before the turn or the lunge, longer than a throw's flight, so a throw made after it never gets caught
  const persDef = () => { const P = stageDef().map.ring.personality; return P && P.kind ? P : null; };
  function persKind() {
    const P = persDef(); if (!P || game.state === "title" || game.phase !== "A" || boss || ring.frozen || attrOn() || portalOpen()) return null;
    if (ring.mode !== "line" && ring.mode !== "static") return null;
    const h = game.stageHits || 0; return h >= (P.from || 0) && h < (P.to || STAGE_MINI) ? P.kind : null;
  }
  const persU = per => ((PERS.t % per) + per) % per;
  // (startGame: the character's clock starts with the run, so a replay, whatever time was spent in the menus first, sees the same beats)
  function persReset() { Object.assign(PERS, { t: 0, off: 0, fl: 0, nerve: 0, nerveT: 0, was: null, lastTell: -1, lastRev: 0, cutWas: 0, tells: 0 }); LANE.i = -1; LANE.z = null; LANE.stage = 0; }
  const ringPersX = () => PERS.off;   // (RING_PATHS line and static, 07e_directors.js)
  function ringNarrow() {   // how wide the shy ring's window is across now (1: face on)
    if (persKind() !== "shy") return 1;
    const u = persU(SHY.per), [a, b] = SHY.turn; if (u < a || u > b) return 1;
    return Math.max(0.12, Math.cos(SHY.yaw * Math.sin(((u - a) / (b - a)) * Math.PI)));
  }
  const persRate = (dt = 0) => { if (persKind() !== "aggressive") return 1; const per = LUNGE.per, u = (((PERS.t + dt) % per) + per) % per; return u >= LUNGE.at[0] && u < LUNGE.at[1] ? LUNGE.rate : 1; };   // (dt: a moment on, for a look ahead)
  function decoyAt() { return persKind() === "decoy" && !plusOn() ? { x: ring.x * DECOY.x, y: ring.y + DECOY.up, z: ring.z } : null; }   // (Adventure+ has its own ghost rings, 07s_plus.js)
  // (hitRing, 07_game.js: through the will-o'-the-wisp's window is a miss)
  function decoyCatch(s, at) {
    const F = decoyAt(); if (!F) return false;
    if (Math.hypot(s.p0.x - F.x, s.p0.y - F.y) > ring.rc - RING_TUBE) return false;
    const p = project(F.x, F.y, F.z); Sound.toon("poof", panOf(F.x)); PERS.fl = 0; resolve("decoy", at, p); return true;
  }
  // (update, before the flight: the character's clock, the timid ring's flinch, and the tells)
  function updatePersonality(dt) {
    const k = persKind(); PERS.t += dt;
    if (k === "timid" && game.state === "flying" && !skull.crossed && !skull.resting) {
      const v = velAt(skull, skull.t), dz = ring.z - skull.pos.z;
      if (!PERS.fl && dz > 0 && dz < TIMID.reach && v.z > 0) { const px = skull.pos.x + v.x * (dz / v.z); PERS.fl = ring.x >= px ? 1 : -1; Sound.toon("tick", panOf(ring.x), 1.3); }
    }
    if (k !== "timid" || game.state !== "flying") PERS.fl = 0;
    const room = Math.max(0, 1.55 - Math.abs(ring.x - PERS.off));   // (it never flinches out of its zone)
    const want = PERS.fl ? PERS.fl * Math.min(TIMID.dart, room) : 0;
    PERS.off += (want - PERS.off) * Math.min(1, dt * (PERS.fl ? 14 : 3));
    // the tells: the timid ring's nerves, and a whirr before the shy one turns or the aggressive one lunges
    const aiming = game.state === "ready" && aim.active && aim.valid;
    const on = aiming && k && Math.hypot(aim.AX - ring.x, aim.AY - ring.y) < 0.7;
    PERS.nerve += ((k === "timid" && on ? 1 : 0) - PERS.nerve) * Math.min(1, dt * 8);
    if (k === "timid" && on && (PERS.nerveT -= dt) <= 0) { PERS.nerveT = 0.35; PERS.tells++; Sound.toon("tick", panOf(ring.x), 1.15); }
    if (k === "decoy" && aiming) { const F = decoyAt(); if (F && Math.hypot(aim.AX - F.x, aim.AY - F.y) < 0.6 && (PERS.nerveT -= dt) <= 0) { PERS.nerveT = 0.6; PERS.tells++; Sound.toon("hiss", panOf(F.x)); } }
    if (k === "shy" || k === "aggressive") {
      const per = k === "shy" ? SHY.per : LUNGE.per, at = (k === "shy" ? SHY.turn[0] : LUNGE.at[0]) - TELL_LEAD, n = Math.floor(PERS.t / per);
      if (persU(per) >= at && PERS.lastTell !== n) { PERS.lastTell = n; if (game.state === "ready" || game.state === "flying") { PERS.tells++; Sound.toon("whirr", panOf(ring.x)); } }
    }
    // a line ring ticks softly a beat before it turns round (while you're aiming, when its rhythm is what you're reading)
    if (aiming && ring.mode === "line" && ring.amp > 0.3 && ring.omega > 0.05) {
      const r = ring.omega * persRate(), k2 = Math.ceil((ring.phase - Math.PI / 2) / Math.PI), next = Math.PI / 2 + k2 * Math.PI, lead = (next - ring.phase) / r;
      if (lead <= 0.22 && PERS.lastRev !== k2) { PERS.lastRev = k2; PERS.tells++; Sound.toon("tick", panOf(ring.x), 0.85); }
    }
    // the Final Reel's cut: a ding as the film starts to flicker
    const cut = ring.mode === "jumpcut" ? RING_PATHS.jumpcut.tell(ring.phase) : 0;
    if (cut > 0 && PERS.cutWas <= 0 && game.state !== "title") { PERS.tells++; Sound.toon("ding", panOf(ring.x), 0.75); }
    PERS.cutWas = cut;
  }
  const persShake = () => (PERS.nerve > 0.02 ? Math.sin(game.time * 55) * PERS.nerve * U * 0.006 : 0);
  function persAfterThrow() {   // (settleThrow: a character arriving says so)
    const k = persKind();
    if (k && k !== PERS.was) { const p = project(ring.x, ring.y, ring.z); caption(t(`pers.${k}`), p.x, p.y - ring.rc * p.s - U * 0.06); Sound.toon("brass"); }
    PERS.was = k;
  }
  // the will-o'-the-wisp: the ring's own shape, green and flickering, with nothing holding it up
  function drawDecoyRing() {
    const F = decoyAt(); if (!F) return;
    const p = project(F.x, F.y, F.z), r = ring.rc * p.s, lw = RING_TUBE * 2 * p.s, fl = 0.55 + 0.25 * Math.sin(game.time * 13) * Math.sin(game.time * 3.1);
    ctx.save(); ctx.globalAlpha *= fl;
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 1.8); g.addColorStop(0, "rgba(150,255,190,.25)"); g.addColorStop(1, "rgba(150,255,190,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.8, 0, TAU); ctx.fill();
    drawRingShape(ctx, p.x, p.y, r, lw, cos.ring, game.time, 0);
    ctx.strokeStyle = "rgba(120,240,170,.7)"; ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();   // (its own sickly green over the tube)
    ctx.restore();
  }
