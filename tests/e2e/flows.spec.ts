import { expect, test } from "@playwright/test";
import { card, projectIdFromUrl, saved, seedCustomer, seedProject, uid } from "./helpers";

test.describe("יצירה, שמירה ופתיחה מחדש", () => {
  test("פרויקט חדש עם לקוח חדש וסוג רהיט נשמר בשרת ונפתח מחדש בדיוק במקום שעצרנו", async ({ page }) => {
    const name = uid("ארון חדר הורים");
    const customer = uid("משפחת לוי");

    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "פרטי פרויקט" })).toBeVisible();
    await expect(page.getByTestId("save-status")).toContainText("יישמר אוטומטית ברגע שתזינו שם");

    await page.getByLabel("שם הפרויקט").fill(name);
    await saved(page);
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}\/wizard\?step=1/);
    const id = projectIdFromUrl(page);

    await page.locator("#customer-input").fill(customer);
    await page.getByRole("button", { name: new RegExp(`הוספת ״${customer}״ כלקוח חדש`) }).click();
    await expect(page.getByTestId("selected-customer")).toContainText(customer);
    await page.getByLabel("טלפון הלקוח").fill("050-1112233");
    await page.getByLabel("כתובת").fill("הרצל 5, חיפה");
    await page.getByLabel("תיאור והערות").fill("ארון עם דלתות הזזה, קיר מזרחי");
    await saved(page);

    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByRole("heading", { name: "סוג רהיט" })).toBeVisible();
    await page.getByTestId("category-wardrobes").click();
    await expect(page.getByTestId("category-wardrobes")).toHaveAttribute("aria-checked", "true");
    await saved(page);

    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();
    await expect(page.getByTestId("step-placeholder")).toBeVisible();
    await saved(page);

    await page.reload();
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();

    const server = await (await page.request.get(`/api/projects/${id}`)).json();
    expect(server.project).toMatchObject({
      name,
      category: "wardrobes",
      wizardStep: 3,
      notes: "ארון עם דלתות הזזה, קיר מזרחי",
      customer: { name: customer, phone: "050-1112233", address: "הרצל 5, חיפה" },
    });

    await page.goto("/projects");
    const c = card(page, name);
    await expect(c).toContainText("ארונות בגדים");
    await expect(c).toContainText(customer);
    await expect(c).toContainText("שלב 3 מתוך 7");
    await c.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name: "מידות ומבנה" })).toBeVisible();

    await page.getByRole("button", { name: "חזרה", exact: true }).click();
    await page.getByRole("button", { name: "חזרה", exact: true }).click();
    await expect(page.getByRole("heading", { name: "פרטי פרויקט" })).toBeVisible();
    await expect(page.getByLabel("שם הפרויקט")).toHaveValue(name);
    await expect(page.getByTestId("selected-customer")).toContainText(customer);
    await expect(page.getByLabel("טלפון הלקוח")).toHaveValue("050-1112233");
    await expect(page.getByLabel("תיאור והערות")).toHaveValue("ארון עם דלתות הזזה, קיר מזרחי");
  });

  test("לא ניתן להמשיך בלי שם פרויקט, ולא נוצר פרויקט ריק", async ({ page, request }) => {
    const before = (await (await request.get("/api/projects?archived=all")).json()).projects.length;
    await page.goto("/projects/new");
    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByText("יש להזין שם לפרויקט").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "פרטי פרויקט" })).toBeVisible();
    const after = (await (await request.get("/api/projects?archived=all")).json()).projects.length;
    expect(after).toBe(before);
  });

  test("ניסיון לא גמור נשמר כטיוטה ומופיע בהיסטוריה", async ({ page }) => {
    const name = uid("טיוטה לא גמורה");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(name);
    await saved(page);
    await page.getByRole("button", { name: "סגירה וחזרה להפרויקטים שלי" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    const c = card(page, name);
    await expect(c).toContainText("טיוטה");
    await expect(c).toContainText("שלב 1 מתוך 7");
  });

  test("פרויקט ניסיון: ללא לקוח, סטטוס ניסיון", async ({ page }) => {
    const name = uid("שידת מגירות — ניסיון");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(name);
    await page.getByRole("switch", { name: /פרויקט ניסיון/ }).check({ force: true });
    await expect(page.locator("#customer-input")).toHaveCount(0);
    await saved(page);
    const id = projectIdFromUrl(page);
    const { project } = await (await page.request.get(`/api/projects/${id}`)).json();
    expect(project.status).toBe("trial");
    expect(project.customer).toBeNull();
  });

  test("בחירת קטגוריה מדף הבית מסמנת אותה בשלב סוג הרהיט", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /מזנונים/ }).click();
    await expect(page).toHaveURL(/\/projects\/new\?type=sideboards/);
    await page.getByLabel("שם הפרויקט").fill(uid("מזנון מהבית"));
    await saved(page);
    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByTestId("category-sideboards")).toHaveAttribute("aria-checked", "true");
  });

  test("בשלב סוג רהיט אי אפשר להמשיך בלי לבחור", async ({ page }) => {
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(uid("בלי סוג"));
    await saved(page);
    await page.getByRole("button", { name: "המשך" }).click();
    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByText("בחרו סוג רהיט כדי להמשיך")).toBeVisible();
    await expect(page.getByRole("heading", { name: "סוג רהיט" })).toBeVisible();
  });

  test("לקוח קיים נבחר מהרשימה, ובמעבר שלב הטקסט שהוקלד הופך ללקוח חדש", async ({ page, request }) => {
    const existing = await seedCustomer(request, uid("כהן יוסי"), "052-0000000");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(uid("מזנון כהן"));
    await page.locator("#customer-input").fill(existing.name.slice(0, 6));
    await page.getByRole("option", { name: new RegExp(existing.name) }).getByRole("button").click();
    await expect(page.getByLabel("טלפון הלקוח")).toHaveValue("052-0000000");

    const typed = uid("לקוח שהוקלד");
    await page.getByRole("button", { name: "החלפה" }).click();
    await page.locator("#customer-input").fill(typed);
    await page.getByRole("button", { name: "המשך" }).click();
    await expect(page.getByRole("heading", { name: "סוג רהיט" })).toBeVisible();
    const list = await (await request.get(`/api/customers?q=${encodeURIComponent(typed)}`)).json();
    expect(list.customers).toHaveLength(1);
    expect(list.customers[0].projectCount).toBe(1);
  });
});

