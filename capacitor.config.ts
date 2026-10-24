import type { CapacitorConfig } from "@capacitor/cli";

/**
 * עטיפת אנדרואיד (Capacitor). הלקוח הסטטי של Next נבנה ל-`out/` עם
 * `npm run build:android` ונארז לתוך ה-APK; השרת (API + מסד נתונים) נשאר נפרד.
 * ברירת המחדל באפליקציה היא אחסון מקומי במכשיר (PGlite ב-IndexedDB); כתובת שרת
 * אפשר להגדיר במסך ההגדרות או דרך NEXT_PUBLIC_API_BASE בזמן הבנייה.
 */
const config: CapacitorConfig = {
  appId: "il.co.asherfurniture.planner",
  appName: "רהיטי אשר",
  webDir: "out",
  android: {
    // אפשר http לשרת פנימי ברשת המקומית (למשל 192.168.x.x:3000) בזמן בדיקות
    allowMixedContent: true,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
