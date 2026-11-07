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
    if ((url.pathname === "/api/ev" && req.method === "POST") || url.pathname === "/stats" || url.pathname === "/stats.json") {
      return env.STATS.get(env.STATS.idFromName("all")).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};
