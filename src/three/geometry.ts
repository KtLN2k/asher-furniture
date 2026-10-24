import { BoxGeometry, BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";
import type { Grain } from "./model";

/** אורך הצד של אריח טקסטורה במטרים: הטקסטורות בקנה מידה אמיתי, לא נמתחות עם הלוח. */
export const TILE_M = 0.9;

const cache = new Map<string, BufferGeometry>();
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
const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

/** גודל חיתוך הקצה (מטרים): בערך מילימטר, כמו קנט משופע בלוח חזית. */
export const BEVEL_RADIUS_M = 0.0011;

/**
 * קופסה עם קצוות משופעים (45°) שמוסיפים קו הארה דק בכל קצה, כמו לוח אמיתי.
 * שש הפאות שומרות על סדר קבוצות החומר של BoxGeometry (px, nx, py, ny, pz, nz), כך שחומר הקצה והחזית ממשיכים לעבוד.
 * ה-UV פיזי (אריח 0.9 מ׳) ונגזר מהמיקום, בלי עיוות.
 */
function chamferBox(sx: number, sy: number, sz: number, c: number, grain: Grain, ou: number, ov: number): BufferGeometry {
  const h = [sx / 2, sy / 2, sz / 2];
  const faceIndex = (axis: number, sign: number) => axis * 2 + (sign > 0 ? 0 : 1);
  const buckets: Array<{ pos: number[]; nor: number[]; uv: number[] }> = Array.from({ length: 6 }, () => ({ pos: [], nor: [], uv: [] }));

  const tri = (group: number, pts: number[][], n: number[]) => {
    const [a, b, d] = pts;
    const cross = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
    const flip = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0;
    const order = flip ? [pts[0], pts[2], pts[1]] : pts;
    let [au, av] = FACE_AXES[group];
    if (au === grain && av !== grain) [au, av] = [av, au];
    const iu = AXIS_INDEX[au];
    const iv = AXIS_INDEX[av];
    const bk = buckets[group];
    for (const p of order) {
      bk.pos.push(p[0], p[1], p[2]);
      bk.nor.push(n[0], n[1], n[2]);
      bk.uv.push((p[iu] + h[iu]) / TILE_M + ou, (p[iv] + h[iv]) / TILE_M + ov);
    }
  };
  const quad = (group: number, q: number[][], n: number[]) => {
    tri(group, [q[0], q[1], q[2]], n);
    tri(group, [q[0], q[2], q[3]], n);
  };

  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const mk = (a: number, b: number) => {
        const p = [0, 0, 0];
        p[axis] = sign * h[axis];
        p[u] = a * (h[u] - c);
        p[v] = b * (h[v] - c);
        return p;
      };
      const n = [0, 0, 0];
      n[axis] = sign;
      quad(faceIndex(axis, sign), [mk(-1, -1), mk(1, -1), mk(1, 1), mk(-1, 1)], n);
    }
  }
  for (let t = 0; t < 3; t++) {
    const a = (t + 1) % 3;
    const b = (t + 2) % 3;
    for (const sa of [1, -1]) {
      for (const sb of [1, -1]) {
        const pt = (along: number, onA: boolean) => {
          const p = [0, 0, 0];
          p[t] = along * (h[t] - c);
          if (onA) {
            p[a] = sa * h[a];
            p[b] = sb * (h[b] - c);
          } else {
            p[b] = sb * h[b];
            p[a] = sa * (h[a] - c);
          }
          return p;
        };
        const n = [0, 0, 0];
        n[a] = sa * Math.SQRT1_2;
        n[b] = sb * Math.SQRT1_2;
        const zAxis = t === 2 ? null : [a, b].find((x) => x === 2);
        const group = zAxis !== undefined && zAxis !== null ? faceIndex(2, a === 2 ? sa : sb) : faceIndex(a, sa);
        quad(group, [pt(-1, true), pt(1, true), pt(1, false), pt(-1, false)], n);
      }
    }
  }
  for (const sxn of [1, -1]) {
    for (const syn of [1, -1]) {
      for (const szn of [1, -1]) {
        const s3 = [sxn, syn, szn];
        const p = (k: number) => s3.map((sg, i) => (i === k ? sg * h[i] : sg * (h[i] - c)));
        const n = s3.map((sg) => sg / Math.sqrt(3));
        tri(faceIndex(2, szn), [p(0), p(1), p(2)], n);
      }
    }
  }

  const g = new BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  let start = 0;
  buckets.forEach((bk, i) => {
    pos.push(...bk.pos);
    nor.push(...bk.nor);
    uv.push(...bk.uv);
    g.addGroup(start, bk.pos.length / 3, i);
    start += bk.pos.length / 3;
  });
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return g;
}

/** קופסה עם UV בקנה מידה פיזי. עם `bevelSegments > 0`: קצוות משופעים קלות. */
export function boxGeometry(sx: number, sy: number, sz: number, grain: Grain, seed: string, bevelSegments = 0): BufferGeometry {
  const bevel = bevelSegments > 0 && Math.min(sx, sy, sz) > BEVEL_RADIUS_M * 3;
  const key = `${sx.toFixed(4)}|${sy.toFixed(4)}|${sz.toFixed(4)}|${grain}|${seed}|${bevel ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) {
      cache.get(first)?.dispose();
      cache.delete(first);
    }
  }
  const ou = hash(seed + "u");
  const ov = hash(seed + "v");
  let g: BufferGeometry;
  if (bevel) {
    g = chamferBox(sx, sy, sz, BEVEL_RADIUS_M, grain, ou, ov);
  } else {
    const box = new BoxGeometry(sx, sy, sz);
    const uv = box.getAttribute("uv") as BufferAttribute;
    const dims = { x: sx, y: sy, z: sz };
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
    g = box;
  }
  cache.set(key, g);
  return g;
}
