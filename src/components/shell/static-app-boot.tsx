"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * רץ פעם אחת בטעינת האפליקציה הארוזה. שרת הקבצים של Capacitor מגיש את index.html של
 * השורש לכל נתיב בלי סיומת, ולכן בטעינה ישירה של כתובת פנימית (למשל אחרי שחזור
 * חלון) הדף שמוצג הוא הבית. כאן מנווטים בצד הלקוח לכתובת האמיתית.
 */
export function StaticAppBoot() {
  const router = useRouter();
  useEffect(() => {
    const { pathname, search } = window.location;
    if (pathname !== "/" && pathname !== "/index.html") router.replace(pathname + search);
  }, [router]);
  return null;
}
