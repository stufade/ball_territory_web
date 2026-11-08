// Вход в Worker: /ws?room=abcd ведёт в комнату, /config.json отдаёт имя бота, /api/ev и /stats - статистика,
// остальное - файлы игры из public/.
import { Room } from "./room.js";
import { Stats } from "./stats.js";

export { Room, Stats };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const code = (url.searchParams.get("room") || "").toLowerCase();
      if (!/^[a-z0-9]{4}$/.test(code)) return new Response("bad room code", { status: 400 });
      if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
    }
    if (url.pathname === "/config.json") {
      return Response.json({ bot: env.BOT_USERNAME || "", app: env.APP_NAME || "" }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/tg/hook" && req.method === "POST") return telegram(req, url);
    if ((url.pathname === "/api/ev" && req.method === "POST") || url.pathname === "/stats" || url.pathname === "/stats.json") {
      return env.STATS.get(env.STATS.idFromName("all")).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

// Бот в Telegram: на /start (и любое сообщение в личке) отвечает кнопкой, которая открывает игру.
// Ответ идёт прямо в ответе на запрос Telegram, поэтому токен бота серверу не нужен.
// Подключить один раз: https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<сайт>/tg/hook
async function telegram(req, url) {
  let u;
  try { u = await req.json(); } catch (e) { return new Response("ok"); }
  const msg = u && u.message;
  if (!msg || !msg.chat || msg.chat.type !== "private") return new Response("ok");
  // ссылка-приглашение вида t.me/бот?start=r_abcd сразу ведёт в комнату друга
  const arg = String(msg.text || "").split(" ")[1] || "", room = (/^r_([a-z0-9]{4})$/i.exec(arg) || [])[1];
  const game = `${url.origin}/${room ? "?room=" + room.toLowerCase() : ""}`;
  return Response.json({
    method: "sendMessage", chat_id: msg.chat.id,
    text: room ? `Your friend is waiting in room ${room.toUpperCase()}! Tap to join.` : "Ball Territory: pick an element, paint the map, beat your friends!",
    reply_markup: { inline_keyboard: [[{ text: room ? "▶️ JOIN THE ROOM" : "▶️ PLAY", web_app: { url: game } }]] },
  });
}
