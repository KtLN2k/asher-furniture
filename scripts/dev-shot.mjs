// שימוש: node scripts/dev-shot.mjs <baseUrl> <out.png> [room] [quality] [view] [size]
// צילום מהיר של ארון היעד בתצוגה המוגדלת, לכיוונון ההדמיה.
import { chromium } from "@playwright/test";

const [base = "http://localhost:3300", out = "/tmp/rs/shot.png", room = "bedroom", quality = "high", view = "perspective", size = "1440x900"] = process.argv.slice(2);
const [W, H] = size.split("x").map(Number);
const post = async (url, body, method = "POST") => (await fetch(base + url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const WHITE = { bodyMaterialId: "board-melamine", bodyFinishId: "fin-melamine", bodyColorId: "col-white", thicknessMm: 18, facadeMaterialId: "fac-mdf", facadeFinishId: "fin-laminate", facadeColorId: "col-white", facadeThicknessMm: 18, backMaterialId: "back-hdf", backThicknessMm: 4 };
const { project } = await post("/api/projects", { name: "יעד", status: "planning" });
const extra = process.env.DESIGN ? JSON.parse(process.env.DESIGN) : {};
await post(`/api/projects/${project.id}`, {
  design: {
    category: "wardrobes",
    dimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 },
    structure: { placement: "legs", baseHeightMm: 40, unitCount: 1, doorCount: 7 },
    facades: { doorType: "hinged", defaults: { style: "flat", handle: "long", handleColor: "black" } },
    materials: WHITE,
    presentation: { room },
    ...(extra.over ?? {}),
  },
  wizardStep: 7,
}, "PATCH");
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: "he-IL" });
await ctx.addInitScript((q) => localStorage.setItem("asher:quality", q), quality);
const page = await ctx.newPage();
page.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log("console:", m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
await page.goto(`${base}/projects/${project.id}/wizard?step=3`);
await page.getByTestId("viewer-expand").click();
await page.getByTestId("preview-expanded").waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="viewer"]')?.getAttribute("data-ready") === "true", null, { timeout: 90000 });
if (view !== "perspective") await page.getByTestId(`viewer-view-${view}`).click();
await page.waitForTimeout(Number(process.env.WAIT ?? 6000));
await page.screenshot({ path: out });
console.log("ok", out, project.id);
await browser.close();
