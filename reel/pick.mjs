// Выбор матча для рилса: перебираем зёрна, ищем бой, где «твой» шар побеждает и много зрелищного.
// node reel/pick.mjs 1500 > reel/plan.json
import { Game, NEL, TITLE, pickFree, seedRandom } from "../public/game.js";

const DT = 1 / 30;
const WOW = new Set(["BOOM", "DEVOUR", "PRISM", "FIRESTORM", "AVALANCHE", "CHAIN", "SHATTER", "TOXIC TIDE", "QUICKSAND", "BLAST",
  "TOXIC STORM", "SANDSTORM", "SLIME FLOOD", "FORGE", "WILDFIRE", "OBSIDIAN", "GEODE", "MYCELIUM", "EXPLOSION", "DETONATE",
  "FREEZE FRAME", "MIRROR", "DUNK", "HOURGLASS", "CORRUPT"]);
const SHOW = { kaboom: 4, glitch: 4, slowtime: 4, balance: 3, sonic: 3, six: 2, itsme: 3, hole: 3, rush: 2, phase: 2, gas: 2, pop: 1, crystal: 2, quake: 2, wave: 2, flash: 2 };
const NEW = new Set([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);

export function play(seed) {
  seedRandom(seed);
  const used = [];
  for (let i = 0; i < 4; i++) used.push(pickFree(used));
  const g = new Game(used.map(e => ({ e, ctl: null })));
  g.launch();
  const evs = [];
  while (!g.S.done) {
    g.step();
    for (const q of g.drain()) evs.push({ t: g.S.t, tick: g.S.tick, kind: q[1], d: q[2] });
  }
  const c = g.S.counts, top = used.reduce((a, e) => c[e] > c[a] ? e : a, used[0]);
  return { seed, players: used, winner: top, evs, counts: used.map(e => c[e]) };
}

function score(r) {
  const you = r.players[0];
  if (r.winner !== you) return null;
  const cands = [];
  for (const e of r.evs) {
    let sc = 0;
    if (e.kind === "rx") sc = (WOW.has(e.d.k) ? 3 : 1) + (e.d.by === you ? 2.5 : 0);
    else if (SHOW[e.kind] && (e.d.e === undefined || e.d.e === you || e.kind === "kaboom" || e.kind === "glitch")) sc = SHOW[e.kind] + (r.players[0] === e.d.e ? 2 : 0);
    else if (e.kind === "redirect" && e.d.e === you) sc = 5;
    if (sc) cands.push({ sc, t: e.t, tick: e.tick, kind: e.kind === "rx" ? e.d.k : e.kind, x: e.d.x, y: e.d.y });
  }
  cands.sort((a, b) => b.sc - a.sc);
  const picked = [], kinds = new Set();
  for (const c of cands) {
    if (c.t < 2.2 || c.t > 56.5 || kinds.has(c.kind)) continue;
    if (picked.every(p => Math.abs(p.t - c.t) > 3.6)) { picked.push(c); kinds.add(c.kind); }
    if (picked.length === 5) break;
  }
  const newCount = r.players.filter(e => NEW.has(e)).length;
  const total = picked.reduce((a, c) => a + c.sc, 0) + newCount * 3 + (picked.some(p => p.kind === "redirect") ? 3 : 0);
  return { total, picked: picked.sort((a, b) => a.t - b.t) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +process.argv[2] || 800;
  let best = null;
  for (let seed = 1; seed <= n; seed++) {
    const r = play(seed), s = score(r);
    if (s && (!best || s.total > best.s.total)) best = { r, s };
  }
  const { r, s } = best;
  // окна показа: начало боя, 5 моментов, последние 2 с
  const wins = [[1.3, 2.7], ...s.picked.map(p => p.kind === "redirect" ? [p.t - 1.6, p.t + 1.3] : [p.t - 1.1, p.t + 1.7]), [58, 60]];
  const merged = [];
  for (const [a, b] of wins) {
    if (merged.length && a <= merged[merged.length - 1][1] + .4) merged[merged.length - 1][1] = Math.max(b, merged[merged.length - 1][1]);
    else merged.push([a, b]);
  }
  const plan = { seed: r.seed, players: r.players, you: r.players[0], winner: r.winner, windows: merged, focus: s.picked,
    names: r.players.map(e => TITLE[e]) };
  console.error("seed", r.seed, plan.names.join(", "), "winner", TITLE[r.winner], "moments", s.picked.map(p => `${p.t.toFixed(1)} ${p.kind}`).join(" | "));
  console.log(JSON.stringify(plan, null, 1));
}
