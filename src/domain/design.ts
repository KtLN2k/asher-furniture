import { z } from "zod";
import { CATEGORY_KEYS } from "./catalog";

/**
 * המודל המרכזי של רהיט. מסמך JSON אחד לכל פריט רהיט, גרסתי (schemaVersion).
 * כל הסעיפים אופציונליים. הממשק, תצוגת התלת-ממד, הבדיקות והסיכום נגזרים כולם מאותו מסמך.
 * פריטי ספרייה (חומרים, גימורים, צבעים) מופיעים כאן כמזהים בלבד.
 * מידות נשמרות במ״מ (מספרים שלמים); הממשק מציג ס״מ.
 */
export const dimensionsSchema = z.object({
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  depthMm: z.number().int().positive(),
});

export const PLACEMENTS = ["floor", "wall-hung", "legs"] as const;
export const BASES = ["plinth", "legs", "none"] as const;
export const DOOR_TYPES = ["hinged", "sliding", "flap", "none"] as const;
export const DOOR_STYLES = ["flat", "framed", "grooved", "glass", "mirror"] as const;
export const HANDLE_TYPES = ["standard", "long", "knob", "integral", "profile", "push", "none"] as const;
export const HANDLE_COLORS = ["black", "steel", "brass", "white"] as const;
export const HANDLE_POSITIONS = ["auto", "top", "middle", "bottom"] as const;
export const OPENINGS = ["left", "right", "up", "down"] as const;
export const ROD_TYPES = ["none", "short", "long"] as const;

export type Placement = (typeof PLACEMENTS)[number];
export type BaseType = (typeof BASES)[number];
export type DoorType = (typeof DOOR_TYPES)[number];
export type DoorStyle = (typeof DOOR_STYLES)[number];
export type HandleType = (typeof HANDLE_TYPES)[number];
export type HandleColor = (typeof HANDLE_COLORS)[number];
export type HandlePosition = (typeof HANDLE_POSITIONS)[number];
export type Opening = (typeof OPENINGS)[number];
export type RodType = (typeof ROD_TYPES)[number];

export const structureSchema = z.object({
  doorCount: z.number().int().min(0).max(16).optional(),
  unitCount: z.number().int().min(1).max(12).optional(),
  placement: z.enum(PLACEMENTS).optional(),
  base: z.enum(BASES).optional(),
  baseHeightMm: z.number().int().min(0).max(400).optional(),
  mountHeightMm: z.number().int().min(0).max(2000).optional(),
  installation: z.enum(["freestanding", "niche"]).optional(),
});

export const compartmentSchema = z.object({
  id: z.string(),
  /** חלק יחסי מהרוחב הפנימי. כל החלקים מנורמלים כך שסכומם 1. */
  widthShare: z.number().positive(),
  shelves: z.number().int().min(0).max(30),
  drawers: z.number().int().min(0).max(12),
  hangingRod: z.enum(ROD_TYPES),
  /** תא פתוח בקצה הארון: בלי דלת בחזית. */
  open: z.boolean().optional(),
});

export const interiorSchema = z.object({
  template: z.string().optional(),
  compartments: z.array(compartmentSchema).optional(),
});

/** הגדרות חזית שאפשר לדרוס לכל דלת/מגירה. ערך חסר = ברירת המחדל של הרהיט. */
export const facadeOverrideSchema = z.object({
  style: z.enum(DOOR_STYLES).optional(),
  handle: z.enum(HANDLE_TYPES).optional(),
  handleColor: z.enum(HANDLE_COLORS).optional(),
  handlePosition: z.enum(HANDLE_POSITIONS).optional(),
  opening: z.enum(OPENINGS).optional(),
  colorId: z.string().optional(),
});

export const facadeSchema = facadeOverrideSchema.extend({
  id: z.string(),
  target: z.enum(["door", "drawer", "open-compartment"]),
});

export const facadesSchema = z.object({
  doorType: z.enum(DOOR_TYPES).optional(),
  /** ברירת מחדל לכל הדלתות. */
  defaults: facadeOverrideSchema.optional(),
  /** ברירת מחדל לכל חזיתות המגירות. */
  drawerDefaults: facadeOverrideSchema.optional(),
  doors: z.array(facadeSchema).optional(),
  drawers: z.array(facadeSchema).optional(),
});

export const materialsSelectionSchema = z.object({
  bodyMaterialId: z.string().optional(),
  bodyFinishId: z.string().optional(),
  bodyColorId: z.string().optional(),
  thicknessMm: z.number().int().positive().optional(),
  facadeMaterialId: z.string().optional(),
  facadeFinishId: z.string().optional(),
  facadeColorId: z.string().optional(),
  facadeThicknessMm: z.number().int().positive().optional(),
  backMaterialId: z.string().optional(),
  backThicknessMm: z.number().int().positive().optional(),
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
