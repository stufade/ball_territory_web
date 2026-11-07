// Проверка комнаты: два игрока и зритель через настоящий сервер. node test/rooms.mjs [http://127.0.0.1:8787]
const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/^http/, "ws");
const code = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, "x");
function client(name, pickE) {
  return new Promise(resolve => {
    const ws = new WebSocket(`${base}/ws?room=${code}`);
    const c = { name, ws, me: "", lobby: null, snaps: 0, bytes: 0, last: null, taps: 0, redirects: 0, presses: 0, dirs: 0, gaps: [], at: 0, kinds: {} };
    const send = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
    c.send = send;
    ws.onopen = () => { send({ t: "hello", name, auto: false, prompts: true, cid: "test" + name.toLowerCase().slice(0, 6) }); resolve(c); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === "you") c.me = m.id;
      if (m.t === "lobby") { c.lobby = m; if (pickE >= 0 && !m.seats.some(s => s.id === c.me && s.e === pickE)) send({ t: "pick", e: pickE }); }
      if (m.t !== "s") return;
      const raw = e.data;
      const s = m.s; Object.assign(m, s); m.t = "s"; m.time = s.t;
      const now = Date.now();
      if (c.at) c.gaps.push(now - c.at);
      c.at = now; c.snaps++; c.bytes += raw.length; c.last = m;
      const myE = (m.b.find(r => r[18] === c.me) || [])[0];
      for (const q of m.ev) { c.kinds[q[1]] = (c.kinds[q[1]] || 0) + 1; if (q[1] === "tap") c.taps++; if (q[1] === "redirect" && q[2].e === myE) c.redirects++; }
      const mine = m.b.find(r => r[18] === c.me);
      if (!mine) return;
      if (m.ph === "aim" && !c.launched) { c.launched = true; send({ t: "launch", d: [0.6, 0.8] }); }
      if (m.ph === "play" && mine[5] && mine[6] >= 1 && now - (c.pressAt || 0) > 400) { c.pressAt = now; c.presses++; send({ t: "press" }); }
      if (m.ph === "play" && m.pu > m.time && !c.dirFor?.[m.pu]) { c.dirFor = { [m.pu]: 1 }; c.dirs++; send({ t: "dir", dx: -mine[13], dy: mine[14] }); }
      if (m.ph === "play" && m.fin && m.time - (c.finAt || 0) > .5) { c.finAt = m.time; c.dirs++; send({ t: "dir", dx: Math.random() - .5, dy: Math.random() - .5 }); }
    };
    ws.onerror = e => console.log(name, "error", e.message || e);
  });
}
const A = await client("Artem", 16), B = await client("Friend", 17);
await new Promise(r => setTimeout(r, 600));
console.log("lobby seats", JSON.stringify(A.lobby.seats.map(s => [s.name, s.e])), "host is A:", A.lobby.host === A.me);
B.send({ t: "start" });  // не хозяин: сервер должен проигнорировать
await new Promise(r => setTimeout(r, 400));
console.log("guest start ignored:", A.snaps === 0);
A.send({ t: "start" });
const t0 = Date.now();
await new Promise(r => { const iv = setInterval(() => { if ((A.last && A.last.ph === "end" && B.last && B.last.ph === "end") || Date.now() - t0 > 150000) { clearInterval(iv); r(); } }, 200); });
const V = await client("Viewer", -1);
await new Promise(r => setTimeout(r, 500));
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
for (const c of [A, B]) {
  console.log(c.name, "snaps", c.snaps, "median gap ms", med(c.gaps), "avg KB", (c.bytes / c.snaps / 1024).toFixed(2),
    "presses", c.presses, "taps seen", c.taps, "dirs", c.dirs, "my redirects", c.redirects, "phase", c.last.ph, "match s", ((Date.now() - t0) / 1000).toFixed(0));
}
console.log("same final map:", A.last.o === B.last.o, "kinds", JSON.stringify(A.kinds));
console.log("viewer sees lobby phase", V.lobby && V.lobby.phase, "watching", V.lobby && V.lobby.watching);
for (const c of [A, B, V]) c.ws.close();
