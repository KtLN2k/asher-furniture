import { HANDLE_COLOR_INFO, resolveFacade, type ResolvedFacade } from "@/domain/facades";
import type { FurnitureDesign } from "@/domain/design";
import { buildLayout, type DoorLayout, type DrawerLayout, type FurnitureLayout } from "@/domain/layout";
import { itemsOf, surfaceLook, surfaceOf, type Library, type WoodTexture } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";

/**
 * מודל תלת-ממדי תיאורי (ללא תלות ב-three): רשימת קופסאות, גלילים וכדורים במטרים,
 * מקובצים לחלקים קבועים ולחלקים נעים (דלתות ומגירות). נגזר כולו מ-buildLayout, כלומר ממודל הנתונים.
 * ציר y למעלה, z לחזית, 0 במרכז הרהיט. המנוע (R3F) רק מצייר את מה שכאן.
 */
export type MaterialKind = "matte" | "wood" | "mirror" | "glass" | "metal" | "dark";

export interface MaterialSpec {
  key: string;
  kind: MaterialKind;
  hex: string;
  texture?: WoodTexture;
  roughness: number;
  metalness: number;
  opacity: number;
  /** כמות שכבת הלק (0–1): נגזרת מחספוס הגימור. */
  clearcoat?: number;
  /** גימור מבריק: מקבל מפת השתקפות של החדר. */
  reflective?: boolean;
}

export type Grain = "x" | "y" | "z";
export type Vec3 = [number, number, number];

export interface BoxNode {
  type: "box";
  id: string;
  /** סוג לוגי: לבדיקות ולהקשר (side, shelf, door-panel, handle...). */
  kind: string;
  size: Vec3;
  pos: Vec3;
  material: MaterialSpec;
  /** חומר מיוחד לפאה הקדמית (למשל מראה על דלת). */
  front?: MaterialSpec;
  /** חומר כהה יותר לארבעת צדי הלוח: יוצר את צל הפער בין דלתות. */
  edge?: MaterialSpec;
  grain: Grain;
  shadow: boolean;
  /** קצוות מעוגלים קלות (חזיתות): מחזירים אור בקצה כמו לוח אמיתי. */
  bevel?: boolean;
}

export interface CylinderNode {
  type: "cylinder";
  id: string;
  kind: string;
  radius: number;
  length: number;
  axis: "x" | "y" | "z";
  pos: Vec3;
  material: MaterialSpec;
}

export interface SphereNode {
  type: "sphere";
  id: string;
  kind: string;
  radius: number;
  pos: Vec3;
  material: MaterialSpec;
}

export type ModelNode = BoxNode | CylinderNode | SphereNode;

export type Motion =
  | { type: "hinge"; axis: "x" | "y"; openAngle: number }
  | { type: "slide"; dx: number }
  | { type: "pull"; dz: number };

export interface MovingPart {
  id: string;
  kind: "door" | "drawer";
  /** מזהה ברמת המודל (door-3, c2:1). */
  facadeId: string;
  index: number;
  pivot: Vec3;
  motion: Motion;
  exposed: boolean;
  children: ModelNode[];
  look: ResolvedFacade;
}

export interface FurnitureModel {
  fixed: ModelNode[];
  moving: MovingPart[];
  bounds: { width: number; height: number; depth: number; bottom: number; niche: boolean };
  stats: {
    doors: number;
    drawers: number;
    shelves: number;
    rods: number;
    compartments: number;
    dividers: number;
    handles: number;
  };
}

const m = (mm: number) => mm / 1000;
const v3 = (x: number, y: number, z: number): Vec3 => [m(x), m(y), m(z)];

