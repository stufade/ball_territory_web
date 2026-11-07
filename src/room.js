// Одна комната = один Durable Object. Бой считает сервер, телефоны только рисуют и шлют нажатия.
// Пока в комнате просто ждут, объект может уснуть (WebSocket Hibernation): данные игроков лежат во вложениях сокетов.
import { DurableObject } from "cloudflare:workers";
import { Game, NEL, DT, pickFree } from "../public/game.js";

const TICK_MS = 33;        // шаг цикла
const SNAP_MS = 66;        // снимок боя 15 раз в секунду
const AIM_LIMIT = 10;      // секунд на прицел
const SEATS = 4;
const SKIP = new Set(["wall"]);

const num = v => (Number.isFinite(+v) ? Math.max(-50, Math.min(50, +v)) : 0);
const clean = s => String(s || "").replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 16).trim();

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.game = null;
    this.phase = "lobby";
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
    const ps = this.people(), players = ps.slice(0, SEATS);
    return { t: "lobby", phase: this.phase, host: players[0] ? players[0].a.id : "",
      seats: players.map(p => ({ id: p.a.id, name: p.a.name, e: p.a.e })), watching: Math.max(0, ps.length - SEATS) };
  }
  sendLobby() { this.broadcast(this.lobbyMsg()); }

  // ---- сообщения ----------------------------------------------------------
  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    const a = ws.deserializeAttachment() || {};
    const save = () => ws.serializeAttachment(a);
    const players = this.people().slice(0, SEATS), isHost = players[0] && players[0].a.id === a.id;
    const seat = this.game ? this.seats.find(s => s.id === a.id) : null;
    switch (m.t) {
      case "hello":
        a.name = clean(m.name) || "Player"; a.auto = !!m.auto; a.prompts = m.prompts !== false; save();
        this.send(ws, { t: "you", id: a.id });
        this.sendLobby();
        if (this.game) this.send(ws, { t: "s", s: this.snap(true) });
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
    const alive = this.ctx.getWebSockets().filter(w => w !== ws);
    if (!alive.length) this.stop();
    else this.sendLobby();
  }

  // ---- матч ---------------------------------------------------------------
  start() {
    const players = this.people().slice(0, SEATS), used = players.map(p => p.a.e).filter(e => e >= 0);
    const seats = players.map(p => {
      let e = p.a.e;
      if (e < 0) { e = pickFree(used); used.push(e); }
      return { id: p.a.id, e, name: p.a.name || "Player", auto: p.a.auto, prompts: p.a.prompts };
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
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  tick() {
    const g = this.game;
    if (!g) return this.stop();
    const now = Date.now(), dt = Math.min(.1, (now - this.last) / 1000);
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
        if (S.done) { this.phase = "end"; break; }
      }
    }
    if (now - this.snapAt >= SNAP_MS || this.phase === "end") {
      this.snapAt = now;
      this.broadcast({ t: "s", s: this.snap(false) });
    }
    if (this.phase === "end") { this.stop(); this.sendLobby(); }
  }
  snap(full) {
    const ev = full ? [] : this.game.drain().filter(q => !SKIP.has(q[1]));  // новичку - без событий, остальным их не теряем
    return this.game.snapshot({ w: Date.now(), m: this.matchId, ph: this.phase === "end" ? "end" : this.phase === "aim" ? "aim" : "play", ev });
  }
}
