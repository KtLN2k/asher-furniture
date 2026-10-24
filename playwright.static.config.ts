import { defineConfig } from "@playwright/test";

/**
 * בדיקות הלקוח הסטטי (האפליקציה הארוזה) על out/ אחרי `npm run build:android -- --web-only`,
 * מול שרת שמדמה את ה-WebView של Capacitor. אין שרת API: הנתונים נשמרים ב-IndexedDB.
 *   npx playwright test -c playwright.static.config.ts
 */
const PORT = 4190;

export default defineConfig({
  testDir: "tests/static",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
