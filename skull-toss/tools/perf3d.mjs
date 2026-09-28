// The 3D renderer's frame report (v68, the owner's performance equations). For each map it draws 240 frames (four
// seconds' worth, one after another, as fast as they'll go: software WebGL is too slow for the real loop) with the
// 3D renderer on and its runtime complexity manager free (08rf_r3d_budget.js), and reports what it settled on and
// what a player would feel:
//   · Q (the governor's quality), the resolution scale, and each channel given up (distant, particles, animation,
//     resolution: in that order, Morty, the ring and the bosses never)
//   · frame pacing: the median, P95, P99 and worst gap between frames, and the jank (how far past the budget, on average)
//   · the 3D's share of the frame's work, and Amdahl's answer to "what if the 3D were twice as fast?"
//   · the set pieces: in 3D, painted (their depth wouldn't show), crossfading, culled (out of view)
// Headless Chromium renders WebGL in software, so the absolute numbers say nothing about a phone: compare maps
// with each other, and runs before and after a change. With `hold` the quality is pinned at 1 (everything in 3D).
//   python3 src/build.py --dev && node tools/perf3d.mjs [frames a map, default 240] [hold]
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), N = Number(args[0]) || 240, HOLD = args.includes("hold");
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(pathToFileURL(join(ROOT, "index-dev.html")).href);
await page.waitForFunction(() => window.SkullToss && window.SkullToss.debug && window.SkullToss.debug.sandbox);
const ok = await page.evaluate(hold => { const T = window.SkullToss.debug; T.sandbox(true); T.setStats({ bestStage: 9 }); T.r3d(true); T.r3dHold(hold ? 1 : null); return T.r3dState().ok; }, HOLD);
if (!ok) { console.log("no WebGL here: nothing to measure"); await browser.close(); process.exit(0); }
const f = (x, d = 1) => (x == null ? "–" : x.toFixed(d));
console.log(`3D frame report: ${N} frames a map, the governor ${HOLD ? "held at Q = 1" : "free"} (software WebGL: compare, don't read absolutely)`);
console.log("map   Q     scale  gave up                  median  P95    P99    worst  jank   3D share  2× 3D →  in 3D  painted  fading  culled");
const costs = [];
for (const m of (process.env.MAPS || "1,2,3,4,5,6,7,8").split(",").map(Number)) {
  const P = await page.evaluate(([m, N]) => { const T = window.SkullToss.debug; T.start(); T.setStage(m); T.calm(); for (let i = 0; i < N; i++) T.step(1 / 60); return T.r3dPerf(); }, [m, N]);
  const gave = P.give.filter(c => P.ch[c] < 1).map(c => `${c} ${Math.round((1 - P.ch[c]) * 100)}%`).join(", ") || "nothing";
  costs.push(`map ${m}: ` + (P.cost.map(([k, v]) => `${k} ${v}`).join(", ") || "none"));
  console.log(`${String(m).padEnd(6)}${f(P.Q, 2).padEnd(6)}${f(P.scale, 2).padEnd(7)}${gave.slice(0, 24).padEnd(25)}${f(P.median).padEnd(8)}${f(P.p95).padEnd(7)}${f(P.p99).padEnd(7)}${f(P.worst).padEnd(7)}${f(P.jank, 2).padEnd(7)}${(Math.round(P.share3d * 100) + "%").padEnd(10)}${(f(P.amdahl2x, 2) + "×").padEnd(9)}${String(P.in3d).padEnd(7)}${String(P.painted).padEnd(9)}${String(P.morph).padEnd(8)}${P.culled}`);
}
console.log("\nthe costliest live pieces, ms a frame (painting, cutting and queueing; MAPS=6,7 to run only those maps):\n  " + costs.join("\n  "));
await page.evaluate(() => { const T = window.SkullToss.debug; T.r3dHold(null); T.r3d(null); });
if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
await browser.close();
process.exit(errors.length ? 1 : 0);
