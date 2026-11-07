// Баланс и таблица «кто против кого»: node test/balance.mjs 3000
import { Game, NEL, TITLE, pickFree } from "../public/game.js";
const R = +process.argv[2] || 2000, wins = new Array(NEL).fill(0), games = new Array(NEL).fill(0);
const above = [...Array(NEL)].map(() => new Array(NEL).fill(0)), met = [...Array(NEL)].map(() => new Array(NEL).fill(0));
let rx = 0;
for (let r = 0; r < R; r++) {
  const used = [];
  for (let i = 0; i < 4; i++) used.push(pickFree(used));
  const g = new Game(used.map(e => ({ e, ctl: null })));
  g.launch();
  while (!g.S.done) { g.step(); g.drain(); }
  const c = g.S.counts, pl = g.S.players, top = pl.reduce((a, e) => c[e] > c[a] ? e : a, pl[0]);
  wins[top]++; rx += g.S.reactions;
  for (const a of pl) { games[a]++; for (const b of pl) if (a !== b) { met[a][b]++; if (c[a] > c[b]) above[a][b]++; } }
}
console.log("reactions/round", (rx / R).toFixed(1));
console.log(TITLE.map((n, e) => `${n} ${(100 * wins[e] / games[e]).toFixed(1)}`).join("  "));
const S = [], Wk = [];
for (let a = 0; a < NEL; a++) {
  const rows = [...Array(NEL).keys()].filter(b => b !== a && met[a][b] > 20).map(b => [b, 100 * above[a][b] / met[a][b]]);
  S.push(rows.filter(r => r[1] >= 60).sort((x, y) => y[1] - x[1]).slice(0, 3).map(r => r[0]));
  Wk.push(rows.filter(r => r[1] <= 40).sort((x, y) => x[1] - y[1]).slice(0, 3).map(r => r[0]));
}
console.log("const STRONG = " + JSON.stringify(S) + ";");
console.log("const WEAK = " + JSON.stringify(Wk) + ";");
