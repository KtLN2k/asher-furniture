import type { CategoryKey } from "./catalog";
import type { RodType } from "./design";
import type { TemplateKey } from "./capabilities";

export interface Compartment {
  id: string;
  widthShare: number;
  shelves: number;
  drawers: number;
  hangingRod: RodType;
  open?: boolean;
}

export const DRAWER_PITCH_MM = 200;
export const HAT_SHELF_FROM_TOP_MM = 350;
export const ROD_BELOW_SHELF_MM = 90;
export const ROD_FROM_TOP_MM = 60;
export const SHORT_HANG_MM = 1000;
export const LONG_HANG_MIN_MM = 1100;
export const SHORT_HANG_MIN_MM = 800;
export const MIN_SHELF_GAP_MM = 110;
export const MAX_DRAWERS_PER_COMPARTMENT = 12;

export interface TemplateContext {
  innerWidthMm: number;
  innerHeightMm: number;
  unitCount: number;
  category: CategoryKey;
}

export function bayCount(innerWidthMm: number, unitCount: number): number {
  const auto = Math.min(8, Math.max(1, Math.round(innerWidthMm / 700)));
  return Math.max(auto, unitCount);
}

function shelvesFor(zoneMm: number, target = 350): number {
  return Math.max(0, Math.min(12, Math.round(zoneMm / target) - 1));
}

type Bay = Pick<Compartment, "shelves" | "drawers" | "hangingRod">;

function drawersFor(innerHeightMm: number, wanted = 3): number {
  return Math.max(1, Math.min(wanted, Math.floor((innerHeightMm * 0.45) / DRAWER_PITCH_MM)));
}

function bayFor(template: TemplateKey, i: number, n: number, ctx: TemplateContext): Bay {
  const h = ctx.innerHeightMm;
  const hang = (): Bay => ({ hangingRod: "long", shelves: 1, drawers: 0 });
  const shelves = (): Bay => ({ hangingRod: "none", shelves: shelvesFor(h), drawers: 0 });
  const drw = drawersFor(h);
  switch (template) {
    case "full-hang":
      return hang();
    case "shelves":
      return shelves();
    case "hang-shelves":
      if (n === 1) return { hangingRod: "short", shelves: 1 + Math.max(1, shelvesFor(h - SHORT_HANG_MM - 350, 300)), drawers: 0 };
      return i % 2 === 0 ? hang() : shelves();
    case "drawers-shelves":
      return { hangingRod: "none", drawers: drw, shelves: shelvesFor(h - drw * DRAWER_PITCH_MM) };
    case "drawers": {
      const count = Math.max(1, Math.min(MAX_DRAWERS_PER_COMPARTMENT, Math.round(h / 220)));
      return { hangingRod: "none", drawers: count, shelves: 0 };
    }
    case "combo": {
      if (n === 1) return { hangingRod: "short", shelves: 1, drawers: drw };
      const k = i % 3;
      if (k === 0) return hang();
      if (k === 1) return shelves();
      return { hangingRod: "short", shelves: 1, drawers: drw };
    }
    default:
      return shelves();
  }
}

export function nextCompartmentId(existing: Compartment[]): string {
  let max = 0;
  for (const c of existing) {
    const m = /^c(\d+)$/.exec(c.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `c${max + 1}`;
}

export function buildCompartments(template: string, ctx: TemplateContext): Compartment[] {
  const n = bayCount(ctx.innerWidthMm, ctx.unitCount);
  const key = (template === "custom" ? "shelves" : template) as TemplateKey;
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    widthShare: 1 / n,
    open: false,
    ...bayFor(key, i, n, ctx),
  }));
}

export function normalizeShares<T extends { widthShare: number }>(comps: T[]): T[] {
  const total = comps.reduce((s, c) => s + c.widthShare, 0);
  if (!(total > 0)) return comps.map((c) => ({ ...c, widthShare: 1 / comps.length }));
  return comps.map((c) => ({ ...c, widthShare: c.widthShare / total }));
}

/** רוחב פנימי נטו של כל תא (אחרי עובי המחיצות בין התאים). */
export function compartmentWidths(comps: Compartment[], innerWidthMm: number, dividerT: number): number[] {
  const usable = innerWidthMm - Math.max(0, comps.length - 1) * dividerT;
  const norm = normalizeShares(comps);
  return norm.map((c) => usable * c.widthShare);
}

/** קובע רוחב של תא אחד במ״מ; שאר התאים מתחלקים בשארית ביחס לרוחבם הקודם. */
export function setCompartmentWidth(comps: Compartment[], index: number, widthMm: number, innerWidthMm: number, dividerT: number, minMm = 100): Compartment[] {
  if (comps.length === 1) return comps;
  const usable = innerWidthMm - (comps.length - 1) * dividerT;
  const maxFor = usable - minMm * (comps.length - 1);
  const w = Math.min(Math.max(widthMm, minMm), Math.max(minMm, maxFor));
  const norm = normalizeShares(comps);
  const othersTotal = norm.reduce((s, c, i) => (i === index ? s : s + c.widthShare), 0);
  const targetShare = w / usable;
  return norm.map((c, i) => ({
    ...c,
    widthShare: i === index ? targetShare : (c.widthShare / othersTotal) * (1 - targetShare),
  }));
}

