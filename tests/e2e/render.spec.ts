import { expect, test, type Page } from "@playwright/test";
import { saved, seedProject, uid } from "./helpers";

/** איכות נמוכה לתצוגה החיה: ״צור הדמיה״ עובר בעצמו לאיכות גבוהה לצורך הרינדור. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("asher:quality", "low"));
});

const ready = (page: Page) => expect(page.getByTestId("viewer")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });

interface SceneStats {
  room: string;
  tier: string;
  fx: { ao: boolean; probe: boolean; floorReflection: boolean; clearcoat: boolean };
}
const scene = (page: Page) => page.evaluate(() => window.__asherScene?.stats() as unknown as SceneStats | null);

test.describe("חדרים לדוגמה והדמיה", () => {
  test("בחירת חדר נשמרת בפרויקט, משתנה בתלת-ממד ונשארת אחרי טעינה מחדש", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("ארון חדרים"), category: "wardrobes", wizardStep: 7 });
    await page.goto(`/projects/${p.id}/wizard?step=7`);
    await ready(page);
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-room", "bedroom");
    await expect(page.getByTestId("viewer-room")).toContainText("חדר שינה");

    for (const [key, label] of [
      ["living", "סלון"],
      ["kids", "חדר ילדים"],
      ["bathroom", "חדר רחצה"],
      ["neutral", "חלל ניטרלי"],
    ] as const) {
      await page.getByTestId("viewer-room").click();
      await expect(page.getByTestId("room-menu").getByRole("menuitemradio")).toHaveCount(6);
      await page.getByTestId(`room-${key}`).click();
      await expect(page.getByTestId("viewer")).toHaveAttribute("data-room", key);
      await expect(page.getByTestId("viewer-room")).toContainText(label);
      expect((await scene(page))?.room).toBe(key);
    }

    await saved(page);
    const server = await (await request.get(`/api/projects/${p.id}`)).json();
    expect(server.project.design.presentation).toEqual({ room: "neutral" });

    await page.reload();
    await ready(page);
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-room", "neutral");

    await page.getByTestId("viewer-room").click();
    await page.getByTestId("room-off").click();
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-room", "off");
  });

  test("צור הדמיה: תמונה ברזולוציה כפולה, הורדה ושמירה כתמונה ממוזערת בכרטיס הפרויקט", async ({ page, request }) => {
    const name = uid("ארון הדמיה");
    const p = await seedProject(request, { name, category: "wardrobes", wizardStep: 7 });
    await page.goto(`/projects/${p.id}/wizard?step=7`);
    await ready(page);
    expect((await scene(page))?.tier).toBe("low");
    const box = await page.getByTestId("viewer").boundingBox();

    await page.getByTestId("viewer-render").click();
    await expect(page.getByTestId("render-working")).toBeVisible();
    const result = page.getByTestId("render-result");
    await expect(result).toBeVisible({ timeout: 150_000 });
    const width = Number(await result.getAttribute("data-width"));
    const height = Number(await result.getAttribute("data-height"));
    expect(width).toBeGreaterThanOrEqual(Math.floor(box!.width * 1.9));
    expect(height).toBeGreaterThanOrEqual(Math.floor(box!.height * 1.9));
    await expect(page.getByTestId("render-saved")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByTestId("render-download").click();
    expect((await download).suggestedFilename()).toMatch(/הדמיה\.png$/);

    // התצוגה החיה חוזרת לאיכות שנבחרה
    await page.locator("dialog button", { hasText: "סגירה" }).first().click();
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-rendering", "false");
    expect((await scene(page))?.tier).toBe("low");

    await saved(page);
    const server = await (await request.get(`/api/projects/${p.id}`)).json();
    expect(server.project.thumbnail).toMatch(/^data:image\/jpeg;base64,/);

    await page.goto("/projects");
    const thumb = page.getByTestId("project-card").filter({ hasText: name }).getByTestId("project-thumbnail");
    await expect(thumb).toBeVisible();
    await expect(thumb).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  });

  test("איכות גבוהה מפעילה השתקפות חדר, חסימת אור סביבתית והשתקפות רצפה; איכות נמוכה לא", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("ארון איכות"), category: "wardrobes", wizardStep: 7 });
    await page.addInitScript(() => localStorage.setItem("asher:quality", "high"));
    await page.goto(`/projects/${p.id}/wizard?step=7`);
    await ready(page);
    await expect.poll(async () => (await scene(page))?.tier).toBe("high");
    expect((await scene(page))?.fx).toEqual({ ao: true, probe: true, floorReflection: true, clearcoat: true });
    await page.getByTestId("viewer-quality").click();
    await page.getByTestId("quality-low").click();
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-tier", "low");
    await expect.poll(async () => (await scene(page))?.fx).toEqual({ ao: false, probe: false, floorReflection: false, clearcoat: false });
  });
});
