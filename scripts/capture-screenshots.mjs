// שימוש: node scripts/capture-screenshots.mjs <baseUrl> <outDir>
// מזרים נתוני דוגמה (בעברית) לשרת רץ ומצלם מסכים מייצגים בטלפון, בטאבלט ובמחשב.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:3100";
const out = process.argv[3] ?? "docs/screenshots";
fs.mkdirSync(out, { recursive: true });

const post = async (url, body, method = "POST") =>
  (await fetch(base + url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

const levi = (await post("/api/customers", { name: "משפחת לוי", phone: "050-1234567", address: "הרצל 12, חיפה" })).customer;
const cohen = (await post("/api/customers", { name: "יוסי כהן", phone: "052-7654321", address: "ז׳בוטינסקי 3, נשר" })).customer;
await post("/api/customers", { name: "דנה אברהם", phone: "054-9998877" });

async function project(body, design, step) {
  const { project } = await post("/api/projects", body);
  await post(`/api/projects/${project.id}`, { design, wizardStep: step }, "PATCH");
  return project;
}
const main = await project({ name: "ארון חדר הורים — משפחת לוי", customerId: levi.id, status: "planning" }, { category: "wardrobes" }, 3);
await project({ name: "מזנון סלון — כהן", customerId: cohen.id, status: "quote" }, { category: "sideboards" }, 5);
await project({ name: "שידת מגירות — ניסיון", status: "trial" }, { category: "dressers" }, 2);
await project({ name: "ספריית קיר — אברהם", status: "approved" }, { category: "bookcases" }, 7);
await project({ name: "ארון ילדים — הדמיה ראשונית" }, {}, 1);
await project({ name: "ארון אמבטיה — לוי", customerId: levi.id, status: "in_progress" }, { category: "bathroom" }, 6);

const sizes = {
  phone: { width: 412, height: 915, hasTouch: true, isMobile: true },
  tablet: { width: 820, height: 1180, hasTouch: true },
  "tablet-landscape": { width: 1180, height: 820, hasTouch: true },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch();
for (const [name, vp] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const page = await ctx.newPage();
  const shot = async (label) => {
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/${name}-${label}.png` });
  };
  await page.goto(base + "/");
  await page.getByTestId("project-card").first().waitFor();
  await shot("01-home");
  await page.goto(base + "/projects");
  await page.getByTestId("project-card").first().waitFor();
  await shot("02-my-projects");
  await page.goto(base + `/projects/${main.id}/wizard?step=1`);
  await page.getByTestId("selected-customer").waitFor();
  await shot("03-wizard-details");
  await page.goto(base + `/projects/${main.id}/wizard?step=2`);
  await page.getByTestId("category-wardrobes").waitFor();
  await shot("04-wizard-type");
  await page.goto(base + `/projects/${main.id}/wizard?step=3`);
  await page.getByTestId("step-placeholder").waitFor();
  await shot("05-wizard-skeleton");
  await page.goto(base + "/customers");
  await page.getByTestId("customer-card").first().waitFor();
  await shot("06-customers");
  await ctx.close();
}
await browser.close();
console.log("saved to", out);
