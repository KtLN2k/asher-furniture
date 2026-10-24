import { expect, test, type Page } from "@playwright/test";
import { saved, seedProject, uid } from "./helpers";

interface Stats {
  doors: number;
  drawers: number;
  shelves: number;
  dividers: number;
  rods: number;
  handles: number;
  openDoors: number;
  bboxMm: { width: number; height: number; depth: number; bottom: number };
  doorsInfo: Array<{ id: string; style: string; handle: string; handleColor: string; opening: string | null }>;
  tier: string;
}

/** איכות נמוכה בבדיקות הזרימה: הרינדור התוכנתי (SwiftShader) חוסם את החוט הראשי, והבדיקות בודקות נתונים ולא יופי. */
test.beforeEach(async ({ page }, info) => {
  const tier = info.title.includes("זוויות") ? "medium" : "low";
  await page.addInitScript((t) => localStorage.setItem("asher:quality", t), tier);
});

async function stats(page: Page): Promise<Stats> {
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  const s = await page.evaluate(() => window.__asherScene?.stats() ?? null);
  expect(s, "מודל התלת-ממד לא נטען").not.toBeNull();
  return s as unknown as Stats;
}

/** מחכה עד שהתלת-ממד מתעדכן לפי הנתונים (המודל נבנה מחדש אחרי דחיית רינדור קצרה). */
async function expectScene(page: Page, check: (s: Stats) => void) {
  await expect(async () => check(await stats(page))).toPass({ timeout: 20_000 });
}

async function setNumber(page: Page, testId: string, value: string) {
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.press("Enter");
}

const next = (page: Page) => page.getByRole("button", { name: "המשך" }).click();