function mat(kind: MaterialKind, hex: string, roughness: number, extra: Partial<MaterialSpec> = {}): MaterialSpec {
  const metalness = extra.metalness ?? (kind === "metal" ? 1 : kind === "mirror" ? 1 : 0);
  const opacity = extra.opacity ?? 1;
  const surface = kind === "matte" || kind === "wood";
  const clearcoat = surface ? Math.min(0.6, Math.max(0.04, (0.72 - roughness) * 0.9)) : undefined;
  const reflective = surface ? roughness <= 0.45 : undefined;
  return { key: `${kind}|${hex}|${extra.texture ?? ""}|${roughness}|${metalness}|${opacity}`, kind, hex, roughness, metalness, opacity, clearcoat, reflective, ...extra };
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * factor))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const MIRROR = mat("mirror", "#e4ebee", 0.03);
const GLASS = mat("glass", "#cfe3e8", 0.04, { metalness: 0, opacity: 0.22 });

export interface ModelOptions {
  library: Library;
}

export function buildFurnitureModel(design: FurnitureDesign, opts: ModelOptions): FurnitureModel {
  const spec = resolveSpec(design);
  const layout = buildLayout(spec);
  const lib = opts.library;
  const mats = design.materials ?? {};

  const bodyLook = surfaceLook(lib, mats.bodyColorId, mats.bodyFinishId);
  const facadeLookBase = surfaceLook(lib, mats.facadeColorId, mats.facadeFinishId);
  const bodyMat = bodyLook.texture ? mat("wood", bodyLook.hex, bodyLook.roughness, { texture: bodyLook.texture }) : mat("matte", bodyLook.hex, bodyLook.roughness);
  const backMat = mat("matte", "#e9e7e1", 0.9);
  const facadeMatFor = (colorId?: string): MaterialSpec => {
    const look = colorId ? surfaceLook(lib, colorId, mats.facadeFinishId) : facadeLookBase;
    return look.texture ? mat("wood", look.hex, look.roughness, { texture: look.texture }) : mat("matte", look.hex, look.roughness);
  };
  const avail = {
    glass: itemsOf(lib, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "glass"),
    mirror: itemsOf(lib, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "mirror"),
  };

  const fixed: ModelNode[] = [];
  const moving: MovingPart[] = [];
  let seq = 0;
  const nid = (k: string) => `${k}-${++seq}`;

  const box = (kind: string, size: Vec3, pos: Vec3, material: MaterialSpec, grain: Grain, extra: Partial<BoxNode> = {}): BoxNode => ({
    type: "box",
    id: nid(kind),
    kind,
    size,
    pos,
    material,
    grain,
    shadow: material.kind !== "glass",
    ...extra,
  });
  const cyl = (kind: string, radius: number, length: number, axis: "x" | "y" | "z", pos: Vec3, material: MaterialSpec): CylinderNode => ({
    type: "cylinder",
    id: nid(kind),
    kind,
    radius,
    length,
    axis,
    pos,
    material,
  });

  const { widthMm: W, depthMm: D, bodyT: t, facadeT: tf, backT: tb } = spec;
  const yMid = (layout.bodyBottomY + layout.bodyTopY) / 2;
  const depth = layout.zFront - layout.zBack;
  const zMid = (layout.zFront + layout.zBack) / 2;
  const bodyH = layout.bodyTopY - layout.bodyBottomY;

  // גוף
  fixed.push(box("side", v3(t, bodyH, depth), v3(-W / 2 + t / 2, yMid, zMid), bodyMat, "y"));
  fixed.push(box("side", v3(t, bodyH, depth), v3(W / 2 - t / 2, yMid, zMid), bodyMat, "y"));
  fixed.push(box("top", v3(W - 2 * t, t, depth), v3(0, layout.bodyTopY - t / 2, zMid), bodyMat, "x"));
  fixed.push(box("bottom", v3(W - 2 * t, t, depth), v3(0, layout.bodyBottomY + t / 2, zMid), bodyMat, "x"));
  fixed.push(box("back", v3(W - 2 * t, layout.innerY1 - layout.innerY0, tb), v3(0, (layout.innerY0 + layout.innerY1) / 2, layout.zBack + tb / 2), backMat, "y"));
  layout.dividerX.forEach((x) => {
    fixed.push(box("divider", v3(t, layout.innerY1 - layout.innerY0, depth - tb), v3(x, (layout.innerY0 + layout.innerY1) / 2, (layout.zFront + layout.zBack + tb) / 2), bodyMat, "y"));
  });

  // בסיס
  if (spec.base === "plinth" && spec.baseHeightMm > 0) {
    const z = D / 2 - tf - 42 - t / 2;
    fixed.push(box("plinth", v3(W - 40, spec.baseHeightMm, t), v3(0, spec.baseHeightMm / 2, z), mat("dark", shade(bodyLook.hex, 0.55), 0.8, { metalness: 0 }), "x"));
  } else if (spec.base === "legs" && spec.baseHeightMm > 0) {
    const columns = Math.max(2, Math.ceil(W / 900) + 1);
    const legMat = mat("metal", "#cfcfd0", 0.5, { metalness: 0.35 });
    for (let c = 0; c < columns; c++) {
      const x = -W / 2 + 55 + ((W - 110) * c) / (columns - 1);
      for (const z of [D / 2 - 70, -D / 2 + 70]) {
        fixed.push(cyl("foot", 0.021, m(spec.baseHeightMm), "y", v3(x, spec.baseHeightMm / 2, z), legMat));
      }
    }
  }

  // מדפים ומוטות
  layout.shelves.forEach((s) => {
    fixed.push(box("shelf", v3(s.x1 - s.x0, t, s.z1 - s.z0), v3((s.x0 + s.x1) / 2, s.y, (s.z0 + s.z1) / 2), bodyMat, "x"));
  });
  const rodMat = mat("metal", "#c9ccd0", 0.28);
  layout.rods.forEach((r) => {
    fixed.push(cyl("rod", 0.0125, m(r.x1 - r.x0), "x", v3((r.x0 + r.x1) / 2, r.y, r.z), rodMat));
  });

  // ידיות
  let handles = 0;
  const handleNodes = (look: ResolvedFacade, rect: HandleRect): ModelNode[] => {
    const nodes = buildHandle(look, rect, nid);
    if (nodes.length) handles++;
    return nodes;
  };

  // חזית בסיסית (דלת/מגירה): מחזיר צמתים בקואורדינטות עולם
  const facePanel = (kind: string, look: ResolvedFacade, x0: number, x1: number, y0: number, y1: number, zCenter: number): ModelNode[] => {
    const w = x1 - x0;
    const h = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const base = facadeMatFor(look.colorId);
    const out: ModelNode[] = [];
    const edge = { ...base, key: `${base.key}|edge`, hex: shade(base.hex, 0.6) };
    const part = (suffix: string, sx: number, sy: number, sz: number, px: number, py: number, pz: number, material: MaterialSpec, extra: Partial<BoxNode> = {}) =>
      out.push(box(`${kind}-${suffix}`, v3(sx, sy, sz), v3(px, py, pz), material, "y", material === base ? { edge, bevel: true, ...extra } : extra));
    switch (look.style) {
      case "framed": {
        const fw = Math.min(70, w / 4, h / 4);
        part("frame", fw, h, tf, x0 + fw / 2, cy, zCenter, base);
        part("frame", fw, h, tf, x1 - fw / 2, cy, zCenter, base);
        part("frame", w - 2 * fw, fw, tf, cx, y1 - fw / 2, zCenter, base, { grain: "x" });
        part("frame", w - 2 * fw, fw, tf, cx, y0 + fw / 2, zCenter, base, { grain: "x" });
        part("panel", w - 2 * fw, h - 2 * fw, tf * 0.5, cx, cy, zCenter - tf * 0.25, base);
        break;
      }
      case "glass": {
        const fw = Math.min(45, w / 4, h / 4);
        part("frame", fw, h, tf, x0 + fw / 2, cy, zCenter, base);
        part("frame", fw, h, tf, x1 - fw / 2, cy, zCenter, base);
        part("frame", w - 2 * fw, fw, tf, cx, y1 - fw / 2, zCenter, base, { grain: "x" });
        part("frame", w - 2 * fw, fw, tf, cx, y0 + fw / 2, zCenter, base, { grain: "x" });
        part("glass", w - 2 * fw, h - 2 * fw, 4, cx, cy, zCenter, GLASS);
        break;
      }
      case "mirror": {
        part("panel", w, h, tf, cx, cy, zCenter, base, { front: MIRROR });
        break;
      }
      case "grooved": {
        part("panel", w, h, tf, cx, cy, zCenter, base);
        const n = Math.max(2, Math.floor(w / 70));
        const step = w / (n + 1);
        const groove = mat("dark", shade(facadeMatFor(look.colorId).hex, 0.4), 0.9, { metalness: 0 });
        for (let i = 1; i <= n; i++) {
          part("groove", 3, h * 0.94, 0.6, x0 + step * i, cy, zCenter + tf / 2 + 0.05, groove, { shadow: false });
        }
        break;
      }
      default:
        part("panel", w, h, tf, cx, cy, zCenter, base);
    }
    return out;
  };

  const rel = (nodes: ModelNode[], pivot: Vec3): ModelNode[] =>
    nodes.map((n) => ({ ...n, pos: [n.pos[0] - pivot[0], n.pos[1] - pivot[1], n.pos[2] - pivot[2]] as Vec3 }));

  // דלתות
  const doorType = spec.doorType;
  const doorLooks = layout.doors.map((d) => resolveFacade(design, "door", d.id, d.index, doorType, avail, spec.doorCount));
  layout.doors.forEach((d: DoorLayout) => {
    const look = doorLooks[d.index];
    const faceZ = d.zCenter + tf / 2;
    const nodes: ModelNode[] = facePanel("door", look, d.x0, d.x1, d.y0, d.y1, d.zCenter);
    let pivot: Vec3;
    let motion: Motion;
    let freeEdge: HandleRect["freeEdge"];
    if (doorType === "sliding") {
      pivot = v3((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, d.zCenter);
      const shift = d.lane === 1 ? -(d.x1 - d.x0 - 50) : 0;
      motion = { type: "slide", dx: m(shift) };
      freeEdge = d.lane === 1 ? "left" : "right";
    } else if (doorType === "flap") {
      const up = look.opening !== "down";
      pivot = v3((d.x0 + d.x1) / 2, up ? d.y1 : d.y0, d.zCenter);
      motion = { type: "hinge", axis: "x", openAngle: up ? -1.75 : 1.65 };
      freeEdge = up ? "bottom" : "top";
    } else {
      const left = look.opening !== "right";
      pivot = v3(left ? d.x0 : d.x1, (d.y0 + d.y1) / 2, d.zCenter);
      motion = { type: "hinge", axis: "y", openAngle: left ? -1.8 : 1.8 };
      freeEdge = left ? "right" : "left";
    }
    // ידית ארוכה במפגש בין שתי דלתות מותקנת פעם אחת בלבד (על הדלת הראשונה בזוג), כמו בהדמיות של ארונות כאלה.
    const prev = doorLooks[d.index - 1];
    const sharedEdge = doorType === "hinged" && look.handle === "long" && freeEdge === "left" && prev?.handle === "long" && prev.opening === "left";
    if (!sharedEdge) nodes.push(...handleNodes(look, { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, faceZ, freeEdge, floorY: 0, orientation: doorType === "flap" ? "h" : "v", kind: "door", thicknessMm: tf }));
    moving.push({ id: `door-${d.index + 1}`, kind: "door", facadeId: d.id, index: d.index, pivot, motion, exposed: true, children: rel(nodes, pivot), look });
  });

  // מגירות
  const drawerBoxMat = mat("matte", shade(bodyLook.hex, 0.97), bodyLook.roughness, bodyLook.texture ? { texture: bodyLook.texture } : {});
  layout.drawers.forEach((dr: DrawerLayout) => {
    const look = resolveFacade(design, "drawer", dr.id, dr.index, doorType, avail);
    const faceZ = dr.fzCenter + tf / 2;
    const nodes: ModelNode[] = facePanel("drawer-front", look, dr.fx0, dr.fx1, dr.fy0, dr.fy1, dr.fzCenter);
    const bw = dr.bx1 - dr.bx0;
    const bh = dr.by1 - dr.by0;
    const bd = dr.bz1 - dr.bz0;
    const bcx = (dr.bx0 + dr.bx1) / 2;
    const bcz = (dr.bz0 + dr.bz1) / 2;
    nodes.push(box("drawer-side", v3(15, bh, bd), v3(dr.bx0 + 7.5, dr.by0 + bh / 2, bcz), drawerBoxMat, "y"));
    nodes.push(box("drawer-side", v3(15, bh, bd), v3(dr.bx1 - 7.5, dr.by0 + bh / 2, bcz), drawerBoxMat, "y"));
    nodes.push(box("drawer-back", v3(bw - 30, bh, 15), v3(bcx, dr.by0 + bh / 2, dr.bz0 + 7.5), drawerBoxMat, "y"));
    nodes.push(box("drawer-bottom", v3(bw - 30, 8, bd - 15), v3(bcx, dr.by0 + 4, bcz + 7.5), drawerBoxMat, "x"));
    nodes.push(...handleNodes(look, { x0: dr.fx0, x1: dr.fx1, y0: dr.fy0, y1: dr.fy1, faceZ, freeEdge: "top", floorY: 0, orientation: "h", kind: "drawer", thicknessMm: tf }));
    const pivot = v3((dr.fx0 + dr.fx1) / 2, (dr.fy0 + dr.fy1) / 2, dr.fzCenter);
    const pull = Math.min(0.78 * bd, 480);
    moving.push({ id: `drawer-${dr.id}`, kind: "drawer", facadeId: dr.id, index: dr.index, pivot, motion: { type: "pull", dz: m(pull) }, exposed: dr.exposed, children: rel(nodes, pivot), look });
  });

  return {
    fixed,
    moving,
    bounds: { width: m(W), height: m(spec.heightMm), depth: m(D), bottom: m(spec.mountHeightMm), niche: design.structure?.installation === "niche" },
    stats: {
      doors: layout.doors.length,
      drawers: layout.drawers.length,
      shelves: layout.shelves.length,
      rods: layout.rods.length,
      compartments: layout.compartments.length,
      dividers: layout.dividerX.length,
      handles,
    },
  };
}

export interface HandleRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  faceZ: number;
  /** הקצה החופשי של הפריט (מול הציר), שם ממוקמת הידית. */
  freeEdge: "left" | "right" | "top" | "bottom";
  floorY: number;
  /** כיוון הידית: אנכית לדלתות, אופקית למגירות וקלפות. */
  orientation: "v" | "h";
  kind: "door" | "drawer";
  thicknessMm: number;
}

