// Правила Ball Territory: 27 стихий, 4 на всех. Общий модуль для сервера и браузера.
"use strict";
const W = 20, H = 24, N = W * H, DT = 1 / 30, ROUND = 60, FINAL = ROUND - 15, FOREVER = 9999, NEL = 27;
const [FIRE, ICE, PLANT, BOLT, WATER, EARTH, WIND, POISON, METAL, SUN, SAND, LAVA, SLIME, VOID, CRYSTAL, MUSHROOM, SMILEY, SIX7, GAS, SOUND, YINYANG, TIME, GHOST, BOMB, BUBBLE, GLITCH, CANDY] = [...Array(NEL).keys()];
const TITLE = ["FIRE", "ICE", "PLANT", "LIGHTNING", "WATER", "EARTH", "WIND", "POISON", "METAL", "LIGHT", "SAND", "LAVA", "SLIME", "VOID", "CRYSTAL", "MUSHROOM", "SMILEY", "67", "GAS", "SOUND", "YIN YANG", "TIME", "GHOST", "BOMB", "BUBBLE", "GLITCH", "CANDY"];
const WORD = ["IGNITE", "FREEZE", "GROW", "STRIKE", "WAVE", "QUAKE", "GUST", "TOXIN", "MAGNET", "FLASH", "SANDSTORM", "ERUPT", "SPLAT", "BLACK HOLE", "CRYSTALLIZE", "SPORES", "IT'S ME", "SIX SEVEN", "GAS CLOUD", "SONIC BOOM", "BALANCE", "SLOW TIME",
  "PHASE", "TICK TOCK", "BUBBLES", "TELEPORT", "SUGAR RUSH"];
const ABOUT = [
  "Burns the area around your ball.", "Freezes the area around your ball.", "Your zone spreads fast for a moment.",
  "Hits in a line ahead of your ball.", "A wave floods the line ahead.", "A ring of rock and a ground slam.",
  "Blows rivals away, takes a cone.", "A toxic cloud that creeps and hurts.", "Pulls rivals into your blades.",
  "Eight beams and a blinding flash.", "Sand that slows rivals down.", "A lava pool that creeps and burns.",
  "Sticky blobs that trap rivals.", "A black hole that eats the map.", "Eight crystal rays nobody can repaint.",
  "Spores that sprout into bushes.", "Three smiley clones run off and paint.",
  "Two shockwaves: SIX, then SEVEN.", "A cloud that slows rivals. Fire makes it explode.",
  "Three sound rings knock rivals back.", "Steals the leader's land around you.", "Rivals slow down, you speed up.",
  "Fly through anything and paint rivals' land.", "A bomb that blows up after 1.5 s.", "Bubbles drift out and trap rivals.",
  "Jump into the biggest rival zone and corrupt it.", "A sugar rush: faster and wider paint.",
];
// кто против кого: доля встреч, где стихия закончила выше, по 6000 раундам ботов (test/balance.mjs; не ниже 60% и не выше 40%)
const STRONG = [[15,10,7],[11,25,2],[15,10],[18,1,0],[10,11,0],[1,11,4],[10,7,0],[15,2,4],[11,1,0],[1,7,14],[8,5,17],[15,10,18],[7,4,3],[12,11,6],[10,1,3],[16,26,8],[14,0,4],[5,4,8],[25,17,14],[14,1],[0,4],[10,1,6],[12,7],[11,5,21],[4,19,21],[14,5],[0,4,11]];
const WEAK = [[8,16,20],[5,21,3],[7,0,1],[14,7,12],[7,24,17],[17,25,24],[21,13,4],[22,6,12],[17,10,15],[12,24,18],[21,0,6],[23,8,5],[22,13],[1,10],[16,25,19],[7,2,0],[15,24],[7,18,10],[3,0,11],[24,7],[],[24,8,23],[1],[],[7],[18,24,1],[15,24,7]];
// скорость заряда силы у каждой стихии (1 - обычная); подбирается тестом test/tune.mjs
const PACE = [0.45,2.2,0.46,0.89,0.88,0.87,1.88,2.18,1.24,0.66,1.42,0.61,1.46,2.09,1,1.67,0.75,0.6,1.35,0.77,1.28,1,0.62,1,0.58,0.89,1.35];
// в дуэли 1 на 1 сила шаров ощущается иначе, поэтому свой набор (test/tune.mjs duel)
const DUEL_PACE = [0.61,1.65,0.46,1.51,0.88,0.68,3,1.3,0.95,0.53,0.93,0.49,1.46,2.09,1.33,1.67,0.75,0.6,1.35,1.32,0.96,1,1.13,1,0.58,1.62,1.35];
// то же для дуэли 1 на 1 (test/duel-table.mjs): не ниже 65% и не выше 35% раундов
const DSTRONG = [[10,15,18],[2,6,13],[10,15,4],[1,18,9],[0,10,22],[1,6,11],[10,7,17],[15,17,19],[1,11,0],[1,7,14],[3,9,22],[15,2,10],[7,4,0],[2,12,6],[1,10,3],[16,26,6],[14,0,4],[5,4,8],[2,6,9],[14,9,22],[0,4,11],[1,10,3],[12,7,15],[11,18,3],[0,4,2],[14,5,8],[0,19,2]];
const DWEAK = [[4,20,24],[3,5,9],[1,13,18],[10,14,21],[12,20,24],[10,17,25],[5,1,14],[12,0,6],[10,4,7],[10,19,3],[0,2,6],[5,23,8],[22,10,13],[1,18,5],[16,19,25],[0,2,7],[15,1,5],[7,10,23],[0,3,23],[7,10,26],[9,6,13],[2,7,15],[10,1,4],[10,15],[1,10,5],[7,1,4],[10,15,1]];
const LAYERS = ["water", "ice", "bush", "burn", "toxic", "sand", "lava", "slime", "rock", "glass", "shock", "gas"];
const HARD = ["ice", "rock", "glass", "water", "shock", "toxic", "lava", "burn", "slime", "gas"];
const TOP = ["shock", "burn", "gas", "lava", "toxic", "slime", "water", "ice", "glass", "rock", "sand", "bush"];
const TOUCH = [
  [["bush", "WILDFIRE"], ["ice", "STEAM"], ["toxic", "BOOM"], ["sand", "GLASS"], ["gas", "EXPLOSION"]],
  [["water", "FROST"], ["lava", "OBSIDIAN"], ["burn", "STEAM"]],
  [["water", "BLOOM"], ["sand", "OASIS"], ["bush", "BLOOM"]],
  [["water", "CHAIN"], ["ice", "SHATTER"], ["burn", "BLAST"], ["gas", "EXPLOSION"]],
  [["burn", "STEAM"], ["lava", "OBSIDIAN"], ["sand", "QUICKSAND"]],
  [["water", "MUDSLIDE"], ["lava", "OBSIDIAN"], ["ice", "AVALANCHE"]],
  [["burn", "FIRESTORM"], ["toxic", "TOXIC STORM"], ["sand", "SANDSTORM"]],
  [["bush", "BLIGHT"], ["water", "TOXIC TIDE"]],
  [["burn", "FORGE"], ["lava", "FORGE"], ["ice", "SHATTER"]],
  [["ice", "PRISM"], ["glass", "PRISM"], ["toxic", "PURIFY"]],
  [["water", "QUICKSAND"], ["burn", "GLASS"], ["lava", "GLASS"]],
  [["water", "OBSIDIAN"], ["ice", "STEAM"], ["bush", "WILDFIRE"], ["sand", "GLASS"], ["gas", "EXPLOSION"]],
  [["water", "SLIME FLOOD"], ["toxic", "ACID"]],
  [["water", "DEVOUR"], ["lava", "DEVOUR"], ["toxic", "DEVOUR"], ["slime", "DEVOUR"]],
  [["water", "GEODE"], ["ice", "GEODE"], ["sand", "GLASS"]],
  [["bush", "MYCELIUM"], ["water", "SWAMP"]],
  [["water", "REFLECTION"], ["glass", "MIRROR"]],
  [["rock", "DUNK"], ["water", "SPLASH"]],
  [["burn", "EXPLOSION"], ["lava", "EXPLOSION"]],
  [["ice", "SHATTER"], ["glass", "CRACK"]],
  [["water", "HARMONY"], ["burn", "HARMONY"]],
  [["sand", "HOURGLASS"], ["ice", "FREEZE FRAME"]],
  [["toxic", "HAUNT"], ["slime", "HAUNT"]],
  [["lava", "DETONATE"], ["gas", "EXPLOSION"]],
  [["water", "FOAM"]],
  [["glass", "CORRUPT"], ["rock", "CORRUPT"]],
  [["water", "SYRUP"]],
];
// реакция: связный кусок местности становится твоим. [во что, сколько держится, колец вокруг, урон, оглушение]
const CONV = {
  "STEAM": ["water", 7, 0, 0, 0], "FROST": ["ice", 8, 0, 0, 0], "BLOOM": [null, 0, 1, 0, 0], "OASIS": ["bush", FOREVER, 1, 0, 0],
  "OBSIDIAN": ["rock", 12, 0, 0, 0], "QUICKSAND": ["sand", 8, 1, 10, 1.6], "MUDSLIDE": [null, 0, 2, 14, .6],
  "AVALANCHE": [null, 0, 2, 25, .8], "FIRESTORM": ["burn", 1.6, 2, 0, 0], "TOXIC STORM": ["toxic", 6, 2, 0, 0],
  "SANDSTORM": ["sand", 8, 2, 0, .5], "BLIGHT": ["toxic", 6, 0, 0, 0], "TOXIC TIDE": ["toxic", 6, 0, 20, 0],
  "FORGE": ["rock", 12, 1, 0, 0], "GLASS": ["glass", 12, 0, 0, 0], "SLIME FLOOD": ["slime", 9, 1, 0, 0],
  "ACID": ["slime", 9, 0, 25, 0], "DEVOUR": [null, 0, 0, 0, 0], "PURIFY": [null, 0, 1, 0, 0], "BOOM": [null, 0, 2, 35, 0],
  "GEODE": ["glass", 10, 0, 0, 0], "MYCELIUM": ["bush", FOREVER, 1, 0, 0], "SWAMP": ["bush", FOREVER, 1, 0, 1],
  "REFLECTION": [null, 0, 1, 0, 0], "MIRROR": ["glass", 8, 0, 0, 0], "DUNK": [null, 0, 2, 25, .6], "SPLASH": [null, 0, 1, 10, 0],
  "EXPLOSION": [null, 0, 2, 30, 0], "CRACK": [null, 0, 1, 10, 0], "HARMONY": [null, 0, 1, 0, 0], "HOURGLASS": [null, 0, 2, 0, .8],
  "FREEZE FRAME": ["ice", 6, 0, 0, 2], "HAUNT": [null, 0, 1, 0, 1], "DETONATE": [null, 0, 2, 25, 0], "FOAM": [null, 0, 2, 0, .6],
  "CORRUPT": [null, 0, 1, 0, 0], "SYRUP": ["slime", 9, 1, 0, 0],
};
const CDS = { STEAM: 6, FROST: 6, SHATTER: 6, CHAIN: 1.2, BLAST: 4, BLOOM: 0, DEVOUR: 9, PRISM: 5, FIRESTORM: 5, REFLECTION: 4, MIRROR: 5, EXPLOSION: 3 };
const P = {
  speed: 4.6, ballR: .85, paintR: 1.5, paintEnemyR: 1, paintNeutral: 3, paintEnemy: 9,
  orbitR: 2, headR: .6, orbitPeriod: 1.15, damage: 16, hitCd: .75, killCharge: .4,
  chargeCells: 50, flightCells: 42, patience: 3, touchR: 1.1, fadeT: 3, behindCharge: 1.5, minRx: 3, cd: 4,
  fireR: 4.3, burnT: 1.5, fireP: .018, plantBurnP: .62, plantBurnT: .7, ashP: .3, wildMin: 6, wildGap: 5, wildCap: 26,
  freezeR: 4.6, freezeT: 8, surgeT: 1.6, surgeArea: 6.5, growNeutralP: .35, growEnemyP: .2, waterT: 9,
  strikeDmg: 30, shockT: 2.5, chainDmg: 30, shardDmg: 14, blastR: 3, blastDmg: 22, waveDmg: 22,
  quakeR: 2.8, quakeDmg: 30, rockT: 6, gustR: 7.5, gustCone: .62, toxinR: 3, toxinT: 5, toxicSpreadP: .015,
  toxicDps: 12, magnetPull: 8, flashLen: 6, flashStun: 1.2, sandR: 6.2, sandT: 8, eruptR: 1.8, eruptReach: 3.6,
  eruptT: 4, lavaT: 5.5, lavaSpreadP: .11, lavaDps: 25, burnDps: 8, splatN: 7, splatR: 2.1, slimeT: 9,
  holeT: 2.2, holeR: 3.4, holePull: 3.5, holeDmg: 0, holeTug: .1,
  crystalN: 8, crystalLen: 4.4, crystalT: 7, crystalDmg: 20, sporeN: 5, sporeR: 1.3, sporeDelay: 1.2,
  promptEvery: 12, promptLen: 2.5, stealR: 3.2, stealHeal: 40, finalDirCd: .2, finalBotAim: [1.4, 2.6],
  gasR: 4, gasT: 5, soundRings: [2.4, 4.2], soundPush: 2.4, soundDmg: 6, balanceR: 6.5, slowT: 2.5, phaseT: 4.5, bombT: 1.5,
  bombR: 3.4, bombDmg: 32, bubbleN: 8, bubbleT: 3, bubbleSpeed: 2.6, glitchN: 40, rushT: 2,
  cloneN: 3, cloneT: 2.6, cloneSpeed: 5.2, cloneR: 1, sixR: 3.6, sevenR: 5.2, sixDmg: 18, sevenDelay: .67,
};