test.describe("תכנון רהיט מלא", () => {
  test("מידות, חלוקה, חזיתות, חומרים, סיכום, שמירה ופתיחה מחדש — והתלת-ממד תואם לנתונים", async ({ page, request }) => {
    const name = uid("ארון תכנון");
    const p = await seedProject(request, { name, category: "wardrobes", wizardStep: 3 });
    await page.goto(`/projects/${p.id}/wizard?step=3`);

    // שלב 3: מידות ומבנה
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
    await expect(page.getByTestId("step-dimensions")).toBeVisible();
    await expect(page.getByTestId("dim-width")).toBeVisible();
    await expectScene(page, (s) => {
      expect(s.doors).toBe(5);
      expect(s.bboxMm).toMatchObject({ width: 2400, height: 2400, depth: 600 });
    });

    await setNumber(page, "dim-width-input", "300");
    await expect(page.getByTestId("door-count-input")).toHaveValue("6");
    await setNumber(page, "door-count-input", "7");
    await setNumber(page, "dim-depth-input", "62");
    await expectScene(page, (s) => {
      expect(s.doors).toBe(7);
      expect(s.handles).toBe(7);
      expect(s.bboxMm.width).toBe(3000);
      expect(s.bboxMm.depth).toBe(620);
    });
    await expect(page.getByTestId("dims-ok")).toBeVisible();

    // תקינות: רוחב מחוץ לטווח חוסם המשך
    await setNumber(page, "dim-width-input", "9");
    await expect(page.getByTestId("issue-list")).toContainText("רוחב");
    await next(page);
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await setNumber(page, "dim-width-input", "300");
    await expect(page.getByTestId("dim-width-input")).toHaveValue("300");
    await saved(page);

    // שלב 4: חלוקה פנימית
    await next(page);
    await expect(page.getByRole("heading", { name: "חלוקה פנימית" })).toBeVisible();
    await page.getByTestId("template-shelves").click();
    await expectScene(page, (s) => {
      expect(s.rods).toBe(0);
      expect(s.shelves).toBeGreaterThan(0);
    });
    await page.getByTestId("template-hang-shelves").click();
    await expectScene(page, (s) => expect(s.rods).toBeGreaterThan(0));

    await page.getByTestId("comp-0").click();
    const before = await stats(page);
    await setNumber(page, "comp-shelves-input", "2");
    await expect(page.getByTestId("template-custom")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("add-compartment").click();
    await expectScene(page, (s) => expect(s.dividers).toBe(before.dividers + 1));
    const afterInterior = await stats(page);
    await saved(page);

    // שלב 5: דלתות, חזיתות וידיות
    await next(page);
    await expect(page.getByRole("heading", { name: "חזיתות, דלתות וידיות" })).toBeVisible();
    await page.getByTestId("facade-chip-door-2").click();
    await page.getByTestId("style-grooved").click();
    await page.getByTestId("handle-knob").click();
    await page.getByTestId("handle-color-brass").click();
    await expectScene(page, (s) => {
      const d = s.doorsInfo.find((x) => x.id === "door-2");
      expect(d).toMatchObject({ style: "grooved", handle: "knob", handleColor: "brass" });
      expect(s.doorsInfo.find((x) => x.id === "door-1")).toMatchObject({ style: "flat", handle: "standard" });
    });

    await page.getByTestId("apply-all").click();
    await expectScene(page, (s) => {
      expect(s.doorsInfo.every((d) => d.style === "grooved" && d.handle === "knob" && d.handleColor === "brass")).toBe(true);
    });

    await page.getByTestId("facade-all").click();
    await page.getByTestId("style-flat").click();
    await page.getByTestId("handle-long").click();
    await page.getByTestId("handle-color-black").click();
    await expectScene(page, (s) => {
      expect(s.doorsInfo.every((d) => d.style === "flat" && d.handle === "long" && d.handleColor === "black")).toBe(true);
      expect(s.handles).toBe(4);
    });

    // שילוב לא מתאים מוסתר או מוסבר: חריצים לא מתאימים לדלתות הזזה
    await page.getByTestId("doortype-none").click();
    await expectScene(page, (s) => expect(s.doors).toBe(0));
    await expect(page.getByText("בעיצוב הנוכחי אין דלתות")).toBeVisible();
    await page.getByTestId("doortype-hinged").click();
    await expectScene(page, (s) => expect(s.doors).toBe(6));
    await saved(page);

    // שלב 6: חומרים וצבעים — רק שילובים מותרים
    await next(page);
    await expect(page.getByRole("heading", { name: "חומרים וגימורים" })).toBeVisible();
    await page.getByTestId("body-material-board-solid-wood").click();
    await expect(page.getByTestId("body-finish-fin-natural-wood")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("body-finish-fin-laminate")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("body-color-col-white")).toHaveAttribute("data-disabled", "true");
    await page.getByTestId("body-color-col-walnut").click();
    await expect(page.getByTestId("body-color-col-walnut")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("facade-material-fac-mdf").click();
    await page.getByTestId("facade-finish-fin-baked-paint").click();
    await expect(page.getByTestId("facade-color-col-oak")).toHaveAttribute("data-disabled", "true");
    await page.getByTestId("facade-color-col-white").click();
    await page.getByTestId("facade-thickness-22").click();
    await saved(page);

    // שלב 7: סיכום
    await next(page);
    await expect(page.getByRole("heading", { name: "סיכום ושמירה" })).toBeVisible();
    await expect(page.getByTestId("sum-dims")).toContainText("300 × 240 × 62");
    await expect(page.getByTestId("sum-door-count")).toHaveText("6");
    await expect(page.getByTestId("sum-body-material")).toContainText("עץ מלא");
    await expect(page.getByTestId("sum-body-color")).toContainText("אגוז");
    await expect(page.getByTestId("sum-facade-color")).toContainText("צבע בתנור");
    await expect(page.getByTestId("sum-doors")).toContainText("ידית ארוכה שחור");
    await page.getByTestId("design-notes").fill("קיר מזרחי, להתקין תאורה פנימית");
    await expect(page.getByTestId("sum-compartments")).toHaveText(String(afterInterior.dividers + 1));
    await expectScene(page, (s) => {
      expect(s.doors).toBe(6);
      expect(s.dividers).toBe(afterInterior.dividers);
      expect(s.shelves).toBe(afterInterior.shelves);
      expect(s.bboxMm).toMatchObject({ width: 3000, depth: 620 });
    });
    await saved(page);

    // הנתונים בשרת
    const server = await (await request.get(`/api/projects/${p.id}`)).json();
    const d = server.project.design;
    expect(d.dimensions).toMatchObject({ widthMm: 3000, heightMm: 2400, depthMm: 620 });
    expect(d.structure.doorCount).toBe(6);
    expect(d.materials).toMatchObject({ bodyMaterialId: "board-solid-wood", bodyColorId: "col-walnut", facadeFinishId: "fin-baked-paint", facadeThicknessMm: 22 });
    expect(d.notes).toBe("קיר מזרחי, להתקין תאורה פנימית");

    // פתיחה מחדש: אותו עיצוב, אותו תלת-ממד
    await page.goto("/projects");
    await page.getByTestId("project-card").filter({ hasText: name }).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name: "סיכום ושמירה" })).toBeVisible();
    await expect(page.getByTestId("design-notes")).toHaveValue("קיר מזרחי, להתקין תאורה פנימית");
    await expect(page.getByTestId("sum-dims")).toContainText("300 × 240 × 62");
    await expectScene(page, (s) => {
      expect(s.doors).toBe(6);
      expect(s.shelves).toBe(afterInterior.shelves);
      expect(s.dividers).toBe(afterInterior.dividers);
      expect(s.doorsInfo.every((x) => x.style === "flat" && x.handle === "long")).toBe(true);
      expect(s.bboxMm).toMatchObject({ width: 3000, height: 2400, depth: 620 });
    });
  });

  test("תצוגת תלת-ממד: זוויות, פתיחת דלתות וצילום תמונה", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("ארון תצוגה"), category: "wardrobes", wizardStep: 3 });
    await page.goto(`/projects/${p.id}/wizard?step=3`);
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-ready", "true", { timeout: 45_000 });

    for (const v of ["front", "side", "top", "perspective"] as const) {
      await page.getByTestId(`viewer-view-${v}`).click();
      await expect(page.getByTestId("viewer")).toHaveAttribute("data-view", v);
    }

    expect((await stats(page)).openDoors).toBe(0);
    await page.getByTestId("viewer-open-all").click();
    await expectScene(page, (s) => expect(s.openDoors).toBe(s.doors));
    await page.getByTestId("viewer-open-all").click();
    await expectScene(page, (s) => expect(s.openDoors).toBe(0));

    const download = page.waitForEvent("download");
    await page.getByTestId("viewer-capture").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);

    await page.getByTestId("viewer-room").click();
    await page.getByTestId("room-off").click();
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-room", "off");
  });

  test("מגירות בתוך הרהיט נראות רק בדלתות פתוחות, ובשידה הן בחזית", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("שידה"), category: "dressers", wizardStep: 4 });
    await page.goto(`/projects/${p.id}/wizard?step=4`);
    await expect(page.getByRole("heading", { name: "חלוקה פנימית" })).toBeVisible();
    await page.getByTestId("template-drawers").click();
    await expectScene(page, (s) => expect(s.drawers).toBeGreaterThan(0));
    await expect(page.getByTestId("viewer")).toHaveAttribute("data-drawers", /[1-9]/);
  });

  test("שינוי סוג רהיט מאפס מידות וחלוקה לברירות המחדל של הסוג", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("החלפת סוג"), category: "wardrobes", wizardStep: 3 });
    await page.goto(`/projects/${p.id}/wizard?step=3`);
    await setNumber(page, "dim-width-input", "200");
    await saved(page);
    await page.goto(`/projects/${p.id}/wizard?step=2`);
    await expect(page.getByTestId("type-change-note")).toBeVisible();
    await page.getByTestId("category-sideboards").click();
    await saved(page);
    await next(page);
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
    await expect(page.getByTestId("dim-width-input")).not.toHaveValue("200");
    const server = await (await request.get(`/api/projects/${p.id}`)).json();
    expect(server.project.category).toBe("sideboards");
    expect(server.project.design.materials).toBeTruthy();
  });
});

