/**
 * תשתית בלבד לשלבים ג׳/ד׳ (חלקים, חומרים, הצעת מחיר, רשימות חיתוך).
 * שום שדה כאן לא מקבל ערך בשלב א׳: אין מחירים ואין מידות ייצור מומצאות.
 * `cutDimensions` יכול להיות מלא רק על ידי מנוע ייצור מאומת, ועד אז הוא תמיד null.
 */
export type MaterialKind =
  | "board"
  | "facade"
  | "back"
  | "finish"
  | "color"
  | "handle"
  | "hardware";

export interface MaterialDef {
  id: string;
  kind: MaterialKind;
  name: string;
  /** מאפיינים חופשיים: עוביים אפשריים, שילובים מותרים (חומר×גימור), טקסטורה. */
  attrs: Record<string, unknown>;
  active: boolean;
  /** מחיר ליחידה. null עד שהנגרייה תזין. */
  unitPrice: number | null;
}

export type PartKind = "side" | "top" | "bottom" | "shelf" | "back" | "divider" | "drawer" | "door" | "other";

export interface Part {
  id: string;
  furnitureId: string;
  kind: PartKind;
  label: string;
  materialId: string | null;
  cutDimensions: { lengthMm: number; widthMm: number; thicknessMm: number } | null;
  productionApproved: false;
}
