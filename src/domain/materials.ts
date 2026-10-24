import { z } from "zod";
import type { FurnitureDesign } from "./design";

/**
 * ספריית החומרים של הנגרייה. הנגר עורך אותה במסך ההגדרות.
 * הערכים ההתחלתיים הם דוגמאות תכנון בלבד (שמות, עוביים וצבעים נפוצים), לא נתוני ייצור או מחירים.
 * שילובים מותרים: חומר -> גימורים מותרים, גימור -> סוגי צבע מותרים (אחיד / דמוי עץ).
 */
export const LIBRARY_KINDS = ["board", "facade", "back", "finish", "color"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  board: "חומר גוף",
  facade: "חומר חזיתות",
  back: "חומר גב",
  finish: "גימורים",
  color: "צבעים",
};

export type ColorType = "solid" | "wood";
export const COLOR_TYPE_LABELS: Record<ColorType, string> = { solid: "צבע אחיד", wood: "דמוי עץ" };
export type Surface = "opaque" | "glass" | "mirror";
export type WoodTexture = "oak" | "walnut";

export interface BoardAttrs {
  thicknessesMm: number[];
  finishIds: string[];
}
export interface FacadeAttrs extends BoardAttrs {
  surface: Surface;
}
export interface BackAttrs {
  thicknessesMm: number[];
}
export interface FinishAttrs {
  /** חספוס 0..1: 0 מבריק, 1 מט. משפיע על ההדמיה בלבד. */
  roughness: number;
  colorTypes: ColorType[];
}
export interface ColorAttrs {
  hex: string;
  type: ColorType;
  texture?: WoodTexture;
}

export interface LibraryItem<A = Record<string, unknown>> {
  id: string;
  kind: LibraryKind;
  name: string;
  active: boolean;
  sort: number;
  attrs: A;
  /** מחיר ליחידה: ריק עד שהנגרייה תזין. לא בשימוש בשלב זה. */
  unitPrice: number | null;
}

export const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "צבע חייב להיות בפורמט #RRGGBB");
const thicknesses = z.array(z.number().int().min(2).max(80)).min(1, "יש להזין לפחות עובי אחד").max(8);

export const attrsSchemas = {
  board: z.object({ thicknessesMm: thicknesses, finishIds: z.array(z.string()) }),
  facade: z.object({
    thicknessesMm: thicknesses,
    finishIds: z.array(z.string()),
    surface: z.enum(["opaque", "glass", "mirror"]),
  }),
  back: z.object({ thicknessesMm: thicknesses }),
  finish: z.object({ roughness: z.number().min(0).max(1), colorTypes: z.array(z.enum(["solid", "wood"])).min(1, "יש לבחור סוג צבע אחד לפחות") }),
  color: z.object({ hex: hexSchema, type: z.enum(["solid", "wood"]), texture: z.enum(["oak", "walnut"]).optional() }),
} as const;

const idSchema = z.string().trim().min(1).max(60).regex(/^[a-z0-9][a-z0-9-]*$/, "מזהה באנגלית קטנה, ספרות ומקפים");
const nameSchema = z.string().trim().min(1, "יש להזין שם").max(80);

export const materialCreateSchema = z
  .object({
    id: idSchema.optional(),
    kind: z.enum(LIBRARY_KINDS),
    name: nameSchema,
    active: z.boolean().optional(),
    attrs: z.record(z.string(), z.unknown()),
  })
  .superRefine((v, ctx) => {
    const r = attrsSchemas[v.kind].safeParse(v.attrs);
    if (!r.success) ctx.addIssue({ code: "custom", message: r.error.issues[0]?.message ?? "הנתונים אינם תקינים", path: ["attrs"] });
  });
export type MaterialCreateInput = z.infer<typeof materialCreateSchema>;

export const materialPatchSchema = z.object({
  name: nameSchema.optional(),
  active: z.boolean().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});
export type MaterialPatchInput = z.infer<typeof materialPatchSchema>;

export function validateAttrs(kind: LibraryKind, attrs: unknown): string | null {
  const r = attrsSchemas[kind].safeParse(attrs);
  return r.success ? null : (r.error.issues[0]?.message ?? "הנתונים אינם תקינים");
}

export type Library = LibraryItem[];

