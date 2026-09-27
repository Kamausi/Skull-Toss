// The balance check (v62): can a person actually finish the Adventure? A model player plays whole runs. It aims
// the way a person does with the guide on: it leads the ring to where it will be (the ideal aim, leadAim), then misses
// by as much as a person would, from a steady hand (σ, metres in the ring's plane), from timing (σ, seconds: the ring
// is where it will be a moment early or late) and now and then a throw that's just off. It waits, as people do, for
// a moment when the ring will arrive slowly (the end of a swing), but never long. Hazards, bosses, rings with a
// character and the rest are the game's own; nothing here is special-cased.
//   python3 src/build.py --dev && node tools/balance.mjs [runs, default 6] [skill: novice|casual|average|good|perfect] [plus] [nocont] [permap]
// permap: each map from its own checkpoint (the v62 way back in after a lost run), [runs] tries of each
// Prints, per map, how many runs got there and finished it, the accuracy there, and where runs ended.
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const RUNS = Number(args[0]) || 6, SKILL = args[1] || "average", PLUS = args.includes("plus"), CONT = !args.includes("nocont"), PERMAP = args.includes("permap");
const SEED = Number((args.find(a => /^seed=/.test(a)) || "seed=1933").slice(5));
const SKILLS = {   // aim σ (m), timing σ (s), how often a throw is just off, and how long they'll wait for a slow ring (s)
  novice: { aim: 0.17, time: 0.11, off: 0.08, wait: 1.2 },   // (a first-time player)
  casual: { aim: 0.13, time: 0.085, off: 0.05, wait: 1.6 },
  average: { aim: 0.10, time: 0.065, off: 0.035, wait: 2.2 },
  good: { aim: 0.075, time: 0.05, off: 0.02, wait: 2.8 },
  perfect: { aim: 0, time: 0, off: 0, wait: 3 }   // (no error at all: a check on the model itself)
};
const S = SKILLS[SKILL]; if (!S) { console.log(`unknown skill ${SKILL}`); process.exit(2); }
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(pathToFileURL(join(ROOT, "index-dev.html")).href);
await page.waitForFunction(() => window.SkullToss && window.SkullToss.debug && window.SkullToss.debug.sandbox);
const t0 = Date.now();
const out = await page.evaluate(([RUNS, S, PLUS, CONT, SEED, PERMAP]) => {
  const T = window.SkullToss.debug;
  let s = SEED >>> 0; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  T.sandbox(true); T.continues(CONT); T.fakeAds(false);
  const runs = [];
  for (let r = 0; r < (PERMAP ? RUNS * 8 : RUNS); r++) {
    const from = PERMAP ? r % 8 : 0;
    T.setStats({ bestStage: 9, plusStage: 9, bossKills: 8, storyClears: PLUS ? 1 : 0, bones: CONT ? 1400 : 0 });
    T.startAt(from, PLUS);
    const R = { maps: {}, end: null, throws: 0, conts: 0, won: false };
    const at = st => (R.maps[st.stage] = R.maps[st.stage] || { throws: 0, hits: 0, fights: { A: [0, 0], B: [0, 0], mini: [0, 0], boss: [0, 0] } });
    let guard = 0, waited = 0;
    while (T.state().state !== "over" && guard++ < 60000 && !(PERMAP && T.state().stage > from + 1)) {
      const st = T.state();
      const c = document.getElementById("continueBox");
      if (c && !c.hidden) { const b = document.getElementById("contBones"); if (CONT && b && !b.disabled) { b.click(); R.conts++; } else document.getElementById("contNo").click(); T.stepQuiet(0.1); continue; }
      if (st.state !== "ready" || st.paused) { T.stepQuiet(0.1); continue; }
      // wait (a little) for a moment when the ring will arrive slowly
      const tc = st.ring.z / (6 / 0.82), v = (() => { const a = T.ringAhead(tc), b = T.ringAhead(tc + 0.02); return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.02; })();
      if (v > 0.45 && waited < S.wait) { T.stepQuiet(1 / 30); waited += 1 / 30; continue; }
      if (T.volleyTold() && waited < S.wait * 3 + 3) { T.stepQuiet(1 / 30); waited += 1 / 30; continue; }   // (the boss is winding up a volley: wait for it, as the tell says)
      let L = null;
      if (T.bank().need) {   // a sealed ring: off the board, the way the guide shows it, once the ring swings where a bank can reach
        const Bd = T.boardsNow()[0];
        if (Bd) {
          const sd = Math.sign(Bd.x), r1 = T.ringAhead(tc * 1.1), u = sd * r1.x;
          if ((u < 0.55 || u > 1.3) && waited < S.wait * 3) { T.stepQuiet(1 / 30); waited += 1 / 30; continue; }
          L = T.leadAim(sd * (2 + (1.29 - u) / 0.8), r1.y); if (L && !T.bankedAim(L.AX, L.AY)) L = null;
        }
      }
      L = L || T.leadAim(); if (!L) { T.stepQuiet(0.1); continue; }
      if (T.obThreat(L.AX, L.AY) && waited < S.wait * 3 + 3) { T.stepQuiet(1 / 30); waited += 1 / 30; continue; }   // (the machinery would be in the way: let it pass)
      if (T.seedThreat(L.AX, L.AY) && waited < S.wait * 3 + 3) { T.stepQuiet(1 / 30); waited += 1 / 30; continue; }   // (it would fly into a seed: let them pass)
      const tau = gauss() * S.time, a = T.ringAhead(L.t), b = T.ringAhead(L.t + tau);
      let AX = L.AX + (b.x - a.x) * 6 / Math.max(1, a.z) + gauss() * S.aim, AY = L.AY + (b.y - a.y) + gauss() * S.aim;
      if (rnd() < S.off) { AX += gauss() * 0.5; AY += gauss() * 0.4; }
      const M = at(st), ph = st.phase in M.fights ? st.phase : "A", hits0 = st.hits;
      if (!T.throwAt(AX, AY)) { T.stepQuiet(0.1); continue; }
      waited = 0;
      R.throws++; M.throws++; M.fights[ph][0]++;
      for (let k = 0; k < 40 && T.state().state === "flying"; k++) T.stepQuiet(0.1);
      const now = T.state(); if (now.hits > hits0) { M.hits++; M.fights[ph][1]++; } else { const k = (now.lastResult && now.lastResult.kind) || "?"; M.miss = M.miss || {}; M.miss[ph + ":" + k] = (M.miss[ph + ":" + k] || 0) + 1; }
    }
    if (guard >= 60000) { const st = T.state(); R.stall = { state: st.state, phase: st.phase, h: st.stageHits, seeds: T.seedsLive(), boss: T.boss(), bank: T.bank(), ring: st.ring, cine: st.cine, paused: st.paused }; }
    R.from = from + 1; const e = T.state(); R.end = { stage: e.stage, phase: e.phase, stageHits: e.stageHits, hits: e.hits }; R.won = !!T.runStats().story;
    runs.push(R); T.toTitle();
  }
  return runs;
}, [RUNS, S, PLUS, CONT, SEED, PERMAP]);
await browser.close();
const secs = Math.round((Date.now() - t0) / 1000);
console.log(`${SKILL}${PLUS ? " · Adventure+" : " · Adventure"}${CONT ? " · with continues" : " · no continues"} · ${RUNS} runs · ${secs} s`);
if (PERMAP) {   // each map from its checkpoint (three skulls, as a run from there starts): how often it's cleared, and the tries the whole story takes
  let tries = 0; const line = [];
  for (let m = 1; m <= 8; m++) { const R = out.filter(r => r.from === m), c = R.filter(r => r.won || r.end.stage > m).length; line.push(`map ${m} ${c}/${R.length}`); tries += R.length / Math.max(0.5, c); }
  console.log(line.join(" · ")); console.log(`about ${tries.toFixed(1)} tries of a map to finish the story from its checkpoints`);
  for (const e of errors) console.log("page error: " + e);
  process.exit(0);
}
console.log(`finished: ${out.filter(r => r.won).length}/${RUNS}`);
for (let m = 1; m <= 8; m++) {
  const reach = out.filter(r => r.maps[m]), pass = out.filter(r => r.won || r.end.stage > m);
  if (!reach.length) continue;
  const sum = k => reach.reduce((n, r) => n + r.maps[m].fights[k][0], 0), got = k => reach.reduce((n, r) => n + r.maps[m].fights[k][1], 0);
  const pct = k => (sum(k) ? `${Math.round((100 * got(k)) / sum(k))}%` : "-");
  const miss = {}; for (const r of reach) for (const [k, n] of Object.entries(r.maps[m].miss || {})) miss[k] = (miss[k] || 0) + n;
  console.log(`map ${m}: reached ${reach.length}, cleared ${pass.length} · accuracy A ${pct("A")}  mini ${pct("mini")}  B ${pct("B")}  boss ${pct("boss")} · misses ${Object.entries(miss).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}
console.log("ended at: " + out.map(r => (r.won ? "WON" : `${r.end.stage}${r.end.phase}${r.end.stageHits}`)).join(" "));
console.log("continues used: " + out.map(r => r.conts).join(" "));
for (const r of out) if (r.stall) console.log("STALL " + JSON.stringify(r.stall));
for (const e of errors) console.log("page error: " + e);
