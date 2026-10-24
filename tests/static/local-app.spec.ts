import { expect, test, type Page } from "@playwright/test";

/**
 * האפליקציה הארוזה ללא שרת: יצירה, תכנון, שמירה מקומית (PGlite ב-IndexedDB), טעינה מחדש
 * ופתיחה מחדש — עם נתיבי `[id]` במציין מקום (/projects/_/wizard/?id=...).
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("asher:quality", "low"));
});

const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 60_000 });

test("פרויקט נשמר במכשיר, שורד טעינה מחדש ונפתח בשלב הנכון עם תלת-ממד תואם", async ({ page }) => {
  const name = `ארון מקומי ${Date.now().toString(36)}`;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "מה נתכנן היום?" })).toBeVisible();

  await page.getByRole("link", { name: /פרויקט חדש/ }).first().click();
  await expect(page.getByRole("heading", { name: "פרטי פרויקט" })).toBeVisible();
  await page.getByLabel("שם הפרויקט").fill(name);
  await saved(page);
  await expect(page).toHaveURL(/\/projects\/_\/wizard\/\?id=[0-9a-f-]{36}&step=1/);

  await page.getByRole("button", { name: "המשך" }).click();
  await page.getByTestId("category-wardrobes").click();
  await saved(page);
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/_\/wizard\/\?id=[0-9a-f-]{36}&step=3/);

  const width = page.getByTestId("dim-width-input");
  await width.fill("300");
  await width.press("Enter");
  const doors = page.getByTestId("door-count-input");
  await doors.fill("7");
  await doors.press("Enter");
  await saved(page);
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await expect
    .poll(async () => page.evaluate(() => window.__asherScene?.stats()?.doors ?? null), { timeout: 30_000 })
    .toBe(7);

  // טעינה מלאה של כתובת פנימית: השרת מגיש את index.html של השורש והאפליקציה משחזרת את הנתיב
  await page.reload();
  await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("dim-width-input")).toHaveValue("300");

  await page.goto("/");
  await page.getByRole("link", { name: "פרויקטים" }).first().click();
  const card = page.getByTestId("project-card").filter({ hasText: name });
  await expect(card).toContainText("שלב 3 מתוך 7");
  await card.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
  await expect(page.getByTestId("door-count-input")).toHaveValue("7");
});

test("הגדרות: ספריית חומרים מקומית ולשונית מכשיר וחיבור", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "הגדרות" }).first().click();
  await expect(page.getByRole("heading", { name: "הגדרות" })).toBeVisible();
  await page.getByTestId("settings-tab-library").click();
  await expect(page.getByTestId("lib-list")).toBeVisible();

  await page.getByTestId("settings-tab-device").click();
  await expect(page.getByTestId("device-storage")).toContainText("במכשיר הזה בלבד");
  await page.getByTestId("server-url").fill("http://10.0.2.2:3000");
  await expect(page.getByTestId("server-save")).toBeEnabled();
});