let rand = Math.random;
function seedRandom(seed) {  // повторяемый матч (рилс, тесты); без вызова - обычный Math.random
  let a = seed >>> 0;
  rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = (a = 1, b) => b === undefined ? rand() * a : a + rand() * (b - a);
const irnd = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = a => a[Math.floor(rand() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = irnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const r2 = v => Math.round(v * 100) / 100;
let S = null;

// ---- клетки -------------------------------------------------------------
function disc(x, y, r) {
  const m = new Uint8Array(N), q = r * r;
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(H - 1, Math.ceil(y + r));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const dx = i + .5 - x, dy = j + .5 - y;
    if (dx * dx + dy * dy <= q) m[j * W + i] = 1;
  }
  return m;
}
function nb(k) {
  const i = k % W, out = [];
  if (k >= W) out.push(k - W);
  if (k < N - W) out.push(k + W);
  if (i > 0) out.push(k - 1);
  if (i < W - 1) out.push(k + 1);
  return out;
}
function neighbors(m) { const r = new Int8Array(N); for (let k = 0; k < N; k++) if (m[k]) for (const q of nb(k)) r[q]++; return r; }
function dilate(m) { const n = neighbors(m), r = new Uint8Array(N); for (let k = 0; k < N; k++) r[k] = n[k] > 0 ? 1 : 0; return r; }
function grow(m) { const d = dilate(m); for (let k = 0; k < N; k++) d[k] |= m[k]; return d; }
function mask(f) { const m = new Uint8Array(N); for (let k = 0; k < N; k++) if (f(k)) m[k] = 1; return m; }
function count(m) { let c = 0; for (let k = 0; k < N; k++) c += m[k]; return c; }
function center(m) {
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < N; k++) if (m[k]) { sx += k % W + .5; sy += (k / W | 0) + .5; n++; }
  return n ? [sx / n, sy / n] : [W / 2, H / 2];
}
function component(src, k0) {
  const m = new Uint8Array(N);
  if (!src[k0]) return m;
  const st = [k0]; m[k0] = 1;
  while (st.length) { const k = st.pop(); for (const q of nb(k)) if (src[q] && !m[q]) { m[q] = 1; st.push(q); } }
  return m;
}
function label(src) {
  const lab = new Int32Array(N), sizes = [0];
  for (let k = 0; k < N; k++) {
    if (!src[k] || lab[k]) continue;
    const id = sizes.length, st = [k]; lab[k] = id; let n = 0;
    while (st.length) { const c = st.pop(); n++; for (const q of nb(c)) if (src[q] && !lab[q]) { lab[q] = id; st.push(q); } }
    sizes.push(n);
  }
  return { lab, sizes };
}
const cellOf = b => Math.min(H - 1, Math.max(0, b.y | 0)) * W + Math.min(W - 1, Math.max(0, b.x | 0));
const hardAt = k => HARD.some(n => S.L[n][k] > 0);
const lockedAt = k => S.L.rock[k] > 0 || S.L.glass[k] > 0;
const clampX = x => Math.min(W - P.ballR, Math.max(P.ballR, x));
const clampY = y => Math.min(H - P.ballR, Math.max(P.ballR, y));
function own(k, e) { if (S.owner[k] !== e) { S.owner[k] = e; S.flash[k] = 1; } S.fade[k] = 0; }
function clearCell(k, keep) { for (const n of LAYERS) if (!keep.includes(n)) S.L[n][k] = 0; S.burnFlam[k] = 0; }
function put(name, m, t, by) { for (let k = 0; k < N; k++) if (m[k]) { S.L[name][k] = t; S.src[k] = by; } }
function capture(m, e, clear = true) {
  const got = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (!m[k] || lockedAt(k)) continue;
    if (clear) { clearCell(k, ["rock", "glass", "bush"]); if (S.owner[k] !== e) S.L.bush[k] = 0; }
    own(k, e); got[k] = 1;
  }
  return got;
}
function ballsIn(m, b) { return S.balls.filter(t => t !== b && t.alive && m[cellOf(t)]); }
const at = (b, name) => { const c = cellOf(b); return S.L[name][c] > 0 && S.src[c] !== b.e; };

// ---- события боя: картинку и звук по ним рисует браузер ------------------
function ev(kind, d = {}) {
  S.evId++;
  S.events.push([S.evId, kind, d]);
}

