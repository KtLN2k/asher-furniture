import { BoxGeometry, BufferAttribute } from "three";
import type { Grain } from "./model";

/** אורך הצד של אריח טקסטורה במטרים: הטקסטורות בקנה מידה אמיתי, לא נמתחות עם הלוח. */
export const TILE_M = 0.9;

const cache = new Map<string, BoxGeometry>();
const MAX = 500;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

type Axis = "x" | "y" | "z";
/** לכל פאה: ציר ה-u וציר ה-v לפי סדר הפאות של BoxGeometry (px, nx, py, ny, pz, nz). */
const FACE_AXES: Array<[Axis, Axis]> = [
  ["z", "y"],
  ["z", "y"],
  ["x", "z"],
  ["x", "z"],
  ["x", "y"],
  ["x", "y"],
];

export function boxGeometry(sx: number, sy: number, sz: number, grain: Grain, seed: string): BoxGeometry {
  const key = `${sx.toFixed(4)}|${sy.toFixed(4)}|${sz.toFixed(4)}|${grain}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) {
      cache.get(first)?.dispose();
      cache.delete(first);
    }
  }
  const g = new BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute("uv") as BufferAttribute;
  const dims = { x: sx, y: sy, z: sz };
  const ou = hash(seed + "u");
  const ov = hash(seed + "v");
  for (let face = 0; face < 6; face++) {
    let [au, av] = FACE_AXES[face];
    if (au === grain && av !== grain) [au, av] = [av, au];
    const su = dims[au] / TILE_M;
    const sv = dims[av] / TILE_M;
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su + ou, uv.getY(idx) * sv + ov);
    }
  }
  uv.needsUpdate = true;
  cache.set(key, g);
  return g;
}
