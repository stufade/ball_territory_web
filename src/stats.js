// Статистика игры: один общий Durable Object с SQLite. Пишут браузеры (шаги, одиночные матчи) и комнаты (матчи с друзьями).
// Хранится только случайный id устройства, без имён и Telegram-аккаунтов. Сводка: /stats, сырые цифры: /stats.json.
import { DurableObject } from "cloudflare:workers";
import { NEL, TITLE } from "../public/game.js";

const KINDS = new Set(["open", "tut", "solo_start", "solo_end", "tut_end", "room_create", "room_join", "room_start", "duel_start", "duel_round"]);
export const TUT_STEPS = ["goal", "aim", "paint", "steer", "spikes", "power", "powerOk", "bush", "rx", "rxOk", "final", "play", "done"];
const day = ts => new Date(ts + 3 * 36e5).toISOString().slice(0, 10);  // дни по Москве
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v) || 0));

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (ts INTEGER, day TEXT, cid TEXT, kind TEXT, v TEXT, tg INTEGER);
      CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, mode TEXT, humans INTEGER, reactions INTEGER);
      CREATE TABLE IF NOT EXISTS seats (match INTEGER, e INTEGER, human INTEGER, place INTEGER, pct REAL, kills INTEGER, powers INTEGER, cid TEXT);
      CREATE INDEX IF NOT EXISTS ev_day ON events(day, kind);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);`);
    // до запуска в базе были только проверочные записи: стираем их один раз
    if (!this.sql.exec("SELECT v FROM meta WHERE k = 'clean1'").toArray().length) {
      this.sql.exec("DELETE FROM events; DELETE FROM matches; DELETE FROM seats; INSERT INTO meta VALUES ('clean1', '1');");
    }
  }

  // событие из браузера; неизвестное и кривое молча выбрасываем
  event(m) {
    if (!m || !KINDS.has(m.kind)) return;
    const cid = String(m.cid || "").replace(/[^a-z0-9]/g, "").slice(0, 12), ts = Date.now();
    if (!cid || cid.startsWith("test")) return;  // проверки не попадают в цифры
    let v = "";
    if (m.kind === "tut") v = TUT_STEPS.includes(m.v) ? m.v : "";
    else if (m.kind === "solo_start" || m.kind === "room_start") v = String(int(m.v, 0, NEL - 1));
    this.sql.exec("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)", ts, day(ts), cid, m.kind, v, m.tg ? 1 : 0);
    const mode = { solo_end: "solo", tut_end: "tut", duel_round: "duel" }[m.kind];
    if (mode && Array.isArray(m.seats)) this.match({ mode, reactions: m.reactions, seats: m.seats, cid });
  }

  // матч: от комнаты (сервер сам знает итог) или из одиночной игры
  match(m) {
    const seats = (Array.isArray(m.seats) ? m.seats : []).slice(0, 4).filter(s => s && s.e >= 0 && s.e < NEL);
    if (seats.length < 2) return;
    const people = seats.filter(s => s.human);
    if (people.length && people.every(s => String(s.cid || m.cid || "").startsWith("test"))) return;
    const ts = Date.now(), humans = seats.filter(s => s.human).length;
    const id = this.sql.exec("INSERT INTO matches (ts, day, mode, humans, reactions) VALUES (?, ?, ?, ?, ?) RETURNING id",
      ts, day(ts), String(m.mode).slice(0, 8), humans, int(m.reactions, 0, 999)).one().id;
    for (const s of seats) {
      this.sql.exec("INSERT INTO seats VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, s.e | 0, s.human ? 1 : 0, int(s.place, 1, 4),
        Math.max(0, Math.min(100, +s.pct || 0)), int(s.kills, 0, 99), int(s.powers, 0, 99), s.human ? String(s.cid || m.cid || "").slice(0, 12) : "");
    }
  }

  summary() {
    const q = (s, ...a) => this.sql.exec(s, ...a).toArray();
    const since = day(Date.now() - 13 * 864e5), week = day(Date.now() - 6 * 864e5);
    const days = q(`SELECT day,
        COUNT(DISTINCT cid) AS players,
        SUM(kind = 'open') AS opens,
        SUM(kind = 'solo_start') AS solo_starts,
        SUM(kind = 'solo_end') AS solo_ends,
        SUM(kind = 'room_create') AS rooms,
        SUM(kind = 'duel_start') AS duels,
        SUM(kind = 'tut' AND v = 'goal') AS tut_starts,
        SUM(kind = 'tut' AND v = 'done') AS tut_done
      FROM events WHERE day >= ? GROUP BY day ORDER BY day DESC`, since);
    const roomMatches = q("SELECT day, COUNT(*) AS n FROM matches WHERE mode = 'room' AND day >= ? GROUP BY day", since);
    for (const d of days) d.room_matches = (roomMatches.find(r => r.day === d.day) || {}).n || 0;
    const tut = TUT_STEPS.map(s => ({ step: s, players: q("SELECT COUNT(DISTINCT cid) AS n FROM events WHERE kind = 'tut' AND v = ?", s)[0].n }));
    const els = q(`SELECT e,
        SUM(human) AS picks,
        SUM(human AND place = 1) AS human_wins,
        AVG(CASE WHEN human THEN place END) AS human_place,
        COUNT(*) AS seats,
        SUM(place = 1) AS wins
      FROM seats s JOIN matches m ON m.id = s.match WHERE m.mode IN ('solo', 'room') GROUP BY e`);
    const duel = new Map(q(`SELECT e, COUNT(*) AS n, SUM(place = 1) AS w FROM seats s JOIN matches m ON m.id = s.match WHERE m.mode = 'duel' GROUP BY e`).map(r => [r.e, r]));
    const byE = new Map(els.map(r => [r.e, r]));
    const elements = TITLE.map((name, e) => {
      const r = byE.get(e) || { picks: 0, human_wins: 0, human_place: null, seats: 0, wins: 0 };
      return { e, name, picks: r.picks || 0, humanWinPct: r.picks ? Math.round(100 * r.human_wins / r.picks) : null,
        humanPlace: r.human_place ? +r.human_place.toFixed(2) : null, seats: r.seats, winPct: r.seats ? Math.round(100 * r.wins / r.seats) : null,
        duelRounds: (duel.get(e) || {}).n || 0, duelWinPct: duel.get(e) ? Math.round(100 * duel.get(e).w / duel.get(e).n) : null };
    });
    const total = q(`SELECT COUNT(DISTINCT cid) AS players, SUM(kind = 'open') AS opens FROM events`)[0];
    const weekPlayers = q("SELECT COUNT(DISTINCT cid) AS n FROM events WHERE day >= ?", week)[0].n;
    const returning = q(`SELECT COUNT(*) AS n FROM (SELECT cid FROM events GROUP BY cid HAVING COUNT(DISTINCT day) >= 2)`)[0].n;
    const matches = q(`SELECT mode, COUNT(*) AS n, AVG(reactions) AS rx FROM matches GROUP BY mode`);
    const tg = q(`SELECT SUM(tg) AS tg, COUNT(*) AS n FROM events WHERE kind = 'open'`)[0];
    return { players: total.players || 0, weekPlayers, returning, opens: total.opens || 0, telegramOpens: tg.tg || 0, matches, days, tutorial: tut, elements };
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST") {
      try { const m = JSON.parse((await req.text()).slice(0, 4000)); this.event(m); } catch (e) { /* мусор не пишем */ }
      return new Response(null, { status: 204 });
    }
    const s = this.summary();
    if (url.pathname.endsWith(".json")) return Response.json(s);
    return new Response(page(s), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
}

const esc = v => String(v ?? "—").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
function table(head, rows) {
  return `<table><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
}
function page(s) {
  const first = s.tutorial[0].players || 0;
  const mm = Object.fromEntries(s.matches.map(m => [m.mode, m]));
  const els = s.elements.slice().sort((a, b) => b.picks - a.picks || b.seats - a.seats);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ball Territory stats</title><style>
:root{--bg:#11132a;--fg:#fff;--mut:#aab0e1;--line:#2e325c}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.4 Arial,sans-serif;max-width:900px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p{color:var(--mut);margin:4px 0}
.kpi{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.kpi div{background:#1f2244;padding:10px 14px;border-radius:8px;min-width:120px}
.kpi b{display:block;font-size:26px}.kpi span{color:var(--mut);font-size:13px}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--mut);font-weight:normal}
th:first-child,td:first-child{text-align:left}
</style></head><body>
<h1>Ball Territory: статистика</h1><p>Обновляется при каждом открытии страницы. Игроки считаются по устройству, без имён. Дни по московскому времени.</p>
<div class="kpi">
<div><b>${s.players}</b><span>игроков всего</span></div>
<div><b>${s.weekPlayers}</b><span>за 7 дней</span></div>
<div><b>${s.returning}</b><span>вернулись в другой день</span></div>
<div><b>${s.opens}</b><span>открытий, из них ${s.telegramOpens} в Telegram</span></div>
<div><b>${(mm.solo || {}).n || 0} / ${(mm.room || {}).n || 0}</b><span>доиграно матчей: одиночных / с друзьями</span></div>
<div><b>${(mm.duel || {}).n || 0}</b><span>раундов дуэли</span></div>
</div>
<h2>По дням (14 дней)</h2><div class="wrap">${table(["День", "Игроков", "Открытий", "Начали одиночный", "Доиграли одиночный", "Дуэлей", "Комнат", "Матчей с друзьями", "Начали обучение", "Прошли обучение"],
  s.days.map(d => [d.day, d.players, d.opens, d.solo_starts, d.solo_ends, d.duels, d.rooms, d.room_matches, d.tut_starts, d.tut_done]))}</div>
<h2>Обучение: где бросают</h2><p>Сколько игроков дошло до каждого шага.</p><div class="wrap">${table(["Шаг", "Игроков", "От начала"],
  s.tutorial.map(t => [t.step, t.players, first ? Math.round(100 * t.players / first) + "%" : "—"]))}</div>
<h2>Шары</h2><p>Первые пять колонок - матчи на четверых: «выбирали» и «побед у людей» только по людям, «побед всего» вместе с ботами (в среднем 25%).
Дуэль - раунды один на один (в среднем 50%). Обучение не входит.</p><div class="wrap">${table(["Шар", "Выбирали", "Побед у людей", "Среднее место у людей", "Побед всего", "Матчей всего", "Дуэль: раундов", "Дуэль: побед"],
  els.map(r => [r.name, r.picks, r.humanWinPct === null ? "—" : r.humanWinPct + "%", r.humanPlace, r.winPct === null ? "—" : r.winPct + "%", r.seats,
    r.duelRounds, r.duelWinPct === null ? "—" : r.duelWinPct + "%"]))}</div>
</body></html>`;
}
