import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { designSchema, emptyDesign } from "@/domain/design";
import { categoryDefaults } from "@/domain/edit";
import { DEFAULT_ROOM, ROOM_KEYS, ROOM_LABELS, roomOf } from "@/domain/rooms";
import { seedLibrary } from "@/domain/materials";
import { boxGeometry, BEVEL_RADIUS_M } from "@/three/geometry";
import { buildFurnitureModel } from "@/three/model";
import { QUALITY_PRESETS, pickTier } from "@/three/quality";
import { ROOM_PRESETS } from "@/three/room-presets";

process.env.ASHER_DATA_DIR = "memory://";
delete process.env.DATABASE_URL;

describe("חדרים לדוגמה", () => {
  it("לכל חדר יש תווית ופריסט עם צבעי קיר ורצפה שונים", () => {
    expect(ROOM_KEYS).toHaveLength(5);
    const walls = new Set<string>();
    for (const k of ROOM_KEYS) {
      expect(ROOM_LABELS[k]).toBeTruthy();
      expect(ROOM_PRESETS[k].key).toBe(k);
      walls.add(ROOM_PRESETS[k].wall);
    }
    expect(walls.size).toBe(5);
    expect(ROOM_PRESETS.bathroom.floor.kind).toBe("tile");
    expect(ROOM_PRESETS.neutral.floor.kind).toBe("concrete");
  });

  it("ערך חסר או לא מוכר חוזר לחדר ברירת המחדל, והסכמה מקבלת רק חדרים מוכרים", () => {
    expect(roomOf(undefined)).toBe(DEFAULT_ROOM);
    expect(roomOf({ room: "castle" })).toBe(DEFAULT_ROOM);
    expect(roomOf({ room: "kids" })).toBe("kids");
    expect(designSchema.safeParse({ ...emptyDesign(), presentation: { room: "living" } }).success).toBe(true);
    expect(designSchema.safeParse({ ...emptyDesign(), presentation: { room: "castle" } }).success).toBe(false);
  });
});

describe("רמות איכות להדמיה", () => {
  it("רק האיכות הגבוהה מפעילה AO והשתקפות רצפה; הנמוכה בלי השתקפות חדר ובלי לק", () => {
    const { high, medium, low } = QUALITY_PRESETS;
    expect([high.ao, medium.ao, low.ao]).toEqual([true, false, false]);
    expect([high.floorReflection, medium.floorReflection, low.floorReflection]).toEqual([true, false, false]);
    expect(high.probeSize).toBeGreaterThan(medium.probeSize);
    expect(medium.probeSize).toBeGreaterThan(0);
    expect(low.probeSize).toBe(0);
    expect(low.clearcoat).toBe(false);
    expect(low.floorTextureSize).toBeLessThan(medium.floorTextureSize);
    expect(medium.floorTextureSize).toBeLessThan(high.floorTextureSize);
  });

  it("אנדרואיד חלש מתחיל באיכות נמוכה, בלי עיבוד כבד", () => {
    const weak = pickTier({ userAgent: "Mozilla/5.0 (Linux; Android 12; SM-A125F)", cores: 4, memoryGb: 3, coarsePointer: true, screenMin: 360, dpr: 2 });
    expect(weak).toBe("low");
    expect(QUALITY_PRESETS[weak].ao).toBe(false);
  });
});