export function addCompartment(comps: Compartment[]): Compartment[] {
  const last = comps[comps.length - 1];
  const share = 1 / (comps.length + 1);
  const shrink = 1 - share;
  const next: Compartment = {
    ...(last ?? { shelves: 3, drawers: 0, hangingRod: "none" as RodType }),
    id: nextCompartmentId(comps),
    widthShare: share,
    open: false,
  };
  return normalizeShares([...comps.map((c) => ({ ...c, widthShare: c.widthShare * shrink })), next]);
}

export function removeCompartment(comps: Compartment[], index: number): Compartment[] {
  if (comps.length <= 1) return comps;
  return normalizeShares(comps.filter((_, i) => i !== index));
}

export interface CompartmentLayout {
  drawers: Array<{ y0: number; y1: number }>;
  /** מרכזי המדפים, גובה יחסי לתחתית החלל הפנימי. */
  shelves: number[];
  rod: { y: number; clearMm: number } | null;
  problems: string[];
}

/**
 * סידור האלמנטים בתא אחד לגובה פנימי נתון (כל הגבהים במ״מ, מתחתית התא כלפי מעלה).
 * מגירות בתחתית; מוט תלייה ליד הקצה העליון (עם מדף כובעים מעליו אם יש מדפים);
 * מדפים נוספים מתפזרים שווה בשטח הפנוי. אם משהו לא נכנס, הסיבה מוחזרת ב-problems.
 */
export function layoutCompartment(spec: Pick<Compartment, "shelves" | "drawers" | "hangingRod">, innerHeightMm: number): CompartmentLayout {
  const problems: string[] = [];
  const h = innerHeightMm;
  const out: CompartmentLayout = { drawers: [], shelves: [], rod: null, problems };

  const rod = spec.hangingRod;
  const fills = rod === "none" && spec.shelves === 0;
  const pitch = spec.drawers > 0 ? (fills ? h / spec.drawers : DRAWER_PITCH_MM) : 0;
  for (let i = 0; i < spec.drawers; i++) out.drawers.push({ y0: i * pitch, y1: (i + 1) * pitch });
  const drawerTop = spec.drawers * pitch;

  if (drawerTop > h + 0.5) {
    problems.push(`${spec.drawers} מגירות לא נכנסות בגובה התא`);
    return out;
  }

  if (rod === "none") {
    const n = spec.shelves;
    if (n > 0) {
      const zone = h - drawerTop;
      const gap = zone / (n + 1);
      if (gap < MIN_SHELF_GAP_MM) problems.push(`${n} מדפים לא נכנסים בגובה הפנוי בתא`);
      for (let i = 1; i <= n; i++) out.shelves.push(drawerTop + gap * i);
    }
    return out;
  }

  const hat = spec.shelves > 0;
  const hatY = h - HAT_SHELF_FROM_TOP_MM;
  const rodY = hat ? hatY - ROD_BELOW_SHELF_MM : h - ROD_FROM_TOP_MM;
  if (hat) out.shelves.push(hatY);
  const clear = rodY - drawerTop;
  out.rod = { y: rodY, clearMm: clear };

  if (rod === "long") {
    if (clear < LONG_HANG_MIN_MM) problems.push("אין מספיק גובה לתלייה ארוכה בתא הזה");
    if (spec.shelves > 1) problems.push("בתלייה ארוכה אפשר מדף עליון אחד בלבד");
  } else {
    if (clear < SHORT_HANG_MIN_MM) problems.push("אין מספיק גובה לתלייה בתא הזה");
    const extra = Math.max(0, spec.shelves - 1);
    const zoneTop = Math.max(drawerTop, rodY - SHORT_HANG_MM);
    const zone = zoneTop - drawerTop;
    if (extra > 0) {
      const gap = zone / (extra + 1);
      if (gap < MIN_SHELF_GAP_MM) problems.push(`${extra} מדפים מתחת לתלייה לא נכנסים בגובה הפנוי`);
      for (let i = 1; i <= extra; i++) out.shelves.push(drawerTop + gap * i);
    }
  }
  return out;
}

/** כמה מדפים מותר להגדיר בתא (למניעת בחירה בלתי אפשרית בממשק). */
export function maxShelves(spec: Pick<Compartment, "drawers" | "hangingRod">, innerHeightMm: number): number {
  if (spec.hangingRod === "long") return 1;
  for (let n = 30; n >= 0; n--) {
    if (layoutCompartment({ ...spec, shelves: n }, innerHeightMm).problems.length === 0) return n;
  }
  return 0;
}

export function maxDrawers(spec: Pick<Compartment, "shelves" | "hangingRod">, innerHeightMm: number): number {
  for (let n = MAX_DRAWERS_PER_COMPARTMENT; n >= 0; n--) {
    if (layoutCompartment({ ...spec, drawers: n }, innerHeightMm).problems.length === 0) return n;
  }
  return 0;
}

export function rodAllowed(spec: Pick<Compartment, "shelves" | "drawers">, rod: RodType, innerHeightMm: number): { ok: boolean; reason?: string } {
  if (rod === "none") return { ok: true };
  const res = layoutCompartment({ ...spec, shelves: Math.min(spec.shelves, rod === "long" ? 1 : spec.shelves), hangingRod: rod }, innerHeightMm);
  if (res.problems.length === 0) return { ok: true };
  return { ok: false, reason: rod === "long" ? "אין מספיק גובה לתלייה ארוכה" : "אין מספיק גובה לתלייה" };
}