// ---- матч ---------------------------------------------------------------
function newBall(e, x, y, ctl) {
  const a = rnd(Math.PI * 2), ang = rnd(Math.PI * 2);
  return { e, x, y, px: x, py: y, dx: Math.cos(a), dy: Math.sin(a), hp: 100, alive: true, respawn: 0, invuln: 1,
    ang, pang: ang, charge: 0, readyT: 0, stun: 0, surge: 0, sx: x, sy: y, erupt: 0, ex: x, ey: y, hole: 0, hx: x, hy: y,
    bigT: 0, hitCd: new Array(NEL).fill(0), powers: 0, kills: 0, redirectAt: 0, ctl };
}
// ctl: "me" - этот браузер, peer-строка - игрок из комнаты, null - бот
// opts.round - длина раунда в секундах (дуэль короче); финал - последние 15 с, в коротком раунде 10 с
function newMatch(seats, opts = {}) {
  const players = seats.map(s => s.e), round = opts.round || ROUND;
  S = { tick: 0, t: 0, owner: new Int8Array(N).fill(-1), src: new Int8Array(N).fill(-1), L: {}, fade: new Float32Array(N),
    burnFlam: new Uint8Array(N), flash: new Float32Array(N), players, balls: [], by: {}, counts: new Array(NEL).fill(0),
    acc: { WILDFIRE: [0, 0, false, 0, 0, -1], BLOOM: [0, 0, false, 0, 0, -1] }, cd: {}, wildNext: 0, reactions: 0,
    seen: {}, done: false, cut: {}, pods: [], nextPrompt: P.promptEvery, promptUntil: -1,
    events: [], evId: 0, slow: 0, clones: [], six: [], bombs: [], bubbles: [], round, finalAt: round - (round <= 30 ? 10 : 15), pace: opts.pace || PACE };
  for (const n of LAYERS) S.L[n] = new Float32Array(N);
  // двое стартуют по диагонали, чтобы никому не досталось лучшее место
  const spots = seats.length === 2 ? shuffle([[[4, 5], [16, 19]], [[16, 5], [4, 19]]])[0] : shuffle([[4, 5], [16, 5], [4, 19], [16, 19]]), start = Math.max(0, 1 - P.flightCells / P.chargeCells);
  seats.forEach((st, i) => {
    const b = newBall(st.e, spots[i][0], spots[i][1], st.ctl);
    b.charge = start; S.balls.push(b); S.by[st.e] = b; S.cut[st.e] = 0;
    const d = disc(b.x, b.y, 2.3);
    for (let k = 0; k < N; k++) if (d[k]) S.owner[k] = st.e;
  });
  makeMap();
  for (const b of S.balls) {
    if (b.ctl) { b.dx = W / 2 - b.x; b.dy = H / 2 - b.y; } else aim(b);
    turn(b, 0);
  }
  recount();
}
function makeMap() {
  const taken = grow(mask(k => S.owner[k] >= 0));
  for (const [kind, size] of [["bush", 9], ["water", 6], ["ice", 5], ["sand", 5], ["lava", 3], ["bush", 4]]) {
    for (let tries = 0; tries < 60; tries++) {
      const blob = new Set([irnd(1, W / 2 - 2) + irnd(1, H / 2 - 1) * W]);
      while (blob.size < size) {
        const c = pick([...blob]), [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]), x = c % W + dx, y = (c / W | 0) + dy;
        if (x >= 0 && x < W / 2 && y >= 0 && y < H / 2) blob.add(y * W + x);
      }
      const all = new Set();
      for (const c of blob) {
        const x = c % W, y = c / W | 0;
        for (const [a, b] of [[x, y], [W - 1 - x, H - 1 - y], [W - 1 - x, y], [x, H - 1 - y]]) all.add(b * W + a);
      }
      if ([...all].some(k => taken[k])) continue;
      for (const k of all) { taken[k] = 1; S.L[kind][k] = FOREVER; }
      break;
    }
  }
}
function recount() {
  S.counts.fill(0);
  for (let k = 0; k < N; k++) if (S.owner[k] >= 0) S.counts[S.owner[k]]++;
}
function turn(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  [b.dx, b.dy] = [b.dx * c - b.dy * s, b.dx * s + b.dy * c];
  if (Math.abs(b.dx) < .22) b.dx = Math.sign(b.dx || 1) * .3;
  if (Math.abs(b.dy) < .22) b.dy = Math.sign(b.dy || 1) * .3;
  const n = Math.hypot(b.dx, b.dy); b.dx /= n; b.dy /= n;
}
function point(b, x, y, away) {
  let dx = x - b.x, dy = y - b.y;
  if (away) { dx = -dx; dy = -dy; }
  const n = Math.hypot(dx, dy) || 1; b.dx = dx / n; b.dy = dy / n; turn(b, 0);
}
function shove(t, ux, uy, d) { t.x = clampX(t.x + ux * d); t.y = clampY(t.y + uy * d); }
function steer(b, dx, dy) { const n = Math.hypot(dx, dy); if (n > .3) { b.dx = dx / n; b.dy = dy / n; turn(b, 0); } }

// ---- тик ----------------------------------------------------------------
function step() {
  S.tick++; S.t = S.tick * DT;
  for (const b of S.balls) { b.px = b.x; b.py = b.y; b.pang = b.ang; }
  if (S.tick % 3 === 0) timers(DT * 3);
  if (!S.final && S.t >= S.finalAt) { S.final = true; S.promptUntil = -1; ev("final"); }
  if (S.t >= S.nextPrompt && S.t + P.promptLen < S.finalAt) {
    S.nextPrompt += P.promptEvery; S.promptUntil = S.t + P.promptLen;
    ev("prompt", { until: r2(S.promptUntil) });
    for (const b of S.balls) b.redirectAt = b.ctl ? 0 : S.t + rnd(.5, 1.7);
  }
  for (const b of S.balls) updateBall(b);
  collide();
  if (S.tick % P.paintNeutral === 0) {
    const enemy = S.tick % P.paintEnemy === 0;
    for (const b of S.balls) if (b.alive) { touch(b); paint(b, enemy); }
  }
  for (const b of S.balls) if (b.alive) weapon(b);
  cloneStep();
  sixStep();
  bombStep();
  bubbleStep();
  if (S.tick % 3 === 0) hazardStep();
  if (S.tick % 4 === 0) fireStep();
  if (S.tick % 6 === 0) plantStep();
  recount();
  if (S.tick >= S.round / DT) S.done = true;
}
function timers(dt) {
  for (const n of LAYERS) {
    if (n === "bush" || n === "burn") continue;
    const a = S.L[n];
    for (let k = 0; k < N; k++) if (a[k] > 0) a[k] = Math.max(0, a[k] - dt);
  }
  for (const k in S.cd) S.cd[k] -= dt;
  for (const b of S.balls) {
    b.bigT -= dt; b.stun -= dt; b.surge -= dt; b.erupt -= dt; b.invuln -= dt;
    b.slowT = (b.slowT || 0) - dt; b.hasteT = (b.hasteT || 0) - dt; b.phaseT = (b.phaseT || 0) - dt; b.rushT = (b.rushT || 0) - dt;
    if (b.phaseT > 0) b.invuln = Math.max(b.invuln, .1);
    for (let i = 0; i < NEL; i++) b.hitCd[i] -= dt;
  }
}
function updateBall(b) {
  if (!b.alive) { b.respawn -= DT; if (b.respawn <= 0) revive(b); return; }
  b.ang += Math.PI * 2 / P.orbitPeriod * DT;
  if (b.charge >= 1) {
    b.readyT += DT;
    if (!b.ctl) decide(b);
    else if (b.auto) press(b);
  }
  if (S.final && !b.ctl && S.t >= (b.finAim || 0)) {
    b.finAim = S.t + rnd(P.finalBotAim[0], P.finalBotAim[1]);
    aim(b); turn(b, 0);
  }
  if (b.redirectAt && S.t >= b.redirectAt) {
    b.redirectAt = 0;
    if (S.t <= S.promptUntil) { aim(b); turn(b, 0); const [tx, ty] = ahead(b, 5); ev("redirect", { e: b.e, x: r2(b.x), y: r2(b.y), tx: r2(tx), ty: r2(ty) }); }
  }
  let sp = P.speed;
  if (at(b, "ice")) sp *= 1.35;
  if (at(b, "water") && b.e !== WATER) sp *= .75;
  if (at(b, "bush") && b.e !== PLANT && b.e !== MUSHROOM) sp *= .75;
  if (at(b, "sand") && b.e !== SAND) sp *= .6;
  if (at(b, "slime") && b.e !== SLIME) sp *= .45;
  if (at(b, "gas") && b.e !== GAS) { sp *= .6; if (rand() < .08) turn(b, rnd(-.6, .6)); }
  if (b.slowT > 0) sp *= .4;
  if (b.hasteT > 0) sp *= 1.5;
  if (b.rushT > 0) sp *= 1.8;
  if (b.stun > 0) sp *= .2;
  let nx = b.x + b.dx * sp * DT, ny = b.y + b.dy * sp * DT, hit = false;
  const R = P.ballR;
  if (nx < R) { nx = R; b.dx = Math.abs(b.dx); hit = true; } else if (nx > W - R) { nx = W - R; b.dx = -Math.abs(b.dx); hit = true; }
  if (ny < R) { ny = R; b.dy = Math.abs(b.dy); hit = true; } else if (ny > H - R) { ny = H - R; b.dy = -Math.abs(b.dy); hit = true; }
  b.x = nx; b.y = ny;
  if (hit) { turn(b, rnd(-.16, .16)); ev("wall"); }
}
function collide() {
  const R2 = P.ballR * 2, bs = S.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], c = bs[j];
    if (!a.alive || !c.alive) continue;
    const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 >= R2 * R2 || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (R2 - d) / 2;
    a.x = clampX(a.x - nx * push); a.y = clampY(a.y - ny * push); c.x = clampX(c.x + nx * push); c.y = clampY(c.y + ny * push);
    const va = a.dx * nx + a.dy * ny, vc = c.dx * nx + c.dy * ny;
    if (va - vc > 0) {
      a.dx += (vc - va) * nx; a.dy += (vc - va) * ny; c.dx += (va - vc) * nx; c.dy += (va - vc) * ny;
      turn(a, rnd(-.3, .3)); turn(c, rnd(-.3, .3));
      ev("bump", { x: r2((a.x + c.x) / 2), y: r2((a.y + c.y) / 2) });
    }
  }
}
function gain(b, n) {
  const cs = S.players.map(e => S.counts[e]), lo = Math.min(...cs), hi = Math.max(1, ...cs);
  const lag = S.counts[b.e] === lo ? 1 - S.counts[b.e] / hi : 0, was = b.charge;
  b.charge = Math.min(1, b.charge + n / P.chargeCells * S.pace[b.e] * (1 + P.behindCharge * lag));
  if (b.ctl && was < 1 && b.charge >= 1) ev("ready", { e: b.e });
}
function paint(b, enemy) {
  const ghost = b.phaseT > 0, rush = b.rushT > 0;  // призрак красит чужое сквозь всё, конфета красит шире
  const d = disc(b.x, b.y, rush ? 2 : P.paintR), de = enemy || ghost || rush ? disc(b.x, b.y, ghost ? 1.5 : rush ? 1.5 : P.paintEnemyR) : null;
  let n = 0;
  for (let k = 0; k < N; k++) {
    const o = S.owner[k];
    if (!((d[k] && o === -1) || (de && de[k] && o >= 0 && o !== b.e))) continue;
    if (ghost ? lockedAt(k) : hardAt(k) || (b.e !== PLANT && b.e !== MUSHROOM && S.L.bush[k] > 0)) continue;
    own(k, b.e); S.L.bush[k] = 0; n++;
  }
  if (n) gain(b, n);
}