describe("גאומטריה עם קצוות משופעים", () => {
  it("שש קבוצות חומר שמכסות את כל הקודקודים, בלי NaN, ומידות המעטפת נשמרות", () => {
    const g = boxGeometry(0.43, 2.3, 0.018, "y", "t1", 1);
    expect(g.groups.map((x) => x.materialIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    const pos = g.getAttribute("position");
    expect(g.groups.reduce((n, x) => n + x.count, 0)).toBe(pos.count);
    for (const name of ["position", "normal", "uv"] as const) {
      const a = g.getAttribute(name).array;
      expect(a.every((v) => Number.isFinite(v))).toBe(true);
    }
    g.computeBoundingBox();
    const size = g.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.43, 5);
    expect(size.y).toBeCloseTo(2.3, 5);
    expect(size.z).toBeCloseTo(0.018, 5);
    const n = g.getAttribute("normal");
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
  });

  it("לוחות דקים מדי נשארים קופסה רגילה", () => {
    const thin = boxGeometry(1, 1, BEVEL_RADIUS_M * 2, "x", "t2", 1);
    expect(thin.getAttribute("position").count).toBe(24);
  });
});

describe("חומרים לפי גימור", () => {
  it("צבע בתנור מבריק יותר ומשקף חדר; מלמין מט עם לק עדין בלבד", () => {
    const lib = seedLibrary();
    const base = { schemaVersion: 1 as const, ...categoryDefaults("wardrobes", lib) };
    const build = (finishId: string, materialId: string) =>
      buildFurnitureModel(
        { ...base, category: "wardrobes", materials: { ...base.materials, facadeMaterialId: materialId, facadeFinishId: finishId, facadeColorId: "col-white" } },
        { library: lib },
      );
    const door = (m: ReturnType<typeof build>) => m.moving.find((p) => p.kind === "door")!.children.find((c) => c.kind === "door-panel")!.material;
    const paint = door(build("fin-baked-paint", "fac-mdf"));
    const melamine = door(build("fin-melamine", "fac-melamine"));
    expect(paint.reflective).toBe(true);
    expect(melamine.reflective).toBe(false);
    expect(paint.clearcoat!).toBeGreaterThan(melamine.clearcoat!);
    expect(melamine.clearcoat!).toBeLessThan(0.15);
  });

  it("הידית הארוכה בנויה משני חלקים: פס וקצה אחיזה", () => {
    const lib = seedLibrary();
    const base = { schemaVersion: 1 as const, ...categoryDefaults("wardrobes", lib) };
    const m = buildFurnitureModel({ ...base, category: "wardrobes", facades: { doorType: "hinged", defaults: { style: "flat", handle: "long", handleColor: "black" } } }, { library: lib });
    const handles = m.moving[0].children.filter((c) => c.kind === "handle");
    expect(handles).toHaveLength(2);
    expect(handles.every((h) => h.type === "box" && h.bevel)).toBe(true);
  });
});

describe("תמונה ממוזערת בפרויקט (API)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Handler = (req: Request, ctx?: any) => Promise<Response>;
  let projects: { POST: Handler; GET: Handler };
  let project: { GET: Handler; PATCH: Handler };
  beforeAll(async () => {
    projects = await import("@/app/api/projects/route");
    project = await import("@/app/api/projects/[id]/route");
  });
  const req = (method: string, body?: unknown) =>
    new Request("http://x/api", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const create = async () => (await (await projects.POST(req("POST", { name: "ארון" }))).json()).project as { id: string; revision: number };

  it("שומר תמונה, מחזיר אותה ברשימה ובפרויקט, ומוחק עם null", async () => {
    const p = await create();
    const thumb = "data:image/jpeg;base64,/9j/4AAQ";
    const res = await project.PATCH(req("PATCH", { thumbnail: thumb, design: { presentation: { room: "kids" } } }), ctx(p.id));
    expect(res.status).toBe(200);
    const got = (await (await project.GET(req("GET"), ctx(p.id))).json()).project;
    expect(got.thumbnail).toBe(thumb);
    expect(got.design.presentation).toEqual({ room: "kids" });
    const list = (await (await projects.GET(new Request("http://x/api/projects"))).json()).projects as Array<{ id: string; thumbnail: string | null }>;
    expect(list.find((x) => x.id === p.id)?.thumbnail).toBe(thumb);
    await project.PATCH(req("PATCH", { thumbnail: null }), ctx(p.id));
    expect((await (await project.GET(req("GET"), ctx(p.id))).json()).project.thumbnail).toBeNull();
  });

  it("דוחה ערך שאינו תמונה או גדול מדי", async () => {
    const p = await create();
    expect((await project.PATCH(req("PATCH", { thumbnail: "http://evil/x.png" }), ctx(p.id))).status).toBe(400);
    expect((await project.PATCH(req("PATCH", { thumbnail: "data:image/jpeg;base64," + "A".repeat(260_000) }), ctx(p.id))).status).toBe(400);
  });
});