export function itemsOf<A = Record<string, unknown>>(lib: Library, kind: LibraryKind, opts: { activeOnly?: boolean } = {}): LibraryItem<A>[] {
  return lib
    .filter((m) => m.kind === kind && (!opts.activeOnly || m.active))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "he")) as LibraryItem<A>[];
}

export function itemById<A = Record<string, unknown>>(lib: Library, id: string | undefined): LibraryItem<A> | undefined {
  return id ? (lib.find((m) => m.id === id) as LibraryItem<A> | undefined) : undefined;
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function thicknessOptions(item: LibraryItem | undefined): number[] {
  return nums(item?.attrs.thicknessesMm).sort((a, b) => a - b);
}
export function allowedFinishIds(item: LibraryItem | undefined): string[] {
  return strs(item?.attrs.finishIds);
}
export function surfaceOf(item: LibraryItem | undefined): Surface {
  const s = item?.attrs.surface;
  return s === "glass" || s === "mirror" ? s : "opaque";
}
export function finishColorTypes(item: LibraryItem | undefined): ColorType[] {
  const t = strs(item?.attrs.colorTypes).filter((x): x is ColorType => x === "solid" || x === "wood");
  return t.length ? t : ["solid"];
}
export function colorType(item: LibraryItem | undefined): ColorType {
  return item?.attrs.type === "wood" ? "wood" : "solid";
}
export function colorHex(item: LibraryItem | undefined): string {
  const h = item?.attrs.hex;
  return typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? h : "#d9d6cf";
}
export function colorTexture(item: LibraryItem | undefined): WoodTexture | undefined {
  const t = item?.attrs.texture;
  return t === "oak" || t === "walnut" ? t : undefined;
}
export function finishRoughness(item: LibraryItem | undefined): number {
  return Math.min(1, Math.max(0, num(item?.attrs.roughness, 0.7)));
}

export type MaterialGroup = "body" | "facade";

export interface Reason {
  ok: boolean;
  reason?: string;
}

/** האם גימור מותר לחומר. כשלא: הסבר קצר בעברית. */
export function finishAllowed(material: LibraryItem | undefined, finish: LibraryItem): Reason {
  if (!material) return { ok: true };
  if (!finish.active) return { ok: false, reason: "הגימור הזה מושבת בספרייה" };
  return allowedFinishIds(material).includes(finish.id)
    ? { ok: true }
    : { ok: false, reason: `לא מתאים ל${material.name}` };
}

/** האם צבע מותר לגימור. */
export function colorAllowed(finish: LibraryItem | undefined, color: LibraryItem): Reason {
  if (!finish) return { ok: true };
  if (!color.active) return { ok: false, reason: "הצבע הזה מושבת בספרייה" };
  return finishColorTypes(finish).includes(colorType(color))
    ? { ok: true }
    : { ok: false, reason: colorType(color) === "wood" ? `${finish.name} זמין רק בצבע אחיד` : `${finish.name} זמין רק בדוגמת עץ` };
}

export interface GroupSelection {
  materialId?: string;
  finishId?: string;
  colorId?: string;
  thicknessMm?: number;
}

export interface GroupFix extends GroupSelection {
  notes: string[];
}

/**
 * משלים ומתקן בחירה של קבוצה (גוף או חזיתות) כך שתהיה תקינה מול הספרייה:
 * חומר פעיל -> גימור מותר לחומר -> צבע מותר לגימור -> עובי מתוך עוביי החומר.
 * שינוי שנאלץ לבצע מוחזר ב-notes, כדי שהמשתמש יראה מה השתנה.
 */
export function fixGroupSelection(lib: Library, kind: "board" | "facade", sel: GroupSelection): GroupFix {
  const notes: string[] = [];
  const materials = itemsOf(lib, kind, { activeOnly: true }).filter((m) => (kind === "facade" ? surfaceOf(m) === "opaque" : true));
  const out: GroupFix = { ...sel, notes };
  let material = itemById(lib, sel.materialId);
  if (!material || !material.active || !materials.some((m) => m.id === material!.id)) {
    material = materials[0];
    if (sel.materialId && material) notes.push(`החומר הקודם לא זמין. נבחר ${material.name}`);
  }
  out.materialId = material?.id;

  const finishes = itemsOf(lib, "finish", { activeOnly: true });
  const okFinishes = finishes.filter((f) => finishAllowed(material, f).ok);
  let finish = itemById(lib, sel.finishId);
  if (!finish || !okFinishes.some((f) => f.id === finish!.id)) {
    const prev = finish;
    finish = okFinishes[0];
    if (prev && finish) notes.push(`הגימור ${prev.name} לא מתאים ל${material?.name ?? "חומר"}. נבחר ${finish.name}`);
  }
  out.finishId = finish?.id;

  const colors = itemsOf(lib, "color", { activeOnly: true });
  const okColors = colors.filter((c) => colorAllowed(finish, c).ok);
  let color = itemById(lib, sel.colorId);
  if (!color || !okColors.some((c) => c.id === color!.id)) {
    const prev = color;
    color = okColors[0];
    if (prev && color) notes.push(`הצבע ${prev.name} לא מתאים לגימור ${finish?.name ?? ""}. נבחר ${color.name}`);
  }
  out.colorId = color?.id;

  const thick = thicknessOptions(material);
  if (thick.length && (sel.thicknessMm === undefined || !thick.includes(sel.thicknessMm))) {
    const prev = sel.thicknessMm;
    const pick = prev === undefined ? (thick.includes(18) ? 18 : thick[0]) : thick.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a));
    out.thicknessMm = pick;
    if (prev !== undefined) notes.push(`עובי ${prev} מ״מ לא קיים ב${material?.name}. נבחר ${pick} מ״מ`);
  }
  return out;
}

