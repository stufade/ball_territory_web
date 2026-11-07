// ---- рилс: страница сама играет выбранный матч и отдаёт кадры по одному ----
// Добавляется в конец скрипта index.html сборкой reel/capture.mjs. План матча приходит в location.hash.
window.reel = (() => {
  const plan = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  const SC = 1.5, FPS = 30, INTRO = 3.8, OUTRO = 4.6, VIEW = 12, CLOSE = 9.4;
  cv.width = VW * SC; cv.height = VH * SC; cv.style.width = VW * SC + "px"; cv.style.height = VH * SC + "px";
  const tmp = document.createElement("canvas"); tmp.width = cv.width; tmp.height = cv.height;
  const tg2 = tmp.getContext("2d");
  const last = document.createElement("canvas"); last.width = cv.width; last.height = cv.height;
  const audio = [];
  let frameNo = 0;
  const vt = () => frameNo / FPS;
  const cue = (kind, d = {}) => audio.push({ t: vt(), kind, d });
  const you = plan.you;

  // ---- вступление: выбор стихии, рулетка, сильные и слабые соперники ----
  const order = shuffle([...Array(NEL).keys()].filter(e => e !== you)).slice(0, 12);
  const hops = []; { let t = .3, gap = .04; for (const e of [...order, you]) { hops.push([t, e]); t += gap; gap *= 1.16; } }
  const pickT = hops[hops.length - 1][0];
  function intro(t) {
    g.setTransform(SC, 0, 0, SC, 0, 0);
    backdrop();
    const q = Math.min(1, t / .18), q2 = Math.min(1, Math.max(0, t - .08) / .18);
    big("CHOOSE YOUR", VW / 2, 110, 66 * (.6 + .4 * q), "#fff", { alpha: q });
    big("ELEMENT!", VW / 2, 200, 108 * (.6 + .4 * q2), "#ffd63c", { alpha: q2 });
    const chosenNow = t >= pickT, g2 = t - pickT;
    drawGrid(380, 122, 44, chosenNow && g2 > .35 ? you : -1, null, t, chosenNow ? [[0, you]] : hops);
    if (chosenNow) {
      const [gx, gy] = gridPos(you, 380, 122), k = Math.min(1, g2 * 4), wob = 1 + .25 * Math.exp(-g2 * 6) * Math.cos(g2 * 30);
      const x = gx + (VW / 2 - gx) * k, y = gy + (1110 - gy) * k;
      g.globalAlpha = .5; circle(x, y, 110, "#fff"); g.globalAlpha = 1;
      ballArt(you, x, y, 44 * (1 + k * .9) * wob);
      if (g2 > .12) big(TITLE[you] + "!", VW / 2, 292, 58, NAMECOL[you], { alpha: Math.min(1, (g2 - .12) / .1), stroke: 6 });
    }
  }

  // ---- бой: тот же модуль правил, то же зерно, что в reel/pick.mjs ----
  seedRandom(plan.seed);
  const used = [];
  for (let i = 0; i < 4; i++) used.push(pickFree(used));
  game = new Game(used.map(e => ({ e, ctl: null })));
  S = game.S; S.you = S.by[you];
  settings.prompts = false; settings.auto = false;
  const TICKS = Math.round(ROUND / DT);
  const per = new Array(TICKS + 2).fill(0);
  for (const [a, b] of plan.windows) for (let k = Math.floor(a / DT); k <= Math.ceil(b / DT); k++) per[k] = 1;
  for (const f of plan.focus) {
    const r = f.tick;
    if (f.kind === "redirect") { for (let k = r - 30; k < r + 4; k++) if (per[k]) per[k] = 2; }
    else for (let k = r - 1; k < r + 9; k++) if (per[k]) per[k] = 3;
  }
  const cuts = new Set(plan.windows.map(([a]) => Math.floor(a / DT)));
  const bigs = [];
  const cam = { x: S.you.x, y: S.you.y, w: VIEW };
  function box() {
    const w = cam.w, h = w * VH / VW;
    const x = Math.min(W - w / 2, Math.max(w / 2, cam.x)), y = h < H ? Math.min(H - h / 2, Math.max(h / 2, cam.y)) : H / 2;
    return [x - w / 2, y - h / 2, w, h];
  }
  function fxAdvance(dt) {
    fx.now += dt;
    if (Math.random() < .3) ambient();
    for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy *= .95; p.t += dt; }
    fx.parts = fx.parts.filter(p => p.t < p.life);
    const n = fx.now, live = (a, l) => a.filter(q => n - q.t < (l || q.life));
    fx.rings = live(fx.rings); fx.arcs = live(fx.arcs); fx.beams = live(fx.beams); fx.calls = live(fx.calls); fx.words = live(fx.words, .95);
    const f = dt * 60;
    fx.shake *= .86 ** f; fx.zoom *= .84 ** f; fx.tintK *= .78 ** f;
    const d = .74 ** (dt * 30); for (let k = 0; k < N; k++) if (S.flash[k] > 0) S.flash[k] *= d;
  }
  function overlay(flash) {
    g.setTransform(SC, 0, 0, SC, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, "rgba(8,8,24,.7)"); gr.addColorStop(1, "rgba(8,8,24,0)");
    g.fillStyle = gr; g.fillRect(0, 0, VW, 240);
    // гонка за карту
    g.fillStyle = "#f0f0fc"; g.fillRect(37, 147, 646, 28); g.fillStyle = "#2e325c"; g.fillRect(40, 150, 640, 22);
    let x = 40;
    for (const e of S.players) {
      const w = S.counts[e] / N * 640;
      g.fillStyle = BRIGHT[e]; g.fillRect(x, 150, w, 22);
      if (e === you && w > 6) { g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(x + 1.5, 151.5, w - 3, 19); }
      x += w;
    }
    // надписи боя живут здесь, в экранных координатах: при наезде камеры они не обрезаются
    const items = bigs.filter(q => fx.now - q.t < 1).slice(-2);
    items.forEach((b, i) => {
      const u = fx.now - b.t, pop = u < .1 ? .6 + 7 * u : u < .2 ? 1.3 - 3 * (u - .1) : 1, al = Math.min(1, (1 - u) / .25);
      const main = i === items.length - 1, y = main ? 268 : 1150, word = b.word;
      big(word, VW / 2, y, (main ? (word.length < 10 ? 100 : 78) : 54) * pop, b.col, { alpha: main ? al : al * .9, stroke: main ? 9 : 6, max: 680 });
      if (main && S.by[b.a] && b.c) { g.globalAlpha = al; ballArt(b.a, VW / 2 - 56, 368, 32); big("+", VW / 2, 370, 50, "#fff", { alpha: al }); terrainIcon(b.c, VW / 2 + 56, 368, 32); g.globalAlpha = 1; }
    });
    if (S.t < S.promptUntil) {
      const left = S.promptUntil - S.t, y = 1030;
      g.fillStyle = "rgba(12,12,34,.7)"; g.fillRect(0, y, VW, 112);
      big("CHOOSE DIRECTION!", VW / 2, y + 42, 54, "#ffe65a", { stroke: 6 });
      g.fillStyle = "#ffe65a"; g.fillRect(60, y + 88, 600 * Math.max(0, left / P.promptLen), 12);
    }
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash / 5})`; g.fillRect(0, 0, VW, VH); }
  }
  function gameFrame(flash) {
    g.setTransform(SC, 0, 0, SC, 0, 0);
    fx.formulas = [];
    const keep = fx.calls, words = fx.words;
    for (const c of fx.calls) if (!c.seen) { c.seen = true; if (!RXCOL[c.s.replace(/!$/, "")]) bigs.push({ word: c.s, col: c.col, t: c.t }); }
    fx.calls = []; fx.words = [];
    draw();
    fx.calls = keep; fx.words = words;
    const [x0, y0, w, h] = box();
    tg2.setTransform(1, 0, 0, 1, 0, 0);
    tg2.drawImage(cv, (FX + x0 * CELL) * SC, (FY + y0 * CELL) * SC, w * CELL * SC, h * CELL * SC, 0, 0, tmp.width, tmp.height);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, 0);
    overlay(flash);
  }

  // ---- концовка: победитель и вопрос ----
  const conf = [...Array(110)].map(() => [rnd(VW), rnd(VH), rnd(-30, 30), rnd(80, 240), irnd(8, 16), irnd(8, 16), BRIGHT[pick(S.players)]]);
  function outro(k) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(last, 0, 0);
    g.setTransform(SC, 0, 0, SC, 0, 0);
    g.fillStyle = `rgba(17,19,42,${Math.min(.93, k / .2 * .93)})`; g.fillRect(0, 0, VW, VH);
    for (const c of conf) { g.fillStyle = c[6]; g.fillRect((c[0] + c[2] * k + VW) % VW, (c[1] + c[3] * k) % VH, c[4], c[5]); }
    const win = S.players.reduce((a, e) => S.counts[e] > S.counts[a] ? e : a, S.players[0]), q = Math.min(1, k / .25);
    big("WINNER", VW / 2, 160, 84, "#fff", { alpha: q, stroke: 7 });
    const bounce = 1 + .15 * Math.exp(-k * 5) * Math.cos(k * 22);
    g.globalAlpha = q * .5; circle(VW / 2, 400, 170, "#fff"); g.globalAlpha = q;
    ballArt(win, VW / 2, 400, 120 * bounce); g.globalAlpha = 1;
    big(TITLE[win] + (win === you ? " (YOU)" : ""), VW / 2, 590, 76, NAMECOL[win], { alpha: q, stroke: 8, max: 680 });
    txt(`${Math.round(S.counts[win] / N * 100)}% of the map`, VW / 2, 675, 44, "#fff", { a: "center", stroke: 4, alpha: q });
    if (k > 1) {
      const a = Math.min(1, (k - 1) / .2);
      big("WHICH ELEMENT", VW / 2, 790, 58, "#ffd63c", { alpha: a, stroke: 7 });
      big("WOULD YOU CHOOSE?", VW / 2, 862, 58, "#ffd63c", { alpha: a, stroke: 7, max: 680 });
      for (let e = 0; e < NEL; e++) {
        const ap = Math.min(1, Math.max(0, (k - 1.15 - e * .035) / .12));
        if (ap <= 0) continue;
        g.globalAlpha = ap; ballArt(e, 64 + (e % 9) * 74, 980 + (e / 9 | 0) * 84, 30); g.globalAlpha = 1;
      }
    }
  }

  // ---- кадры по порядку ----
  function* frames() {
    for (let i = 0; i < INTRO * FPS; i++) {
      const t = i / FPS;
      for (const [ht] of hops) if (Math.abs(ht - t) < .5 / FPS) cue("hop");
      if (Math.abs(t - pickT) < .5 / FPS) cue("ding");
      if (i === 4) cue("voice", { name: "choose" });
      intro(t); yield;
    }
    phase = "play"; fx.reset();
    game.launch();
    let flash = 0;
    for (let tick = 1; !S.done; tick++) {
      game.step();
      const evs = game.drain(), shown = per[S.tick] > 0;
      if (cuts.has(S.tick)) { flash = 4; cam.x = NaN; cue("whoosh"); }
      for (const q of evs) {
        applyFx(q[1], q[2]);
        if (q[1] === "rx" && shown) bigs.push({ word: q[2].k + "!", col: RXCOL[q[2].k] || "#fff", t: fx.now, a: q[2].by, c: q[2].layer });
        if (shown) cue(q[1], q[2]);
      }
      const n = per[S.tick] || 0;
      if (!n) { fxAdvance(DT); continue; }
      // камера: к ближайшему показанному моменту, иначе за своим шаром
      const near = plan.focus.find(f => f.tick - S.tick <= 50 && S.tick - f.tick <= 40);
      let tx = S.you.x, ty = S.you.y, tw = VIEW;
      if (near && near.kind !== "redirect" && near.x !== undefined) { tx = near.x; ty = near.y; tw = Math.abs(S.t - near.t) < .6 ? CLOSE : VIEW; }
      else if (near && near.kind === "redirect") tw = CLOSE + 1;
      if (S.t > 57.8) { tx = W / 2; ty = H / 2; tw = 13.4; }
      if (Number.isNaN(cam.x)) { cam.x = tx; cam.y = ty; cam.w = tw; }
      for (let k = 1; k <= n; k++) {
        acc = k / n * DT;
        fxAdvance(DT / n);
        cam.x += (tx - cam.x) * .12 / n; cam.y += (ty - cam.y) * .12 / n; cam.w += (tw - cam.w) * .12 / n;
        gameFrame(flash); if (flash) flash--;
        yield;
      }
    }
    const lc = last.getContext("2d"); lc.drawImage(cv, 0, 0);
    for (let i = 0; i < OUTRO * FPS; i++) {
      const k = i / FPS;
      if (i === 0) cue("win");
      if (i === FPS) cue("voice", { name: "which" });
      outro(k); yield;
    }
  }
  const it = frames();
  return {
    ready: true, audio,
    step() { const r = it.next(); if (r.done) return null; frameNo++; return cv.toDataURL("image/jpeg", .92); },
  };
})();
