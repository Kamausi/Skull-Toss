  // ───────────────────────── v68 3D: the runtime complexity manager (the owner's performance equations) ─────────────────────────
  // Not Low / Medium / High: each piece of the 3D picture asks, every frame, how much it's worth on this one. The
  // equations are the math core's (MC.PF, 01e_mathcore_engine.js); this is the 3D renderer running on them.
  //   · Timing: the gap between frames and the work in each, smoothed (EMA, α = 0.1), how much of the work is the 3D's,
  //     and the jank, median, P95, P99 and worst frame over the last 240 frames. Average FPS alone hides a hitch.
  //   · A PID governor: e = T_target − T_work moves one quality, Q (0 … 1).
  //   · Q is given up in order of efficiency (saving ÷ harm), and the protected things never go: Morty, the ring,
  //     collision and the bosses stay whole. First the distant set pieces go back to paint, then the particles thin,
  //     then the live pieces re-cut less often, and last the resolution drops, by s·√(T_t / T_3d): the 3D's own
  //     share of the frame, since only its pixels shrink (Amdahl).
  //   · A set piece is 3D only while its depth shows. Painted flat, its error is the depth it lacks, E = depth·F/z
  //     pixels (the screen-space error); above T + Δ it's built, below T − Δ it's painted (hysteresis), and each switch
  //     crossfades over a quarter second (smoothstep), so nothing pops or flickers at the edge. This replaces the
  //     old fixed 30 m cut.
  //   · Frustum culling: a piece whose bounding sphere is wholly outside the view (n·c + d < −r) isn't drawn at all.
  //   · A build budget: new set pieces are cut a few milliseconds' worth a frame, the most visible first, so coming
  //     into a street of new scenery doesn't stall one frame (the map-entry hitch); the rest stay painted till built.
  //   · A particle budget: effects ask for particles and are given a share by importance.
  const R3D_RCM = { cost: {}, costFrames: 0,
    target: PERF.frameMs, a: 0.1, gap: null, work: null, work3d: null, hist: new Float32Array(240), n: 0, i: 0,
    pid: MC.PF.pid(), Q: 1, hold: null, ch: {}, scale: 1, sMin: 0.7, resAt: 0,
    T: [4, 12], D: 0.2, fade: 250, E: 1,   // (T: a set piece's threshold in pixels of error, at Q = 1 and Q = 0; Δ = 20% of it)
    build: { frame: 5, end: 4, spent: 0 }, pend: new Map(), W: new WeakMap(), LW: new Map(),
    parts: { B: 480, want: new Map(), got: new Map() },
    t0: 0, last: 0, now: 0, t3d: 0, frames: 0, stats: {}, fr: null
  };
  // what to give up first (static estimates of the saving and the harm; the protected list is never offered)
  const R3D_GIVE = MC.PF.sacrifice([
    { name: "distant", savings: 6, damage: 1 },      // far set pieces back to paint: most of the scene's cost, barely seen
    { name: "particles", savings: 2, damage: 1 },    // the portal's motes thin
    { name: "animation", savings: 3, damage: 2 },    // live pieces re-cut on fours, not twos
    { name: "resolution", savings: 8, damage: 6 }    // the 3D's pixels, last
  ]).map(o => o.name);
  // each channel's own quality: the first to go spends the top quarter of Q, the next the quarter below, and so on
  function r3dChannels(Q) { const n = R3D_GIVE.length; R3D_GIVE.forEach((c, k) => { R3D_RCM.ch[c] = clamp((Q - (1 - (k + 1) / n)) * n, 0, 1); }); }
  r3dChannels(1);
  const r3dZero = () => ({ culled: 0, painted: 0, morph: 0, in3d: 0, deferred: 0, built: 0 });
  R3D_RCM.stats = r3dZero();
  // the view's four sides and the near plane, in camera space (08r_r3d.js's pinhole: centre on the horizon)
  function r3dFrustum() {
    const R = R3D_RCM, k = W + "x" + H + "x" + HY + "x" + F;
    if (!R.fr || R.fr.k !== k) R.fr = { k, planes: MC.PF.frustum(W, H, HY, F) };
    return R.fr.planes;
  }
  function r3dFrameBegin() {
    const R = R3D_RCM; R.now = performance.now();
    if (!r3dOn()) { R.last = R.t0 = 0; return; }
    if (R.last) { const gap = R.now - R.last; if (gap < 1000) {   // (a longer gap is a pause, not a frame)
      R.hist[R.i] = gap; R.i = (R.i + 1) % R.hist.length; R.n = Math.min(R.n + 1, R.hist.length); R.gap = MC.PF.ema(R.gap, gap, R.a); } }
    R.last = R.t0 = R.now; R.t3d = 0; R.build.spent = 0; R.stats = r3dZero(); R3D.fresh = true;   // (the frame's depth starts clear: 08r_r3d.js)
  }
  function r3dFrameEnd() {
    const R = R3D_RCM; if (!R.t0 || !r3dOn()) return;
    const now = performance.now(), work = now - R.t0; R.frames++;
    R.work = MC.PF.ema(R.work, work, R.a); R.work3d = MC.PF.ema(R.work3d, R.t3d, R.a);
    R.Q = R.hold != null ? R.hold : R.pid.update(R.target - R.work);
    r3dChannels(R.Q);
    // resolution: the 3D's share of the budget is what's left after the rest of the frame; only its pixels scale (∝ s²).
    // It comes down at most twice a second, never below the floor its channel allows, and goes back up at once.
    const floor = R.sMin + (1 - R.sMin) * R.ch.resolution;
    if (floor > R.scale + 1e-9) { R.scale = Math.min(1, Math.ceil(floor * 20) / 20); r3dResize(); }
    else if (now - R.resAt > 500) {
      R.resAt = now;
      const left = Math.max(1, R.target - Math.max(0, R.work - R.work3d)), s = Math.min(1, Math.ceil(Math.max(floor, MC.PF.dynRes(R.scale, left, Math.max(0.1, R.work3d), R.sMin)) * 20) / 20);
      if (Math.abs(s - R.scale) > 0.04) { R.scale = s; r3dResize(); }
    }
    // particles: the requests of this frame, shared out for the next by importance, under B × the channel's quality
    const P = R.parts, req = [...P.want.entries()];
    if (req.length) { const al = MC.PF.particles(req.map(([, w]) => w), P.B * Math.max(0.15, R.ch.particles)); req.forEach(([k], i) => P.got.set(k, al[i])); P.want.clear(); }
    // the set pieces that waited: the most visible first, as far as what's left of this frame's build budget goes
    if (R.pend.size) {
      const list = [...R.pend.values()].sort((a, b) => b.prio - a.prio); R.pend.clear();
      const t0 = performance.now();
      for (const p of list) { if (performance.now() - t0 > R.build.end) break; p.make(); }
    }
  }
  // may a new set piece be cut now? If this frame's budget is spent it waits (painted meanwhile) with its priority
  function r3dMayBuild(key, prio, make) {
    const R = R3D_RCM;
    if (prio === Infinity || R.build.spent < R.build.frame) return true;
    const p = R.pend.get(key); if (!p || p.prio < prio) R.pend.set(key, { prio, make });
    R.stats.deferred++; return false;
  }
  function r3dBuilt(t0) { const R = R3D_RCM, dt = performance.now() - t0; R.build.spent += dt; R.t3d += dt; R.stats.built++; }
  // how much of a set piece to show in 3D: 0 paint it, 1 build it, between the two crossfading; −1 it's out of view
  // (draw nothing). k: the thing in the world (its state is kept against it); x, y: its foot on screen; cw × ch its
  // painting in canvas units with the foot at foot; sc: pixels per canvas unit at the foot.
  function r3dWorth(k, x, y, cw, ch, foot, sc) {
    const R = R3D_RCM, S = R.stats, PF = MC.PF;
    // its bounding sphere round the foot, in camera space with one canvas unit as the unit (the planes through the eye
    // don't care about scale), reaching the painting's farthest corner whichever way it's flipped
    const r = Math.hypot(Math.max(foot[0], cw - foot[0]), Math.max(foot[1], ch - foot[1])) * 1.15;
    if (PF.outside(r3dFrustum(), [(x - W / 2) / sc, -(y - HY) / sc, -F / sc], r)) { S.culled++; return -1; }
    const E = R3D_SETS.depth * Math.min(cw, ch * 0.8) * sc;
    let st = R.W.get(k); if (!st) R.W.set(k, (st = r3dFirstSeen(E)));
    R.E = E;   // (the priority of a build this asks for: the error it would fix)
    return r3dFade(st, E);
  }
  // the threshold now, a thing's state when first seen (as it is, no fade), and its weight: the dead zone, then a
  // quarter-second crossfade at each switch
  const r3dT = () => R3D_RCM.T[1] + (R3D_RCM.T[0] - R3D_RCM.T[1]) * R3D_RCM.ch.distant;
  const r3dFirstSeen = E => { const T = r3dT(); return { on: MC.PF.hysteresis(false, E, T, T * R3D_RCM.D), t: -1e9 }; };
  function r3dFade(st, E) {
    const R = R3D_RCM, T = r3dT(), on = MC.PF.hysteresis(st.on, E, T, T * R.D);
    if (on !== st.on) { st.on = on; st.t = R.now; }
    const m = MC.MO.smoothstep((R.now - st.t) / R.fade), w = on ? m : 1 - m;
    if (w <= 0) R.stats.painted++; else if (w >= 1) R.stats.in3d++; else R.stats.morph++;
    return w;
  }
  // the same for a live piece that isn't protected (wildlife, sea life, the cat, the cast): its depth thick metres at
  // zc metres shows as E = thick·F/zc pixels; a fish a few pixels long gains nothing from being cut out
  function r3dLiveWorth(key, E) {
    const R = R3D_RCM; let st = R.LW.get(key);
    if (!st) { if (R.LW.size > 3000) R.LW.clear(); R.LW.set(key, (st = r3dFirstSeen(E))); }
    return r3dFade(st, E);
  }
  // a live piece's re-cut rate: 12 a second (on twos) while there's room; as the animation channel gives, the less
  // important pieces slow to 4, and the protected ones never do: Morty's things (hats, wings, launcher), the ring's
  // support (anchor, pole), what the skull can hit (targets, obstacles, hazards, the encounter, the power-up, the cans)
  // and the bosses
  const R3D_KEEP = /^(boss|anchor|pole|hat|wings|launcher|tg|ob|hz|enc|pickup|cans)/;
  function r3dTraceHz(key, share) {
    const I = R3D_KEEP.test(key) ? 1 : clamp(Math.sqrt(share) * 2.5, 0.15, 1), q = R3D_RCM.ch.animation;
    return MC.PF.hz(1 - (1 - q) * (1 - I), 4, R3D_LIVE.fps);
  }
  // an effect asks for n particles (importance 0 … 1) and gets its share, worked out at the end of the last frame
  function r3dParticles(key, n, importance) {
    const P = R3D_RCM.parts; P.want.set(key, { want: n, importance });
    const g = P.got.get(key); return g == null ? n : Math.min(n, g);
  }
  // what the tools and the spec read
  function r3dPerf() {
    const R = R3D_RCM, gaps = Array.from(R.hist.slice(0, R.n)), st = MC.PF.stats(gaps, R.target);
    const share = R.work ? clamp((R.work3d || 0) / R.work, 0, 1) : 0;
    const nF = Math.max(1, R.frames - R.costFrames), cost = Object.entries(R.cost).map(([k, v]) => [k, +(v / nF).toFixed(2)]).sort((a, b) => b[1] - a[1]).slice(0, 12);   // (ms a frame per live piece since the last report)
    R.cost = {}; R.costFrames = R.frames;
    return { cost, Q: R.Q, ch: { ...R.ch }, give: R3D_GIVE.slice(), scale: R.scale, pr: R3D.pr, gap: R.gap, work: R.work, work3d: R.work3d, share3d: share, amdahl2x: MC.PF.amdahl(share, 2),
      frames: R.frames, n: R.n, parts: Object.fromEntries(R.parts.got), median: st.median, p95: st.p95, p99: st.p99, worst: st.worst, jank: st.jank, T: R.T[1] + (R.T[0] - R.T[1]) * R.ch.distant, ...R.stats, pending: R.pend.size,
      textures: R3D.gl ? R3D.gl.info.memory.textures : 0, geometries: R3D.gl ? R3D.gl.info.memory.geometries : 0, cached: Object.keys(R3D.cache).length, scene: (() => { let n = 0; if (R3D.scene) R3D.scene.traverse(() => n++); return n; })(), calls: R3D.gl ? R3D.gl.info.render.calls : 0 };
  }
