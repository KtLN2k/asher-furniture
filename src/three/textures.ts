import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { WoodTexture } from "@/domain/materials";

/** טקסטורות פרוצדורליות על canvas: אין הורדות, אין נכסים חיצוניים. דטרמיניסטיות (זרע קבוע). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement, color: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  if (color) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (c: number[], f = 1, a = 1) => `rgba(${Math.round(Math.min(255, c[0] * f))},${Math.round(Math.min(255, c[1] * f))},${Math.round(Math.min(255, c[2] * f))},${a})`;

export interface TexturePair {
  map: Texture;
  bump: Texture | null;
}

const cache = new Map<string, TexturePair>();

/** עץ: סיבים אנכיים (לאורך v) עם גלים, נקבוביות ושינויי גוון, חוזר בצורה חלקה. */
export function woodTexture(kind: WoodTexture, hex: string, size: number, withBump: boolean): TexturePair {
  const key = `wood|${kind}|${hex}|${size}|${withBump}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(kind === "oak" ? 11 : 29);
  const base = parse(hex);
  const [c, ctx] = canvas(size);
  const [bc, bctx] = canvas(size);
  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, size, size);

  const bands = Math.round(size / 28);
  for (let i = 0; i < bands; i++) {
    const x = rand() * size;
    const w = 30 + rand() * 90;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    const f = 0.9 + rand() * 0.2;
    g.addColorStop(0, rgb(base, f, 0));
    g.addColorStop(0.5, rgb(base, f, 0.35));
    g.addColorStop(1, rgb(base, f, 0));
    ctx.fillStyle = g;
    for (const dx of [-size, 0, size]) {
      ctx.save();
      ctx.translate(dx, 0);
      ctx.fillRect(x - w, 0, w * 2, size);
      ctx.restore();
    }
  }

  const lines = Math.round(size * 0.9);
  const dark = kind === "walnut" ? 0.55 : 0.72;
  for (let i = 0; i < lines; i++) {
    const x0 = rand() * size;
    const wob = 2 + rand() * 6;
    const freq = (1 + rand() * 3) * ((Math.PI * 2) / size);
    const phase = rand() * 6.28;
    const alpha = 0.04 + rand() * 0.16;
    const lw = 0.5 + rand() * 1.8;
    const light = rand() < 0.25;
    for (const dx of [-size, 0, size]) {
      ctx.beginPath();
      for (let y = 0; y <= size; y += 8) {
        const x = x0 + dx + Math.sin(y * freq + phase) * wob;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = light ? rgb(base, 1.18, alpha) : rgb(base, dark, alpha * 1.6);
      ctx.lineWidth = lw;
      ctx.stroke();
      if (withBump && !light) {
        bctx.beginPath();
        for (let y = 0; y <= size; y += 8) {
          const x = x0 + dx + Math.sin(y * freq + phase) * wob;
          if (y === 0) bctx.moveTo(x, y);
          else bctx.lineTo(x, y);
        }
        bctx.strokeStyle = `rgba(40,40,40,${alpha * 1.5})`;
        bctx.lineWidth = lw;
        bctx.stroke();
      }
    }
  }
  const pores = Math.round(size * 2.2);
  for (let i = 0; i < pores; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rgb(base, dark * 0.9, 0.12 + rand() * 0.2);
    ctx.fillRect(x, y, 1, 2 + rand() * 7);
  }
  const pair: TexturePair = { map: toTexture(c, true), bump: withBump ? toTexture(bc, false) : null };
  cache.set(key, pair);
  return pair;
}

/** רעש עדין למשטח מט: מפת בליטה בלבד, שובר את המראה ה״פלסטי״. */
export function grainBump(size: number): Texture {
  const key = `grain|${size}`;
  const hit = cache.get(key);
  if (hit) return hit.map;
  const rand = rng(5);
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rand() - 0.5) * 70;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, false);
  cache.set(key, { map: t, bump: null });
  return t;
}

/** פרקט אלון: קרשים מדורגים, כל קרש בגוון שונה, סיבים ומרווחי חיבור כהים. */
export function parquetTexture(size: number, withBump: boolean): TexturePair {
  const key = `parquet|${size}|${withBump}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(77);
  const [c, ctx] = canvas(size);
  const [bc, bctx] = canvas(size);
  const base = parse("#c3ab88");
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, size, size);
  const cols = 12;
  const plankW = size / cols;
  const rows = 1;
  const plankL = size / rows;
  for (let col = 0; col < cols; col++) {
    const offset = rand() * plankL;
    for (let row = -1; row <= rows; row++) {
      const x = col * plankW;
      const y = row * plankL + offset;
      const f = 0.95 + rand() * 0.1;
      ctx.fillStyle = rgb(base, f);
      ctx.fillRect(x, y, plankW, plankL);
      const streaks = Math.round(plankW / 2.2);
      for (let i = 0; i < streaks; i++) {
        const sx = x + rand() * plankW;
        ctx.strokeStyle = rgb(base, f * (rand() < 0.5 ? 0.82 : 1.1), 0.06 + rand() * 0.1);
        ctx.lineWidth = 0.6 + rand() * 1.2;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.bezierCurveTo(sx + (rand() - 0.5) * 6, y + plankL * 0.3, sx + (rand() - 0.5) * 6, y + plankL * 0.7, sx + (rand() - 0.5) * 3, y + plankL);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(40,22,8,0.4)";
      ctx.fillRect(x, y, plankW, 1.2);
      ctx.fillRect(x, y, 1.4, plankL);
      if (withBump) {
        bctx.fillStyle = "rgba(0,0,0,0.9)";
        bctx.fillRect(x, y, plankW, 2);
        bctx.fillRect(x, y, 2, plankL);
      }
    }
  }
  const pair: TexturePair = { map: toTexture(c, true), bump: withBump ? toTexture(bc, false) : null };
  cache.set(key, pair);
  return pair;
}

/** קיר צבוע: צבע אחיד עם רעש עדין מאוד. */
export function wallBump(size: number): Texture {
  return grainBump(size);
}