/** ידית בקואורדינטות עולם (מ״מ -> מטרים). */
export function buildHandle(look: ResolvedFacade, r: HandleRect, nid: (k: string) => string): ModelNode[] {
  if (look.handle === "none" || look.handle === "push") return [];
  const info = HANDLE_COLOR_INFO[look.handleColor];
  const metal = mat("metal", info.hex, info.rough, { metalness: info.metal });
  const out: ModelNode[] = [];
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  const inset = 48;
  const stand = 26;
  const zBar = r.faceZ + stand;

  const edgeX = r.freeEdge === "left" ? r.x0 + inset : r.freeEdge === "right" ? r.x1 - inset : cx;
  const edgeY = r.freeEdge === "bottom" ? r.y0 + inset : r.freeEdge === "top" ? r.y1 - inset : cy;

  const addBox = (kind: string, size: Vec3, pos: Vec3, material: MaterialSpec, shadow = true, bevel = false): void => {
    out.push({ type: "box", id: nid(kind), kind, size, pos, material, grain: "y", shadow, bevel });
  };
  const addCyl = (kind: string, radius: number, length: number, axis: "x" | "y" | "z", pos: Vec3, material: MaterialSpec): void => {
    out.push({ type: "cylinder", id: nid(kind), kind, radius, length, axis, pos, material });
  };

  if (look.handle === "profile") {
    if (r.kind === "drawer" || r.orientation === "h") {
      addBox("handle", v3(w, 22, 13), v3(cx, r.freeEdge === "bottom" ? r.y0 + 11 : r.y1 - 11, r.faceZ + 5.5), metal);
    } else {
      const x = r.freeEdge === "left" ? r.x0 + 11 : r.x1 - 11;
      addBox("handle", v3(22, h, 13), v3(x, cy, r.faceZ + 5.5), metal);
    }
    return out;
  }

  if (look.handle === "integral") {
    const groove = mat("dark", "#101010", 0.9, { metalness: 0 });
    if (r.kind === "drawer" || r.orientation === "h") {
      addBox("handle", v3(w * 0.96, 20, 0.8), v3(cx, r.freeEdge === "bottom" ? r.y0 + 14 : r.y1 - 14, r.faceZ + 0.25), groove, false);
    } else {
      const x = r.freeEdge === "left" ? r.x0 + 14 : r.x1 - 14;
      addBox("handle", v3(20, h * 0.94, 0.8), v3(x, cy, r.faceZ + 0.25), groove, false);
    }
    return out;
  }

  if (look.handle === "knob") {
    const x = r.kind === "drawer" ? cx : edgeX;
    const y = r.kind === "drawer" ? cy : handleY(look, r, 40);
    addCyl("handle", 0.004, m(20), "z", v3(x, y, r.faceZ + 10), metal);
    out.push({ type: "sphere", id: nid("handle"), kind: "handle", radius: 0.0155, pos: v3(x, y, r.faceZ + 27), material: metal });
    return out;
  }

  const isLong = look.handle === "long";
  if (r.kind === "drawer" || r.orientation === "h") {
    const len = isLong ? Math.min(w * 0.7, 900) : Math.min(160, w * 0.5);
    const y = r.kind === "drawer" ? Math.min(r.y1 - 38, cy + h * 0.28) : edgeY;
    const x = cx;
    if (isLong) {
      addBox("handle", v3(len, 12, 14), v3(x, y, zBar), metal);
    } else {
      addCyl("handle", 0.006, m(len), "x", v3(x, y, zBar), metal);
    }
    const spacing = isLong ? len - 40 : len * 0.8;
    for (const s of [-1, 1]) addCyl("handle-post", 0.0045, m(stand), "z", v3(x + (s * spacing) / 2, y, r.faceZ + stand / 2), metal);
    return out;
  }

  const len = isLong ? Math.max(300, Math.min(h * 0.5, 1300)) : 160;
  const y = handleY(look, r, len / 2 + 30);
  if (isLong) {
    const dir = r.freeEdge === "left" ? 1 : -1;
    const edge = r.freeEdge === "left" ? r.x0 : r.x1;
    addBox("handle", v3(6, len, 14), v3(edge + dir * 5, y, r.faceZ + 7), metal, true, true);
    addBox("handle", v3(13, len, 2.6), v3(edge + dir * 8.5, y, r.faceZ + 12.7), metal, true, true);
    return out;
  }
  addCyl("handle", 0.006, m(len), "y", v3(edgeX, y, zBar), metal);
  const spacing = len * 0.8;
  for (const s of [-1, 1]) addCyl("handle-post", 0.0045, m(stand), "z", v3(edgeX, y + (s * spacing) / 2, r.faceZ + stand / 2), metal);
  return out;
}

function handleY(look: ResolvedFacade, r: HandleRect, halfExtent: number): number {
  const lo = r.y0 + halfExtent + 20;
  const hi = r.y1 - halfExtent - 20;
  const h = r.y1 - r.y0;
  const mid = (r.y0 + r.y1) / 2;
  let y = mid;
  if (look.handlePosition === "top") y = r.y1 - halfExtent - 60;
  else if (look.handlePosition === "bottom") y = r.y0 + halfExtent + 60;
  else if (look.handlePosition === "middle") y = mid;
  else if (look.handle === "long" && h >= 1500) y = r.y0 + halfExtent + 30;
  else if (h >= 1500) y = 1050;
  return Math.max(Math.min(y, Math.max(lo, hi)), Math.min(lo, hi));
}

export type { FurnitureLayout };