export function fixBackSelection(lib: Library, sel: { materialId?: string; thicknessMm?: number }) {
  const backs = itemsOf(lib, "back", { activeOnly: true });
  let m = itemById(lib, sel.materialId);
  if (!m || !m.active) m = backs[0];
  const thick = thicknessOptions(m);
  let t = sel.thicknessMm;
  if (thick.length && (t === undefined || !thick.includes(t))) t = thick.includes(4) ? 4 : thick[0];
  return { materialId: m?.id, thicknessMm: t };
}

/** משלים/מתקן את סעיף החומרים כולו מול הספרייה. */
export function fixMaterials(lib: Library, current: FurnitureDesign["materials"]): { materials: NonNullable<FurnitureDesign["materials"]>; notes: string[] } {
  const c = current ?? {};
  const body = fixGroupSelection(lib, "board", { materialId: c.bodyMaterialId, finishId: c.bodyFinishId, colorId: c.bodyColorId, thicknessMm: c.thicknessMm });
  const facade = fixGroupSelection(lib, "facade", {
    materialId: c.facadeMaterialId,
    finishId: c.facadeFinishId,
    colorId: c.facadeColorId,
    thicknessMm: c.facadeThicknessMm,
  });
  const back = fixBackSelection(lib, { materialId: c.backMaterialId, thicknessMm: c.backThicknessMm });
  const materials: NonNullable<FurnitureDesign["materials"]> = {};
  if (body.materialId) materials.bodyMaterialId = body.materialId;
  if (body.finishId) materials.bodyFinishId = body.finishId;
  if (body.colorId) materials.bodyColorId = body.colorId;
  if (body.thicknessMm) materials.thicknessMm = body.thicknessMm;
  if (facade.materialId) materials.facadeMaterialId = facade.materialId;
  if (facade.finishId) materials.facadeFinishId = facade.finishId;
  if (facade.colorId) materials.facadeColorId = facade.colorId;
  if (facade.thicknessMm) materials.facadeThicknessMm = facade.thicknessMm;
  if (back.materialId) materials.backMaterialId = back.materialId;
  if (back.thicknessMm) materials.backThicknessMm = back.thicknessMm;
  return { materials, notes: [...body.notes.map((n) => `גוף: ${n}`), ...facade.notes.map((n) => `חזיתות: ${n}`)] };
}

/** מראה פיזי מחושב של משטח, לשימוש תצוגת התלת-ממד והסיכום. */
export interface SurfaceLook {
  hex: string;
  texture?: WoodTexture;
  roughness: number;
  name: string;
}

export function surfaceLook(lib: Library, colorId: string | undefined, finishId: string | undefined): SurfaceLook {
  const color = itemById(lib, colorId);
  const finish = itemById(lib, finishId);
  return {
    hex: colorHex(color),
    texture: colorType(color) === "wood" ? (colorTexture(color) ?? "oak") : undefined,
    roughness: finishRoughness(finish),
    name: color?.name ?? "—",
  };
}

