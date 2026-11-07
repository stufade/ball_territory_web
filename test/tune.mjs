// Подстройка баланса: меняем скорость заряда силы (PACE) так, чтобы каждая стихия выигрывала 20-30% матчей на четверых.
// node test/tune.mjs [матчей на попытку] [попыток]  -> печатает PACE для public/game.js
// node test/tune.mjs duel [повторов каждой пары] [попыток] -> DUEL_PACE: каждая стихия выигрывает 40-60% раундов 1 на 1
import { Game, NEL, TITLE, PACE, DUEL_PACE, DUEL_ROUND, pickFree } from "../public/game.js";
const DUEL = process.argv[2] === "duel", args = process.argv.slice(DUEL ? 3 : 2);
const R = +args[0] || (DUEL ? 4 : 2000), TRIES = +args[1] || 8;
const K = DUEL ? DUEL_PACE : PACE, LO = DUEL ? 40 : 20, HI = DUEL ? 60 : 30, MID = (LO + HI) / 2;
function duelRates() {
  const wins = new Array(NEL).fill(0), games = new Array(NEL).fill(0);
  for (let a = 0; a < NEL; a++) for (let b = a + 1; b < NEL; b++) for (let i = 0; i < R; i++) {
    const g = new Game([{ e: a, ctl: null }, { e: b, ctl: null }], { round: DUEL_ROUND, pace: DUEL_PACE });
    g.launch();
    while (!g.S.done) { g.step(); g.drain(); }
    const c = g.S.counts; games[a]++; games[b]++;
    if (c[a] > c[b]) wins[a]++; else if (c[b] > c[a]) wins[b]++; else { wins[a] += .5; wins[b] += .5; }
  }
  return wins.map((w, e) => 100 * w / games[e]);
}
function rates() {
  if (DUEL) return duelRates();
  const wins = new Array(NEL).fill(0), games = new Array(NEL).fill(0);
  for (let r = 0; r < R; r++) {
    const used = [];
    for (let i = 0; i < 4; i++) used.push(pickFree(used));
    const g = new Game(used.map(e => ({ e, ctl: null })));
    g.launch();
    while (!g.S.done) { g.step(); g.drain(); }
    const c = g.S.counts, top = used.reduce((a, e) => c[e] > c[a] ? e : a, used[0]);
    wins[top]++; for (const e of used) games[e]++;
  }
  return wins.map((w, e) => 100 * w / games[e]);
}
for (let t = 1; t <= TRIES; t++) {
  const wr = rates(), out = wr.filter(v => v < LO || v > HI).length;
  console.log(`try ${t}: outside ${LO}-${HI}%: ${out}  min ${Math.min(...wr).toFixed(1)}  max ${Math.max(...wr).toFixed(1)}`);
  console.log("  " + TITLE.map((n, e) => `${n} ${wr[e].toFixed(0)}`).join("  "));
  if (!out) break;
  for (let e = 0; e < NEL; e++) {
    if (wr[e] >= LO + 1 && wr[e] <= HI - 1) continue;
    const k = Math.max(.75, Math.min(1.35, (MID / Math.max(5, wr[e])) ** (DUEL ? 1.2 : .7)));
    K[e] = Math.max(.35, Math.min(3, +(K[e] * k).toFixed(2)));
  }
  console.log("  PACE " + JSON.stringify(K));
}
console.log(`const ${DUEL ? "DUEL_PACE" : "PACE"} = ` + JSON.stringify(K) + ";");
