import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { seedCustomer, seedProject, uid } from "./helpers";

const VIEWPORTS = [
  { key: "phone-360", width: 360, height: 740, kind: "phone" },
  { key: "phone-galaxy-412", width: 412, height: 915, kind: "phone" },
  { key: "tablet-portrait-820", width: 820, height: 1180, kind: "tablet" },
  { key: "tablet-landscape-1180", width: 1180, height: 820, kind: "tablet" },
  { key: "desktop-1440", width: 1440, height: 900, kind: "desktop" },
] as const;

const OUT = path.join("test-results", "screens");
fs.mkdirSync(OUT, { recursive: true });

async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const wide: string[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > de.clientWidth + 1 || r.left < -1)) {
        const scrollable = el.closest("[class*='overflow-x-auto']");
        const fixedOrHidden = getComputedStyle(el).position === "fixed" || el.closest("nextjs-portal");
        if (!scrollable && !fixedOrHidden) wide.push(`${el.tagName}.${(el as HTMLElement).className?.toString().slice(0, 60)}`);
      }
    });
    return { pageOverflows: de.scrollWidth > de.clientWidth, wide: wide.slice(0, 5) };
  });
}

async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    const sel = "a, button, input:not([type=hidden]), select, textarea, [role=radio], [role=switch], [role=menuitem]";
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (el.closest("nextjs-portal") || el.closest("[hidden]")) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (el.classList.contains("sr-only")) return;
      if (getComputedStyle(el, "::after").position === "absolute" && el.tagName === "A") return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.width < 43.5 || r.height < 43.5) {
        bad.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return bad;
  });
}

let projectId = "";

test.beforeAll(async ({ request }) => {
  const customer = await seedCustomer(request, uid("משפחת לוי"), "050-1234567");
  await request.patch(`/api/customers/${customer.id}`, { data: { address: "הרצל 5, חיפה" } });
  const p = await seedProject(request, { name: "ארון חדר הורים — משפחת לוי", status: "planning", customerId: customer.id, category: "wardrobes", wizardStep: 2 });
  projectId = p.id;
  await seedProject(request, { name: "מזנון סלון — כהן", status: "quote", category: "sideboards", wizardStep: 5 });
  await seedProject(request, { name: "שידת מגירות — ניסיון", status: "trial", category: "dressers", wizardStep: 2 });
  await seedProject(request, { name: "ספריית קיר — אברהם", status: "approved", category: "bookcases", wizardStep: 7 });
  await seedProject(request, { name: "ארון ילדים — הדמיה ראשונית" });
  const longCustomer = await seedCustomer(request, "ל".repeat(110), "050-0000000");
  await seedProject(request, { name: "פ".repeat(115), customerId: longCustomer.id });
});

for (const vp of VIEWPORTS) {
  test.describe(`התאמה ל-${vp.key}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.kind !== "desktop", isMobile: vp.kind === "phone" });

    const pages: Array<[string, () => string, string]> = [
      ["home", () => "/", "מה נתכנן היום?"],
      ["projects", () => "/projects", "הפרויקטים שלי"],
      ["customers", () => "/customers", "לקוחות"],
      ["settings", () => "/settings", "הגדרות"],
      ["wizard-new", () => "/projects/new", "פרטי פרויקט"],
      ["wizard-step1", () => `/projects/${projectId}/wizard?step=1`, "פרטי פרויקט"],
      ["wizard-step2", () => `/projects/${projectId}/wizard?step=2`, "סוג רהיט"],
      ["wizard-step3", () => `/projects/${projectId}/wizard?step=3`, "מידות ומבנה"],
      ["wizard-step7", () => `/projects/${projectId}/wizard?step=7`, "סיכום ושמירה"],
    ];

    for (const [name, url, heading] of pages) {
      test(`${name}: RTL, בלי גלילה אופקית, ניווט נכון ואזורי מגע`, async ({ page }) => {
        await page.goto(url());
        await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
        if (name === "projects") await expect(page.getByTestId("project-card").first()).toBeVisible();
        if (name === "customers") await expect(page.getByTestId("customer-card").first()).toBeVisible();
        if (name.startsWith("wizard") && name !== "wizard-new") await expect(page.getByTestId("save-status")).toBeVisible();
        await page.waitForTimeout(250);

        expect(await page.evaluate(() => [document.dir, document.documentElement.lang])).toEqual(["rtl", "he"]);
        const report = await overflowReport(page);
        expect(report, "אסור גלילה אופקית").toEqual({ pageOverflows: false, wide: [] });

        const isWizard = name.startsWith("wizard");
        const bottom = page.getByRole("navigation", { name: "ניווט תחתון" });
        const side = page.getByRole("navigation", { name: "ניווט ראשי" });
        if (vp.kind === "phone") {
          await expect(side).toBeHidden();
          if (isWizard) await expect(bottom).toBeHidden();
          else await expect(bottom).toBeVisible();
        } else {
          await expect(bottom).toBeHidden();
          await expect(side).toBeVisible();
          const box = (await side.boundingBox())!;
          expect(box.x + box.width / 2, "סרגל הניווט בצד ימין (RTL)").toBeGreaterThan(vp.width / 2);
        }

        expect(await smallTargets(page), "אזורי לחיצה קטנים מ-44px").toEqual([]);
        await page.screenshot({ path: path.join(OUT, `${vp.key}__${name}.png`) });
      });
    }

    test("חלונות קופצים ותפריט פעולות נכנסים למסך", async ({ page }) => {
      await page.goto("/projects");
      await expect(page.getByTestId("project-card").first()).toBeVisible();
      await page.getByRole("button", { name: /פעולות עבור ארון חדר הורים/ }).first().click();
      await expect(page.getByRole("menu")).toBeVisible();
      expect(await smallTargets(page)).toEqual([]);
      await page.screenshot({ path: path.join(OUT, `${vp.key}__menu.png`) });
      await page.getByRole("menuitem", { name: "מחיקה" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(400);
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
      expect(await smallTargets(page)).toEqual([]);
      await page.screenshot({ path: path.join(OUT, `${vp.key}__delete-dialog.png`) });
    });
  });
}