test.describe("שמירה אוטומטית: כשלים והתנגשויות", () => {
  test("כשל רשת: השינוי נשאר במסך, מוצגת הודעה, ונשמר אוטומטית כשהחיבור חוזר", async ({ page }) => {
    const name = uid("כשל רשת");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(name);
    await saved(page);
    const id = projectIdFromUrl(page);

    await page.route("**/api/projects/*", (route) => (route.request().method() === "PATCH" ? route.abort("failed") : route.continue()));
    await page.getByLabel("תיאור והערות").fill("הערה שנכתבה בזמן שאין רשת");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "error");
    await expect(page.getByTestId("save-status")).toContainText("לא נשמר");
    await expect(page.getByLabel("תיאור והערות")).toHaveValue("הערה שנכתבה בזמן שאין רשת");

    await page.unroute("**/api/projects/*");
    await saved(page);
    const { project } = await (await page.request.get(`/api/projects/${id}`)).json();
    expect(project.notes).toBe("הערה שנכתבה בזמן שאין רשת");
  });

  test("גיבוי מקומי של שינויים שלא נשמרו משוחזר בפתיחה הבאה ונשמר בשרת", async ({ page }) => {
    const name = uid("שחזור");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(name);
    await saved(page);
    const id = projectIdFromUrl(page);
    const { project } = await (await page.request.get(`/api/projects/${id}`)).json();

    // מדמה סגירת דפדפן באמצע כשל רשת: בגיבוי המקומי נשארו שינויים שהשרת לא קיבל
    await page.evaluate(
      ([key, backup]) => localStorage.setItem(key, backup),
      [`asher:draft:${id}`, JSON.stringify({ baseRevision: project.revision, patch: { notes: "שינוי שלא הספיק להישמר" } })],
    );
    await page.goto(`/projects/${id}/wizard?step=1`);
    await expect(page.getByText("שחזרנו שינויים שלא הספיקו להישמר")).toBeVisible();
    await expect(page.getByLabel("תיאור והערות")).toHaveValue("שינוי שלא הספיק להישמר");
    await saved(page);
    const after = await (await page.request.get(`/api/projects/${id}`)).json();
    expect(after.project.notes).toBe("שינוי שלא הספיק להישמר");
    expect(await page.evaluate((k) => localStorage.getItem(k), `asher:draft:${id}`)).toBeNull();
  });

  test("סגירת הדף בזמן כשל שמירה לא מאבדת את השינוי (שליחה אחרונה בעת הסתרת הדף)", async ({ page }) => {
    const name = uid("סגירה בכשל");
    await page.goto("/projects/new");
    await page.getByLabel("שם הפרויקט").fill(name);
    await saved(page);
    const id = projectIdFromUrl(page);

    await page.route("**/api/projects/*", (route) => (route.request().method() === "PATCH" ? route.abort("failed") : route.continue()));
    await page.getByLabel("תיאור והערות").fill("נכתב ממש לפני סגירה");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "error");
    await page.unroute("**/api/projects/*");

    page.on("dialog", (d) => void d.accept());
    await page.goto("/projects");
    await expect
      .poll(async () => (await (await page.request.get(`/api/projects/${id}`)).json()).project.notes)
      .toBe("נכתב ממש לפני סגירה");
  });

  test("שני חלונות על אותו פרויקט: מזהים התנגשות ומאפשרים לבחור", async ({ browser, request }) => {
    const p = await seedProject(request, { name: uid("התנגשות") });
    const ctx = await browser.newContext({ locale: "he-IL" });
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await a.goto(`/projects/${p.id}/wizard?step=1`);
    await b.goto(`/projects/${p.id}/wizard?step=1`);
    await expect(a.getByLabel("שם הפרויקט")).toBeVisible();
    await expect(b.getByLabel("שם הפרויקט")).toBeVisible();

    await a.getByLabel("תיאור והערות").fill("מחלון א");
    await saved(a);

    await b.getByLabel("תיאור והערות").fill("מחלון ב");
    await expect(b.getByRole("alertdialog")).toContainText("עודכן בינתיים");
    await b.getByRole("button", { name: "שמירת השינויים שלי" }).click();
    await saved(b);
    const { project } = await (await request.get(`/api/projects/${p.id}`)).json();
    expect(project.notes).toBe("מחלון ב");

    await a.getByLabel("תיאור והערות").fill("שוב מחלון א");
    await expect(a.getByRole("alertdialog")).toBeVisible();
    await a.getByRole("button", { name: "טעינת הגרסה העדכנית" }).click();
    await expect(a.getByLabel("תיאור והערות")).toHaveValue("מחלון ב");
    await ctx.close();
  });
});