interface Seed {
  id: string;
  kind: LibraryKind;
  name: string;
  attrs: Record<string, unknown>;
}

export const SEED_LIBRARY: Seed[] = [
  { id: "fin-laminate", kind: "finish", name: "פורמייקה", attrs: { roughness: 0.55, colorTypes: ["solid", "wood"] } },
  { id: "fin-baked-paint", kind: "finish", name: "צבע בתנור", attrs: { roughness: 0.42, colorTypes: ["solid"] } },
  { id: "fin-veneer", kind: "finish", name: "פורניר", attrs: { roughness: 0.5, colorTypes: ["wood"] } },
  { id: "fin-melamine", kind: "finish", name: "מלמין", attrs: { roughness: 0.62, colorTypes: ["solid", "wood"] } },
  { id: "fin-natural-wood", kind: "finish", name: "גימור עץ טבעי", attrs: { roughness: 0.68, colorTypes: ["wood"] } },

  { id: "board-melamine", kind: "board", name: "סיבית מצופה מלמין", attrs: { thicknessesMm: [17, 18, 25], finishIds: ["fin-melamine"] } },
  { id: "board-mdf", kind: "board", name: "MDF", attrs: { thicknessesMm: [18, 25, 28], finishIds: ["fin-laminate", "fin-baked-paint", "fin-veneer"] } },
  { id: "board-plywood", kind: "board", name: "סנדוויץ׳ (דיקט רב-שכבתי)", attrs: { thicknessesMm: [15, 18, 21, 28], finishIds: ["fin-laminate", "fin-veneer", "fin-natural-wood", "fin-baked-paint"] } },
  { id: "board-solid-wood", kind: "board", name: "עץ מלא", attrs: { thicknessesMm: [20, 28, 40], finishIds: ["fin-natural-wood"] } },

  { id: "fac-mdf", kind: "facade", name: "MDF", attrs: { thicknessesMm: [18, 22, 25], finishIds: ["fin-laminate", "fin-baked-paint", "fin-veneer"], surface: "opaque" } },
  { id: "fac-plywood", kind: "facade", name: "סנדוויץ׳", attrs: { thicknessesMm: [18, 21], finishIds: ["fin-laminate", "fin-veneer", "fin-natural-wood"], surface: "opaque" } },
  { id: "fac-melamine", kind: "facade", name: "סיבית מצופה מלמין", attrs: { thicknessesMm: [17, 18], finishIds: ["fin-melamine"], surface: "opaque" } },
  { id: "fac-solid-wood", kind: "facade", name: "עץ מלא", attrs: { thicknessesMm: [20, 28], finishIds: ["fin-natural-wood", "fin-baked-paint"], surface: "opaque" } },
  { id: "fac-glass", kind: "facade", name: "זכוכית", attrs: { thicknessesMm: [4, 6], finishIds: [], surface: "glass" } },
  { id: "fac-mirror", kind: "facade", name: "מראה", attrs: { thicknessesMm: [4, 5], finishIds: [], surface: "mirror" } },

  { id: "back-hdf", kind: "back", name: "HDF", attrs: { thicknessesMm: [3, 4, 6] } },
  { id: "back-plywood", kind: "back", name: "דיקט", attrs: { thicknessesMm: [4, 6, 8] } },

  { id: "col-white", kind: "color", name: "לבן מט", attrs: { hex: "#f6f6f3", type: "solid" } },
  { id: "col-cream", kind: "color", name: "שמנת", attrs: { hex: "#e7dcc3", type: "solid" } },
  { id: "col-oak", kind: "color", name: "אלון טבעי", attrs: { hex: "#c8a06c", type: "wood", texture: "oak" } },
  { id: "col-walnut", kind: "color", name: "אגוז", attrs: { hex: "#6a4630", type: "wood", texture: "walnut" } },
  { id: "col-grey", kind: "color", name: "אפור", attrs: { hex: "#8c8e91", type: "solid" } },
  { id: "col-graphite", kind: "color", name: "גרפיט", attrs: { hex: "#3b3d40", type: "solid" } },
  { id: "col-black", kind: "color", name: "שחור", attrs: { hex: "#1c1c1d", type: "solid" } },
];

export function seedLibrary(): Library {
  return SEED_LIBRARY.map((s, i) => ({ ...s, active: true, sort: (i + 1) * 10, unitPrice: null }));
}
