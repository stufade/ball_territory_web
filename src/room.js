// Одна комната = один Durable Object. Бой считает сервер, телефоны только рисуют и шлют нажатия.
// Пока в комнате просто ждут, объект может уснуть (WebSocket Hibernation): данные игроков лежат во вложениях сокетов.
import { DurableObject } from "cloudflare:workers";
import { Game, Duel, Draft, botDraft, botChoose, NEL, N, DT, pickFree } from "../public/game.js";

const TICK_MS = 33;        // шаг цикла
const SNAP_MS = 66;        // снимок боя 15 раз в секунду
const AIM_LIMIT = 10;      // секунд на прицел
const SEATS = 4;
const ROUND_PAUSE = 3500;  // мс между раундами дуэли
const DRAFT_TURN = 15000;  // мс на ход в драфте, потом случайный шар
const CHOOSE_TIME = 10000; // мс на выбор шара перед раундом
const BOT_THINK = 900;     // бот «думает» в драфте, чтобы было видно его ход
const seatsFor = mode => mode === "duel" ? 2 : SEATS;
const SKIP = new Set(["wall"]);

const num = v => (Number.isFinite(+v) ? Math.max(-50, Math.min(50, +v)) : 0);
const clean = s => String(s || "").replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 16).trim();

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.game = null;
    this.phase = "lobby";
    this.mode = "ffa";      // ffa - каждый за себя на 4, duel - 1 на 1, по 3 шара
    this.duel = null;
    this.sides = [];
    this.matchId = 0;
    this.seats = [];        // [{id, e, name}] того матча, что идёт
    this.launched = new Set();
    this.timer = null;
    this.aimAt = 0;
    this.last = 0;
    this.acc = 0;
    this.snapAt = 0;
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), name: "", e: -1, joined: Date.now(), auto: false, prompts: true });
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- кто в комнате ------------------------------------------------------
  people() {
    return this.ctx.getWebSockets().map(ws => ({ ws, a: ws.deserializeAttachment() || {} })).filter(p => p.a.id)
      .sort((x, y) => x.a.joined - y.a.joined);
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* сокет закрылся */ } }
  broadcast(msg) { const s = JSON.stringify(msg); for (const ws of this.ctx.getWebSockets()) { try { ws.send(s); } catch (e) { /* закрыт */ } } }
  lobbyMsg() {
    const ps = this.people(), cap = seatsFor(this.mode), players = ps.slice(0, cap);
    return { t: "lobby", phase: this.phase, mode: this.mode, host: players[0] ? players[0].a.id : "",
      seats: players.map(p => ({ id: p.a.id, name: p.a.name, e: p.a.e })), watching: Math.max(0, ps.length - cap) };
  }
  sendLobby() { this.broadcast(this.lobbyMsg()); }

  // ---- сообщения ----------------------------------------------------------
  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    const a = ws.deserializeAttachment() || {};
    const save = () => ws.serializeAttachment(a);
    const players = this.people().slice(0, seatsFor(this.mode)), isHost = players[0] && players[0].a.id === a.id;
    const seat = this.game ? this.seats.find(s => s.id === a.id) : null;
    switch (m.t) {
      case "hello":
        a.name = clean(m.name) || "Player"; a.auto = !!m.auto; a.prompts = m.prompts !== false;
        a.cid = String(m.cid || "").replace(/[^a-z0-9]/g, "").slice(0, 12); save();
        this.send(ws, { t: "you", id: a.id });
        this.sendLobby();
        if (this.phase === "draft" || this.phase === "choose") this.send(ws, this.duelMsg());
        else if (this.game) this.send(ws, { t: "s", s: this.snap(true) });
        break;
      case "name":
        a.name = clean(m.name) || a.name; save(); this.sendLobby();
        break;
      case "settings":
        a.auto = !!m.auto; a.prompts = m.prompts !== false; save();
        break;
      case "pick": {
        const e = m.e | 0;
        if (e < 0 || e >= NEL || this.phase !== "lobby" && this.phase !== "end") return;
        if (players.some(p => p.a.id !== a.id && p.a.e === e)) return;
        a.e = e; save(); this.sendLobby();
        break;
      }
      case "dpick": {  // ход в драфте дуэли
        const side = this.sideOf(a.id);
        if (this.phase === "draft" && side >= 0 && this.draft.pick(side, m.e | 0)) this.afterDraftPick();
        break;
      }
      case "dchoose": {  // шар на следующий раунд
        const side = this.sideOf(a.id);
        if (this.phase === "choose" && side >= 0 && this.duel.choose(side, m.e | 0)) this.afterChoose();
        break;
      }
      case "mode":
        if (isHost && (this.phase === "lobby" || this.phase === "end")) { this.mode = m.m === "duel" ? "duel" : "ffa"; this.sendLobby(); }
        break;
      case "start":
        if (isHost && (this.phase === "lobby" || this.phase === "end")) {
          try { this.start(); } catch (e) { console.error("start failed", e && e.stack); this.broadcast({ t: "error", msg: "start failed" }); }
        }
        break;
      case "lobby":
        if (isHost && this.phase === "end") { this.phase = "lobby"; this.game = null; this.sendLobby(); }
        break;
      case "aim":
        if (seat && this.phase === "aim") this.game.steer(seat.e, num(m.dx), num(m.dy));
        break;
      case "launch":
        if (seat && this.phase === "aim") { this.launched.add(a.id); if (Array.isArray(m.d)) this.game.steer(seat.e, num(m.d[0]), num(m.d[1])); }
        break;
      case "press":
        if (seat && this.phase === "play") this.game.press(seat.e);
        break;
      case "dir":
        if (seat && this.phase === "play") this.game.redirect(seat.e, num(m.dx), num(m.dy));
        break;
      case "ping":
        this.send(ws, { t: "pong", c: m.c });
        break;
    }
  }

  async webSocketClose(ws) {
    try { ws.close(1000, "bye"); } catch (e) { /* уже закрыт */ }
    this.left(ws);
  }
  async webSocketError(ws) { this.left(ws); }
  left(ws) {
    const a = ws.deserializeAttachment() || {};
    if (this.game) {
      const s = this.seats.find(q => q.id === a.id);
      if (s) { const b = this.game.S.by[s.e]; if (b) { b.ctl = null; b.name = (b.name || "") + " (BOT)"; } s.id = ""; }
    }
    // ушедший из дуэли: дальше за него драфтит, выбирает и играет бот
    const side = this.phase !== "lobby" && this.phase !== "end" ? this.sideOf(a.id) : -1;
    if (side >= 0) {
      this.sides[side].id = ""; this.sides[side].name += " (BOT)";
      if (this.duel) { this.duel.ctls[side] = null; if (this.phase === "choose" && this.duel.cur[side] < 0) { this.duel.choose(side, botChoose(this.duel, side)); this.afterChoose(); } }
    }
    const alive = this.ctx.getWebSockets().filter(w => w !== ws);
    if (!alive.length) this.stop();
    else this.sendLobby();
  }

  // ---- матч ---------------------------------------------------------------
  start() {
    if (this.mode === "duel") return this.startDuel();
    this.duel = null; this.sides = [];
    const players = this.people().slice(0, SEATS), used = players.map(p => p.a.e).filter(e => e >= 0);
    const seats = players.map(p => {
      let e = p.a.e;
      if (e < 0) { e = pickFree(used); used.push(e); }
      return { id: p.a.id, e, name: p.a.name || "Player", auto: p.a.auto, prompts: p.a.prompts, cid: p.a.cid || "" };
    });
    while (seats.length < SEATS) { const e = pickFree(used); used.push(e); seats.push({ id: "", e, name: "" }); }
    this.game = new Game(seats.map(s => ({ e: s.e, ctl: s.id || null })));
    for (const s of seats) {
      const b = this.game.S.by[s.e];
      b.name = s.name; b.pid = s.id; b.auto = !!s.auto; b.prompts = s.prompts !== false;
    }
    this.seats = seats;
    this.matchId++;
    this.phase = "aim";
    this.launched = new Set();
    this.aimAt = Date.now();
    this.game.drain();
    this.broadcast({ t: "start", m: this.matchId, seats: seats.map(s => ({ id: s.id, e: s.e, name: s.name })) });
    this.sendLobby();
    this.last = Date.now(); this.acc = 0; this.snapAt = 0;
    if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error("tick failed", e && e.stack); this.stop(); } }, TICK_MS);
  }
  // ---- дуэль: драфт по очереди, выбор шара перед раундом, раунды ----------
  sideOf(id) { return this.sides.findIndex(q => q.id && q.id === id); }
  duelMsg() {
    const dm = this.duel ? this.duel.meta() : null;
    return { t: "duel", ph: this.phase, draft: this.draft.meta(), dm, blind: this.blind, names: this.sides.map(s => s.name), pids: this.sides.map(s => s.id),
      left: Math.max(0, (this.phase === "draft" ? DRAFT_TURN - (Date.now() - this.turnAt) : CHOOSE_TIME - (Date.now() - this.chooseAt))) };
  }
  startDuel() {
    const sides = this.people().slice(0, 2).map(p => ({ id: p.a.id, name: p.a.name || "Player", cid: p.a.cid || "", auto: p.a.auto, prompts: p.a.prompts }));
    while (sides.length < 2) sides.push({ id: "", name: "BOT", cid: "" });
    this.sides = sides; this.duel = null; this.game = null;
    this.draft = new Draft(Math.random() < .5 ? 0 : 1);
    this.phase = "draft"; this.turnAt = Date.now(); this.matchId++;
    this.sendLobby(); this.broadcast(this.duelMsg());
    this.last = Date.now();
    if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error("tick failed", e && e.stack); this.stop(); } }, TICK_MS);
  }
  afterDraftPick() {
    this.turnAt = Date.now();
    if (this.draft.done) {
      this.duel = new Duel(this.draft.teams, this.sides.map(s => s.id || null));
      this.enterChoose();
    } else this.broadcast(this.duelMsg());
  }
  enterChoose() {
    this.phase = "choose"; this.chooseAt = Date.now();
    const need = this.duel.need();
    this.blind = need.length === 2;
    for (const i of need) if (!this.sides[i].id) this.duel.choose(i, botChoose(this.duel, i));  // бот выбирает сразу, но шар покажут со стартом раунда
    this.broadcast(this.duelMsg());
    if (!this.duel.need().length) this.duelRound();
  }
  afterChoose() {
    if (this.duel.need().length) this.broadcast(this.duelMsg());
    else this.duelRound();
  }
  duelRound() {
    const g = this.game = this.duel.newRound();
    this.seats = this.sides.map((s, i) => ({ id: s.id, e: this.duel.cur[i], name: s.name, auto: s.auto, prompts: s.prompts, cid: s.cid }));
    for (const s of this.seats) { const b = g.S.by[s.e]; b.name = s.name; b.pid = s.id; b.auto = !!s.auto; b.prompts = s.prompts !== false; }
    this.matchId++; this.phase = "aim"; this.launched = new Set(); this.aimAt = Date.now(); g.drain();
    this.last = Date.now(); this.acc = 0; this.snapAt = 0;
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  tick() {
    const now = Date.now();
    if (this.phase === "draft") {
      const side = this.draft.turn(), bot = !this.sides[side].id;
      if ((bot && now - this.turnAt > BOT_THINK) || now - this.turnAt > DRAFT_TURN) {
        this.draft.pick(side, bot ? botDraft(this.draft, side) : pickFree([...this.draft.teams[0], ...this.draft.teams[1]]));
        this.afterDraftPick();
      }
      return;
    }
    if (this.phase === "choose") {
      if (now - this.chooseAt > CHOOSE_TIME) { for (const i of this.duel.need()) { const l = this.duel.left(i); this.duel.choose(i, l[Math.floor(Math.random() * l.length)]); } this.afterChoose(); }
      return;
    }
    const g = this.game;
    if (!g) return this.stop();
    const dt = Math.min(.1, (now - this.last) / 1000);
    this.last = now;
    // настройки игроков могли поменяться
    for (const p of this.people()) {
      const s = this.seats.find(q => q.id && q.id === p.a.id);
      if (s && g.S.by[s.e]) { g.S.by[s.e].auto = !!p.a.auto; g.S.by[s.e].prompts = p.a.prompts !== false; }
    }
    if (this.phase === "aim") {
      const humans = this.seats.filter(s => s.id);
      if (humans.every(s => this.launched.has(s.id)) || now - this.aimAt > AIM_LIMIT * 1000) { g.launch(); this.phase = "play"; }
    } else if (this.phase === "play") {
      const S = g.S;
      const prompts = S.t < S.promptUntil && S.balls.some(b => b.ctl && b.prompts !== false);
      this.acc += dt * (S.slow > 0 ? 1 / 3 : 1) * (prompts ? .5 : 1);
      let n = 0;
      while (this.acc >= DT && n < 6) {
        this.acc -= DT; n++;
        if (S.slow > 0) S.slow -= DT;
        g.step();
        if (S.done) {
          if (this.duel) { this.duel.endRound(); this.record(); this.phase = "rend"; this.rendAt = now; }
          else this.phase = "end";
          break;
        }
      }
    } else if (this.phase === "rend" && now - this.rendAt > ROUND_PAUSE) {
      if (this.duel.done) this.phase = "end";
      else this.enterChoose();
    }
    if (this.phase === "choose") return;
    if (now - this.snapAt >= SNAP_MS || this.phase === "end") {
      this.snapAt = now;
      this.broadcast({ t: "s", s: this.snap(false) });
    }
    if (this.phase === "end") { this.stop(); this.sendLobby(); if (!this.duel) this.record(); }
  }
  // итог матча в общую статистику; сбой статистики не мешает игре
  record() {
    try {
      const S = this.game.S, order = S.players.slice().sort((a, b) => S.counts[b] - S.counts[a]);
      const seats = this.seats.map(s => ({ e: s.e, human: !!s.id, cid: s.cid || "", place: order.indexOf(s.e) + 1,
        pct: Math.round(S.counts[s.e] / N * 1000) / 10, kills: S.by[s.e].kills, powers: S.by[s.e].powers }));
      const stub = this.env.STATS.get(this.env.STATS.idFromName("all"));
      this.ctx.waitUntil(stub.match({ mode: this.duel ? "duel" : "room", reactions: S.reactions, seats }).catch(e => console.error("stats failed", e && e.message)));
    } catch (e) { console.error("stats failed", e && e.stack); }
  }
  snap(full) {
    const ev = full ? [] : this.game.drain().filter(q => !SKIP.has(q[1]));  // новичку - без событий, остальным их не теряем
    const dm = this.duel ? Object.assign(this.duel.meta(), { names: this.sides.map(s => s.name), pids: this.sides.map(s => s.id) }) : undefined;
    const ph = ["end", "aim", "rend"].includes(this.phase) ? this.phase : "play";
    return this.game.snapshot({ w: Date.now(), m: this.matchId, ph, ev, dm });
  }
}