// ---- реакции ------------------------------------------------------------
function touch(b) { trigger(b, disc(b.x, b.y, P.touchR), false); }
function trigger(b, area, skipWild) {
  let n = 0;
  for (const [layer, rx] of TOUCH[b.e]) {
    if (skipWild && rx === "WILDFIRE") continue;
    const L = S.L[layer], m = new Uint8Array(N);
    let k0 = -1;
    for (let k = 0; k < N; k++) {
      if (area[k] && L[k] > 0 && S.src[k] !== b.e && !(layer === "bush" && S.L.burn[k] > 0)) { m[k] = 1; if (k0 < 0) k0 = k; }
    }
    if (k0 >= 0) n += react(b, rx, layer, k0, m);
  }
  if (n) gain(b, n);
}
function react(b, rx, layer, k0, touched) {
  if (rx === "WILDFIRE") { ignite(touched, b.e); return 0; }
  if ((S.cd[rx] || 0) > 0) return 0;
  if (rx === "CHAIN") return chain(k0, b);
  if (rx === "SHATTER") return shatter(k0, b);
  if (rx === "BLAST") { blast(k0 % W + .5, (k0 / W | 0) + .5, b); return 6; }
  const m = component(mask(k => S.L[layer][k] > 0 && S.src[k] !== b.e), k0), n = count(m);
  if (n < P.minRx) return 0;
  S.cd[rx] = CDS[rx] !== undefined ? CDS[rx] : P.cd;
  if (rx === "PRISM") return prism(m, b, layer);
  return convert(b, rx, layer, m);
}
// реакция в счёт матча; картинку и звук рисует applyFx
function reaction(k, x, y, by, layer, extra = {}) {
  S.reactions++;
  if (!S.seen[k]) { S.seen[k] = true; if (!S.final) S.slow = .2; }
  ev("rx", Object.assign({ k, x: r2(x), y: r2(y), by, layer }, extra));
}
function convert(b, rx, layer, m) {
  const [to, t, rings, dmg, stun] = CONV[rx], [cx, cy] = center(m);
  let ring = m.slice();
  for (let i = 0; i < rings; i++) ring = grow(ring);
  const spread = to === "burn" || to === "toxic" || to === "sand";
  for (let k = 0; k < N; k++) {
    ring[k] = ring[k] && !m[k] && !lockedAt(k) && !(spread && (S.L.water[k] > 0 || S.L.ice[k] > 0)) ? 1 : 0;
    if (m[k]) { S.L[layer][k] = 0; if (layer === "burn") S.burnFlam[k] = 0; own(k, b.e); }
  }
  const clear = rx === "DEVOUR" || rx === "PURIFY" || rx === "BOOM";
  const taken = capture(ring, b.e, clear), both = m.map((v, k) => v | taken[k]);
  if (to === "burn") put("burn", both, t, b.e);
  else if (to) put(to, rings && to !== "bush" ? both : m, t, b.e);
  if (clear) for (let k = 0; k < N; k++) if (m[k]) clearCell(k, ["rock", "glass"]);
  reaction(rx, cx, cy, b.e, layer);
  if (rx === "REFLECTION") spawnClones(b, cx, cy, 1);
  if (rx === "MIRROR") spawnClones(b, cx, cy, 2);
  const hitm = rx === "BOOM" ? disc(cx, cy, 3.5) : both;
  for (const v of ballsIn(hitm, b)) {
    if (stun) v.stun = Math.max(v.stun, stun);
    if (dmg) hit(v, dmg, b);
    if (rx === "BOOM") point(v, cx, cy, true);
  }
  return count(m) + count(taken);
}
function ignite(m, by) {
  for (let k = 0; k < N; k++) {
    if (!m[k] || S.L.water[k] > 0 || S.L.ice[k] > 0 || lockedAt(k) || S.owner[k] === by) continue;
    S.burnFlam[k] = S.L.bush[k] > 0 || (S.by[PLANT] && S.owner[k] === PLANT) ? 1 : 0;
    S.L.burn[k] = P.burnT; S.src[k] = by;
  }
}
function fireStep() {
  const dt = DT * 4, burn = S.L.burn, wf = S.acc.WILDFIRE;
  wf[1] += dt;
  const burning = mask(k => burn[k] > 0);
  if (count(burning)) {
    const n = neighbors(burning), hot = wf[0] < P.wildCap ? P.plantBurnP : P.fireP;
    const flamIgn = new Uint8Array(N), by = new Array(NEL).fill(0);
    let kf = 0;
    for (let k = 0; k < N; k++) {
      if (!n[k] || burning[k] || S.L.water[k] > 0 || S.L.ice[k] > 0 || lockedAt(k)) continue;
      let ns = -1;
      for (const q of nb(k)) if (burning[q]) ns = Math.max(ns, S.src[q]);
      if (S.owner[k] === ns) continue;
      const flam = S.L.bush[k] > 0 || (S.by[PLANT] && S.owner[k] === PLANT);
      if (rand() < 1 - (1 - (flam ? hot : P.fireP)) ** n[k]) {
        burn[k] = flam ? P.plantBurnT : P.burnT; S.burnFlam[k] = flam ? 1 : 0; S.src[k] = ns;
        if (flam) { flamIgn[k] = 1; kf++; if (ns >= 0) by[ns]++; }
      }
    }
    if (kf) accumulate("WILDFIRE", flamIgn, kf, by.indexOf(Math.max(...by)));
    for (let k = 0; k < N; k++) {
      if (!burning[k]) continue;
      burn[k] -= dt;
      if (burn[k] > 0) continue;
      burn[k] = 0;
      const ash = S.burnFlam[k] && rand() < P.ashP, bushy = S.L.bush[k] > 0, e = S.src[k];
      if (ash || e < 0) S.owner[k] = -1; else own(k, e);
      S.L.bush[k] = 0; S.burnFlam[k] = 0; S.fade[k] = 0;
      if (bushy && S.by[e]) gain(S.by[e], 1);
    }
  }
  flushAcc("WILDFIRE");
}
function accumulate(kind, m, n, by) {
  const a = S.acc[kind];
  a[0] += n; a[1] = 0; [a[3], a[4]] = center(m); a[5] = by;
  if (!a[2] && a[0] >= (kind === "WILDFIRE" ? P.wildMin : 4)) {
    a[2] = true;
    if (kind !== "WILDFIRE" || S.t >= S.wildNext) { S.wildNext = S.t + P.wildGap; reaction(kind, a[3], a[4], by, kind === "BLOOM" ? "water" : "bush"); }
  }
}
function flushAcc(kind) { const a = S.acc[kind]; if (a[1] > .5) { a[0] = 0; a[2] = false; } }
function plantStep() {
  S.acc.BLOOM[1] += DT * 6;
  const b = S.by[PLANT];
  if (b && b.surge > 0 && b.alive) {
    const area = disc(b.sx, b.sy, P.surgeArea), near = dilate(mask(k => S.owner[k] === PLANT)), wet = new Uint8Array(N);
    let nw = 0;
    for (let k = 0; k < N; k++) {
      if (!area[k] || !near[k]) continue;
      const roll = rand();
      if (S.L.water[k] > 0 && roll < .5) { own(k, PLANT); S.L.water[k] = 0; wet[k] = 1; nw++; continue; }
      if (S.owner[k] === PLANT || hardAt(k)) continue;
      const pr = S.L.bush[k] > 0 ? .7 : S.owner[k] === -1 ? P.growNeutralP : P.growEnemyP;
      if (roll < pr) { own(k, PLANT); S.L.bush[k] = 0; }
    }
    if (nw) accumulate("BLOOM", wet, nw, PLANT);
  }
  flushAcc("BLOOM");
}
function hazardStep() {
  const dt = DT * 3, lava = S.L.lava;
  for (const b of S.balls) {
    if (b.erupt <= 0) continue;
    const mine = mask(k => lava[k] > 0 && S.src[k] === b.e), d = dilate(mine), reach = disc(b.ex, b.ey, P.eruptReach);
    const wet = new Uint8Array(N), bush = new Uint8Array(N);
    let nf = 0, nw = 0;
    for (let k = 0; k < N; k++) {
      if (!d[k] || mine[k] || !reach[k] || lockedAt(k) || rand() >= P.lavaSpreadP) continue;
      nf++;
      if (S.L.water[k] > 0 || S.L.ice[k] > 0) { clearCell(k, []); S.L.rock[k] = P.rockT; S.src[k] = b.e; own(k, b.e); wet[k] = 1; nw++; }
      else if (S.L.bush[k] > 0) bush[k] = 1;
      else { clearCell(k, ["rock", "glass"]); lava[k] = P.lavaT; S.src[k] = b.e; own(k, b.e); }
    }
    if (nw && (S.cd.OBSIDIAN || 0) <= 0) { S.cd.OBSIDIAN = 3; const [x, y] = center(wet); reaction("OBSIDIAN", x, y, b.e, "water"); }
    if (count(bush)) ignite(bush, b.e);
    if (nf) gain(b, nf);
  }
  const live = [];
  for (const pod of S.pods) {
    if (S.t < pod.t) { live.push(pod); continue; }
    const d = disc(pod.x, pod.y, P.sporeR), m = capture(mask(k => d[k] && !hardAt(k)), pod.e);
    for (let k = 0; k < N; k++) if (m[k]) { S.L.bush[k] = FOREVER; S.src[k] = pod.e; }
    if (S.by[pod.e]) gain(S.by[pod.e], count(m) >> 1);
    ev("spore", { x: r2(pod.x), y: r2(pod.y) });
  }
  S.pods = live;
  const tox = S.L.toxic;
  if (tox.some(v => v > 0)) {
    const lv = mask(k => tox[k] > 0 && S.src[k] >= 0), near = neighbors(lv), add = [];
    for (let k = 0; k < N; k++) {
      if (!near[k] || lv[k] || hardAt(k)) continue;
      let ns = -1;
      for (const q of nb(k)) if (lv[q]) ns = Math.max(ns, S.src[q]);
      if (ns < 0 || S.owner[k] === ns) continue;
      if (rand() < 1 - (1 - P.toxicSpreadP) ** near[k]) add.push([k, ns]);
    }
    for (const [k, ns] of add) { tox[k] = P.toxinT * .6; S.src[k] = ns; own(k, ns); }
  }
  for (const b of S.balls) {
    if (b.hole <= 0) continue;
    b.hole -= dt;
    const u = 1 - Math.max(0, b.hole) / P.holeT, d = disc(b.hx, b.hy, 1 + u * (P.holeR - 1));
    const eat = mask(k => d[k] && !lockedAt(k) && S.L.ice[k] <= 0 && S.owner[k] !== b.e), n = count(eat);
    if (n) { capture(eat, b.e); gain(b, n >> 1); }
    for (const t of S.balls) {
      if (t === b || !t.alive) continue;
      const dist = Math.hypot(t.x - b.hx, t.y - b.hy);
      if (dist < P.holePull) {
        point(t, b.hx, b.hy);
        shove(t, (b.hx - t.x) / (dist || 1), (b.hy - t.y) / (dist || 1), Math.min(dist, P.holeTug));
        if (dist < 1.3 && t.invuln <= 0 && b.hitCd[t.e] <= 0) { b.hitCd[t.e] = .9; hit(t, P.holeDmg, b); }
      }
    }
  }
  for (const b of S.balls) {
    if (!b.alive || b.invuln > 0) continue;
    const c = cellOf(b), by = S.src[c];
    if (by === b.e) continue;
    let dmg = 0;
    if (S.L.lava[c] > 0 && b.e !== LAVA && b.e !== FIRE && b.e !== EARTH) dmg += P.lavaDps * dt;
    if (S.L.toxic[c] > 0 && b.e !== POISON) dmg += P.toxicDps * dt;
    if (S.L.burn[c] > 0 && b.e !== FIRE && b.e !== LAVA) dmg += P.burnDps * dt;
    if (dmg) hit(b, dmg, S.by[by], true);
  }
}
function zoneStep() {
  const dt = DT * 15;
  for (const e of S.players) {
    const ownm = mask(k => S.owner[k] === e);
    if (!count(ownm)) continue;
    const { lab, sizes } = label(ownm);
    let main = 1;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
    const b = S.by[e], bl = b.alive ? lab[cellOf(b)] : 0;
    let size = 0;
    const cut = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (!lab[k]) continue;
      if (lab[k] === main || lab[k] === bl) { if (S.fade[k] > 0) S.fade[k] = 0; continue; }
      cut[k] = 1; size++;
      if (S.L.ice[k] > 0 || lockedAt(k)) continue;
      S.fade[k] += dt;
      if (S.fade[k] >= P.fadeT + rand() * 1.5) { S.owner[k] = -1; S.fade[k] = 0; }
    }
    if (size >= 20 && S.cut[e] < 20) { const [x, y] = center(cut); ev("cut", { x: r2(x), y: r2(y) }); }
    S.cut[e] = size;
  }
}
function weapon(b) {
  const big = b.bigT > 0, reach = P.orbitR * (big ? 1.5 : 1), hr = P.headR * (big ? 1.3 : 1) + P.ballR;
  for (const t of S.balls) {
    if (t === b || !t.alive || t.invuln > 0 || b.hitCd[t.e] > 0) continue;
    if (Math.abs(t.x - b.x) > reach + hr || Math.abs(t.y - b.y) > reach + hr) continue;
    for (let i = 0; i < 2; i++) {
      const a = b.ang + i * Math.PI, hx = b.x + Math.cos(a) * reach, hy = b.y + Math.sin(a) * reach;
      if ((hx - t.x) ** 2 + (hy - t.y) ** 2 <= hr * hr) { b.hitCd[t.e] = P.hitCd; hit(t, P.damage, b, false, hx, hy); break; }
    }
  }
}
function hit(t, dmg, by, quiet, x, y) {
  if (!t.alive) return;
  t.hp -= dmg;
  if (!quiet) ev("hit", { x: r2(x === undefined ? t.x : x), y: r2(y === undefined ? t.y : y) });
  if (t.hp > 0) return;
  t.alive = false; t.respawn = 3; t.surge = t.erupt = t.hole = 0;
  ev("ko", { e: t.e, x: r2(t.x), y: r2(t.y) });
  if (by && by !== t) {
    by.kills++; by.charge = Math.min(1, by.charge + P.killCharge);
    if (by.alive) by.hp = Math.min(100, by.hp + P.stealHeal);
    const d = disc(t.x, t.y, P.stealR);
    let n = 0;
    for (let k = 0; k < N; k++) if (d[k] && S.owner[k] === t.e && !lockedAt(k)) { own(k, by.e); n++; }
    ev("steal", { e: by.e, v: t.e, x: r2(t.x), y: r2(t.y), n });
  }
}
function revive(b) {
  const opts = [];
  for (let k = 0; k < N; k++) if (S.owner[k] === b.e && !hardAt(k)) opts.push(k);
  const k = opts.length ? pick(opts) : irnd(2, H - 3) * W + irnd(2, W - 3);
  b.x = clampX(k % W + .5); b.y = clampY((k / W | 0) + .5); b.px = b.x; b.py = b.y;
  b.hp = 100; b.alive = true; b.invuln = 1;
  const a = rnd(Math.PI * 2); b.dx = Math.cos(a); b.dy = Math.sin(a); turn(b, 0);
  ev("spawn", { e: b.e, x: r2(b.x), y: r2(b.y) });
}

