/**
 * שרת קבצים לבדיקת הייצוא הסטטי (out/) שמתנהג כמו שרת ה-WebView של Capacitor:
 * כל נתיב בלי סיומת קובץ מקבל את index.html של השורש, וקבצים מוגשים כמו שהם.
 *   node scripts/serve-static.mjs [dir=out] [port=4173]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] || "out");
const port = Number(process.argv[3] || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || !p.split("/").pop().includes(".")) p = "/index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": mime[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`static app: http://localhost:${port} (${root})`));
