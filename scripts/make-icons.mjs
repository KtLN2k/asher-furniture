import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/logo.svg");
await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");
// maskable: תוכן בתוך אזור בטוח של 80%
const inner = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#774a2b" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
console.log("icons ready");
