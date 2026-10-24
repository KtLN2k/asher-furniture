import { compartmentWidths, layoutCompartment, type Compartment, type CompartmentLayout } from "./interior";
import type { DoorType } from "./design";
import type { Spec } from "./spec";

/**
 * פריסת הרהיט במרחב (מ״מ). מקור אחד לתצוגת התלת-ממד, להמחשות הדו-ממדיות ולבדיקות.
 * צירים: x אופקי (0 במרכז), y מהרצפה כלפי מעלה, z עומק (0 במרכז, החזית ב-z חיובי).
 */
export const GAP_MM = 3;
export const SLIDING_OVERLAP_MM = 50;

export interface CompLayout {
  id: string;
  index: number;
  /** קצוות פנימיים של התא (בין המחיצות). */
  x0: number;
  x1: number;
  width: number;
  /** תא בלי דלת בחזית. */
  open: boolean;
  elements: CompartmentLayout;
  source: Compartment;
}

export interface DoorLayout {
  id: string;
  index: number;
  type: DoorType;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** מרכז הדלת בעומק (z). */
  zCenter: number;
  /** מסילה: 0 אחורית, 1 קדמית (דלתות הזזה). */
  lane: 0 | 1;
}

export interface DrawerLayout {
  id: string;
  index: number;
  compIndex: number;
  /** האם החזית נראית כשהדלתות סגורות. */
  exposed: boolean;
  /** מלבן החזית. */
  fx0: number;
  fx1: number;
  fy0: number;
  fy1: number;
  fzCenter: number;
  /** תיבת המגירה. */
  bx0: number;
  bx1: number;
  by0: number;
  by1: number;
  bz0: number;
  bz1: number;
}

export interface ShelfLayout {
  id: string;
  compIndex: number;
  x0: number;
  x1: number;
  y: number;
  z0: number;
  z1: number;
}

export interface RodLayout {
  compIndex: number;
  x0: number;
  x1: number;
  y: number;
  z: number;
}

export interface FurnitureLayout {
  spec: Spec;
  bodyBottomY: number;
  bodyTopY: number;
  innerY0: number;
  innerY1: number;
  zFront: number;
  zBack: number;
  /** קצה קדמי פנימי שאליו מגיעים מדפים ומגירות. */
  zInnerFront: number;
  compartments: CompLayout[];
  /** מרכזי המחיצות בין התאים. */
  dividerX: number[];
  doors: DoorLayout[];
  drawers: DrawerLayout[];
  shelves: ShelfLayout[];
  rods: RodLayout[];
  doorSpan: { x0: number; x1: number } | null;
}

/** אילו תאים באמת פתוחים (בלי דלת). תאים פתוחים אפשריים רק בקצוות, ורק בדלתות ציר/קלפה. */
export function effectiveOpen(comps: Compartment[], doorCount: number, doorType: DoorType): boolean[] {
  if (doorCount === 0) return comps.map(() => true);
  if (doorType === "sliding") return comps.map(() => false);
  const open = comps.map(() => false);
  let i = 0;
  while (i < comps.length - 1 && comps[i].open) open[i++] = true;
  let j = comps.length - 1;
  while (j > i && comps[j].open) open[j--] = true;
  return open;
}

