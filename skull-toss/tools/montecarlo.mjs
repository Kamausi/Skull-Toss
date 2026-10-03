// The Monte Carlo check (v68, the owner's math toolkit): how forgiving is each map's ring, measured rather than felt?
// For each map it runs n throws through the game's own physics (the ring held where it stands at random along its
// path, the aim jittered by a person's hand: σ metres in the ring's plane) and estimates P(make) with its standard
// error, using the math core's seeded sampler (MC.monteCarlo), so the same seed gives the same numbers every time.
// With `sweep` it also measures the success region round a perfect aim: the σ at which half the throws still go in
// (six bisection steps a map: slow, about half an hour for all eight).
//   python3 src/build.py --dev && node tools/montecarlo.mjs [n, default 300] [sigma, default 0.10] [sweep] [hits=24]
// hits: how far into the map (the ring shrinks along each map's curve, blueprint.json)
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), N = Number(args[0]) || 300, SIGMA = Number(args[1]) || 0.1, SWEEP = args.includes("sweep"), HITS = Number((args.find(a => /^hits=/.test(a)) || "hits=24").slice(5));
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto(pathToFileURL(join(ROOT, "index-dev.html")).href);
await page.waitForFunction(() => window.SkullToss && window.SkullToss.debug && window.SkullToss.debug.sandbox);
const run = (map, n, sigma, seed) => page.evaluate(([map, n, sigma, seed, hits]) => {
  const T = window.SkullToss.debug, M = T.mathCore(), C = T.constants;
  T.sandbox(true); T.setStats({ bestStage: 9 }); T.start(); T.setStage(map); T.calm(); T.setHits(hits);
  const ready = () => { for (let i = 0; i < 80 && T.state().state !== "ready"; i++) T.step(0.1); return T.state().state === "ready"; };
  let refused = 0;
  const gauss = r => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  const res = M.monteCarlo(r => {
    const x = (r() * 2 - 1) * 1.1, y = C.RING_Y + (r() * 2 - 1) * 0.35;   // where the ring stands on this throw
    ready(); T.setHits(hits); T.freezeRing(x, y);
    if (!T.throwAt(x + gauss(r) * sigma, y + gauss(r) * sigma)) { refused++; return 0; }
    for (let i = 0; i < 60 && T.state().state !== "ready"; i++) T.step(0.1);
    return T.state().lastResult && T.state().lastResult.make ? 1 : 0;
  }, n, seed);
  res.refused = refused; return res;
}, [map, n, sigma, seed, HITS]);
console.log(`Monte Carlo: ${N} throws a map at hit ${HITS}, aim σ = ${SIGMA} m (the ring frozen at random along its path)`);
for (let m = 1; m <= 8; m++) {
  const r = await run(m, N, SIGMA, 1000 + m);
  let line = `map ${m}: P(make) = ${(r.mean * 100).toFixed(1)}% ± ${(r.se * 100).toFixed(1)}${r.refused ? ` (${r.refused} throws refused)` : ""}`;
  if (SWEEP) {   // bisection on σ for P(make) = 50%
    let lo = 0, hi = 0.4; for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2, q = await run(m, Math.max(60, N >> 2), mid, 77 + k); if (q.mean > 0.5) lo = mid; else hi = mid; }
    line += `   half the throws still go in up to σ ≈ ${((lo + hi) / 2 * 100).toFixed(1)} cm`;
  }
  console.log(line);
}
if (errors.length) console.log("page errors:\n  " + errors.join("\n  "));
await browser.close();
process.exit(errors.length ? 1 : 0);
