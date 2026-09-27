  // ───────────────────────── v67: the phantom coach (the foreground pressure event) ─────────────────────────
  // The rail-shooter study's third pattern (the task "Prototype ring-centric rail-shooter hazard patterns"): a pressure
  // event in the foreground, between Morty and the ring. A phantom coach crosses the lane on its schedule, right
  // through the band every throw flies through. First the tell: its lamp glows at the side it'll come from, a bell, and
  // a dashed track runs across the ground where it'll pass (1.2 s). Then it rushes across (about two seconds) and is
  // gone. Throw while it's crossing the middle and it knocks the skull out of the air; wait, or lob over it, and the
  // way is clear. It never hides the ring: where it passes in front of it, it's drawn as a ghost (the ring shows
  // through), and its collision is its own box, not its drawing. It runs on the obstacles' clock, so replays agree.
  // src/maps/*.json obstacles.B: { kind: "coach", z, y: [low, high], every: [period, tell], speed, look, from, phase }
  const COACH = { half: 0.8, depth: 0.35, lane: 3.4 };
  Object.assign(OB_CAT, { coach: "Mover" });
  // where it is at obstacle-time T: x (null while off stage), which way, and the tell (0 … 1 before it enters)
  function coachAt(I, T = OB.t) {
    const [per, tell] = I.every, u = ((T + (I.phase || 0)) % per + per) % per, n = Math.floor((T + (I.phase || 0)) / per), dir = n % 2 ? -1 : 1;
    const run = (2 * COACH.lane) / I.speed;
    if (u < tell) return { x: null, dir, tell: u / tell };
    if (u < tell + run) return { x: -dir * COACH.lane + dir * I.speed * (u - tell), dir, tell: 0 };
    return { x: null, dir, tell: 0 };
  }
  function coachHit(I, P) {   // its box: the coach's body, not its drawing
    const c = coachAt(I); if (c.x == null) return false;
    return Math.abs(P.x - c.x) < COACH.half + SKULL_R && P.y > I.y[0] - SKULL_R && P.y < I.y[1] + SKULL_R && Math.abs(P.z - I.z) < COACH.depth + SKULL_R;
  }
  const coachCentre = I => { const c = coachAt(I); return [c.x == null ? -c.dir * COACH.lane : c.x, (I.y[0] + I.y[1]) / 2, I.z]; };
  const COACH_LOOK = {   // body, trim, lamp
    wood: ["#3A2A1C", "#8A6A3E", "255,200,110"], gilt: ["#2A2230", "#C49A42", "255,220,130"], iron: ["#23272C", "#6E7680", "180,230,255"],
    bone: ["#6A5E4C", "#E4DAC4", "255,210,150"], film: ["#15121E", "#8A6ACC", "190,150,255"]
  };
  const COACH_DRAWN = { ghost: 0, over: false };   // (what the last frame did, for the spec: did it ghost over the ring?)
  function drawCoach(I) {
    const C = COACH_LOOK[I.look] || COACH_LOOK.wood, c = coachAt(I), z = I.z, [y0, y1] = I.y;
    if (c.x == null) {
      if (c.tell > 0) {   // the tell: the track across the lane, and the lamp glowing at the edge it'll come from
        const a = project(-COACH.lane, 0, z), b = project(COACH.lane, 0, z); ctx.save(); ctx.setLineDash([8, 8]); ctx.lineDashOffset = -OB.t * 40 * c.dir; ctx.strokeStyle = `rgba(${C[2]},${0.25 + 0.4 * c.tell})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
        const q = project(-c.dir * (COACH.lane - 0.3), y1, z); gpuLight(q.x, q.y, U * 0.25 * c.tell, C[2], 0.5); ctx.fillStyle = `rgba(${C[2]},${0.4 + 0.6 * c.tell})`; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(3, 0.12 * q.s), 0, TAU); ctx.fill();
      }
      COACH_DRAWN.over = false; return;
    }
    const tl = project(c.x - COACH.half, y1, z), br = project(c.x + COACH.half, y0, z);
    // over the ring? then a ghost: the ring shows through it (the rail-shooter rule: the target is never hidden)
    const R = project(ring.x, ring.y, ring.z), rr = ring.rc * R.s * 1.25, over = R.x + rr > tl.x && R.x - rr < br.x && R.y + rr > tl.y && R.y - rr < br.y;
    COACH_DRAWN.over = over; COACH_DRAWN.ghost = over ? 0.3 : 0.92; ctx.globalAlpha *= COACH_DRAWN.ghost;
    const w = br.x - tl.x, h = br.y - tl.y;
    for (let k = 1; k <= 3; k++) { ctx.fillStyle = `rgba(${C[2]},${0.06 * (4 - k)})`; ctx.fillRect(tl.x - c.dir * w * 0.25 * k, tl.y + h * 0.15, w, h * 0.7); }   // (its phantom trail)
    ctx.fillStyle = C[0]; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 0.03 * br.s * 2);
    ctx.beginPath(); ctx.moveTo(tl.x + w * 0.08, tl.y); ctx.lineTo(br.x - w * 0.08, tl.y); ctx.lineTo(br.x, tl.y + h * 0.25); ctx.lineTo(br.x, br.y - h * 0.2); ctx.lineTo(tl.x, br.y - h * 0.2); ctx.lineTo(tl.x, tl.y + h * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(${C[2]},.55)`; for (const u of [0.3, 0.7]) ctx.fillRect(tl.x + w * u - w * 0.1, tl.y + h * 0.2, w * 0.2, h * 0.28);   // (lit windows)
    ctx.strokeStyle = C[1]; ctx.lineWidth = Math.max(1.5, w * 0.02); ctx.strokeRect(tl.x + w * 0.05, tl.y + h * 0.08, w * 0.9, h * 0.62);
    for (const u of [0.22, 0.78]) { const wx = tl.x + w * u, wy = br.y - h * 0.12, r = h * 0.2; ctx.fillStyle = C[1]; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(wx, wy, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + OB.t * 8 * c.dir; ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r); } ctx.stroke(); }
    const lq = { x: c.dir > 0 ? br.x : tl.x, y: tl.y + h * 0.2 }; gpuLight(lq.x, lq.y, w * 0.6, C[2], 0.4); ctx.fillStyle = `rgb(${C[2]})`; ctx.beginPath(); ctx.arc(lq.x, lq.y, Math.max(3, w * 0.05), 0, TAU); ctx.fill();
  }
  OB_DRAW.coach = drawCoach;
