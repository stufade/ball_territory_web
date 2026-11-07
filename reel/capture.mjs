// Снимает рилс с самой игры: собирает reel.html, открывает его в Chrome, забирает кадры и пишет видео без звука,
// а события боя - в audio.json для reel/audio.py.
// node reel/capture.mjs reel/plan.json out/reel-video.mp4 out/reel-audio.json
import fs from "fs";
import http from "http";
import path from "path";
import { spawn } from "child_process";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [planFile, outVideo, outAudio] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// reel.html = index.html без обычного цикла + режиссёр
let html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
html = html.replace("<head>", "<head><script>window.REEL = true;</script>");
const tail = "requestAnimationFrame(frame);\n</script>";
if (!html.includes(tail)) throw new Error("index.html changed: cannot find the main loop start");
html = html.replace(tail, "if (!window.REEL) requestAnimationFrame(frame);\n" + fs.readFileSync(path.join(root, "reel/director.js"), "utf8") + "\n</script>");
const files = { "/reel.html": html, "/game.js": fs.readFileSync(path.join(root, "public/game.js")) };
const server = http.createServer((req, res) => {
  const p = req.url.split("?")[0].split("#")[0];
  if (p === "/config.json") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"bot":"","app":""}'); return; }
  const body = files[p];
  if (!body) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body);
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/reel.html#${encodeURIComponent(JSON.stringify(plan))}`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction("window.reel && window.reel.ready", { timeout: 20000 });

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-r", "30", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outVideo], { stdio: ["pipe", "inherit", "inherit"] });
let n = 0;
for (;;) {
  const url = await page.evaluate(() => window.reel.step());
  if (!url) break;
  const ok = ff.stdin.write(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  if (!ok) await new Promise(r => ff.stdin.once("drain", r));
  if (++n % 150 === 0) console.log("кадров", n);
  if (process.env.MAX && n >= +process.env.MAX) break;  // короткий пробный прогон
}
ff.stdin.end();
await new Promise(r => ff.on("close", r));
fs.writeFileSync(outAudio, JSON.stringify({ frames: n, events: await page.evaluate(() => window.reel.audio) }));
await browser.close();
server.close();
console.log("готово", outVideo, "кадров", n, "секунд", (n / 30).toFixed(1), "ошибок страницы", errors.length, errors.slice(0, 3));