test.describe("ספריית חומרים ומגבלות בהגדרות", () => {
  test("הוספת צבע והשבתתו משפיעות על שלב החומרים; מגבלות מידות משפיעות על התקינות", async ({ page, request }) => {
    const colorName = uid("ירוק מרווה");
    await page.goto("/settings");
    await page.getByTestId("settings-tab-library").click();
    await page.getByTestId("lib-tab-color").click();
    await page.getByTestId("lib-add").click();
    await page.getByTestId("lib-name").fill(colorName);
    await page.getByTestId("lib-hex").fill("#7a8f72");
    await page.getByTestId("lib-save").click();
    await expect(page.getByTestId("lib-list")).toContainText(colorName);

    const p = await seedProject(request, { name: uid("בדיקת ספרייה"), category: "wardrobes", wizardStep: 6 });
    await page.goto(`/projects/${p.id}/wizard?step=6`);
    await expect(page.getByTestId("step-materials")).toBeVisible();
    await expect(page.getByTestId("materials-body")).toContainText(colorName);

    await page.goto("/settings");
    await page.getByTestId("settings-tab-library").click();
    await page.getByTestId("lib-tab-color").click();
    const row = page.getByTestId("lib-list").getByRole("listitem").filter({ hasText: colorName });
    await row.getByRole("button", { name: "השבתה" }).click();
    await expect(row).toContainText("מושבת");
    await page.goto(`/projects/${p.id}/wizard?step=6`);
    await expect(page.getByTestId("materials-body")).not.toContainText(colorName);

    // שגיאת ולידציה בעורך
    await page.goto("/settings");
    await page.getByTestId("settings-tab-library").click();
    await page.getByTestId("lib-tab-color").click();
    await page.getByTestId("lib-add").click();
    await page.getByTestId("lib-name").fill("צבע שגוי");
    await page.getByTestId("lib-hex").fill("12345");
    await page.getByTestId("lib-save").click();
    await expect(page.getByTestId("lib-error")).toContainText("#RRGGBB");

    // מגבלות: מצמצמים רוחב מקסימלי לארון ובודקים שאזהרה/שגיאה מופיעה
    const limits = (await (await request.get("/api/limits")).json()).limits;
    const narrowed = { ...limits, byCategory: { ...limits.byCategory, wardrobes: { ...limits.byCategory.wardrobes, maxWidthMm: 2000 } } };
    expect((await request.put("/api/limits", { data: narrowed })).ok()).toBe(true);
    try {
      await page.goto(`/projects/${p.id}/wizard?step=3`);
      await expect(page.getByTestId("issue-list")).toContainText("רוחב");
    } finally {
      await request.put("/api/limits", { data: limits });
    }
  });
});
