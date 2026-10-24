// שימוש: node scripts/capture-render.mjs <baseUrl> <outDir>
// מצלם את ההדמיה בכל החדרים בלחיצה אמיתית על ״צור הדמיה״ (רינדור ברזולוציה כפולה), את התצוגה החיה
// באותה מסגרת כמו צילומי שלב ב׳ (להשוואת לפני/אחרי), ואת רשימת הפרויקטים עם התמונות הממוזערות.
// דורש דפדפן עם WebGL (בסביבה בלי GPU: SwiftShader, ראו README).
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3300";
const out = process.argv[3] ?? "docs/screenshots-render";
fs.mkdirSync(out, { recursive: true });

const post = async (url, body, method = "POST") =>
  (await fetch(base + url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const WHITE = { bodyMaterialId: "board-melamine", bodyFinishId: "fin-melamine", bodyColorId: "col-white", thicknessMm: 18, facadeMaterialId: "fac-mdf", facadeFinishId: "fin-laminate", facadeColorId: "col-white", facadeThicknessMm: 18, backMaterialId: "back-hdf", backThicknessMm: 4 };
const ROOMS = { bedroom: "חדר שינה", living: "סלון", kids: "חדר ילדים", bathroom: "חדר רחצה", neutral: "חלל ניטרלי" };

async function project(name, design, step = 7) {
  const { project } = await post("/api/projects", { name, status: "planning" });
  await post(`/api/projects/${project.id}`, { design, wizardStep: step }, "PATCH");
  return project;
}
const wardrobe = (room) => ({
  category: "wardrobes",
  dimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 },
  structure: { placement: "legs", baseHeightMm: 40, unitCount: 1, doorCount: 7 },
  facades: { doorType: "hinged", defaults: { style: "flat", handle: "long", handleColor: "black" } },
  materials: WHITE,
  presentation: { room },
});

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const newPage = async (viewport, quality = "high", extra = {}) => {
  const ctx = await browser.newContext({ viewport, locale: "he-IL", timezoneId: "Asia/Jerusalem", ...extra });
  await ctx.addInitScript((q) => localStorage.setItem("asher:quality", q), quality);
  return { ctx, page: await ctx.newPage() };
};
const ready = async (page) => {
  await page.getByTestId("viewer").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="viewer"]')?.getAttribute("data-ready") === "true", null, { timeout: 90000 });
  await page.waitForTimeout(4000);
};
const expanded = async (page, id) => {
  await page.goto(`${base}/projects/${id}/wizard?step=3`);
  await page.getByTestId("viewer-expand").click();
  await page.getByTestId("preview-expanded").waitFor();
  await ready(page);
};
async function renderTo(page, file) {
  await page.getByTestId("viewer-render").click();
  await page.getByTestId("render-result").waitFor({ timeout: 300000 });
  const dataUrl = await page.evaluate(async () => {
    const img = document.querySelector('[data-testid="render-result"] img');
    const blob = await (await fetch(img.src)).blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  await page.locator("dialog button", { hasText: "סגירה" }).first().click();
  await page.waitForTimeout(800);
}

// 1. אחרי: התצוגה החיה באותה מסגרת של שלב ב׳, ואז ״צור הדמיה״ בכל חדר
const projects = {};
for (const room of Object.keys(ROOMS)) projects[room] = await project(`ארון 7 דלתות — ${ROOMS[room]}`, wardrobe(room));
{
  const { ctx, page } = await newPage({ width: 1440, height: 900 });
  await expanded(page, projects.bedroom.id);
  await page.screenshot({ path: `${out}/after-live-bedroom-desktop.png` });
  await renderTo(page, `${out}/render-bedroom.png`);
  for (const room of ["living", "kids", "bathroom", "neutral"]) {
    await expanded(page, projects[room].id);
    await page.screenshot({ path: `${out}/live-${room}-desktop.png` });
    await renderTo(page, `${out}/render-${room}.png`);
  }
  await ctx.close();
}

// 2. מראה והשתקפות חדר אמיתי, וחזית מבריקה
{
  const mirror = await project("ארון הזזה עם מראה — סלון", {
    category: "sliding-wardrobes",
    dimensions: { widthMm: 2800, heightMm: 2500, depthMm: 600 },
    structure: { placement: "floor", base: "plinth", baseHeightMm: 80, unitCount: 1, doorCount: 3 },
    facades: { doorType: "sliding", defaults: { style: "mirror", handle: "profile", handleColor: "steel" } },
    materials: WHITE,
    presentation: { room: "living" },
  });
  const gloss = await project("ארון גרפיט מבריק — חדר שינה", {
    ...wardrobe("bedroom"),
    materials: { ...WHITE, bodyMaterialId: "board-mdf", bodyFinishId: "fin-baked-paint", facadeFinishId: "fin-baked-paint", facadeColorId: "col-graphite" },
  });
  const { ctx, page } = await newPage({ width: 1440, height: 900 });
  await expanded(page, mirror.id);
  await renderTo(page, `${out}/render-mirror-living.png`);
  await expanded(page, gloss.id);
  await renderTo(page, `${out}/render-gloss-bedroom.png`);
  await ctx.close();
}

// 3. טלפון (איכות בינונית): בחירת חדר
{
  const { ctx, page } = await newPage({ width: 412, height: 915 }, "medium", { hasTouch: true, isMobile: true });
  await expanded(page, projects.kids.id);
  await page.screenshot({ path: `${out}/phone-live-kids.png` });
  await page.getByTestId("viewer-room").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/phone-room-menu.png` });
  await ctx.close();
}

// 4. רשימת הפרויקטים עם התמונות הממוזערות שנשמרו מההדמיה
{
  const { ctx, page } = await newPage({ width: 1100, height: 900 }, "low");
  await page.goto(`${base}/projects`);
  await page.getByTestId("project-card").first().waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/projects-with-thumbnails.png` });
  await ctx.close();
}
await browser.close();
console.log("saved to", out);
