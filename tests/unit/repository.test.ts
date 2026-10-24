import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/server/db/pglite";
import { migrate } from "@/server/db/migrate";
import { SqlRepository } from "@/server/repo/sql-repository";
import { ConflictError, NotFoundError, ValidationError } from "@/server/repo/types";
import { memoryRepo } from "./helpers";

let repo: SqlRepository;
let close: () => Promise<void>;

beforeAll(async () => {
  const m = await memoryRepo();
  repo = m.repo;
  close = () => m.db.close();
});
afterAll(() => close());

describe("פרויקטים: יצירה ושמירה", () => {
  it("יוצר פרויקט כטיוטה עם רהיט ראשי ומסמך עיצוב ריק", async () => {
    const p = await repo.createProject({ name: "ארון חדר הורים — משפחת לוי" });
    expect(p.status).toBe("draft");
    expect(p.revision).toBe(1);
    expect(p.wizardStep).toBe(1);
    expect(p.design).toEqual({ schemaVersion: 1, category: null });
    expect(p.furnitureId).toBeTruthy();
    expect(p.customer).toBeNull();
  });

  it("שומר שינויים ומעלה גרסה; שינוי סעיף אחד לא מוחק סעיפים אחרים", async () => {
    const p = await repo.createProject({ name: "מזנון סלון — כהן" });
    const a = await repo.updateProject(p.id, { design: { category: "sideboards" }, wizardStep: 3 }, 1);
    expect(a.revision).toBe(2);
    expect(a.category).toBe("sideboards");
    expect(a.wizardStep).toBe(3);

    const b = await repo.updateProject(p.id, {
      design: { dimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 } },
    });
    expect(b.design.category).toBe("sideboards");
    expect(b.design.dimensions?.widthMm).toBe(3000);

    const c = await repo.updateProject(p.id, { design: { structure: { doorCount: 4 } } });
    expect(c.design.dimensions?.depthMm).toBe(600);
    expect(c.design.structure?.doorCount).toBe(4);
    expect(c.revision).toBe(4);
  });

  it("מזהה התנגשות כששני חלונות שומרים על אותה גרסה", async () => {
    const p = await repo.createProject({ name: "התנגשות" });
    await repo.updateProject(p.id, { name: "חלון א" }, 1);
    await expect(repo.updateProject(p.id, { name: "חלון ב" }, 1)).rejects.toBeInstanceOf(ConflictError);
    const current = await repo.getProject(p.id);
    expect(current?.name).toBe("חלון א");
  });

  it("מחזיר NotFound לפרויקט שלא קיים ושגיאת ולידציה ללקוח שלא קיים", async () => {
    await expect(repo.updateProject("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.createProject({ name: "x", customerId: "ghost" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("שומר ומחזיר טקסט עברי ותווים מיוחדים במלואם", async () => {
    const name = `שידת "מגירות" 100% _ניסיון_ ' ; --`;
    const p = await repo.createProject({ name, notes: "הערה\nבשתי שורות" });
    const again = await repo.getProject(p.id);
    expect(again?.name).toBe(name);
    expect(again?.notes).toBe("הערה\nבשתי שורות");
  });
});

describe("היסטוריה: חיפוש, סינון וארכוב", () => {
  beforeEach(async () => {
    for (const p of await repo.listProjects({ archived: "all" })) await repo.deleteProject(p.id);
    for (const c of await repo.listCustomers()) await repo.deleteCustomer(c.id);
  });

  it("מחפש לפי שם פרויקט ולפי שם לקוח, ומתעלם מ-% ו-_ כתווים מיוחדים", async () => {
    const levi = await repo.createCustomer({ name: "משפחת לוי", phone: "", address: "", notes: "" });
    await repo.createProject({ name: "ארון חדר הורים", customerId: levi.id });
    await repo.createProject({ name: "מזנון סלון — כהן" });
    await repo.createProject({ name: "שידה 100%" });

    expect((await repo.listProjects({ q: "מזנון" })).map((p) => p.name)).toEqual(["מזנון סלון — כהן"]);
    expect((await repo.listProjects({ q: "לוי" })).map((p) => p.name)).toEqual(["ארון חדר הורים"]);
    expect(await repo.listProjects({ q: "%" })).toHaveLength(1);
    expect(await repo.listProjects({ q: "_" })).toHaveLength(0);
  });

  it("מסנן לפי סטטוס ומסתיר ארכיון כברירת מחדל", async () => {
    const a = await repo.createProject({ name: "א", status: "planning" });
    await repo.createProject({ name: "ב", status: "trial" });
    const c = await repo.createProject({ name: "ג" });
    await repo.updateProject(c.id, { archived: true });

    expect((await repo.listProjects({ status: "planning" })).map((p) => p.id)).toEqual([a.id]);
    expect(await repo.listProjects()).toHaveLength(2);
    expect((await repo.listProjects({ archived: "only" })).map((p) => p.id)).toEqual([c.id]);
    expect(await repo.listProjects({ archived: "all" })).toHaveLength(3);

    await repo.updateProject(c.id, { archived: false });
    expect(await repo.listProjects()).toHaveLength(3);
  });

  it("ממיין לפי עדכון אחרון", async () => {
    const a = await repo.createProject({ name: "ראשון" });
    const b = await repo.createProject({ name: "שני" });
    await repo.updateProject(a.id, { notes: "עודכן" });
    expect((await repo.listProjects()).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it("משכפל פרויקט כולל העיצוב, כטיוטה חדשה ועצמאית", async () => {
    const p = await repo.createProject({ name: "ארון ילדים", status: "approved" });
    await repo.updateProject(p.id, {
      design: { category: "wardrobes", dimensions: { widthMm: 2000, heightMm: 2400, depthMm: 600 } },
      wizardStep: 4,
    });
    const copy = await repo.duplicateProject(p.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.furnitureId).not.toBe(p.furnitureId);
    expect(copy.name).toBe("ארון ילדים — עותק");
    expect(copy.status).toBe("draft");
    expect(copy.wizardStep).toBe(4);
    expect(copy.design.category).toBe("wardrobes");
    expect(copy.design.dimensions?.widthMm).toBe(2000);

    await repo.updateProject(copy.id, { design: { category: "bookcases" } });
    expect((await repo.getProject(p.id))?.design.category).toBe("wardrobes");
  });

  it("מוחק פרויקט לצמיתות", async () => {
    const p = await repo.createProject({ name: "למחיקה" });
    expect(await repo.deleteProject(p.id)).toBe(true);
    expect(await repo.getProject(p.id)).toBeNull();
    expect(await repo.deleteProject(p.id)).toBe(false);
  });
});

describe("לקוחות", () => {
  it("יוצר, מעדכן ומחזיר מספר פרויקטים משויכים", async () => {
    const c = await repo.createCustomer({ name: "יוסי כהן", phone: "050-1234567", address: "הרצל 1, חיפה", notes: "" });
    await repo.createProject({ name: "מזנון", customerId: c.id });
    await repo.createProject({ name: "ארון", customerId: c.id });
    const updated = await repo.updateCustomer(c.id, { phone: "052-7654321" });
    expect(updated.phone).toBe("052-7654321");
    expect(updated.name).toBe("יוסי כהן");
    const list = await repo.listCustomers("יוסי");
    expect(list.find((x) => x.id === c.id)?.projectCount).toBe(2);
    expect((await repo.listCustomers("0527654321")).length).toBe(0);
    expect((await repo.listCustomers("052-765")).length).toBe(1);
  });

  it("מחיקת לקוח משאירה את הפרויקטים ללא לקוח", async () => {
    const c = await repo.createCustomer({ name: "למחיקה", phone: "", address: "", notes: "" });
    const p = await repo.createProject({ name: "פרויקט שנשאר", customerId: c.id });
    expect(await repo.deleteCustomer(c.id)).toBe(true);
    const after = await repo.getProject(p.id);
    expect(after).not.toBeNull();
    expect(after?.customer).toBeNull();
  });

  it("הגדרות העסק נשמרות עם ברירות מחדל", async () => {
    expect((await repo.getSettings()).businessName).toBe("רהיטי אשר");
    await repo.updateSettings({ businessPhone: "04-1234567" });
    const s = await repo.getSettings();
    expect(s.businessPhone).toBe("04-1234567");
    expect(s.businessName).toBe("רהיטי אשר");
  });
});

describe("עמידות: נתונים שורדים הפעלה מחדש של בסיס הנתונים", () => {
  it("פרויקט שנשמר לדיסק נפתח שוב אחרי סגירה ופתיחה", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asher-pg-"));
    try {
      const db1 = await createPgliteDb(dir);
      await migrate(db1);
      const r1 = new SqlRepository(db1);
      const c = await r1.createCustomer({ name: "לקוח קבוע", phone: "050", address: "", notes: "" });
      const p = await r1.createProject({ name: "נשמר בדיסק", customerId: c.id });
      await r1.updateProject(p.id, { design: { category: "dressers" }, wizardStep: 2 });
      await db1.close();

      const db2 = await createPgliteDb(dir);
      expect(await migrate(db2)).toEqual([]);
      const r2 = new SqlRepository(db2);
      const back = await r2.getProject(p.id);
      expect(back?.name).toBe("נשמר בדיסק");
      expect(back?.customer?.name).toBe("לקוח קבוע");
      expect(back?.design.category).toBe("dressers");
      expect(back?.wizardStep).toBe(2);
      await db2.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
