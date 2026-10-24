/**
 * אייקונים ומסך פתיחה לאפליקציית אנדרואיד מתוך public/icons/logo.svg.
 *   node scripts/android-assets.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const res = path.join(root, "android/app/src/main/res");
const svg = readFileSync(path.join(root, "public/icons/logo.svg"));
const BRAND = "#774a2b";
const CREAM = "#fdfbf7";

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// הלוגו בלי הרקע המעוגל: משמש כשכבת ה-foreground של אייקון אדפטיבי
const logoNoBg = Buffer.from(
  svg
    .toString()
    .replace(/<rect width="512" height="512" rx="112" fill="#774a2b"\/>/, ""),
);

for (const [d, scale] of Object.entries(densities)) {
  const dir = path.join(res, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * scale);
  const fg = Math.round(108 * scale);
  await sharp(svg).resize(legacy, legacy).png().toFile(path.join(dir, "ic_launcher.png"));
  // אייקון עגול: מסכה עגולה על הלוגו
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await sharp(svg)
    .resize(legacy, legacy)
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toFile(path.join(dir, "ic_launcher_round.png"));
  // foreground: הלוגו בתוך האזור הבטוח (66dp מתוך 108dp)
  const inner = Math.round(fg * 0.62);
  const logo = await sharp(logoNoBg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

writeFileSync(
  path.join(res, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND}</color>\n</resources>\n`,
);

// מסך פתיחה: רקע קרם עם הלוגו במרכז, לכל צפיפות ולכל כיוון
const splashSizes = {
  "drawable": [480, 320],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};
for (const [dir, [w, h]] of Object.entries(splashSizes)) {
  const size = Math.round(Math.min(w, h) * 0.3);
  const logo = await sharp(svg).resize(size, size).png().toBuffer();
  mkdirSync(path.join(res, dir), { recursive: true });
  await sharp({ create: { width: w, height: h, channels: 4, background: CREAM } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(res, dir, "splash.png"));
}

writeFileSync(
  path.join(res, "values/colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">${BRAND}</color>\n    <color name="colorPrimaryDark">#5c381f</color>\n    <color name="colorAccent">${BRAND}</color>\n</resources>\n`,
);
console.log("android assets ready");