test.describe("הפרויקטים שלי", () => {
  test("חיפוש לפי שם ולפי לקוח, וסינון לפי סטטוס", async ({ page, request }) => {
    const tag = uid("חיפוש").replace(/\s/g, "-");
    const cust = await seedCustomer(request, `לקוח-${tag}`);
    const a = await seedProject(request, { name: `ארון ${tag}`, status: "planning", category: "wardrobes" });
    const b = await seedProject(request, { name: `מזנון ${tag}`, status: "quote", customerId: cust.id });
    await page.goto("/projects");

    const search = page.getByRole("searchbox", { name: "חיפוש פרויקט לפי שם" });
    await search.fill(tag);
    await expect(card(page, a.name)).toBeVisible();
    await expect(card(page, b.name)).toBeVisible();

    await search.fill(`מזנון ${tag}`);
    await expect(card(page, a.name)).toHaveCount(0);
    await expect(card(page, b.name)).toBeVisible();

    await search.fill(`לקוח-${tag}`);
    await expect(card(page, b.name)).toBeVisible();
    await expect(card(page, a.name)).toHaveCount(0);

    await search.fill(tag);
    await page.getByRole("group", { name: "סינון לפי סטטוס" }).getByRole("button", { name: "בתכנון" }).click();
    await expect(card(page, a.name)).toBeVisible();
    await expect(card(page, b.name)).toHaveCount(0);

    await search.fill("אין-כזה-בכלל-" + tag);
    await expect(page.getByText("לא נמצאו פרויקטים")).toBeVisible();
    await page.getByRole("button", { name: "ניקוי סינון" }).click();
    await expect(search).toHaveValue("");
  });

  test("שינוי שם, שכפול, שינוי סטטוס", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("פרויקט לשכפול"), category: "dressers" });
    await page.goto("/projects");
    await page.getByRole("searchbox", { name: "חיפוש פרויקט לפי שם" }).fill(p.name);

    await page.getByRole("button", { name: `פעולות עבור ${p.name}` }).click();
    await page.getByRole("menuitem", { name: "שינוי שם" }).click();
    const newName = p.name + " (שונה)";
    await page.getByRole("dialog").getByLabel("שם הפרויקט").fill(newName);
    await page.getByRole("button", { name: "שמירה" }).click();
    await expect(card(page, newName)).toBeVisible();

    await page.getByRole("button", { name: `פעולות עבור ${newName}` }).click();
    await page.getByRole("menuitem", { name: "שכפול" }).click();
    await expect(card(page, `${newName} — עותק`)).toBeVisible();
    await expect(card(page, `${newName} — עותק`)).toContainText("שידות וקומודות");

    await page.getByRole("button", { name: `פעולות עבור ${newName}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "שינוי סטטוס" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "אושר" }).click();
    await expect(card(page, newName).first()).toContainText("אושר");
  });

  test("ארכוב ושחזור", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("לארכוב") });
    await page.goto("/projects");
    await page.getByRole("searchbox", { name: "חיפוש פרויקט לפי שם" }).fill(p.name);
    await page.getByRole("button", { name: `פעולות עבור ${p.name}` }).click();
    await page.getByRole("menuitem", { name: "העברה לארכיון" }).click();
    await expect(card(page, p.name)).toHaveCount(0);

    await page.getByRole("button", { name: "ארכיון" }).click();
    await expect(card(page, p.name)).toContainText("בארכיון");
    await page.getByRole("button", { name: `פעולות עבור ${p.name}` }).click();
    await page.getByRole("menuitem", { name: "שחזור מהארכיון" }).click();
    await expect(card(page, p.name)).toHaveCount(0);

    await page.getByRole("button", { name: "ארכיון" }).click();
    await expect(card(page, p.name)).toBeVisible();
  });

  test("מחיקה דורשת אישור מפורש וניתנת לביטול", async ({ page, request }) => {
    const p = await seedProject(request, { name: uid("למחיקה") });
    await page.goto("/projects");
    await page.getByRole("searchbox", { name: "חיפוש פרויקט לפי שם" }).fill(p.name);

    await page.getByRole("button", { name: `פעולות עבור ${p.name}` }).click();
    await page.getByRole("menuitem", { name: "מחיקה" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(p.name);
    await dialog.getByRole("button", { name: "ביטול" }).click();
    await expect(card(page, p.name)).toBeVisible();
    expect((await request.get(`/api/projects/${p.id}`)).status()).toBe(200);

    await page.getByRole("button", { name: `פעולות עבור ${p.name}` }).click();
    await page.getByRole("menuitem", { name: "מחיקה" }).click();
    await page.getByRole("button", { name: "כן, מחק לצמיתות" }).click();
    await expect(card(page, p.name)).toHaveCount(0);
    expect((await request.get(`/api/projects/${p.id}`)).status()).toBe(404);
  });

  test("פרויקט שנמחק או לא קיים מציג הודעה ברורה", async ({ page }) => {
    await page.goto("/projects/00000000-0000-4000-8000-000000000000/wizard");
    await expect(page.getByText("הפרויקט לא נמצא")).toBeVisible();
  });
});

test.describe("לקוחות", () => {
  test("יצירה, חיפוש, עריכה, שיוך פרויקט ומחיקה", async ({ page, request }) => {
    const name = uid("דנה אברהם");
    await page.goto("/customers");
    await page.getByRole("button", { name: "לקוח חדש" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "שמירת לקוח" }).click();
    await expect(page.getByText("יש להזין שם לקוח")).toBeVisible();
    await page.getByRole("dialog").getByLabel("שם הלקוח").fill(name);
    await page.getByRole("dialog").getByLabel("טלפון").fill("054-9998877");
    await page.getByRole("button", { name: "שמירת לקוח" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("אין עדיין פרויקטים ללקוח זה")).toBeVisible();

    await page.getByLabel("כתובת").fill("סוקולוב 3, תל אביב");
    await page.getByRole("button", { name: "שמירת שינויים" }).click();
    await page.getByText("הפרטים נשמרו").waitFor();

    const project = await seedProject(request, { name: uid("פרויקט של דנה") });
    const customers = (await (await request.get(`/api/customers?q=${encodeURIComponent(name)}`)).json()).customers;
    await request.patch(`/api/projects/${project.id}`, { data: { customerId: customers[0].id } });
    await page.reload();
    await expect(card(page, project.name)).toBeVisible();

    await page.goto("/customers");
    await page.getByRole("searchbox", { name: "חיפוש לקוח" }).fill("054-9998877");
    const c = page.getByTestId("customer-card").filter({ hasText: name });
    await expect(c).toContainText("סוקולוב 3");
    await expect(c).toContainText("פרויקט אחד");
    await c.click();

    await page.getByRole("button", { name: "מחיקת לקוח" }).click();
    await expect(page.getByRole("dialog")).toContainText("הפרויקטים של הלקוח לא יימחקו");
    await page.getByRole("button", { name: "כן, מחק את הלקוח" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    const still = await (await request.get(`/api/projects/${project.id}`)).json();
    expect(still.project.customer).toBeNull();
  });

  test("הגדרות העסק נשמרות", async ({ page }) => {
    await page.goto("/settings");
    const phone = "04-" + Math.floor(1000000 + Math.random() * 8999999);
    await page.getByLabel("טלפון העסק").fill(phone);
    await page.getByRole("button", { name: "שמירה" }).click();
    await page.getByText("ההגדרות נשמרו").waitFor();
    await page.reload();
    await expect(page.getByLabel("טלפון העסק")).toHaveValue(phone);
  });
});
