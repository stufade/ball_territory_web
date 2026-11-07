// Проверка экранов в Chrome: обучение по шагам и экран победы каждой стихии.
// node test/ui.mjs <папка для скриншотов> [tut|win|all]
import fs from "fs";
import http from "http";
import path from "path";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = process.argv[2] || "shots", what = process.argv[3] || "all", live = process.argv[4] || "";
fs.mkdirSync(out, { recursive: true });
let html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const tail = "requestAnimationFrame(frame);\n</script>";
if (live) html = html.replace("<head>", `<head><script>window.BT_WS = ${JSON.stringify(live.replace(/^http/, "ws"))};</script>`);
html = html.replace(tail, `window.T = { startSolo, startWin, startTutorial, get S() { return S; }, get phase() { return phase; }, get tut() { return tut; }, get D() { return D; }, get DR() { return DR; }, get game() { return game; }, chooseSpots, connect, send, chooseBall, draftPick, mySide, net, tutBush, fx, N };\n` + tail);
const files = { "/": html, "/game.js": fs.readFileSync(path.join(root, "public/game.js")), "/choose.mp3": fs.readFileSync(path.join(root, "public/choose.mp3")) };
const server = http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/config.json") { res.end('{"bot":"","app":""}'); return; }
  const b = files[p]; if (!b) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".mp3") ? "audio/mpeg" : "text/html" }); res.end(b);
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.T");
const wait = ms => new Promise(r => setTimeout(r, ms));
const k = 360 / 720;  // холст 720×1280 вписан в 360×640
const tap = async (x, y) => { await page.mouse.move(x * k, y * k); await page.mouse.down(); await page.mouse.up(); await wait(120); };
const shot = async name => { await page.screenshot({ path: path.join(out, name + ".png") }); };
const step = () => page.evaluate(() => T.tut ? T.tut.step : T.phase);

