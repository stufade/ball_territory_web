// Вход в Worker: /ws?room=abcd ведёт в комнату, /config.json отдаёт имя бота, остальное - файлы игры из public/.
import { Room } from "./room.js";

export { Room };

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
    return env.ASSETS.fetch(req);
  },
};