// ---- кнопка и боты ------------------------------------------------------
function likes(e) {
  const w = new Float32Array(N);
  for (const [layer] of TOUCH[e]) for (let k = 0; k < N; k++) if (S.L[layer][k] > 0) w[k] += 3;
  return w;
}
function aim(b) {
  const w = likes(b.e);
  for (let k = 0; k < N; k++) if (S.owner[k] === -1) w[k] += 1;
  let best = -1e9, ba = 0;
  const base = rnd(Math.PI * 2);
  for (let i = 0; i < 16; i++) {
    const a = base + i * Math.PI / 8, line = grow(rayMask(b.x, b.y, b.x + Math.cos(a), b.y + Math.sin(a)));
    let s = rnd(3);
    for (let k = 0; k < N; k++) if (line[k]) s += w[k];
    if (s > best) { best = s; ba = a; }
  }
  b.dx = Math.cos(ba); b.dy = Math.sin(ba);
}
function decide(b) {
  if (S.tick % 6) return;
  const wait = b.powers ? P.patience : P.patience * .3;
  if (value(b) >= 1 - b.readyT / wait) press(b);
}
function value(b) {
  const others = S.players.filter(e => e !== b.e), top = others.reduce((a, e) => S.counts[e] > S.counts[a] ? e : a, others[0]);
  const area = areaOf(b), w = likes(b.e);
  let v = 0, n = 0;
  for (let k = 0; k < N; k++) {
    if (!area[k]) continue;
    n++;
    const o = S.owner[k];
    v += w[k] + (o >= 0 && o !== b.e ? 1 : 0) + (o === top ? .6 : 0) + (o === -1 ? .7 : 0) - (o === b.e ? .4 : 0);
  }
  if ([METAL, WIND, VOID, SUN, CRYSTAL, SIX7, SOUND, TIME, BOMB, BUBBLE].includes(b.e)) v += 6 * ballsIn(disc(b.x, b.y, 6.5), b).length;
  return v / (.5 * n + 4);
}
function press(b) {
  if (!b.alive || b.charge < 1) return;
  b.readyT = 0; b.charge = 0;
  if (b.ctl) ev("tap", { e: b.e });
  power(b);
}
function rayCells(x0, y0, x1, y1) {
  let dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy);
  if (n < 1e-6) { dx = 1; dy = 0; n = 1; }
  dx /= n; dy /= n;
  const out = [], seen = new Set();
  let x = x0, y = y0, last = null;
  while (x >= 0 && x < W && y >= 0 && y < H) {
    const c = [x | 0, y | 0];
    if (!last || c[0] !== last[0] || c[1] !== last[1]) {
      if (last && c[0] !== last[0] && c[1] !== last[1]) { const q = last[1] * W + c[0]; if (!seen.has(q)) { seen.add(q); out.push(q); } }
      const q = c[1] * W + c[0];
      if (!seen.has(q)) { seen.add(q); out.push(q); }
      last = c;
    }
    x += dx * .25; y += dy * .25;
  }
  return { out, ex: x - dx * .25, ey: y - dy * .25 };
}
function rayMask(x0, y0, x1, y1) { const m = new Uint8Array(N); for (const k of rayCells(x0, y0, x1, y1).out) m[k] = 1; return m; }
function rays(x, y, n, len, a0 = 0) {
  const m = new Uint8Array(N), ends = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + i * Math.PI * 2 / n, { out, ex, ey } = rayCells(x, y, x + Math.cos(a), y + Math.sin(a));
    for (const k of out) if (Math.hypot(k % W + .5 - x, (k / W | 0) + .5 - y) <= len) m[k] = 1;
    const d = Math.min(len, Math.hypot(ex - x, ey - y));
    ends.push([r2(x + Math.cos(a) * d), r2(y + Math.sin(a) * d)]);
  }
  return { m, ends };
}
function ahead(b, d) { return [clampX(b.x + b.dx * d), clampY(b.y + b.dy * d)]; }
function areaOf(b) {
  const e = b.e, x = b.x, y = b.y;
  if (e === FIRE) return disc(x, y, P.fireR);
  if (e === ICE) return disc(x, y, P.freezeR);
  if (e === PLANT) return disc(x, y, 4);
  if (e === BOLT || e === WATER) { const l = grow(rayMask(x, y, x + b.dx, y + b.dy)); return e === WATER ? grow(grow(l)) : l; }
  if (e === EARTH) return disc(x, y, P.quakeR + .6);
  if (e === WIND) {
    const d = disc(x, y, P.gustR), near = disc(x, y, 1.5), h = Math.atan2(b.dy, b.dx);
    return mask(k => near[k] || (d[k] && Math.abs(((Math.atan2((k / W | 0) + .5 - y, k % W + .5 - x) - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <= P.gustCone));
  }
  if (e === POISON) return disc(x, y, P.toxinR);
  if (e === METAL) return disc(x, y, 3.8);
  if (e === SUN) return rays(x, y, 8, P.flashLen, Math.PI / 8).m;
  if (e === SAND) return disc(x, y, P.sandR);
  if (e === LAVA) return disc(x, y, P.eruptReach);
  if (e === SLIME) return disc(...ahead(b, 3.5), 3.6);
  if (e === CRYSTAL) return rays(x, y, P.crystalN, P.crystalLen, Math.atan2(b.dy, b.dx)).m;
  if (e === MUSHROOM) return disc(x, y, 4.2);
  if (e === SMILEY) return disc(x, y, 4);
  if (e === SIX7) { const a = ringMask(x, y, P.sixR), c = ringMask(x, y, P.sevenR); return a.map((v, k) => v | c[k]); }
  if (e === GAS || e === BUBBLE) return disc(x, y, P.gasR);
  if (e === SOUND) return disc(x, y, 5);
  if (e === GLITCH) return disc(x, y, 6);
  if (e === YINYANG) return disc(x, y, P.balanceR);
  if (e === TIME) return disc(x, y, 2.5);
  if (e === GHOST || e === CANDY) return disc(...ahead(b, 3), 3.5);
  if (e === BOMB) return disc(x, y, P.bombR);
  return disc(x, y, P.holeR);
}
function power(b) {
  const e = b.e, x = b.x, y = b.y, area = areaOf(b);
  b.powers++;
  ev("power", { e, x: r2(x), y: r2(y) });
  trigger(b, area, true);
  if (e === FIRE) ignite(area, e);
  else if (e === ICE) put("ice", capture(area, e), P.freezeT, e);
  else if (e === PLANT) { capture(disc(x, y, 1.7), e); b.surge = P.surgeT; b.sx = x; b.sy = y; }
  else if (e === BOLT) strike(b);
  else if (e === WATER) {
    const { ex, ey } = rayCells(x, y, x + b.dx, y + b.dy);
    ev("wave", { x0: r2(x), y0: r2(y), x1: r2(ex), y1: r2(ey) });
    const got = capture(area, e), track = rayMask(x, y, x + b.dx, y + b.dy);  // вода остаётся только следом волны
    put("water", got.map((v, k) => v & track[k]), P.waterT, e);
    for (const t of ballsIn(area, b)) { shove(t, b.dx, b.dy, 2.5); hit(t, P.waveDmg, b); }
  } else if (e === EARTH) {
    ev("quake", { x: r2(x), y: r2(y) });
    const d = disc(x, y, P.quakeR + .6), inner = disc(x, y, P.quakeR - .6);
    capture(d, e);
    put("rock", mask(k => d[k] && !inner[k] && !lockedAt(k)), P.rockT, e);
    for (const t of ballsIn(disc(x, y, P.quakeR + 1), b)) { point(t, x, y, true); hit(t, P.quakeDmg, b); }
  } else if (e === WIND) {
    ev("gust", { x: r2(x), y: r2(y), dx: r2(b.dx), dy: r2(b.dy) });
    capture(mask(k => area[k] && !hardAt(k)), e);
    for (const t of ballsIn(disc(x, y, P.gustR), b)) {
      const ux = t.x - x, uy = t.y - y, n = Math.hypot(ux, uy) || 1;
      shove(t, ux / n, uy / n, 3); point(t, x, y, true); t.stun = Math.max(t.stun, .5);
    }
  } else if (e === POISON) put("toxic", capture(area, e), P.toxinT, e);
  else if (e === METAL) {
    ev("magnet", { x: r2(x), y: r2(y) });
    capture(area, e); b.bigT = Math.max(b.bigT, 5);
    for (const t of ballsIn(disc(x, y, P.magnetPull), b)) {
      point(t, x, y);
      const d = Math.hypot(t.x - x, t.y - y) || 1;
      shove(t, (x - t.x) / d, (y - t.y) / d, Math.min(2, d - 1.8));
    }
  } else if (e === SUN) {
    const { m, ends } = rays(x, y, 8, P.flashLen, Math.PI / 8);
    ev("flash", { x: r2(x), y: r2(y), ends });
    capture(mask(k => m[k] && !hardAt(k)), e);
    for (let k = 0; k < N; k++) if (m[k] && S.owner[k] === e) S.L.shock[k] = 1;
    for (const t of ballsIn(disc(x, y, P.flashLen), b)) t.stun = Math.max(t.stun, P.flashStun);
  } else if (e === SAND) put("sand", capture(area, e), P.sandT, e);
  else if (e === LAVA) { put("lava", capture(disc(x, y, P.eruptR), e), P.lavaT, e); b.erupt = P.eruptT; b.ex = x; b.ey = y; }
  else if (e === SLIME) {
    const [cx, cy] = ahead(b, 3.5), spots = [];
    for (let i = 0; i < P.splatN; i++) {
      const a = rnd(Math.PI * 2), r = i ? rnd(2.6) : 0, sx = clampX(cx + Math.cos(a) * r), sy = clampY(cy + Math.sin(a) * r);
      const d = disc(sx, sy, P.splatR);
      put("slime", capture(mask(k => d[k] && !lockedAt(k)), e), P.slimeT, e);
      spots.push([r2(sx), r2(sy)]);
    }
    ev("splat", { spots });
  } else if (e === CRYSTAL) {
    const { m, ends } = rays(x, y, P.crystalN, P.crystalLen, Math.atan2(b.dy, b.dx)), near = disc(x, y, 1.2);
    const got = capture(mask(k => m[k] && !lockedAt(k) && !near[k]), e);
    put("glass", got, P.crystalT, e);
    ev("crystal", { x: r2(x), y: r2(y), ends });
    for (const t of ballsIn(got, b)) hit(t, P.crystalDmg, b);
  } else if (e === MUSHROOM) {
    const spots = [];
    for (let i = 0; i < P.sporeN; i++) {
      const a = i * Math.PI * 2 / P.sporeN + rnd(-.3, .3), r = rnd(2.4, 3.9);
      const sx = clampX(x + Math.cos(a) * r), sy = clampY(y + Math.sin(a) * r);
      spots.push([r2(sx), r2(sy)]);
      S.pods.push({ x: sx, y: sy, t: S.t + P.sporeDelay + i * .08, e });
    }
    capture(disc(x, y, 1.5), e);
    ev("spores", { spots });
  } else if (e === SMILEY) {
    capture(disc(x, y, 1.5), e);
    spawnClones(b, x, y, P.cloneN);
    ev("itsme", { x: r2(x), y: r2(y) });
  } else if (e === SIX7) {
    S.six.push({ x, y, t: S.t, r: P.sixR, e, word: "SIX" }, { x, y, t: S.t + P.sevenDelay, r: P.sevenR, e, word: "SEVEN" });
  } else if (e === GAS) {
    put("gas", capture(mask(k => area[k] && !lockedAt(k)), e), P.gasT, e);
    ev("gas", { x: r2(x), y: r2(y) });
  } else if (e === SOUND) {
    P.soundRings.forEach((r, i) => S.six.push({ x, y, t: S.t + i * .2, r, e, word: "", push: P.soundPush, dmg: P.soundDmg, stun: .6 }));
    ev("sonic", { x: r2(x), y: r2(y) });
  } else if (e === YINYANG) {
    const others = S.players.filter(q => q !== e).sort((a, c) => S.counts[c] - S.counts[a]);
    const target = S.counts[e] >= S.counts[others[0]] ? others[1] : others[0], d = disc(x, y, P.balanceR);
    capture(mask(k => d[k] && S.owner[k] === target && !lockedAt(k)), e, false);
    capture(disc(x, y, 2.2), e);
    b.hp = Math.min(100, b.hp + 30);
    ev("balance", { x: r2(x), y: r2(y), target });
  } else if (e === TIME) {
    capture(disc(x, y, 2.5), e);
    for (const t of S.balls) if (t !== b) t.slowT = P.slowT;
    b.hasteT = P.slowT;
    ev("slowtime", { x: r2(x), y: r2(y) });
  } else if (e === GHOST) {
    b.phaseT = P.phaseT;
    ev("phase", { e, x: r2(x), y: r2(y) });
  } else if (e === BOMB) {
    S.bombs.push({ x, y, t: S.t + P.bombT, e });
    ev("bomb", { x: r2(x), y: r2(y) });
  } else if (e === BUBBLE) {
    const a0 = rnd(Math.PI * 2);
    for (let i = 0; i < P.bubbleN; i++) { const a = a0 + i * Math.PI * 2 / P.bubbleN; S.bubbles.push({ x, y, dx: Math.cos(a), dy: Math.sin(a), until: S.t + P.bubbleT, e }); }
    ev("bubbles", { x: r2(x), y: r2(y) });
  } else if (e === GLITCH) {
    const lab = S.players.filter(q => q !== e).sort((a, c) => S.counts[c] - S.counts[a])[0], cells = [];
    for (let k = 0; k < N; k++) if (S.owner[k] === lab) cells.push(k);
    const [cx, cy] = cells.length ? center(mask(k => S.owner[k] === lab)) : [x, y];
    const fx0 = x, fy0 = y;
    b.x = clampX(cx); b.y = clampY(cy); b.px = b.x; b.py = b.y;
    const d = disc(b.x, b.y, 6), near = shuffle([...Array(N).keys()].filter(k => d[k] && S.owner[k] >= 0 && S.owner[k] !== e && !lockedAt(k))).slice(0, P.glitchN);
    capture(mask(k => near.includes(k)), e);
    ev("glitch", { x0: r2(fx0), y0: r2(fy0), x: r2(b.x), y: r2(b.y) });
  } else if (e === CANDY) {
    b.rushT = P.rushT;
    ev("rush", { e, x: r2(x), y: r2(y) });
  } else {
    b.hole = P.holeT; b.hx = x; b.hy = y;
    ev("hole", { x: r2(x), y: r2(y) });
  }
}
function strike(b) {
  const { out, ex, ey } = rayCells(b.x, b.y, b.x + b.dx, b.y + b.dy), line = new Uint8Array(N);
  for (const k of out) line[k] = 1;
  const wide = grow(line);
  ev("strike", { x0: r2(b.x), y0: r2(b.y), x1: r2(ex), y1: r2(ey) });
  for (let k = 0; k < N; k++) if (wide[k] && !hardAt(k)) { own(k, b.e); S.L.bush[k] = 0; S.L.shock[k] = P.shockT; S.fade[k] = -(P.shockT + 1.5); }
  for (const t of ballsIn(wide, b)) hit(t, P.strikeDmg, b);
}
function chain(k0, b) {
  const m = component(mask(k => S.L.water[k] > 0 && S.src[k] !== b.e), k0), n = count(m);
  if (n < 3) return 0;
  S.cd.CHAIN = CDS.CHAIN;
  const [cx, cy] = center(m), pts = [];
  for (let k = 0; k < N; k++) if (m[k]) { S.L.water[k] = 0; own(k, b.e); if (pts.length < 14 && rand() < 14 / n) pts.push([k % W + .5, (k / W | 0) + .5]); }
  reaction("CHAIN", cx, cy, b.e, "water", { pts: shuffle(pts) });
  for (const t of ballsIn(m, b)) { t.stun = .9; hit(t, P.chainDmg, b); }
  return n;
}
function shatter(k0, b) {
  const m = component(mask(k => S.L.ice[k] > 0 && S.src[k] !== b.e), k0), n = count(m);
  if (n < 3) return 0;
  S.cd.SHATTER = CDS.SHATTER;
  const d = dilate(m), ring = mask(k => d[k] && !m[k]), [cx, cy] = center(m);
  for (let k = 0; k < N; k++) if (m[k]) S.L.ice[k] = 0;
  capture(mask(k => ring[k] || (m[k] && rand() < .75)), b.e);
  reaction("SHATTER", cx, cy, b.e, "ice");
  for (const t of ballsIn(ring, b)) hit(t, P.shardDmg, b);
  return n;
}
function blast(x, y, b) {
  S.cd.BLAST = CDS.BLAST;
  const d = disc(x, y, P.blastR);
  for (let k = 0; k < N; k++) if (d[k]) S.L.burn[k] = 0;
  capture(d, b.e);
  reaction("BLAST", x, y, b.e, "burn");
  for (const t of S.balls) if (t !== b && t.alive && Math.hypot(t.x - x, t.y - y) <= P.blastR + 1) { point(t, x, y, true); hit(t, P.blastDmg, b); }
}
function prism(m, b, layer) {
  const [cx, cy] = center(m), { m: beams, ends } = rays(cx, cy, 8, 9);
  const got = capture(mask(k => (beams[k] && !hardAt(k)) || m[k]), b.e, false);
  for (let k = 0; k < N; k++) if (beams[k] && !hardAt(k)) S.L.shock[k] = 1;
  reaction("PRISM", cx, cy, b.e, layer, { ends });
  for (const t of ballsIn(beams, b)) hit(t, 20, b);
  return count(got);
}
// ---- смайлик и 67 -------------------------------------------------------
function ringMask(x, y, r) {
  const d = disc(x, y, r + .75), inner = disc(x, y, Math.max(0, r - .75));
  return d.map((v, k) => v && !inner[k] ? 1 : 0);
}
function spawnClones(b, x, y, n) {
  const a0 = Math.atan2(b.dy, b.dx);
  for (let i = 0; i < n; i++) {
    const a = a0 + i * Math.PI * 2 / Math.max(3, n) + rnd(-.3, .3);
    S.clones.push({ x: clampX(x), y: clampY(y), dx: Math.cos(a), dy: Math.sin(a), until: S.t + P.cloneT, e: b.e });
  }
}
function cloneStep() {
  if (!S.clones.length) return;
  const paintNow = S.tick % 6 === 0;
  S.clones = S.clones.filter(c => S.t < c.until && S.by[c.e] && S.by[c.e].alive);
  for (const c of S.clones) {
    c.x += c.dx * P.cloneSpeed * DT; c.y += c.dy * P.cloneSpeed * DT;
    if (c.x < .6 || c.x > W - .6) { c.dx = -c.dx; c.x = Math.min(W - .6, Math.max(.6, c.x)); }
    if (c.y < .6 || c.y > H - .6) { c.dy = -c.dy; c.y = Math.min(H - .6, Math.max(.6, c.y)); }
    if (!paintNow) continue;
    const d = disc(c.x, c.y, P.cloneR);
    let n = 0;
    for (let k = 0; k < N; k++) if (d[k] && S.owner[k] !== c.e && !hardAt(k) && S.L.bush[k] <= 0) { own(k, c.e); n++; }
    if (n) gain(S.by[c.e], n * .3);
  }
}
function sixStep() {
  if (!S.six.length) return;
  const left = [];
  for (const w of S.six) {
    if (S.t < w.t) { left.push(w); continue; }
    const b = S.by[w.e], m = ringMask(w.x, w.y, w.r);
    if (!b) continue;
    capture(mask(k => m[k] && !hardAt(k)), w.e);
    ev("six", { x: r2(w.x), y: r2(w.y), r: w.r, word: w.word, e: w.e });
    for (const t of ballsIn(m, b)) {
      point(t, w.x, w.y, true);
      if (w.push) { const dd = Math.hypot(t.x - w.x, t.y - w.y) || 1; shove(t, (t.x - w.x) / dd, (t.y - w.y) / dd, w.push); }
      if (w.stun) t.stun = Math.max(t.stun, w.stun);
      hit(t, w.dmg !== undefined ? w.dmg : P.sixDmg, b);
    }
  }
  S.six = left;
}

function bombStep() {
  if (!S.bombs.length) return;
  S.bombs = S.bombs.filter(q => {
    if (S.t < q.t) return true;
    const b = S.by[q.e], d = disc(q.x, q.y, P.bombR);
    if (!b) return false;
    const got = capture(mask(k => d[k] && !lockedAt(k)), q.e);
    for (let k = 0; k < N; k++) if (got[k]) clearCell(k, ["rock", "glass"]);
    const gas = mask(k => d[k] && S.L.gas[k] > 0);
    if (count(gas) >= 3) react(b, "EXPLOSION", "gas", gas.indexOf(1), gas);
    ev("kaboom", { x: r2(q.x), y: r2(q.y) });
    for (const t of ballsIn(d, b)) { point(t, q.x, q.y, true); hit(t, P.bombDmg, b); }
    gain(b, count(got) >> 1);
    return false;
  });
}
function bubbleStep() {
  if (!S.bubbles.length) return;
  S.bubbles = S.bubbles.filter(q => {
    const b = S.by[q.e];
    if (!b) return false;
    q.x += q.dx * P.bubbleSpeed * DT; q.y += q.dy * P.bubbleSpeed * DT;
    if (q.x < .5 || q.x > W - .5) q.dx = -q.dx;
    if (q.y < .5 || q.y > H - .5) q.dy = -q.dy;
    const t = S.balls.find(o => o !== b && o.alive && o.invuln <= 0 && Math.hypot(o.x - q.x, o.y - q.y) < 1.2);
    if (!t && S.t < q.until) return true;
    capture(mask(k => disc(q.x, q.y, t ? 2.2 : 1.9)[k] && !hardAt(k)), q.e);
    if (t) { t.stun = Math.max(t.stun, 1.5); hit(t, 6, b); }
    ev("pop", { x: r2(q.x), y: r2(q.y), trap: t ? t.e : -1 });
    return false;
  });
}

// ---- снимок боя для сети ------------------------------------------------
function snapshot(meta) {
  let o = "", gs = "", f = "", anyFade = false;
  for (let k = 0; k < N; k++) {
    o += S.owner[k] < 0 ? "." : String.fromCharCode(97 + S.owner[k]);
    let ti = -1;
    for (let i = 0; i < TOP.length; i++) if (S.L[TOP[i]][k] > 0) { ti = i; break; }
    gs += ti < 0 ? "." : String.fromCharCode(97 + ti);
    const fv = S.fade[k] > 0 ? Math.min(9, Math.round(S.fade[k] / P.fadeT * 9)) : 0;
    if (fv) anyFade = true;
    f += fv;
  }
  const bs = S.balls.map(b => [b.e, r2(b.x), r2(b.y), r2(b.ang % (Math.PI * 2)), Math.round(b.hp), b.alive ? 1 : 0, r2(b.charge),
    (b.stun > 0 ? 1 : 0) | (b.bigT > 0 ? 2 : 0) | (b.invuln > 0 ? 4 : 0) | (b.surge > 0 ? 8 : 0) | (b.phaseT > 0 ? 16 : 0) |
    (b.rushT > 0 ? 32 : 0) | (b.slowT > 0 ? 64 : 0) | (b.hasteT > 0 ? 128 : 0), r2(Math.max(0, b.hole)),
    r2(b.hx), r2(b.hy), r2(b.sx), r2(b.sy), r2(b.dx), r2(b.dy), b.powers, b.kills, b.name || "", b.pid || ""]);
  return Object.assign({ t: r2(S.t), rx: S.reactions, pu: r2(S.promptUntil), fin: S.final ? 1 : 0, rd: S.round, fa: S.finalAt, o, g: gs, f: anyFade ? f : "", b: bs,
    c: S.clones.map(c => [r2(c.x), r2(c.y), c.e]), k: S.bombs.map(q => [r2(q.x), r2(q.y), r2(q.t - S.t)]),
    u: S.bubbles.map(q => [r2(q.x), r2(q.y), q.e]) }, meta);
}

// ---- обёртка: у каждой комнаты свой матч, S переключается на время вызова --
class Game {
  constructor(seats, opts) { newMatch(seats, opts); this.S = S; }
  step() { S = this.S; step(); }
  press(e) { S = this.S; const b = S.by[e]; if (b) press(b); }
  steer(e, dx, dy) { S = this.S; const b = S.by[e]; if (b) steer(b, dx, dy); }
  redirect(e, dx, dy) {
    S = this.S; const b = S.by[e];
    if (!b || !b.alive) return;
    if (S.final) { if (S.t - (b.dirAt || -9) < P.finalDirCd) return; b.dirAt = S.t; }
    else if (S.t > S.promptUntil) return;
    steer(b, dx, dy);
    const [tx, ty] = ahead(b, 5);
    ev("redirect", { e: b.e, x: r2(b.x), y: r2(b.y), tx: r2(tx), ty: r2(ty) });
  }
  launch() { S = this.S; for (const b of S.balls) turn(b, 0); ev("launch"); }
  drain() { const e = this.S.events; this.S.events = []; return e; }
  snapshot(meta) { S = this.S; return snapshot(meta); }
}
// ---- дуэль: у каждой стороны 3 шара по очереди. Проиграл раунд - выходит следующий шар, победитель остаётся.
// Кончились шары - проиграл дуэль. Ничья в раунде забирает по шару у обоих.
const DUEL_ROUND = 30, DUEL_SIZE = 3;
class Duel {
  constructor(teams, ctls) {
    this.teams = teams.map(t => t.slice(0, DUEL_SIZE)); this.ctls = ctls.slice();
    this.idx = [0, 0]; this.round = 0; this.log = []; this.done = false; this.winner = -1; this.game = null;
  }
  cur(side) { return this.teams[side][Math.min(DUEL_SIZE - 1, this.idx[side])]; }
  newRound() {
    this.round++;
    this.game = new Game([0, 1].map(i => ({ e: this.cur(i), ctl: this.ctls[i] })), { round: DUEL_ROUND, pace: DUEL_PACE });
    return this.game;
  }
  endRound() {
    const S = this.game.S, a = this.cur(0), b = this.cur(1), ca = S.counts[a], cb = S.counts[b];
    const win = ca > cb ? 0 : cb > ca ? 1 : -1;
    this.log.push([a, b, win, r2(ca / N * 100), r2(cb / N * 100)]);
    if (win !== 0) this.idx[0]++;
    if (win !== 1) this.idx[1]++;
    const outA = this.idx[0] >= DUEL_SIZE, outB = this.idx[1] >= DUEL_SIZE;
    if (outA || outB) { this.done = true; this.winner = outA && outB ? -1 : outA ? 1 : 0; }
    return win;
  }
  meta() { return { teams: this.teams, idx: this.idx.slice(), round: this.round, log: this.log, done: this.done, winner: this.winner }; }
}
// случайные стихии ботов: без повторов и без пары похожих цветов
const CLASH = [[BOLT, SMILEY], [FIRE, SIX7], [MUSHROOM, GAS], [GAS, BOMB], [SLIME, SOUND], [WATER, TIME], [POISON, TIME],
  [ICE, BUBBLE], [WIND, BUBBLE], [CRYSTAL, BUBBLE], [SUN, GHOST], [PLANT, BOMB]];
function pickFree(used) {
  const opts = [...Array(NEL).keys()].filter(e => !used.includes(e) && !CLASH.some(([a, c]) => (a === e && used.includes(c)) || (c === e && used.includes(a))));
  return pick(opts.length ? opts : [...Array(NEL).keys()].filter(e => !used.includes(e)));
}
function recountState(st) { const keep = S; S = st; recount(); S = keep; }

export {
  W, H, N, DT, ROUND, FINAL, NEL, FIRE, ICE, PLANT, BOLT, WATER, EARTH, WIND, POISON, METAL, SUN, SAND, LAVA, SLIME, VOID, CRYSTAL,
  MUSHROOM, SMILEY, SIX7, GAS, SOUND, YINYANG, TIME, GHOST, BOMB, BUBBLE, GLITCH, CANDY, TITLE, WORD, ABOUT, STRONG, WEAK, DSTRONG, DWEAK, LAYERS, TOP, P, rnd, irnd, pick, shuffle, r2, rayCells, cellOf,
  newBall, Game, Duel, DUEL_ROUND, DUEL_SIZE, PACE, DUEL_PACE, pickFree, recountState, seedRandom,
};
