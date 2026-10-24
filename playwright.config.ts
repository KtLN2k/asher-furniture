import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
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
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "phone", testIgnore: /responsive/, use: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true } },
    { name: "desktop", testIgnore: /responsive/, use: { viewport: { width: 1440, height: 900 } } },
    { name: "layouts", testMatch: /responsive/, use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `rm -rf .data-e2e && ASHER_DATA_DIR=.data-e2e npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
