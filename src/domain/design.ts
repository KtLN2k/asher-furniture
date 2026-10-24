import { z } from "zod";
import { CATEGORY_KEYS } from "./catalog";

/**
 * המודל המרכזי של רהיט. מסמך JSON אחד לכל פריט רהיט, גרסתי (schemaVersion).
 * כל הסעיפים אופציונליים: שלב א׳ ממלא רק את `category`; שלב ב׳ ימלא את שאר הסעיפים
 * (ושלב ג׳ ייצור תצוגת 3D מאותו מסמך). אין כאן ערכי ברירת מחדל מומצאים.
 * מידות נשמרות במ״מ (מספרים שלמים); הממשק מציג ס״מ.
 */
export const dimensionsSchema = z.object({
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  depthMm: z.number().int().positive(),
});

export const structureSchema = z.object({
  doorCount: z.number().int().min(0).optional(),
  unitCount: z.number().int().min(1).optional(),
  placement: z.enum(["floor", "wall-hung", "legs"]).optional(),
  base: z.enum(["plinth", "legs", "none"]).optional(),
  installation: z.enum(["freestanding", "niche"]).optional(),
});

export const compartmentSchema = z.object({
  id: z.string(),
  widthShare: z.number().positive().optional(),
  kind: z.string().optional(),
  shelves: z.number().int().min(0).optional(),
  drawers: z.number().int().min(0).optional(),
  hangingRod: z.enum(["none", "short", "long"]).optional(),
  open: z.boolean().optional(),
});

export const interiorSchema = z.object({
  template: z.string().optional(),
  compartments: z.array(compartmentSchema).optional(),
});

export const facadeSchema = z.object({
  id: z.string(),
  target: z.enum(["door", "drawer", "open-compartment"]),
  doorType: z.enum(["hinged", "sliding", "flap", "none"]).optional(),
  style: z.string().optional(),
  handle: z.string().optional(),
  handlePosition: z.string().optional(),
  opening: z.enum(["left", "right", "up", "down"]).optional(),
  materialId: z.string().optional(),
  colorId: z.string().optional(),
});

export const facadesSchema = z.object({
  doors: z.array(facadeSchema).optional(),
});

export const materialsSelectionSchema = z.object({
  bodyMaterialId: z.string().optional(),
  facadeMaterialId: z.string().optional(),
  backMaterialId: z.string().optional(),
  thicknessMm: z.number().int().positive().optional(),
  finishId: z.string().optional(),
  bodyColorId: z.string().optional(),
  facadeColorId: z.string().optional(),
});

const designSections = {
  category: z.enum(CATEGORY_KEYS).nullable(),
  dimensions: dimensionsSchema,
  structure: structureSchema,
  interior: interiorSchema,
  facades: facadesSchema,
  materials: materialsSelectionSchema,
  notes: z.string().max(4000),
};

export const designSchema = z.object({
  schemaVersion: z.literal(1),
  category: designSections.category,
  dimensions: designSections.dimensions.optional(),
  structure: designSections.structure.optional(),
  interior: designSections.interior.optional(),
  facades: designSections.facades.optional(),
  materials: designSections.materials.optional(),
  notes: designSections.notes.optional(),
});

export type FurnitureDesign = z.infer<typeof designSchema>;

export const DESIGN_SECTIONS = [
  "category",
  "dimensions",
  "structure",
  "interior",
  "facades",
  "materials",
  "notes",
] as const;

/** עדכון חלקי: רק סעיפים שנשלחו. בלי ברירות מחדל, כדי שסעיף חסר לעולם לא ידרוס נתונים. */
export const designPatchSchema = z.object({
  category: designSections.category.optional(),
  dimensions: designSections.dimensions.optional(),
  structure: designSections.structure.optional(),
  interior: designSections.interior.optional(),
  facades: designSections.facades.optional(),
  materials: designSections.materials.optional(),
  notes: designSections.notes.optional(),
});
export type DesignPatch = z.infer<typeof designPatchSchema>;

export function emptyDesign(): FurnitureDesign {
  return { schemaVersion: 1, category: null };
}

/** מיזוג ברמת סעיף: סעיף שנשלח מחליף את הסעיף הקיים, שאר הסעיפים נשארים. */
export function mergeDesign(base: FurnitureDesign, patch: DesignPatch): FurnitureDesign {
  const next: FurnitureDesign = { ...base };
  for (const section of DESIGN_SECTIONS) {
    if (section in patch) {
      const value = patch[section];
      if (value === undefined) {
        delete (next as Record<string, unknown>)[section];
      } else {
        (next as Record<string, unknown>)[section] = value;
      }
    }
  }
  return next;
}
