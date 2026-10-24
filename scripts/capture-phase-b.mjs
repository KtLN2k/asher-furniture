// שימוש: node scripts/capture-phase-b.mjs <baseUrl> <outDir> [only]
// מזרים פרויקטים לדוגמה לשרת רץ ומצלם את שלבי התכנון והתלת-ממד בטלפון, בטאבלט ובמחשב.
// דורש דפדפן עם WebGL (בסביבה בלי GPU: SwiftShader, ראו README).
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "docs/screenshots-b";
const only = process.argv[4];
fs.mkdirSync(out, { recursive: true });

const post = async (url, body, method = "POST") =>
  (await fetch(base + url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

async function project(name, design, step) {
  const { project } = await post("/api/projects", { name, status: "planning" });
  await post(`/api/projects/${project.id}`, { design, wizardStep: step }, "PATCH");
  return project;
}

const WHITE = { bodyMaterialId: "board-melamine", bodyFinishId: "fin-melamine", bodyColorId: "col-white", thicknessMm: 18, facadeMaterialId: "fac-mdf", facadeFinishId: "fin-laminate", facadeColorId: "col-white", facadeThicknessMm: 18, backMaterialId: "back-hdf", backThicknessMm: 4 };

const target = await project(
  "ארון 7 דלתות לבן — הדמיית יעד",
  {
    category: "wardrobes",
    dimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 },
    structure: { placement: "legs", baseHeightMm: 40, unitCount: 1, doorCount: 7 },
    facades: { doorType: "hinged", defaults: { style: "flat", handle: "long", handleColor: "black" } },
    materials: WHITE,
  },
  7,
);
const planning = await project(
  "ארון חדר הורים — משפחת לוי",
  {
    category: "wardrobes",
    dimensions: { widthMm: 2400, heightMm: 2400, depthMm: 600 },
    structure: { placement: "floor", base: "plinth", baseHeightMm: 80, unitCount: 1, doorCount: 5 },
    facades: { doorType: "hinged", defaults: { style: "framed", handle: "standard", handleColor: "brass" }, doors: [{ id: "door-3", target: "door", style: "flat", handle: "knob", colorId: "col-walnut" }] },
    materials: { ...WHITE, bodyColorId: "col-cream", facadeColorId: "col-cream" },
  },
  3,
);
const sliding = await project(
  "ארון הזזה — חדר ילדים",
  {
    category: "sliding-wardrobes",
    dimensions: { widthMm: 2800, heightMm: 2500, depthMm: 600 },
    facades: { doorType: "sliding", defaults: { style: "mirror" , handle: "profile", handleColor: "steel" } },
    materials: { ...WHITE, bodyColorId: "col-white" },
  },
  7,
);
const dresser = await project(
  "שידת מגירות — אגוז",
  {
    category: "dressers",
    dimensions: { widthMm: 1200, heightMm: 900, depthMm: 480 },
    structure: { placement: "legs", baseHeightMm: 150, unitCount: 1, doorCount: 0 },
    interior: { template: "drawers" },
    facades: { doorType: "none", drawerDefaults: { handle: "long", handleColor: "brass" } },
    materials: { ...WHITE, bodyFinishId: "fin-laminate", bodyMaterialId: "board-mdf", bodyColorId: "col-walnut", facadeColorId: "col-walnut", facadeFinishId: "fin-laminate", facadeMaterialId: "fac-mdf" },
  },
  7,
);

const sizes = {
  phone: { width: 412, height: 915, hasTouch: true, isMobile: true },
  tablet: { width: 820, height: 1180, hasTouch: true },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function ready(page) {
  await page.getByTestId("viewer").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="viewer"]')?.getAttribute("data-ready") === "true", null, { timeout: 60000 });
  await page.waitForTimeout(2500);
}

for (const [name, vp] of Object.entries(sizes)) {
  if (only && !only.split(",").includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile, locale: "he-IL", timezoneId: "Asia/Jerusalem", deviceScaleFactor: name === "desktop" ? 1 : 1 });
  await ctx.addInitScript(() => localStorage.setItem("asher:quality", "high"));
  const page = await ctx.newPage();
  const shot = async (label, full = false) => page.screenshot({ path: `${out}/${name}-${label}.png`, fullPage: full });

  // 3D במסך מלא (כפתור ההגדלה בתצוגה המקדימה של שלבי התכנון)
  const expanded = async (id) => {
    await page.goto(`${base}/projects/${id}/wizard?step=3`);
    await page.getByTestId("viewer-expand").click();
    await page.getByTestId("preview-expanded").waitFor();
    await ready(page);
  };
  await expanded(target.id);
  await shot("01-target-wardrobe");
  await page.getByTestId("viewer-view-front").click();
  await page.waitForTimeout(2500);
  await shot("02-target-front");
  await page.getByTestId("viewer-view-perspective").click();
  await page.getByTestId("viewer-open-all").click();
  await page.waitForTimeout(3000);
  await shot("03-target-open");

  for (const [label, p] of [["04-sliding-mirror", sliding], ["05-dresser-drawers", dresser]]) {
    await expanded(p.id);
    await shot(label);
  }

  // שלבי האשף
  const steps = [["10-step3-dimensions", 3], ["11-step4-interior", 4], ["12-step5-facades", 5], ["13-step6-materials", 6], ["14-step7-summary", 7]];
  for (const [label, s] of steps) {
    await page.goto(`${base}/projects/${planning.id}/wizard?step=${s}`);
    await ready(page);
    await shot(label, true);
  }
  await ctx.close();
}
await browser.close();
console.log("saved to", out);
