export const FURNITURE_CATEGORIES = [
  { key: "wardrobes", label: "ארונות בגדים", hint: "ארון עם תלייה, מדפים ומגירות" },
  { key: "sliding-wardrobes", label: "ארונות הזזה", hint: "דלתות הזזה לחדר שינה" },
  { key: "dressers", label: "שידות וקומודות", hint: "מגירות לחדר שינה וחדר ילדים" },
  { key: "sideboards", label: "מזנונים", hint: "מזנון סלון ופינת אוכל" },
  { key: "bedrooms", label: "חדרי שינה", hint: "מערכת שלמה לחדר שינה" },
  { key: "bookcases", label: "ספריות ומדפים", hint: "מדפים פתוחים וספריות" },
  { key: "bathroom", label: "ארונות אמבטיה", hint: "ארון תחת כיור וארונית קיר" },
] as const;

export type CategoryKey = (typeof FURNITURE_CATEGORIES)[number]["key"];

export const CATEGORY_KEYS = FURNITURE_CATEGORIES.map((c) => c.key) as [
  CategoryKey,
  ...CategoryKey[],
];

export function categoryLabel(key: string | null | undefined): string | null {
  return FURNITURE_CATEGORIES.find((c) => c.key === key)?.label ?? null;
}

export const PROJECT_STATUSES = [
  { key: "draft", label: "טיוטה" },
  { key: "trial", label: "ניסיון" },
  { key: "planning", label: "בתכנון" },
  { key: "quote", label: "הצעת מחיר" },
  { key: "approved", label: "אושר" },
  { key: "in_progress", label: "בביצוע" },
  { key: "completed", label: "הושלם" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["key"];

export const STATUS_KEYS = PROJECT_STATUSES.map((s) => s.key) as [
  ProjectStatus,
  ...ProjectStatus[],
];

export function statusLabel(key: string): string {
  return PROJECT_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export type WizardStepKey =
  | "details"
  | "type"
  | "dimensions"
  | "interior"
  | "facades"
  | "materials"
  | "summary";

export interface WizardStepDef {
  n: number;
  key: WizardStepKey;
  title: string;
  subtitle: string;
  implemented: boolean;
  /** מה יופיע בשלב כשייבנה (מוצג בשלד המנווט בלבד). */
  includes?: string[];
}

export const WIZARD_STEPS: readonly WizardStepDef[] = [
  { n: 1, key: "details", title: "פרטי פרויקט", subtitle: "שם הפרויקט והלקוח", implemented: true },
  { n: 2, key: "type", title: "סוג רהיט", subtitle: "בחרו את סוג הרהיט שברצונכם לתכנן", implemented: true },
  { n: 3, key: "dimensions", title: "מידות ומבנה", subtitle: "הזינו את המידות ובחרו מיקום", implemented: false, includes: ["רוחב, גובה ועומק בס״מ", "מספר דלתות ויחידות", "מיקום: על הרצפה, תלוי או עם רגליים", "בדיקות תקינות והמחשה עם חיצי מידות"] },
  { n: 4, key: "interior", title: "חלוקה פנימית", subtitle: "בחרו את הסידור הפנימי", implemented: false, includes: ["תבניות מוכנות: תלייה, מדפים, מגירות", "התאמה אישית של כל תא", "כמות מדפים ומגירות"] },
  { n: 5, key: "facades", title: "חזיתות, דלתות וידיות", subtitle: "בחרו סוג דלת, סגנון וידית", implemented: false, includes: ["סוג דלת: ציר או הזזה", "סגנון חזית וסוג ידית", "הגדרה לכל דלת בנפרד"] },
  { n: 6, key: "materials", title: "חומרים וגימורים", subtitle: "בחרו חומר, צבע וגימור", implemented: false, includes: ["חומר גוף, חזית וגב", "עובי לוח וגימור", "צבע נפרד לגוף ולחזיתות"] },
  { n: 7, key: "summary", title: "סיכום ושמירה", subtitle: "צפו בתוצאה, שמרו ושלחו ללקוח", implemented: false, includes: ["סיכום כל ההגדרות", "תצוגת תלת-ממד", "הערות לנגר"] },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

export function stepByNumber(n: number): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.n === n);
}
