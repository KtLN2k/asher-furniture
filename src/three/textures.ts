import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { WoodTexture } from "@/domain/materials";

/**
 * טקסטורות פרוצדורליות: אין הורדות ואין נכסים חיצוניים, כולן דטרמיניסטיות (זרע קבוע) וניתנות לריצוף.
 * רעש ערכים מחזורי לפי גודל האריח, כך שהקצוות מתחברים בלי תפר. כל טקסטורה מגיעה עם מפת צבע,
 * מפת בליטה ומפת חספוס (חריצים וחיבורים מחוספסים יותר מהמשטח), כדי שהחומר יגיב לתאורה כמו חומר אמיתי.
 */
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

/** רעש ערכים דו-ממדי מחזורי: u,v בטווח [0,1) מתחברים בקצוות. */
function tileNoise(seed: number, cx: number, cy: number) {
  const rand = rng(seed);
  const grid = new Float32Array(cx * cy);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  return (u: number, v: number): number => {
    const x = u * cx;
    const y = v * cy;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % cx) + cx) % cx;
    const y0 = ((yi % cy) + cy) % cy;
    const x1 = (x0 + 1) % cx;
    const y1 = (y0 + 1) % cy;
    const a = grid[y0 * cx + x0];
    const b = grid[y0 * cx + x1];
    const c = grid[y1 * cx + x0];
    const d = grid[y1 * cx + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(seed: number, cx: number, cy: number, octaves: number) {
  const layers = Array.from({ length: octaves }, (_, i) => tileNoise(seed + i * 101, cx * 2 ** i, cy * 2 ** i));
  let norm = 0;
  for (let i = 0; i < octaves; i++) norm += 0.5 ** i;
  return (u: number, v: number): number => {
    let s = 0;
    for (let i = 0; i < octaves; i++) s += layers[i](u, v) * 0.5 ** i;
    return s / norm;
  };
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function toTexture(c: HTMLCanvasElement, color: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  if (color) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

interface Planes {
  size: number;
  color: ImageData;
  bump: ImageData | null;
  rough: ImageData | null;
  ctx: [CanvasRenderingContext2D, CanvasRenderingContext2D | null, CanvasRenderingContext2D | null];
  canvases: [HTMLCanvasElement, HTMLCanvasElement | null, HTMLCanvasElement | null];
}

function planes(size: number, withBump: boolean, withRough: boolean): Planes {
  const make = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return [c, c.getContext("2d")!];
  };
  const [cc, cctx] = make();
  const b = withBump ? make() : null;
  const r = withRough ? make() : null;
  return {
    size,
    color: cctx.createImageData(size, size),
    bump: b ? b[1].createImageData(size, size) : null,
    rough: r ? r[1].createImageData(size, size) : null,
    ctx: [cctx, b ? b[1] : null, r ? r[1] : null],
    canvases: [cc, b ? b[0] : null, r ? r[0] : null],
  };
}

function put(p: Planes, i: number, r: number, g: number, b: number, bump = 0.5, rough = 0.8): void {
  const o = i * 4;
  p.color.data[o] = r;
  p.color.data[o + 1] = g;
  p.color.data[o + 2] = b;
  p.color.data[o + 3] = 255;
  if (p.bump) {
    const v = clamp(bump) * 255;
    p.bump.data[o] = p.bump.data[o + 1] = p.bump.data[o + 2] = v;
    p.bump.data[o + 3] = 255;
  }
  if (p.rough) {
    const v = clamp(rough) * 255;
    p.rough.data[o] = p.rough.data[o + 1] = p.rough.data[o + 2] = v;
    p.rough.data[o + 3] = 255;
  }
}

function finish(p: Planes): TexturePair {
  p.ctx[0].putImageData(p.color, 0, 0);
  if (p.bump && p.ctx[1]) p.ctx[1].putImageData(p.bump, 0, 0);
  if (p.rough && p.ctx[2]) p.ctx[2].putImageData(p.rough, 0, 0);
  return {
    map: toTexture(p.canvases[0], true),
    bump: p.canvases[1] ? toTexture(p.canvases[1], false) : null,
    rough: p.canvases[2] ? toTexture(p.canvases[2], false) : null,
  };
}

export interface TexturePair {
  map: Texture;
  bump: Texture | null;
  rough?: Texture | null;
}

const cache = new Map<string, TexturePair>();

interface WoodParams {
  base: [number, number, number];
  /** מספר טבעות גידול לרוחב האריח (שלם, כדי שיתחבר). */
  rings: number;
  warp: number;
  contrast: number;
  fibre: number;
  pores: number;
}

/** פיקסל עץ: טבעות גידול מעוותות, סיבים דקים לאורך, נקבוביות ושינויי גוון. v הוא כיוון הסיב. */
function woodSampler(seed: number, prm: WoodParams) {
  const warpN = fbm(seed, 4, 2, 3);
  const bandN = fbm(seed + 7, 3, 2, 2);
  const fibreN = tileNoise(seed + 13, 96, 3);
  const fibreN2 = tileNoise(seed + 17, 48, 9);
  const poreN = tileNoise(seed + 19, 160, 18);
  return (u: number, v: number) => {
    const w = (warpN(u, v) - 0.5) * prm.warp;
    const ring = u * prm.rings + w + (bandN(u, v) - 0.5) * 0.5;
    const f = ring - Math.floor(ring);
    const late = smooth(0.0, 0.72, f) * (1 - smooth(0.72, 1.0, f));
    const tone = 1 - prm.contrast * (1 - late) * (0.6 + 0.4 * bandN(v, u));
    const fib = fibreN(u, v) * 0.6 + fibreN2(u, v) * 0.4;
    const pore = poreN(u, v);
    const poreDark = pore < 0.2 ? (0.2 - pore) / 0.2 : 0;
    const shade = tone * (1 - prm.fibre * (0.5 - fib)) * (1 - prm.pores * poreDark);
    return { shade, groove: clamp(0.5 + (fib - 0.5) * 0.9 - poreDark * 0.5), poreDark };
  };
}

const WOOD_PRESETS: Record<WoodTexture, Omit<WoodParams, "base">> = {
  oak: { rings: 7, warp: 1.7, contrast: 0.2, fibre: 0.3, pores: 0.28 },
  walnut: { rings: 6, warp: 2, contrast: 0.3, fibre: 0.38, pores: 0.34 },
};

/** עץ לרהיט: טבעות גידול וסיבים אמיתיים יותר, בקנה מידה של לוח. */
export function woodTexture(kind: WoodTexture, hex: string, size: number, withBump: boolean): TexturePair {
  const key = `wood|${kind}|${hex}|${size}|${withBump}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = parse(hex);
  const sample = woodSampler(kind === "oak" ? 11 : 29, { base, ...WOOD_PRESETS[kind] });
  const p = planes(size, withBump, withBump);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = sample(x / size, y / size);
      const k = clamp(s.shade, 0.35, 1.25);
      put(p, y * size + x, clamp(base[0] * k, 0, 255), clamp(base[1] * k * 0.995, 0, 255), clamp(base[2] * k * 0.985, 0, 255), s.groove, 0.82 + s.poreDark * 0.18);
    }
  }
  const pair = finish(p);
  cache.set(key, pair);
  return pair;
}

/** רעש עדין למשטח מט: מפת בליטה בלבד, שובר את המראה ה״פלסטי״. */
export function grainBump(size: number): Texture {
  const key = `grain|${size}`;
  const hit = cache.get(key);
  if (hit) return hit.map;
  const rand = rng(5);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
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

/** קיר צבוע: צבע אחיד עם רעש עדין מאוד. */
export function wallBump(size: number): Texture {
  return grainBump(size);
}

export interface ParquetOptions {
  /** גוון בסיס של הקרשים. */
  hex: string;
  /** מספר קרשים לרוחב האריח (2.4 מ׳) ואורך כל קרש באריחים (1 = כל הגובה). */
  columns: number;
  rows: number;
  /** שונות בגוון בין קרשים (0–1). */
  variation: number;
  /** שכבת הברק של הרצפה (חספוס בסיסי). */
  roughness: number;
}

export const PARQUET_OAK: ParquetOptions = { hex: "#a89883", columns: 12, rows: 2, variation: 0.05, roughness: 0.5 };

/** פרקט: קרשים מדורגים, כל קרש בגוון וצורת סיב משלו, חיבורים כהים מדורגים ושיפוע בקצוות. */
export function parquetTexture(size: number, withBump: boolean, opts: ParquetOptions = PARQUET_OAK): TexturePair {
  const key = `parquet|${size}|${withBump}|${opts.hex}|${opts.columns}|${opts.rows}|${opts.variation}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(77);
  const base = parse(opts.hex);
  const { columns: cols, rows } = opts;
  const plankW = size / cols;
  const plankL = size / rows;
  const sampleFor = Array.from({ length: cols * 2 }, (_, i) =>
    woodSampler(100 + i * 17, { base, rings: 1 + (i % 2), warp: 0.9 + (i % 4) * 0.3, contrast: 0.08, fibre: 0.13, pores: 0.1 }),
  );
  const plank = Array.from({ length: cols }, () => ({
    offset: Math.floor(rand() * size),
    tone: Array.from({ length: rows }, () => 1 + (rand() - 0.5) * 2 * opts.variation),
    warm: Array.from({ length: rows }, () => (rand() - 0.5) * 0.04),
    shift: Array.from({ length: rows }, () => rand()),
    alt: Array.from({ length: rows }, () => Math.floor(rand() * 2)),
  }));
  const p = planes(size, withBump, true);
  const gap = Math.max(1.2, size / 1400);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = Math.min(cols - 1, Math.floor(x / plankW));
      const pk = plank[col];
      const yy = (y - pk.offset + size) % size;
      const row = Math.min(rows - 1, Math.floor(yy / plankL));
      const lx = x - col * plankW;
      const ly = yy - row * plankL;
      const s = sampleFor[col * 2 + pk.alt[row]]((lx / plankW + pk.shift[row]) % 1, ((ly / plankL) * 0.5 + pk.shift[row] * 0.5) % 1);
      const k = clamp(s.shade * pk.tone[row], 0.4, 1.3);
      const edge = Math.min(lx, plankW - lx, ly, plankL - ly);
      const seam = 1 - smooth(0, gap, edge);
      const bevel = 1 - smooth(gap, gap * 3.2, edge);
      const dark = 1 - 0.42 * seam - 0.06 * bevel;
      put(
        p,
        y * size + x,
        clamp(base[0] * k * dark * (1 + pk.warm[row]), 0, 255),
        clamp(base[1] * k * dark, 0, 255),
        clamp(base[2] * k * dark * (1 - pk.warm[row]), 0, 255),
        clamp(s.groove * 0.55 + 0.4 - seam * 0.5 - bevel * 0.08),
        clamp(opts.roughness + 0.22 * seam + s.poreDark * 0.1 + 0.06 * (1 - s.groove)),
      );
    }
  }
  const pair = finish(p);
  cache.set(key, pair);
  return pair;
}

