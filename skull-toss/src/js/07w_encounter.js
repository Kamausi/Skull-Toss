  // ───────────────────────── encounters (v58): the ring stays core, the world answers ─────────────────────────
  // RING → THROW → WORLD INTERACTION → CONSEQUENCE. The ring is the one mandatory thing, and nothing takes its job. Three
  // layers sit round it:
  //   the Ring Target       the ring itself: every throw is judged on it, as ever;
  //   the Ring Modifier     what moves in front of it (the map's movers, threats and blockers, the pendulum, the jump-cut ring);
  //   the Ring Interaction  something optional hung just behind the ring, off to one side (a bell, a lantern, a crank,
  //                         a gong…, each map its own), swinging on its own pendulum. Go through the ring and on into it
  //                         and the chain has a consequence: bonus points and, on most maps, the way clearing (the next
  //                         throw's movers and threats stand aside); hit it without the ring and it only rings.
  // Behavioural hazards: every one of the map's threats and movers goes idle → notice → telegraph → active → recover, and
  // shows it with a pair of cartoon eyes (sleepy; open and looking at Morty when his aim comes near; narrowed as it
  // winds up; screwed shut as it goes; dizzy after). The threats (the cannon, the crusher) have a weak point, a glinting
  // spot: hit it and it's knocked out for two throws. Skull Sense: while aiming, whatever the throw would pass near
  // answers a little (the interaction trembles and glints, a hazard opens its eyes). No meters, no markers.
  // The encounter's rhythm is TRAVEL → RING → THROW → CONSEQUENCE → TRAVEL (ENC.phase), and the camera reads it
  // (04c_camera.js). Everything that touches the game runs on the run's own simulation clock, so replays agree.
  const ENC_CATS = ["Threat", "Blocker", "Mover", "Deflector", "Trigger", "Target", "Weak Point", "Hazard", "Prize", "Secret", "Set Piece"];
  const OB_CAT = { bumper: "Deflector", magnet: "Deflector", bar: "Mover", fan: "Mover", cannon: "Threat", crusher: "Threat", spikes: "Hazard", barrier: "Blocker" };
  const TARGET_CAT = { standard: "Target", swinging: "Target", runaway: "Target", popup: "Target", shielded: "Weak Point", split: "Target", decoy: "Blocker", golden: "Prize", secret: "Secret" };
  const ENC = { it: null, calm: 0, chain: 0, cons: 0, focus: null, sense: 0, phase: "ring", lastHit: -1, chains: 0 };
  const encDef = () => (mapData(game.stage || 1).encounter || null);
  const INTER_R = 0.18, WEAK_R = 0.2;
  let encDefOverride = false;   // (the spec's: an interaction on every ring)
  // is there an interaction behind this ring? Three throws in every six, through the legs (never a boss, a mini-game or the road between maps)
  function encWanted() {
    const E = encDef(); if (!E || game.state === "title" || boss || attrOn() || game.phase === "crossing" || !(game.phase === "A" || game.phase === "B") || game.ringHidden) return null;
    return encDefOverride || (game.stageHits || 0) % 6 >= 3 ? E : null;
  }
  function encSync() {   // after every settled throw: the interaction comes or goes, the calm and knockouts wear off
    const E = encWanted(), h = game.stageHits || 0;
    if (!ENC.chained) ENC.chain = 0; ENC.chained = false;   // (a chain runs while every throw keeps chaining)
    if (!E) ENC.it = null;
    else if (!ENC.it || ENC.it.kind !== E.interaction) ENC.it = { kind: E.interaction, cons: E.consequence, side: h % 2 ? 1 : -1, ang: 0, av: 0, rung: -9, sense: 0 };
    if (ENC.calm > 0) ENC.calm--;
    for (const I of OB.list) if (I.out > 0) I.out--;
    gatesSync();
  }
  function encReset() { ENC.it = null; ENC.calm = 0; ENC.chain = 0; ENC.cons = 0; ENC.focus = null; ENC.chains = 0; }
  // where the interaction hangs: from the ring's own support, just behind it and off to one side, swinging
  function encPos(I = ENC.it) {
    const L = 0.55, a = I.ang + Math.sin(OB.t * 1.9) * 0.08, px = ring.x + I.side * ring.rc * 0.72, py = ring.y + 0.25, pz = ring.z + 1.0;   // (reached through the ring's lower side half: a choice, not a gift)
    return { x: px + Math.sin(a) * L, y: py - Math.cos(a) * L, z: pz, px, py };
  }
  function updateEncounter(dt) {
    const I = ENC.it;
    if (I) { I.av += (-9.8 / 0.55 * Math.sin(I.ang) - I.av * 0.9) * dt; I.ang += I.av * dt; I.sense += ((ENC.sense) - I.sense) * (1 - Math.exp(-dt * 6)); }
    ENC.cons = Math.max(0, ENC.cons - dt);
    ENC.phase = ENC.cons > 0 ? "consequence" : game.state === "flying" ? "throw" : TRAVEL.v > 0.3 ? "travel" : "ring";
    // Skull Sense: sample the throw the aim would make (no forces: it's a feeling, not a guide)
    ENC.sense = 0; for (const O of OB.list) O.sense = 0;
    if (game.state === "ready" && aim.active && aim.valid && !attrOn()) {
      const v = aimVelocity(aim.AX, aim.AY), wx = 0.5 * windNow(), G = gNow(), P = I ? encPos() : null, T = ring.z / Math.max(0.5, v.z) + 0.5;
      const wet = waterFlight() || banksLive() ? forcedPath(v, T, { forces: false }) : null;   // (v60: under the sea it's the water's curve it feels along, and off a bank board the bounce)
      for (let t = 0.05; t < T; t += 0.05) {
        const q = wet ? wet[Math.min(wet.length - 1, Math.round(t / SIM_STEP) - 1)] : { x: v.x * t + wx * t * t, y: START_Y + v.y * t - 0.5 * G * t * t, z: v.z * t }; if (!q || q.y < 0) break;
        if (P) ENC.sense = Math.max(ENC.sense, clamp(1 - Math.hypot(q.x - P.x, q.y - P.y, q.z - P.z) / 0.9, 0, 1));
        for (const O of OB.list) { const c = obCentre(O); O.sense = Math.max(O.sense, clamp(1 - Math.hypot(q.x - c[0], q.y - c[1], q.z - c[2]) / 1.4, 0, 1)); }
      }
    }
  }
  // in flight: the interaction, and the threats' weak points
  function encounterCheck(s, prev) {
    const P = s.pos, I = ENC.it;
    if (I && OB.t - I.rung > 0.4) {
      const c = encPos(); if (segDist(c, prev, P) < INTER_R + SKULL_R) {
        I.rung = OB.t; I.av += (Math.sign(P.x - prev.x || I.side) * 6 + (P.z - prev.z) * 3); gatesWorked();   // (v66: the actor works the gate, 07wa_gates.js)
        const p = project(c.x, c.y, c.z); Sound.toon(I.kind === "crank" ? "clang" : "bell", panOf(c.x));
        if (game.result && game.result.make) {   // RING → THROW → INTERACTION → CONSEQUENCE
          ENC.chain++; ENC.chains++; ENC.chained = true; const pts = 150 * ENC.chain; game.score += pts; profile.scoreTotal += pts; game.result.pts = (game.result.pts || 0) + pts; game.result.chain = ENC.chain;
          gateKey(s);   // (v66: through the gate first? a key to the secret path)
          if (I.cons === "path") ENC.calm = 2;   // (this throw's settle takes one: the next throw finds them standing aside)
          ENC.cons = 1.1; ENC.focus = { x: c.x, y: c.y, z: c.z };
          impact(t("enc.chain", { n: ENC.chain }), p.x, p.y - U * 0.05, { fill: GOLD, text: INK, scale: 0.6, bits: true });
          if (I.cons === "path") caption(t("enc.path"), p.x, p.y + U * 0.06);
          camJolt("swish", 0.7);
        }
      }
    }
  }
  function weakCheck(s, prev) {   // (before the obstacles' own collisions: the weak point is what's hit first)
    const P = s.pos;
    for (const O of OB.list) {   // a threat's weak point: knock it out for two throws
      const w = encWeak(O); if (!w || O.out > 0) continue;
      if (segDist(w, prev, P) < WEAK_R + SKULL_R) {
        O.out = 3; O.hitAt = OB.t; const pts = 200; game.score += pts; profile.scoreTotal += pts;
        const p = project(w.x, w.y, w.z); impact(t("enc.weak"), p.x, p.y - U * 0.05, { fill: "#E8C040", text: INK, scale: 0.55, bits: true }); Sound.toon("clang", panOf(w.x));
        ENC.cons = 0.9; ENC.focus = w;
      }
    }
  }
  function encWeak(O) {   // the cannon's powder cap, the crusher's rivet
    if (O.kind === "cannon") return { x: O.side * 2.25, y: O.y + 0.32, z: O.z };
    if (O.kind === "crusher") { const [x0, x1, z0] = O.box; return { x: Math.abs(x0) > Math.abs(x1) ? x0 + 0.16 : x1 - 0.16, y: crusherBottom(O).y + CRUSHER_TALL * 0.82, z: z0 - 0.12 }; }   // (the big rivet at its outer top corner: a precise shot, never the middle)
    return null;
  }
  const obStandsAside = O => O.out > 0 || ENC.calm > 0;   // (07m_obstacles.js skips them)
  // how a hazard is behaving: idle → notice → telegraph → active → recover
  function obBehaviour(O) {
    if (obStandsAside(O)) return "recover";
    let tele = 0, act = false;
    if (O.kind === "cannon") { tele = cannonTell(O); act = O.balls.length > 0; }
    else if (O.kind === "crusher") { const B = crusherBottom(O); tele = B.tell; act = !!(B.slam || B.down); if (!act && !tele && B.y < O.top - 0.05) return "recover"; }
    else if (O.kind === "spikes") { tele = spikesTell(O) ? 1 : 0; act = spikesRaise(O) > 0.3; }
    else if (O.kind === "barrier") { const a = barrierAlpha(O); act = a > 0.9; tele = a > 0.02 && a < 0.9 ? 1 : 0; }
    else if (O.kind === "fan") act = fanOn(O) > 0.2;
    else if (O.kind === "coach") { const c = coachAt(O); tele = c.tell; act = c.x != null; }   // (v67)
    else if (O.kind === "jet") { tele = jetTell(O); act = jetOn(O) > 0.2; }
    else act = true;   // (a bar, a bumper, a lodestone: always at it)
    if (tele > 0) return "telegraph";
    if (act && O.kind !== "bar" && O.kind !== "bumper" && O.kind !== "magnet") return "active";
    return O.sense > 0.25 ? "notice" : act ? "active" : "idle";
  }
  const EYES = { drawn: 0, st: {} };
  // the eyes: a 1930s cartoon's way of saying what a thing is about to do
  function drawObEyes(O) {
    if (O.kind === "current" || O.kind === "pocket" || (O.kind === "coach" && coachAt(O).x == null)) return;   // (v60: the water itself has no face)
    const st = obBehaviour(O), c = obCentre(O), up = O.kind === "spikes" ? O.h * 0.5 : O.kind === "crusher" ? crusherBottom(O).y + 0.9 - c[1] : 0.25, p = project(c[0], c[1] + up, c[2]), e = Math.max(2, p.s * 0.06), t = OB.t;
    if (p.s < 12) return;
    EYES.drawn++; EYES.st[st] = Math.max(EYES.st[st] || 0, e);   // (v67: the spec and the e2e read how big they're drawn, on a phone and with reduced motion)
    const shake = st === "telegraph" ? (reduceMotion ? 0 : Math.sin(t * 50) * e * 0.25) : 0, look = st === "notice" || st === "telegraph" ? -0.35 : 0;
    ctx.save(); ctx.translate(p.x + shake, p.y); ctx.lineWidth = Math.max(1, e * 0.25); ctx.strokeStyle = INK;
    for (const sd of [-1, 1]) {
      const x = sd * e * 1.3;
      if (st === "recover") { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k * 0.9 + t * 6, r = (k / 10) * e; ctx.lineTo(x + Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); continue; }   // dizzy
      const open = st === "idle" ? 0.25 : st === "active" ? 0.35 : st === "telegraph" ? 0.6 : 1;
      ctx.fillStyle = "#F2EAD8"; ctx.beginPath(); ctx.ellipse(x, 0, e, e * open, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (open > 0.3) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + look * e * 0.4 * sd * 0, e * (0.2 + look * 0.3), e * 0.45 * Math.min(1, open), 0, TAU); ctx.fill(); }
      if (st === "telegraph" || st === "active") { ctx.beginPath(); ctx.moveTo(x - sd * e * 1.1, -e * 1.3); ctx.lineTo(x + sd * e * 0.9, -e * 0.7); ctx.stroke(); }   // the brow comes down
    }
    ctx.restore();
    const w = encWeak(O); if (w && O.out <= 0) { const q = project(w.x, w.y, w.z), r = Math.max(2, WEAK_R * q.s * 0.6), g = 0.5 + 0.5 * Math.sin(t * 5); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,220,120,${0.25 + 0.3 * g})`; ctx.beginPath(); ctx.arc(q.x, q.y, r * (1.2 + g * 0.3), 0, TAU); ctx.fill(); ctx.restore(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke(); }
  }
  // the interaction itself, on its line from the ring's support
  function drawEncounter() {
    const I = ENC.it; if (!I || game.state === "title") return;
    const c = encPos(), top = project(c.px, c.py, c.z), p = project(c.x, c.y, c.z), r = 0.24 * p.s, sense = I.sense, tr = Math.sin(OB.t * 40) * sense * r * 0.06, ring_ = OB.t - I.rung < 0.6;
    if (r3dOn() && r3dLiveAt("enc", p, [0.7, Math.max(0.7, c.py - c.y + 0.1), 0.7, 0.6], 0.2, drawEncounter)) return;   // (v68: a live 3D piece)
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(p.x + tr, p.y - r * 0.8); ctx.stroke();
    ctx.translate(p.x + tr, p.y); ctx.rotate(I.ang);
    ENC_DRAW[I.kind] ? ENC_DRAW[I.kind](r) : ENC_DRAW.bell(r);
    if (sense > 0.05 || ring_) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,230,160,${0.12 * sense + (ring_ ? 0.25 : 0)})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.fill(); }   // (Skull Sense: the faintest glint)
    ctx.restore();
  }
  const ENC_DRAW = {
    bell(r) { ctx.fillStyle = "#C89A3A"; ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.7); ctx.quadraticCurveTo(-r * 0.35, r * 0.2, -r * 0.8, r * 0.55); ctx.lineTo(r * 0.8, r * 0.55); ctx.quadraticCurveTo(r * 0.35, r * 0.2, r * 0.3, -r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, r * 0.62, r * 0.14, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,240,190,.5)"; ctx.fillRect(-r * 0.22, -r * 0.4, r * 0.1, r * 0.7); },
    lantern(r) { ctx.fillStyle = "#3A3028"; ctx.fillRect(-r * 0.45, -r * 0.7, r * 0.9, r * 0.14); ctx.fillRect(-r * 0.45, r * 0.5, r * 0.9, r * 0.14); ctx.fillStyle = "#FFC860"; ctx.beginPath(); ctx.rect(-r * 0.35, -r * 0.56, r * 0.7, r * 1.06); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#3A3028"; for (const x of [-0.12, 0.12]) { ctx.beginPath(); ctx.moveTo(x * r, -r * 0.56); ctx.lineTo(x * r, r * 0.5); ctx.stroke(); } },
    chime(r) { ctx.fillStyle = "#8A8A90"; for (const [x, h] of [[-0.45, 1.1], [-0.15, 1.35], [0.15, 1.2], [0.45, 0.95]]) { ctx.beginPath(); ctx.rect(x * r - r * 0.08, -r * 0.6, r * 0.16, h * r); ctx.fill(); ctx.stroke(); } ctx.fillStyle = "#6A4A2A"; ctx.fillRect(-r * 0.6, -r * 0.75, r * 1.2, r * 0.14); },
    gong(r) { ctx.fillStyle = "#B8862A"; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "rgba(90,60,20,.6)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke(); ctx.fillStyle = "#8A5A1A"; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, TAU); ctx.fill(); },
    crank(r) { ctx.fillStyle = "#8A8A90"; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = i % 2 ? r * 0.55 : r * 0.72; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, r * 0.2); ctx.stroke(); ctx.fillStyle = "#6A2A2A"; ctx.beginPath(); ctx.arc(r * 0.9, r * 0.2, r * 0.16, 0, TAU); ctx.fill(); },
    triangle(r) { ctx.strokeStyle = "#C8C8C0"; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.65, r * 0.55); ctx.lineTo(-r * 0.65, r * 0.55); ctx.closePath(); ctx.stroke(); },
    orb(r) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8); g.addColorStop(0, "#F0E8FF"); g.addColorStop(1, "#8A60E0"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill(); ctx.stroke(); }
  };