if (what === "tut" || what === "all") {
  await shot("00-title");
  await tap(360, 1212); await wait(500); await shot("01-goal"); console.log("step", await step());
  await tap(360, 600); await wait(300); console.log("step", await step());
  await page.mouse.move(360 * k, 500 * k); await page.mouse.down(); await page.mouse.move(400 * k, 400 * k, { steps: 4 }); await page.mouse.up(); await wait(1500);
  await shot("02-paint"); console.log("step", await step());
  await wait(2400); await shot("03-steer"); console.log("step", await step());
  await tap(360, 640); await wait(1500); await shot("04-spikes"); console.log("step", await step());
  await wait(3000); await shot("05-power"); console.log("step", await step());
  await tap(360, 1200); await wait(400); await shot("06-powerOk"); console.log("step", await step());
  await wait(2500); await shot("07-bush"); console.log("step", await step());
  const bush = await page.evaluate(() => T.tutBush());
  if (bush) await tap(bush[0], bush[1]);
  for (let i = 0; i < 40 && (await step()) === "rx"; i++) await wait(200);
  await wait(300); await shot("08-rxOk"); console.log("step", await step(), "reaction", await page.evaluate(() => T.tut.rx));
  await wait(3000); await shot("09-final-card"); console.log("step", await step());
  await tap(360, 600); await wait(2000); await shot("10-final-banner"); console.log("step", await step(), "final", await page.evaluate(() => T.S.final));
  await tap(200, 400); await wait(300); await tap(500, 800); await wait(300);
  for (let i = 0; i < 100 && (await page.evaluate(() => T.phase)) !== "end"; i++) await wait(200);
  for (const [ms, n] of [[300, "11-end-time"], [900, "12-end-sig"], [900, "13-end-crown"], [1500, "14-end-full"]]) { await wait(ms); await shot(n); }
}
if (what === "duel" || what === "all") {
  await page.goto(page.url().split("?")[0], { waitUntil: "networkidle0" }); await page.waitForFunction("window.T");
  const ph = () => page.evaluate(() => T.phase);
  const gpos = e => { const row = e / 5 | 0, inRow = Math.min(5, 27 - row * 5); return [88 + (5 - inRow) * 68 + (e % 5) * 136, 344 + row * 100]; };
  await tap(484, 872); await wait(300); await shot("d0-draft-start");
  let n = 0;
  for (let i = 0; i < 80 && (await ph()) === "ddraft"; i++) {
    const dr = await page.evaluate(() => T.DR.draft);
    if (dr.turn === 0) {
      const taken = [...dr.teams[0], ...dr.teams[1]], e = [0, 13, 24, 19, 5, 9].find(q => !taken.includes(q));
      await tap(...gpos(e)); await wait(150); if (n === 0) await shot("d1-draft-selected");
      await tap(360, 1100); n++; await wait(200);
      if (n === 2) await shot("d2-draft-mid");
    } else await wait(300);
  }
  console.log("draft", JSON.stringify(await page.evaluate(() => T.DR.draft.teams)), "order", JSON.stringify(await page.evaluate(() => T.DR.draft.order)));
  let shotChoose = 0;
  for (let r = 0; r < 8; r++) {
    for (let i = 0; i < 60 && !["dchoose", "aim", "end"].includes(await ph()); i++) await wait(100);
    if ((await ph()) === "end") break;
    if ((await ph()) === "dchoose") {
      await wait(300); await shot(`d3-choose-r${r + 1}`); shotChoose++;
      const spots = await page.evaluate(() => T.DR.dm.cur[0] < 0 ? T.chooseSpots() : []);
      if (spots.length) { await tap(spots[0][1], spots[0][2]); await wait(200); }
      for (let i = 0; i < 40 && (await ph()) !== "aim"; i++) await wait(100);
    }
    await wait(200); if (r === 0) await shot("d4-aim-arena");
    await page.mouse.move(360 * k, 500 * k); await page.mouse.down(); await page.mouse.move(430 * k, 420 * k, { steps: 3 }); await page.mouse.up();
    await wait(2500); if (r === 0) await shot("d5-play-arena");
    await page.evaluate(() => { const g = T.game, S = T.S; while (S.t < S.round - .2) { g.step(); g.drain(); } });
    for (let i = 0; i < 30 && !["rend", "end"].includes(await ph()); i++) await wait(100);
    await wait(1500); await shot(`d6-rend-r${r + 1}`);
    console.log("round", r + 1, JSON.stringify(await page.evaluate(() => T.D.log.at(-1))), "lost", JSON.stringify(await page.evaluate(() => T.D.lost)));
    if (await page.evaluate(() => T.D.done)) break;
  }
  for (let i = 0; i < 60 && (await ph()) !== "end"; i++) await wait(100);
  await wait(3600); await shot("d7-end"); console.log("winner", await page.evaluate(() => T.D.winner), "choose screens", shotChoose);
}
if (what === "online-duel") {
  // настоящий клиент в Chrome против соперника по сети: после выбора шара не должен снова всплывать итог раунда
  const code = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, "x");
  const ws = new WebSocket(`${live.replace(/^http/, "ws")}/ws?room=${code}`);
  const opp = { me: "" }, osend = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === "you") opp.me = m.id;
    if (m.t === "duel") {
      const side = m.pids.indexOf(opp.me);
      if (m.ph === "draft" && m.draft.turn === side) { const tk = [...m.draft.teams[0], ...m.draft.teams[1]]; setTimeout(() => osend({ t: "dpick", e: [...Array(27).keys()].filter(q => !tk.includes(q)).at(-1) }), 300); }
      if (m.ph === "choose" && m.dm && m.dm.cur[side] < 0) { const l = m.dm.teams[side].filter(q => !m.dm.lost[side].includes(q)); setTimeout(() => osend({ t: "dchoose", e: l[0] }), 400); }
    }
    if (m.t === "s" && m.s.ph === "aim" && opp.m !== m.s.m) { opp.m = m.s.m; osend({ t: "launch", d: [.6, .8] }); }
  };
  await page.evaluate(c => T.connect(c), code); await wait(1500);
  await new Promise(r => { if (ws.readyState === 1) r(); else ws.onopen = r; });
  osend({ t: "hello", name: "Rival", cid: "testrival" }); await wait(800);
  await page.evaluate(() => { T.send({ t: "mode", m: "duel" }); }); await wait(400);
  await page.evaluate(() => { T.send({ t: "start" }); });
  const seq = [], t0 = Date.now(); let shots = 0, chooseFor = -1;
  while (Date.now() - t0 < 260000) {
    const st = await page.evaluate(() => ({ ph: T.phase, turn: T.DR && T.DR.draft ? T.DR.draft.turn : -9, side: T.mySide(), dm: T.DR && T.DR.dm, D: T.D && { done: T.D.done, round: T.D.round } }));
    if (seq.at(-1) !== st.ph) seq.push(st.ph);
    if (st.ph === "ddraft" && st.turn === st.side) { await page.evaluate(() => { const tk = [...T.DR.draft.teams[0], ...T.DR.draft.teams[1]]; T.draftPick([...Array(27).keys()].find(q => !tk.includes(q))); }); await wait(300); }
    if (st.ph === "dchoose" && st.dm && st.dm.cur[st.side] < 0 && chooseFor !== st.dm.round) {
      chooseFor = st.dm.round; await wait(1500);  // человек смотрит на экран, в это время раньше всплывал итог раунда
      if (shots++ < 2) await shot(`o-choose-${shots}`);
      const ph2 = await page.evaluate(() => T.phase); if (ph2 !== "dchoose") console.log("BUG: choose screen replaced by", ph2);
      await page.evaluate(() => { const s = T.mySide(), dm = T.DR.dm; T.chooseBall(dm.teams[s].find(q => !dm.lost[s].includes(q))); });
    }
    if (st.ph === "aim") { await page.mouse.move(360 * k, 500 * k); await page.mouse.down(); await page.mouse.up(); }
    if (st.ph === "end") break;
    await wait(100);
  }
  const s2 = seq.join(">");
  console.log("client phases:", s2);
  console.log("choose followed by round result (bug):", /dchoose>rend/.test(s2));
  ws.close();
}
if (what === "win" || what === "all") {
  for (let e = +(process.env.FROM || 0); e < 27; e++) {
    await page.evaluate(e => { T.startSolo(e); const S = T.S; for (let k = 0; k < T.N; k++) S.owner[k] = k % 10 < 5 ? e : S.players[1 + k % 3]; S.counts.fill(0); for (let k = 0; k < T.N; k++) S.counts[S.owner[k]]++; T.startWin(); }, e);
    await wait(1500); await shot(`w${String(e).padStart(2, "0")}a`);
    await wait(1900); await shot(`w${String(e).padStart(2, "0")}b`);
  }
}
console.log("errors", errors.length, errors.slice(0, 5));
await browser.close(); server.close();
