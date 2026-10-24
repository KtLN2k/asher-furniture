import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_LIMITS } from "@/domain/limits";
import { SEED_LIBRARY } from "@/domain/materials";

process.env.ASHER_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx?: any) => Promise<Response>;
let materials: { GET: Handler; POST: Handler };
let material: { PATCH: Handler; DELETE: Handler };
let limits: { GET: Handler; PUT: Handler };
let projects: { POST: Handler };
let project: { PATCH: Handler };

beforeAll(async () => {
  materials = await import("@/app/api/materials/route");
  material = await import("@/app/api/materials/[id]/route");
  limits = await import("@/app/api/limits/route");
  projects = await import("@/app/api/projects/route");
  project = await import("@/app/api/projects/[id]/route");
});

const req = (method: string, body?: unknown) =>
  new Request("http://x/api", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("ספריית חומרים ומגבלות (API)", () => {
  it("הספרייה ההתחלתית נטענת מהמיגרציה", async () => {
    const { materials: list } = await (await materials.GET(req("GET"))).json();
    expect(list).toHaveLength(SEED_LIBRARY.length);
    expect(list.find((m: { id: string }) => m.id === "col-oak").attrs).toMatchObject({ type: "wood", texture: "oak" });
    expect(list.every((m: { unitPrice: unknown }) => m.unitPrice === null)).toBe(true);
  });

  it("יוצר, מעדכן, משבית ומוחק פריט; בודק תקינות מאפיינים", async () => {
    const bad = await materials.POST(req("POST", { kind: "color", name: "ירוק", attrs: { hex: "ירוק", type: "solid" } }));
    expect(bad.status).toBe(400);
    const created = await materials.POST(req("POST", { id: "col-green", kind: "color", name: "ירוק זית", attrs: { hex: "#5a6b3c", type: "solid" } }));
    expect(created.status).toBe(201);
    const dup = await materials.POST(req("POST", { id: "col-green", kind: "color", name: "עוד", attrs: { hex: "#5a6b3c", type: "solid" } }));
    expect(dup.status).toBe(400);
    const patched = await (await material.PATCH(req("PATCH", { name: "ירוק מרווה", active: false, attrs: { hex: "#7a8b5c", type: "solid" } }), ctx("col-green"))).json();
    expect(patched.material).toMatchObject({ name: "ירוק מרווה", active: false });
    expect((await material.PATCH(req("PATCH", { attrs: { hex: "x", type: "solid" } }), ctx("col-green"))).status).toBe(400);
    expect((await material.PATCH(req("PATCH", { name: "x" }), ctx("nope"))).status).toBe(404);
    expect((await material.DELETE(req("DELETE"), ctx("col-green"))).status).toBe(200);
    expect((await material.DELETE(req("DELETE"), ctx("col-green"))).status).toBe(404);
  });

  it("פריט בשימוש בפרויקט לא נמחק; מחיקת גימור מנקה אותו משילובים מותרים", async () => {
    const p = (await (await projects.POST(req("POST", { name: "פרויקט עם חומרים" }))).json()).project;
    await project.PATCH(req("PATCH", { design: { materials: { bodyMaterialId: "board-mdf" } }, baseRevision: p.revision }), ctx(p.id));
    const blocked = await material.DELETE(req("DELETE"), ctx("board-mdf"));
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error.message).toContain("בשימוש");

    expect((await material.DELETE(req("DELETE"), ctx("fin-veneer"))).status).toBe(200);
    const { materials: list } = await (await materials.GET(req("GET"))).json();
    expect(list.some((m: { attrs: { finishIds?: string[] } }) => m.attrs.finishIds?.includes("fin-veneer"))).toBe(false);
    expect(list.find((m: { id: string }) => m.id === "board-mdf").attrs.finishIds).toEqual(["fin-laminate", "fin-baked-paint"]);
  });

  it("מגבלות: ברירות מחדל, שמירה ובדיקת עקביות", async () => {
    const first = (await (await limits.GET(req("GET"))).json()).limits;
    expect(first).toEqual(DEFAULT_LIMITS);
    const next = structuredClone(first);
    next.byCategory.wardrobes.maxWidthMm = 4500;
    next.general.maxHingedDoorWidthMm = 550;
    const saved = (await (await limits.PUT(req("PUT", next))).json()).limits;
    expect(saved.byCategory.wardrobes.maxWidthMm).toBe(4500);
    expect((await (await limits.GET(req("GET"))).json()).limits.general.maxHingedDoorWidthMm).toBe(550);
    const broken = structuredClone(next);
    broken.byCategory.dressers.minWidthMm = 5000;
    const res = await limits.PUT(req("PUT", broken));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain("מינימום");
  });
});
