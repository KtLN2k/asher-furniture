import { z } from "zod";
import { CATEGORY_KEYS, type CategoryKey } from "./catalog";

/**
 * מגבלות תכנון שהנגר מגדיר בהגדרות. ברירות המחדל הן ערכי התחלה סבירים לעריכה, לא מפרט ייצור.
 * כל המידות במ״מ.
 */
export const dimLimitSchema = z.object({
  minWidthMm: z.number().int().positive(),
  maxWidthMm: z.number().int().positive(),
  minHeightMm: z.number().int().positive(),
  maxHeightMm: z.number().int().positive(),
  minDepthMm: z.number().int().positive(),
  maxDepthMm: z.number().int().positive(),
});
export type DimLimit = z.infer<typeof dimLimitSchema>;

export const generalLimitSchema = z.object({
  maxHingedDoorWidthMm: z.number().int().positive(),
  minDoorWidthMm: z.number().int().positive(),
  maxDoorHeightMm: z.number().int().positive(),
  maxSlidingDoorWidthMm: z.number().int().positive(),
  maxShelfSpanMm: z.number().int().positive(),
  minCompartmentWidthMm: z.number().int().positive(),
});
export type GeneralLimits = z.infer<typeof generalLimitSchema>;

export interface Limits {
  general: GeneralLimits;
  byCategory: Record<CategoryKey, DimLimit>;
}

const L = (w: [number, number], h: [number, number], d: [number, number]): DimLimit => ({
  minWidthMm: w[0],
  maxWidthMm: w[1],
  minHeightMm: h[0],
  maxHeightMm: h[1],
  minDepthMm: d[0],
  maxDepthMm: d[1],
});

export const DEFAULT_LIMITS: Limits = {
  general: {
    maxHingedDoorWidthMm: 600,
    minDoorWidthMm: 200,
    maxDoorHeightMm: 2700,
    maxSlidingDoorWidthMm: 1300,
    maxShelfSpanMm: 900,
    minCompartmentWidthMm: 250,
  },
  byCategory: {
    wardrobes: L([400, 6000], [1200, 2700], [300, 800]),
    "sliding-wardrobes": L([900, 6000], [1800, 2700], [450, 800]),
    dressers: L([400, 2000], [400, 1400], [300, 700]),
    sideboards: L([600, 3000], [300, 1000], [300, 600]),
    bedrooms: L([400, 6000], [1200, 2700], [300, 800]),
    bookcases: L([300, 3000], [300, 2700], [150, 600]),
    bathroom: L([300, 1500], [300, 2200], [150, 600]),
  },
};

export const limitsSchema = z.object({
  general: generalLimitSchema,
  byCategory: z.object(Object.fromEntries(CATEGORY_KEYS.map((k) => [k, dimLimitSchema])) as Record<CategoryKey, typeof dimLimitSchema>),
});

/** בדיקת עקביות: מינימום לא גדול ממקסימום. מחזיר הודעה בעברית או null. */
export function limitsProblem(l: Limits): string | null {
  for (const key of CATEGORY_KEYS) {
    const c = l.byCategory[key];
    if (c.minWidthMm > c.maxWidthMm || c.minHeightMm > c.maxHeightMm || c.minDepthMm > c.maxDepthMm) {
      return "המינימום לא יכול להיות גדול מהמקסימום";
    }
  }
  if (l.general.minDoorWidthMm >= l.general.maxHingedDoorWidthMm) return "רוחב דלת מינימלי חייב להיות קטן מהמקסימלי";
  return null;
}

/** מיזוג מגבלות שנשמרו עם ברירות המחדל (שדות חדשים לא יישברו נתונים ישנים). */
export function resolveLimits(stored: unknown): Limits {
  const s = (stored ?? {}) as Partial<Limits>;
  const parsedGeneral = generalLimitSchema.safeParse({ ...DEFAULT_LIMITS.general, ...(s.general ?? {}) });
  const byCategory = { ...DEFAULT_LIMITS.byCategory };
  for (const key of CATEGORY_KEYS) {
    const p = dimLimitSchema.safeParse({ ...DEFAULT_LIMITS.byCategory[key], ...(s.byCategory?.[key] ?? {}) });
    if (p.success) byCategory[key] = p.data;
  }
  return { general: parsedGeneral.success ? parsedGeneral.data : DEFAULT_LIMITS.general, byCategory };
}