export interface TileOptions {
  hex: string;
  grout: string;
  /** מספר אריחים לרוחב ולגובה האריח הלוגי. */
  nx: number;
  ny: number;
  variation: number;
  roughness: number;
}

/** חיפוי קרמי: אריחים עם שונות עדינה, פוגות כהות וחספוס גבוה בפוגות. */
export function tileTexture(size: number, withBump: boolean, o: TileOptions): TexturePair {
  const key = `tile|${size}|${withBump}|${o.hex}|${o.grout}|${o.nx}|${o.ny}|${o.variation}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = rng(303);
  const base = parse(o.hex);
  const grout = parse(o.grout);
  const tones = Array.from({ length: o.nx * o.ny }, () => 1 + (rand() - 0.5) * 2 * o.variation);
  const mottle = fbm(41, 6, 6, 4);
  const fine = tileNoise(43, 128, 128);
  const p = planes(size, withBump, true);
  const cw = size / o.nx;
  const ch = size / o.ny;
  const gw = Math.max(2, size / 360);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / cw);
      const ty = Math.floor(y / ch);
      const lx = x - tx * cw;
      const ly = y - ty * ch;
      const edge = Math.min(lx, cw - lx, ly, ch - ly);
      const inGrout = 1 - smooth(gw * 0.5, gw, edge);
      const m = mottle(x / size, y / size);
      const k = (tones[ty * o.nx + tx] ?? 1) * (0.96 + 0.08 * m) * (0.985 + 0.03 * fine(x / size, y / size));
      const r = base[0] * k * (1 - inGrout) + grout[0] * inGrout;
      const g = base[1] * k * (1 - inGrout) + grout[1] * inGrout;
      const b = base[2] * k * (1 - inGrout) + grout[2] * inGrout;
      put(p, y * size + x, clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 0.62 - inGrout * 0.5 + 0.04 * m, o.roughness + inGrout * (0.95 - o.roughness));
    }
  }
  const pair = finish(p);
  cache.set(key, pair);
  return pair;
}

/** בטון/צמנט חלק: כתמים רכים מאוד לחלל ניטרלי. */
export function concreteTexture(size: number, hex: string, withBump: boolean): TexturePair {
  const key = `concrete|${size}|${hex}|${withBump}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = parse(hex);
  const big = fbm(61, 3, 3, 4);
  const fine = tileNoise(67, 160, 160);
  const p = planes(size, withBump, true);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const m = big(u, v);
      const f = fine(u, v);
      const k = 0.93 + 0.12 * m + 0.03 * f;
      put(p, y * size + x, clamp(base[0] * k, 0, 255), clamp(base[1] * k, 0, 255), clamp(base[2] * k, 0, 255), 0.45 + 0.1 * f + 0.1 * m, 0.55 + 0.25 * m);
    }
  }
  const pair = finish(p);
  cache.set(key, pair);
  return pair;
}