export function buildLayout(spec: Spec): FurnitureLayout {
  const { widthMm: W, depthMm: D, bodyT: t, facadeT: tf, backT: tb } = spec;
  const bodyBottomY = spec.baseHeightMm + spec.mountHeightMm;
  const bodyTopY = bodyBottomY + spec.bodyHeightMm;
  const innerY0 = bodyBottomY + t;
  const innerY1 = bodyTopY - t;
  const innerH = innerY1 - innerY0;

  const widths = compartmentWidths(spec.compartments, spec.innerWidthMm, t);
  const open = effectiveOpen(spec.compartments, spec.doorCount, spec.doorType);

  const drawersExposedAny = spec.compartments.some((c, i) => c.drawers > 0 && open[i]);
  const sliding = spec.doorType === "sliding" && spec.doorCount > 0;
  const hingedLike = spec.doorCount > 0 && !sliding;
  const overlay = hingedLike || drawersExposedAny ? tf + 2 : 0;
  const zFront = D / 2 - overlay;
  const zBack = -D / 2;
  const slidingDepth = sliding ? 2 * tf + 30 : 0;
  const zInnerFront = zFront - slidingDepth;
  const zShelfBack = zBack + tb;

  const comps: CompLayout[] = [];
  const dividerX: number[] = [];
  let x = -W / 2 + t;
  spec.compartments.forEach((c, index) => {
    const w = widths[index];
    comps.push({ id: c.id, index, x0: x, x1: x + w, width: w, open: open[index], elements: layoutCompartment(c, innerH), source: c });
    x += w;
    if (index < spec.compartments.length - 1) {
      dividerX.push(x + t / 2);
      x += t;
    }
  });

  const shelves: ShelfLayout[] = [];
  const rods: RodLayout[] = [];
  const drawers: DrawerLayout[] = [];
  let drawerIndex = 0;
  const shelfFront = zInnerFront - (open.some(Boolean) ? 2 : 8);
  const lastComp = comps.length - 1;

  comps.forEach((c) => {
    c.elements.shelves.forEach((y, k) =>
      shelves.push({ id: `${c.id}-s${k + 1}`, compIndex: c.index, x0: c.x0, x1: c.x1, y: innerY0 + y, z0: zShelfBack, z1: shelfFront }),
    );
    if (c.elements.rod) {
      rods.push({ compIndex: c.index, x0: c.x0, x1: c.x1, y: innerY0 + c.elements.rod.y, z: (zShelfBack + shelfFront) / 2 });
    }
    c.elements.drawers.forEach((d, j) => {
      const exposed = c.open;
      const compIsFirst = c.index === 0;
      const compIsLast = c.index === lastComp;
      let fx0 = c.x0 + 2;
      let fx1 = c.x1 - 2;
      let fy0 = innerY0 + d.y0 + 2;
      let fy1 = innerY0 + d.y1 - 2;
      let fzCenter = zInnerFront - 2 - tf / 2;
      if (exposed) {
        fx0 = (compIsFirst ? -W / 2 : c.x0 - t / 2) + GAP_MM / 2;
        fx1 = (compIsLast ? W / 2 : c.x1 + t / 2) - GAP_MM / 2;
        const topDrawer = j === c.elements.drawers.length - 1;
        const fillsTop = topDrawer && c.source.shelves === 0 && c.source.hangingRod === "none";
        fy0 = j === 0 ? bodyBottomY + GAP_MM : innerY0 + d.y0 + GAP_MM / 2;
        fy1 = fillsTop ? bodyTopY - GAP_MM : innerY0 + d.y1 - GAP_MM / 2;
        fzCenter = D / 2 - tf / 2;
      }
      const boxH = Math.max(30, d.y1 - d.y0 - 40);
      drawers.push({
        id: `${c.id}:${j + 1}`,
        index: drawerIndex++,
        compIndex: c.index,
        exposed,
        fx0,
        fx1,
        fy0,
        fy1,
        fzCenter,
        bx0: c.x0 + 13,
        bx1: c.x1 - 13,
        by0: innerY0 + d.y0 + 20,
        by1: innerY0 + d.y0 + 20 + boxH,
        bz0: zShelfBack + 12,
        bz1: zInnerFront - 2 - tf,
      });
    });
  });

  const doors: DoorLayout[] = [];
  let doorSpan: FurnitureLayout["doorSpan"] = null;
  if (spec.doorCount > 0) {
    const n = spec.doorCount;
    if (sliding) {
      const x0 = -W / 2 + t;
      const span = spec.innerWidthMm;
      const dw = (span + (n - 1) * SLIDING_OVERLAP_MM) / n;
      doorSpan = { x0, x1: x0 + span };
      for (let i = 0; i < n; i++) {
        const lane = (i % 2) as 0 | 1;
        const faceZ = zFront - 6 - (lane === 1 ? 0 : tf + 8);
        doors.push({
          id: `door-${i + 1}`,
          index: i,
          type: "sliding",
          x0: x0 + i * (dw - SLIDING_OVERLAP_MM),
          x1: x0 + i * (dw - SLIDING_OVERLAP_MM) + dw,
          y0: innerY0 + 12,
          y1: innerY1 - 12,
          zCenter: faceZ - tf / 2,
          lane,
        });
      }
    } else {
      const firstClosed = open.indexOf(false);
      const lastClosed = open.lastIndexOf(false);
      const first = comps[Math.max(0, firstClosed)];
      const last = comps[Math.max(0, lastClosed)];
      const x0 = first.index === 0 ? -W / 2 : first.x0 - t / 2;
      const x1 = last.index === lastComp ? W / 2 : last.x1 + t / 2;
      doorSpan = { x0, x1 };
      const dw = (x1 - x0 - (n + 1) * GAP_MM) / n;
      for (let i = 0; i < n; i++) {
        const dx0 = x0 + GAP_MM + i * (dw + GAP_MM);
        doors.push({
          id: `door-${i + 1}`,
          index: i,
          type: spec.doorType,
          x0: dx0,
          x1: dx0 + dw,
          y0: bodyBottomY + GAP_MM,
          y1: bodyTopY - GAP_MM,
          zCenter: D / 2 - tf / 2,
          lane: 1,
        });
      }
    }
  }

  return {
    spec,
    bodyBottomY,
    bodyTopY,
    innerY0,
    innerY1,
    zFront,
    zBack,
    zInnerFront,
    compartments: comps,
    dividerX,
    doors,
    drawers,
    shelves,
    rods,
    doorSpan,
  };
}
