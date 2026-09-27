  // ───────────────────────── v66: moving gates and secret paths ─────────────────────────
  // The owner's call (2026-09-27): "actual moving gates, and the gates tie into the interactive environmental actors,
  // and that's what decides if secret paths open up; this is where some of the rail shooter mechanics come in."
  //   the gate      a real gate across the lane between Morty and the ring: two leaves on hinges at either side and an
  //                 arch over them. On its own clock it swings open, stands open, rattles (its lamps flash: the tell)
  //                 and swings shut. Shut, it stops the skull; open, the throw goes through the middle. A lob over the
  //                 arch clears it too, but that isn't going through.
  //   the actor     the map's ring interaction (the lantern, the bell, the crank…, 07w_encounter.js) works the gate:
  //                 ring it, by any throw at all, and the gate's winch hauls it open and holds it there for the next
  //                 two throws. The switch is in the world, as a rail shooter's are; nothing on the screen says so
  //                 except the gate's own lamps going gold.
  //   the key       a throw that goes through the open gate, through the ring, and on into the actor is a key; the
  //                 keyhole on the arch lights one notch. Two keys in the map's first half open its secret path.
  //   secret path   the road forks. Up ahead a hidden way turns off (the old road carries on, fading, the way not
  //                 taken), and the second half of the map is played down it: a smaller ring, gold targets far
  //                 more often, bones for every ring through, and 300 more for reaching the end boss that way. A rail
  //                 shooter's alternate route: harder, better paid, and found only by playing the world.
  // It all runs on the obstacles' clock and the run's own throws, so a replay finds the same gate, the same keys and
  // the same fork. The Adventure and Adventure+ only take the secret path; the gate itself stands in every mode that
  // plays the map's obstacles.
  const GATE = { swing: 0.4, tell: 0.7, openA: 1.5, beam: 0.25 };
  const SECRET = { keys: 0, need: 2, open: false, stage: 0, branch: null, taken: false, makes: 0 };
  Object.assign(OB_CAT, { gate: "Blocker" });

  // how far open a gate is at obstacle-time T: 0 shut … 1 open; tell while it rattles before shutting
  function gateOpen(I, T = OB.t) {
    if (obStandsAside(I) || (I.held || 0) > 0) return { k: 1, tell: 0, held: true };
    const [open, shut] = I.cycle, per = open + shut + 2 * GATE.swing, u = ((T + (I.phase || 0)) % per + per) % per;
    if (u < GATE.swing) return { k: smooth(u / GATE.swing), tell: 0 };
    if (u < GATE.swing + open) { const left = GATE.swing + open - u; return { k: 1, tell: left < GATE.tell ? 1 - left / GATE.tell : 0 }; }
    if (u < 2 * GATE.swing + open) return { k: 1 - smooth((u - GATE.swing - open) / GATE.swing), tell: 0 };
    return { k: 0, tell: 0 };
  }
  // where each leaf's free edge is: hinged at ±half, swinging open toward Morty (never back into the ring's space or
  // the bank boards beside it: a bank shot passes inside the open leaves)
  function gateLeaves(I, T = OB.t) {
    const half = (I.span[1] - I.span[0]) / 2, cx = (I.span[0] + I.span[1]) / 2, a = gateOpen(I, T).k * GATE.openA;
    return [-1, 1].map(sd => ({ hinge: cx + sd * half, edge: cx + sd * half - sd * half * Math.cos(a), dz: -half * Math.sin(a) }));
  }
  // in flight, as the skull crosses the gate's plane: through the gap (a note on the skull for the key), over the arch,
  // or into a leaf, a post or the beam (a knock, as any blocker)
  function gateCross(s, prev, I) {
    const P = s.pos; if (!(prev.z < I.z && P.z >= I.z)) return null;
    const u = (I.z - prev.z) / (P.z - prev.z), x = prev.x + (P.x - prev.x) * u, y = prev.y + (P.y - prev.y) * u;
    if (x < I.span[0] - 0.12 - SKULL_R || x > I.span[1] + 0.12 + SKULL_R || y > I.h + GATE.beam + SKULL_R) return null;   // (round it or over it)
    if (y > I.h - SKULL_R) return { hit: true, at: { x, y, z: I.z } };   // (the arch's beam)
    const L = gateLeaves(I);
    if (x < L[0].edge + SKULL_R || x > L[1].edge - SKULL_R) return { hit: true, at: { x, y, z: I.z } };
    s.gated = true; return null;
  }
  // the actor worked the gate (07w_encounter.js calls this when its interaction is rung)
  function gatesWorked() {   // (held 3: this throw's settle takes one, so it stands open for the next two)
    for (const I of OB.list) if (I.kind === "gate" && !I.held) { I.held = 3; I.workedAt = OB.t; Sound.toon("clang", 0); }
  }
  function gatesSync() { for (const I of OB.list) if (I.kind === "gate" && I.held > 0) I.held--; }
  // a chain through the ring into the actor: if it came through the gate first, a key
  function gateKey(s) {
    if (!s.gated || game.phase !== "A" || SECRET.open || !secretAllowed()) return;
    SECRET.keys++; SECRET.stage = game.stage;
    const G = OB.list.find(I => I.kind === "gate"), p = G ? project(0, G.h + 0.1, G.z) : { x: W / 2, y: H * 0.3 };
    Sound.toon("xylo"); caption(t("secret.key", { n: SECRET.keys, of: SECRET.need }), p.x, p.y - U * 0.04);
    if (SECRET.keys >= SECRET.need) secretOpen();
  }
  const secretAllowed = () => game.mode === "story";   // (the Adventure and Adventure+)
  // the way opens: the road forks a little way ahead, to the side the run's dice pick
  function secretOpen() {
    SECRET.open = true; SECRET.stage = game.stage; SECRET.branch = { at: landD() + 26, side: runRand() < 0.5 ? -1 : 1 };
    stageCard(t("secret.k"), t("secret.t"), t("secret.s"), 2.6, "gold"); Sound.toon("fanfare");
    profile.secretPaths = (profile.secretPaths || 0) + 1; Telemetry.emit("secret_path", { stage: game.stage });
  }
  const secretOn = () => SECRET.open && SECRET.stage === game.stage && (game.phase === "B" || game.phase === "loose" || game.phase === "boss");
  function secretReset() { Object.assign(SECRET, { keys: 0, open: false, stage: game.stage || 1, branch: null, makes: 0 }); }
  // the fork, across the track at d: how far the secret road has turned off from the old one
  const secretOff = d => { const B = SECRET.branch; return B && SECRET.stage === (game.stage || 1) && d > B.at ? B.side * 11 * smooth(clamp((d - B.at) / 55, 0, 1)) : 0; };
  // is the road z metres ahead the secret one (lit along its edges)?
  const secretLit = z => { const B = SECRET.branch; return !!B && SECRET.stage === (game.stage || 1) && landD() + z > B.at + 4; };
  // the arch over the hidden way where it turns off: a lit keyhole on its beam, lanterns on its posts
  function drawSecretFork(z0, z1) {
    const B = SECRET.branch; if (!B || SECRET.stage !== (game.stage || 1)) return;
    const z = B.at + 6 - landD(); if (!(z >= z0 && z < z1) || z < 1) return;
    const Ld = landAt(0, z), half = pathHalf() + 0.35, h = 2.6, P = (x, y) => project(x + Ld.dx, y + Ld.y, z), s = P(0, 0).s;
    if (s < 2) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const x of [-half, half]) { const a = P(x, 0), b = P(x, h); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 0.16 * s) + 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = "#6A4A30"; ctx.lineWidth = Math.max(1.5, 0.16 * s); ctx.stroke();
      const q = P(x, h + 0.15); gpuLight(q.x, q.y, 0.9 * s, "255,210,110", 0.4); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, 0.1 * s), 0, TAU); ctx.fill(); }
    const l = P(-half - 0.2, h), r = P(half + 0.2, h); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, 0.22 * s) + 2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.strokeStyle = "#6A4A30"; ctx.lineWidth = Math.max(2, 0.22 * s); ctx.stroke();
    const k = P(0, h), kr = Math.max(3, 0.2 * s); ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(k.x, k.y, kr, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(k.x, k.y - kr * 0.2, kr * 0.3, 0, TAU); ctx.fill(); ctx.fillRect(k.x - kr * 0.12, k.y - kr * 0.2, kr * 0.24, kr * 0.6);
    ctx.restore();
  }
  // a ring through on the secret road pays bones; the end boss reached that way, 300 more (07b_stage.js)
  function secretMake() { if (secretOn() && game.phase === "B") { SECRET.makes++; game.run.secretBones = (game.run.secretBones || 0) + 20; } }
  function secretBossDown() {
    if (!secretOn()) return;
    game.run.secretBones = (game.run.secretBones || 0) + 300; game.run.secrets = (game.run.secrets || 0) + 1;
    caption(t("secret.done"), W / 2, H * 0.34);
  }

  // ── drawing the gate: posts, an arch with its keyhole and lamps, and two barred leaves
  const GATE_LOOK = {   // by map (its own material): frame, bars, trim
    wood: ["#5A3E26", "#7A5636", "#C9A36A"], gilt: ["#6E5A2E", "#C49A42", "#F2D27A"], iron: ["#2E3136", "#565B63", "#9AA3AE"],
    bone: ["#9A8E78", "#DDD2BC", "#F4ECDA"], film: ["#1A1624", "#3A3050", "#B48CFF"]
  };
  function drawGate(I) {
    const C = GATE_LOOK[I.look] || GATE_LOOK.iron, O = gateOpen(I), L = gateLeaves(I), z = I.z, h = I.h;
    const P = (x, y, zz = z) => project(x, y, zz), lw = Math.max(2, 0.05 * P(0, 0).s);
    obShadow((I.span[0] + I.span[1]) / 2, z, (I.span[1] - I.span[0]) * 0.55);
    // the leaves: a frame with upright bars, drawn from the hinge to the free edge (back toward the ring as it opens)
    for (const Lf of L) {
      const a0 = P(Lf.hinge, 0), a1 = P(Lf.hinge, h - 0.05), b0 = P(Lf.edge, 0, z + Lf.dz), b1 = P(Lf.edge, h - 0.05 - 0.25 * (1 - O.k), z + Lf.dz);
      ctx.fillStyle = "rgba(10,8,6,.18)"; ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = lw + 2.5; ctx.stroke(); ctx.strokeStyle = C[0]; ctx.lineWidth = lw; ctx.stroke();
      for (let k = 1; k < 6; k++) {   // the bars
        const u = k / 6, x = Lf.hinge + (Lf.edge - Lf.hinge) * u, zz = z + Lf.dz * u, top = h - 0.05 - 0.25 * (1 - O.k) * u, q0 = P(x, 0.05, zz), q1 = P(x, top, zz);
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.9 + 1.5; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
        ctx.strokeStyle = C[1]; ctx.lineWidth = lw * 0.6; ctx.stroke();
      }
      const m0 = P(Lf.hinge, h * 0.5), m1 = P(Lf.edge, h * 0.5, z + Lf.dz); ctx.strokeStyle = C[1]; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();   // (the cross rail)
    }
    // the posts and the arch
    for (const x of I.span) { const q0 = P(x, 0), q1 = P(x, h + GATE.beam); ctx.strokeStyle = INK; ctx.lineWidth = lw * 2.4 + 3; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke(); ctx.strokeStyle = C[0]; ctx.lineWidth = lw * 2.4; ctx.stroke(); }
    const bl = P(I.span[0] - 0.12, h), br = P(I.span[1] + 0.12, h), tl = P(I.span[0] - 0.12, h + GATE.beam), tr = P(I.span[1] + 0.12, h + GATE.beam);
    ctx.fillStyle = C[0]; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // the lamps on the posts: amber as it rattles before shutting, gold when the actor's holding it
    const lamp = O.held ? GOLD : O.tell > 0 && Math.floor(OB.t * 10) % 2 ? "#FF8A3A" : "rgba(80,70,50,.9)";
    for (const x of [-0.75, 0.75]) { const q = P((I.span[0] + I.span[1]) / 2 + x, h + GATE.beam + 0.12), r = Math.max(3, 0.1 * q.s); if (lamp !== "rgba(80,70,50,.9)") gpuLight(q.x, q.y, r * 5, O.held ? "255,210,100" : "255,140,60", 0.35); ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    // the keyhole in the middle of the arch, a notch lit for each key
    const kh = P((I.span[0] + I.span[1]) / 2, h + GATE.beam * 0.5), r = Math.max(4, 0.13 * kh.s);
    ctx.fillStyle = C[2]; ctx.beginPath(); ctx.arc(kh.x, kh.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(kh.x, kh.y - r * 0.2, r * 0.3, 0, TAU); ctx.fill(); ctx.fillRect(kh.x - r * 0.12, kh.y - r * 0.2, r * 0.24, r * 0.6);
    if (secretAllowed() && SECRET.stage === game.stage) for (let k = 0; k < SECRET.need; k++) {
      const a = -Math.PI / 2 + (k - (SECRET.need - 1) / 2) * 0.7, on = SECRET.open || k < SECRET.keys;
      ctx.fillStyle = on ? GOLD : "rgba(20,14,8,.6)"; ctx.beginPath(); ctx.arc(kh.x + Math.cos(a) * r * 1.5, kh.y + Math.sin(a) * r * 1.5, r * 0.28, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (O.tell > 0 && Math.floor(OB.t * 12) % 2 && !O.held) { ctx.fillStyle = "rgba(242,231,201,.8)"; ctx.font = `800 ${Math.round(U * 0.03)}px ${UIFONT}`; ctx.textAlign = "center"; ctx.fillText("CLANK", kh.x, kh.y - r * 2.4); }
  }
  OB_DRAW.gate = drawGate;