/** שטיח אריג: צבע בסיס עם חוטים עדינים ופס שוליים. */
export function rugTexture(size: number, hex: string, border: string, round = false): TexturePair {
  const key = `rug|${size}|${hex}|${border}|${round}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const a = parse(hex);
  const b = parse(border);
  const slub = fbm(83, 8, 8, 3);
  const p = planes(size, true, false);
  const band = (t: number, at: number, w: number) => 1 - smooth(w * 0.5, w * 0.5 + 0.006, Math.abs(t - at));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const e = round ? 0.5 - Math.hypot(u - 0.5, v - 0.5) : Math.min(u, 1 - u, v, 1 - v);
      const stripe = Math.max(band(e, 0.05, 0.035), band(e, 0.11, 0.012));
      const weave = 0.5 + 0.5 * Math.sin(x * 1.9) * Math.sin(y * 1.9);
      const k = 0.9 + 0.1 * weave + 0.12 * (slub(u, v) - 0.5);
      const c = stripe > 0.5 ? b : a;
      put(p, y * size + x, clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255), 0.4 + 0.35 * weave + 0.2 * slub(u, v));
    }
  }
  const pair = finish(p);
  pair.map.wrapS = pair.map.wrapT = RepeatWrapping;
  cache.set(key, pair);
  return pair;
}
