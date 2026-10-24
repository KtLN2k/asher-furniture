import type { CategoryKey } from "./catalog";
import type { BaseType, DoorType, Placement } from "./design";

export const TEMPLATE_KEYS = ["hang-shelves", "full-hang", "shelves", "drawers-shelves", "combo", "drawers", "custom"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, { label: string; hint: string }> = {
  "hang-shelves": { label: "תלייה ומדפים", hint: "תאי תלייה לסירוגין עם תאי מדפים" },
  "full-hang": { label: "תלייה מלאה", hint: "כל התאים לתלייה ארוכה" },
  shelves: { label: "מדפים בלבד", hint: "כל התאים עם מדפים" },
  "drawers-shelves": { label: "מגירות ומדפים", hint: "מגירות למטה ומדפים מעליהן" },
  combo: { label: "חלוקה משולבת", hint: "תלייה, מדפים ותא עם מגירות" },
  drawers: { label: "מגירות", hint: "ערימת מגירות בכל תא" },
  custom: { label: "מותאמת אישית", hint: "עורכים כל תא בנפרד" },
};

export interface CategoryCaps {
  doorTypes: DoorType[];
  defaultDoorType: DoorType;
  placements: Placement[];
  defaultPlacement: Placement;
  defaultDims: { widthMm: number; heightMm: number; depthMm: number };
  defaultTemplate: TemplateKey;
  templates: TemplateKey[];
  allowRod: boolean;
  /** גובה בסיס (צוקל/רגליים) ברירת מחדל במ״מ. */
  defaultBaseMm: { plinth: number; legs: number };
  defaultMountMm: number;
  /** מספר המגירות המקסימלי בתא. */
  note?: string;
}

export const CATEGORY_CAPS: Record<CategoryKey, CategoryCaps> = {
  wardrobes: {
    doorTypes: ["hinged", "none"],
    defaultDoorType: "hinged",
    placements: ["floor", "legs"],
    defaultPlacement: "floor",
    defaultDims: { widthMm: 2400, heightMm: 2400, depthMm: 600 },
    defaultTemplate: "hang-shelves",
    templates: ["hang-shelves", "full-hang", "shelves", "drawers-shelves", "combo", "custom"],
    allowRod: true,
    defaultBaseMm: { plinth: 80, legs: 100 },
    defaultMountMm: 0,
  },
  "sliding-wardrobes": {
    doorTypes: ["sliding", "none"],
    defaultDoorType: "sliding",
    placements: ["floor", "legs"],
    defaultPlacement: "floor",
    defaultDims: { widthMm: 2400, heightMm: 2400, depthMm: 600 },
    defaultTemplate: "hang-shelves",
    templates: ["hang-shelves", "full-hang", "shelves", "drawers-shelves", "combo", "custom"],
    allowRod: true,
    defaultBaseMm: { plinth: 80, legs: 100 },
    defaultMountMm: 0,
  },
  dressers: {
    doorTypes: ["none", "hinged"],
    defaultDoorType: "none",
    placements: ["floor", "legs", "wall-hung"],
    defaultPlacement: "legs",
    defaultDims: { widthMm: 1200, heightMm: 850, depthMm: 480 },
    defaultTemplate: "drawers",
    templates: ["drawers", "drawers-shelves", "shelves", "custom"],
    allowRod: false,
    defaultBaseMm: { plinth: 70, legs: 140 },
    defaultMountMm: 300,
  },
  sideboards: {
    doorTypes: ["hinged", "sliding", "flap", "none"],
    defaultDoorType: "hinged",
    placements: ["floor", "legs", "wall-hung"],
    defaultPlacement: "legs",
    defaultDims: { widthMm: 1800, heightMm: 600, depthMm: 420 },
    defaultTemplate: "drawers-shelves",
    templates: ["shelves", "drawers-shelves", "drawers", "combo", "custom"],
    allowRod: false,
    defaultBaseMm: { plinth: 70, legs: 150 },
    defaultMountMm: 300,
  },
  bedrooms: {
    doorTypes: ["hinged", "sliding", "none"],
    defaultDoorType: "hinged",
    placements: ["floor", "legs"],
    defaultPlacement: "floor",
    defaultDims: { widthMm: 2400, heightMm: 2400, depthMm: 600 },
    defaultTemplate: "combo",
    templates: ["hang-shelves", "full-hang", "shelves", "drawers-shelves", "combo", "custom"],
    allowRod: true,
    defaultBaseMm: { plinth: 80, legs: 100 },
    defaultMountMm: 0,
    note: "בשלב הזה מתכננים את ארון חדר השינה. פריטים נוספים בחדר (מיטה, שידות) יתווספו בהמשך.",
  },
  bookcases: {
    doorTypes: ["none", "hinged", "flap"],
    defaultDoorType: "none",
    placements: ["floor", "legs", "wall-hung"],
    defaultPlacement: "floor",
    defaultDims: { widthMm: 1200, heightMm: 2000, depthMm: 300 },
    defaultTemplate: "shelves",
    templates: ["shelves", "drawers-shelves", "custom"],
    allowRod: false,
    defaultBaseMm: { plinth: 70, legs: 100 },
    defaultMountMm: 300,
  },
  bathroom: {
    doorTypes: ["hinged", "flap", "none"],
    defaultDoorType: "hinged",
    placements: ["wall-hung", "floor", "legs"],
    defaultPlacement: "wall-hung",
    defaultDims: { widthMm: 800, heightMm: 600, depthMm: 460 },
    defaultTemplate: "drawers-shelves",
    templates: ["shelves", "drawers-shelves", "drawers", "custom"],
    allowRod: false,
    defaultBaseMm: { plinth: 70, legs: 120 },
    defaultMountMm: 450,
  },
};

export const PLACEMENT_LABELS: Record<Placement, { label: string; hint: string }> = {
  floor: { label: "על הרצפה", hint: "עומד ישירות על הרצפה" },
  legs: { label: "עם רגליים", hint: "מורם מעט מהרצפה" },
  "wall-hung": { label: "תלוי על הקיר", hint: "מרחף מעל הרצפה" },
};

export const BASE_LABELS: Record<BaseType, string> = {
  plinth: "צוקל",
  legs: "רגליים",
  none: "ללא בסיס",
};

export const DOOR_TYPE_LABELS: Record<DoorType, { label: string; hint: string }> = {
  hinged: { label: "דלתות ציר", hint: "נפתחות החוצה על צירים" },
  sliding: { label: "דלתות הזזה", hint: "נעות על מסילה, חוסכות מקום" },
  flap: { label: "קלפה", hint: "נפתחת מעלה או מטה" },
  none: { label: "ללא דלתות", hint: "חזית פתוחה או מגירות" },
};

export function capsFor(category: CategoryKey | null | undefined): CategoryCaps {
  return CATEGORY_CAPS[category ?? "wardrobes"];
}

/** מספר דלתות מוצע לפי רוחב וסוג. */
export function suggestDoorCount(widthMm: number, type: DoorType): number {
  if (type === "none") return 0;
  if (type === "sliding") return Math.max(2, Math.ceil(widthMm / 1100));
  if (type === "flap") return Math.max(1, Math.round(widthMm / 800));
  return Math.max(1, Math.ceil(widthMm / 550));
}
