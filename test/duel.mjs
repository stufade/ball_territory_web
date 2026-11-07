// Дуэль в комнате через настоящий сервер: два игрока, по 3 шара, все раунды до конца.
// node test/duel.mjs [https://адрес]
const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/^http/, "ws");
const code = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, "x");
const wait = ms => new Promise(r => setTimeout(r, ms));
function client(name) {
  return new Promise(resolve => {
    const ws = new WebSocket(`${base}/ws?room=${code}`);
    const c = { name, ws, me: "", lobby: null, last: null, phases: [], rounds: new Set(), dmSeen: null };
    c.send = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
    ws.onopen = () => { c.send({ t: "hello", name, cid: "test" + name.toLowerCase() }); resolve(c); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === "you") c.me = m.id;
      if (m.t === "lobby") c.lobby = m;
      if (m.t !== "s") return;
      const s = m.s; c.last = s;
      if (c.phases.at(-1) !== s.ph) c.phases.push(s.ph);
      if (s.dm) { c.rounds.add(s.dm.round); c.dmSeen = s.dm; }
      if (s.ph === "aim" && c.aimedFor !== s.m) { c.aimedFor = s.m; c.send({ t: "launch", d: [0.6, 0.8] }); }
      const mine = (s.b || []).find(r => r[18] === c.me);
      if (s.ph === "play" && mine && mine[6] >= 1 && Date.now() - (c.pressAt || 0) > 400) { c.pressAt = Date.now(); c.send({ t: "press" }); }
    };
  });
}
const A = await client("Host"), B = await client("Friend");
await wait(500);
A.send({ t: "mode", m: "duel" }); await wait(300);
B.send({ t: "mode", m: "ffa" }); await wait(300);  // не хозяин: игнор
A.send({ t: "team", team: [0, 1, 2] }); B.send({ t: "team", team: [2, 3, 4, 5] }); await wait(500);
const seats = A.lobby.seats.map(s => [s.name, s.team]);
console.log("mode", A.lobby.mode, "seats", JSON.stringify(seats));
A.send({ t: "start" });
const t0 = Date.now();
while (!(A.last && A.last.ph === "end" && B.last && B.last.ph === "end") && Date.now() - t0 > -1 && Date.now() - t0 < 300000) await wait(300);
const dm = A.last.dm;
console.log("phases A", A.phases.join(">"));
console.log("rounds", dm.round, "log", JSON.stringify(dm.log), "idx", JSON.stringify(dm.idx), "winner", dm.winner, "names", JSON.stringify(dm.names));
console.log("same end for both:", JSON.stringify(A.last.dm) === JSON.stringify(B.last.dm), "seconds", ((Date.now() - t0) / 1000).toFixed(0));
A.ws.close(); B.ws.close();
