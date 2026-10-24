import type { NextConfig } from "next";

/**
 * NEXT_PUBLIC_STATIC_APP=1 (scripts/build-android.mjs): ייצוא סטטי ל-`out/` שנארז
 * ב-APK. בלי ה-API (שמועבר הצידה בזמן הבנייה) ועם נתיבי `[id]` במציין מקום.
 */
const isStaticApp = process.env.NEXT_PUBLIC_STATIC_APP === "1";

/** CORS ל-API: ברירת מחדל פתוח (אין עוגיות/אימות); CORS_ORIGIN="off" מכבה. */
const corsOrigin = process.env.CORS_ORIGIN ?? "*";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isStaticApp
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        // ה-API מועבר הצידה בבנייה הזו, ובדיקות היחידה מייבאות אותו; בדיקת הטיפוסים המלאה רצה ב-npm run typecheck
        typescript: { ignoreBuildErrors: true },
      }
    : {
        async headers() {
          if (corsOrigin === "off") return [];
          return [
            {
              source: "/api/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: corsOrigin },
                { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
                { key: "Access-Control-Allow-Headers", value: "Content-Type" },
                { key: "Access-Control-Max-Age", value: "86400" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
