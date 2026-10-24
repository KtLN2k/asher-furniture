import { beforeAll, describe, expect, it } from "vitest";

process.env.ASHER_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx?: any) => Promise<Response>;
let projects: { GET: Handler; POST: Handler };
let project: { GET: Handler; PATCH: Handler; DELETE: Handler };
let duplicate: { POST: Handler };
let customers: { GET: Handler; POST: Handler };
let customer: { GET: Handler; PATCH: Handler; DELETE: Handler };
let settings: { GET: Handler; PUT: Handler };

beforeAll(async () => {
  projects = await import("@/app/api/projects/route");
  project = await import("@/app/api/projects/[id]/route");
  duplicate = await import("@/app/api/projects/[id]/duplicate/route");
  customers = await import("@/app/api/customers/route");
  customer = await import("@/app/api/customers/[id]/route");
  settings = await import("@/app/api/settings/route");
});

const req = (method: string, body?: unknown, url = "http://x/api") =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("API: זרימת יצירה, שמירה ופתיחה מחדש", () => {
  it("יוצר פרויקט, שומר בשלבים ופותח מחדש עם כל הנתונים", async () => {
    const created = await projects.POST(req("POST", { name: "ארון חדר הורים — משפחת לוי" }));
    expect(created.status).toBe(201);
    const { project: p } = await created.json();

    const c = await (await customers.POST(req("POST", { name: "משפחת לוי", phone: "050-1112222" }))).json();
    const saved1 = await project.PATCH(
      req("PATCH", { customerId: c.customer.id, notes: "הערה", baseRevision: p.revision }),
      ctx(p.id),
    );
    expect(saved1.status).toBe(200);
    const r1 = (await saved1.json()).project;

    const saved2 = await project.PATCH(
      req("PATCH", { design: { category: "wardrobes" }, wizardStep: 3, baseRevision: r1.revision }),
      ctx(p.id),
    );
    const r2 = (await saved2.json()).project;
    expect(r2.revision).toBe(3);

    const reopened = (await (await project.GET(req("GET"), ctx(p.id))).json()).project;
    expect(reopened).toMatchObject({
      name: "ארון חדר הורים — משפחת לוי",
      notes: "הערה",
      wizardStep: 3,
      category: "wardrobes",
      customer: { name: "משפחת לוי", phone: "050-1112222" },
    });
  });

  it("עדכון שם בלבד לא מאפס קטגוריה וגם עדכון לקוח בלבד לא מאפס טלפון", async () => {
    const { project: p } = await (await projects.POST(req("POST", { name: "מקורי" }))).json();
    await project.PATCH(req("PATCH", { design: { category: "bookcases" } }), ctx(p.id));
    const after = (await (await project.PATCH(req("PATCH", { name: "שם חדש" }), ctx(p.id))).json()).project;
    expect(after.category).toBe("bookcases");

    const { customer: c } = await (await customers.POST(req("POST", { name: "דנה", phone: "050", address: "חיפה" }))).json();
    const upd = (await (await customer.PATCH(req("PATCH", { name: "דנה כהן" }), ctx(c.id))).json()).customer;
    expect(upd).toMatchObject({ name: "דנה כהן", phone: "050", address: "חיפה" });
  });

  it("מחזיר 409 עם הגרסה העדכנית בהתנגשות", async () => {
    const { project: p } = await (await projects.POST(req("POST", { name: "התנגשות" }))).json();
    await project.PATCH(req("PATCH", { name: "א", baseRevision: 1 }), ctx(p.id));
    const res = await project.PATCH(req("PATCH", { name: "ב", baseRevision: 1 }), ctx(p.id));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("conflict");
    expect(body.error.current.name).toBe("א");
  });

  it("מחזיר שגיאות בעברית: שם ריק, פרויקט לא קיים, JSON שבור", async () => {
    const empty = await projects.POST(req("POST", { name: "   " }));
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.message).toBe("יש להזין שם לפרויקט");

    const missing = await project.GET(req("GET"), ctx("nope"));
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.message).toBe("הפרויקט לא נמצא");

    const broken = await projects.POST(new Request("http://x/api", { method: "POST", body: "{oops" }));
    expect(broken.status).toBe(400);

    const badCategory = await project.PATCH(req("PATCH", { design: { category: "spaceship" } }), ctx("x"));
    expect(badCategory.status).toBe(400);
  });

  it("חיפוש, סינון סטטוס, ארכוב, שכפול ומחיקה דרך ה-API", async () => {
    const mk = async (name: string, status?: string) =>
      (await (await projects.POST(req("POST", { name, status }))).json()).project;
    const a = await mk("שולחן-חיפוש-אלפא", "planning");
    await mk("שולחן-חיפוש-בטא", "trial");

    const found = await (await projects.GET(req("GET", undefined, "http://x/api/projects?q=חיפוש-אלפא"))).json();
    expect(found.projects.map((x: { id: string }) => x.id)).toEqual([a.id]);
    const byStatus = await (await projects.GET(req("GET", undefined, "http://x/api/projects?q=חיפוש&status=trial"))).json();
    expect(byStatus.projects).toHaveLength(1);

    await project.PATCH(req("PATCH", { archived: true }), ctx(a.id));
    const hidden = await (await projects.GET(req("GET", undefined, "http://x/api/projects?q=חיפוש-אלפא"))).json();
    expect(hidden.projects).toHaveLength(0);
    const arch = await (await projects.GET(req("GET", undefined, "http://x/api/projects?q=חיפוש-אלפא&archived=only"))).json();
    expect(arch.projects).toHaveLength(1);

    const dup = await (await duplicate.POST(req("POST"), ctx(a.id))).json();
    expect(dup.project.name).toBe("שולחן-חיפוש-אלפא — עותק");
    expect(dup.project.archivedAt).toBeNull();

    expect((await project.DELETE(req("DELETE"), ctx(dup.project.id))).status).toBe(200);
    expect((await project.DELETE(req("DELETE"), ctx(dup.project.id))).status).toBe(404);
  });

  it("לקוחות: פרטי לקוח כוללים פרויקטים משויכים; הגדרות נשמרות", async () => {
    const { customer: c } = await (await customers.POST(req("POST", { name: "לקוח עם פרויקט" }))).json();
    await projects.POST(req("POST", { name: "פרויקט ראשון", customerId: c.id }));
    const detail = await (await customer.GET(req("GET"), ctx(c.id))).json();
    expect(detail.projects).toHaveLength(1);
    const list = await (await customers.GET(req("GET", undefined, "http://x/api/customers?q=עם פרויקט"))).json();
    expect(list.customers[0].projectCount).toBe(1);

    const s = await (await settings.PUT(req("PUT", { businessPhone: "04-9999999" }))).json();
    expect(s.settings).toMatchObject({ businessName: "רהיטי אשר", businessPhone: "04-9999999" });
    const bad = await settings.PUT(req("PUT", { businessName: "" }));
    expect(bad.status).toBe(400);
  });
});
