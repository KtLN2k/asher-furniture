/**
 * מצב הריצה של הלקוח.
 *
 *  - אתר רגיל (`next build`/`next start`): הלקוח פונה ל-API היחסי של אותו שרת.
 *  - אפליקציה ארוזה (NEXT_PUBLIC_STATIC_APP=1, למשל APK עם Capacitor): אין שרת
 *    מקומי. ברירת המחדל היא אחסון במכשיר (PGlite ב-IndexedDB, דרך אותו Repository
 *    שמשרת את ה-API); אם הוגדרה כתובת שרת — בהגדרות או ב-NEXT_PUBLIC_API_BASE
 *    בזמן הבנייה — הלקוח עובד מול השרת הזה.
 */
export const IS_STATIC_APP = process.env.NEXT_PUBLIC_STATIC_APP === "1";

const SERVER_KEY = "asher:server";
const BUILD_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

function normalize(url: string): string {
  const t = url.trim().replace(/\/+$/, "");
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

/** כתובת השרת שנשמרה במכשיר (ריק = לא הוגדרה). */
export function getStoredServer(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SERVER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredServer(url: string): void {
  const v = normalize(url);
  if (v) window.localStorage.setItem(SERVER_KEY, v);
  else window.localStorage.removeItem(SERVER_KEY);
}

/** בסיס ה-URL לקריאות API ("" = יחסי לאותו שרת). */
export function getServerBase(): string {
  if (!IS_STATIC_APP) return BUILD_BASE;
  return getStoredServer() || BUILD_BASE;
}

/** האם הנתונים נשמרים במכשיר עצמו (ללא שרת). */
export function usesLocalStore(): boolean {
  return IS_STATIC_APP && !getServerBase();
}

/** מציין המקום של נתיבי `[id]` בייצוא סטטי (ראו lib/routes.ts). */
export const ROUTE_PLACEHOLDER = "_";

/** ל-generateStaticParams של נתיבי `[id]`: בייצוא סטטי נבנה רק מציין המקום. */
export function staticIdParams(): { id: string }[] {
  return IS_STATIC_APP ? [{ id: ROUTE_PLACEHOLDER }] : [];
}
