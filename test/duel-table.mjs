// Кто кого в дуэли 1 на 1: каждая пара по R раундов. Печатает DSTRONG и DWEAK для public/game.js (подсветка в выборе команды).
// node test/duel-table.mjs [R]
import { Game, NEL, TITLE, DUEL_ROUND, DUEL_PACE } from "../public/game.js";
const R = +process.argv[2] || 10;
const w = [...Array(NEL)].map(() => new Array(NEL).fill(0));
for (let a = 0; a < NEL; a++) for (let b = a + 1; b < NEL; b++) for (let i = 0; i < R; i++) {
  const g = new Game([{ e: a, ctl: null }, { e: b, ctl: null }], { round: DUEL_ROUND, pace: DUEL_PACE });
  g.launch();
  while (!g.S.done) { g.step(); g.drain(); }
  const c = g.S.counts;
  if (c[a] > c[b]) w[a][b]++; else if (c[b] > c[a]) w[b][a]++; else { w[a][b] += .5; w[b][a] += .5; }
}
const pct = (a, b) => 100 * w[a][b] / R, all = [...Array(NEL).keys()];
const S = all.map(a => all.filter(b => b !== a && pct(a, b) >= 65).sort((x, y) => pct(a, y) - pct(a, x)).slice(0, 3));
const Wk = all.map(a => all.filter(b => b !== a && pct(a, b) <= 35).sort((x, y) => pct(a, x) - pct(a, y)).slice(0, 3));
console.log("overall:", TITLE.map((t, a) => `${t} ${Math.round(all.reduce((s, b) => s + (b === a ? 0 : pct(a, b)), 0) / (NEL - 1))}`).join("  "));
let hard = 0; for (const a of all) for (const b of all) if (a < b && (pct(a, b) >= 80 || pct(a, b) <= 20)) hard++;
console.log("pairs 80%+ one-sided:", hard, "of", NEL * (NEL - 1) / 2);
console.log("const DSTRONG = " + JSON.stringify(S) + ";");
console.log("const DWEAK = " + JSON.stringify(Wk) + ";");
