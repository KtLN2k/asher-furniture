import { describe, expect, it } from "vitest";
import { categoryDefaults, editCompartment, resizeCompartment, selectTemplate, setDimensions, setDoorType, setStructure } from "@/domain/edit";
import { applyLookToAll, handleOptions, resolveFacade, setFacadeDefaults, setFacadeOverride, styleOptions } from "@/domain/facades";
import { buildCompartments, compartmentWidths, layoutCompartment, maxShelves, setCompartmentWidth } from "@/domain/interior";
import { buildLayout } from "@/domain/layout";
import { DEFAULT_LIMITS } from "@/domain/limits";
import { colorAllowed, finishAllowed, fixGroupSelection, fixMaterials, itemById, seedLibrary } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";
import { errorsOf, validateDesign, warningsOf } from "@/domain/validation";
import type { FurnitureDesign } from "@/domain/design";

const lib = seedLibrary();

function design(category: FurnitureDesign["category"], extra: Partial<FurnitureDesign> = {}): FurnitureDesign {
  const d: FurnitureDesign = { schemaVersion: 1, category, ...extra };
  return { ...d, ...categoryDefaults(category ?? "wardrobes", lib), ...extra } as FurnitureDesign;
}

describe("חלוקה פנימית", () => {
  it("מדפים מתפזרים שווה ומגירות יושבות בתחתית", () => {
    const l = layoutCompartment({ shelves: 3, drawers: 0, hangingRod: "none" }, 1000);
    expect(l.shelves).toEqual([250, 500, 750]);
    const d = layoutCompartment({ shelves: 1, drawers: 2, hangingRod: "none" }, 1000);
    expect(d.drawers).toEqual([
      { y0: 0, y1: 200 },
      { y0: 200, y1: 400 },
    ]);
    expect(d.shelves[0]).toBeCloseTo(700);
  });

  it("מגירות בלי שום דבר אחר ממלאות את כל הגובה", () => {
    const l = layoutCompartment({ shelves: 0, drawers: 4, hangingRod: "none" }, 800);
    expect(l.drawers[3].y1).toBe(800);
  });

  it("תלייה ארוכה: מוט מתחת למדף כובעים ובדיקת גובה מינימלי", () => {
    const ok = layoutCompartment({ shelves: 1, drawers: 0, hangingRod: "long" }, 2200);
    expect(ok.problems).toEqual([]);
    expect(ok.rod!.y).toBeLessThan(ok.shelves[0]);
    const low = layoutCompartment({ shelves: 1, drawers: 0, hangingRod: "long" }, 1300);
    expect(low.problems.length).toBeGreaterThan(0);
  });

  it("דורש שמגירות לא יחרגו מהגובה", () => {
    expect(layoutCompartment({ shelves: 1, drawers: 12, hangingRod: "none" }, 800).problems.length).toBe(1);
    expect(maxShelves({ drawers: 0, hangingRod: "long" }, 2200)).toBe(1);
  });

  it("תבניות מייצרות תאים לפי הרוחב והגובה", () => {
    const ctx = { innerWidthMm: 2800, innerHeightMm: 2300, unitCount: 1, category: "wardrobes" as const };
    const hang = buildCompartments("hang-shelves", ctx);
    expect(hang).toHaveLength(4);
    expect(hang.map((c) => c.hangingRod)).toEqual(["long", "none", "long", "none"]);
    expect(buildCompartments("full-hang", ctx).every((c) => c.hangingRod === "long")).toBe(true);
    expect(buildCompartments("drawers", { ...ctx, innerHeightMm: 700 }).every((c) => c.drawers >= 3 && c.shelves === 0)).toBe(true);
    for (const t of ["hang-shelves", "full-hang", "shelves", "drawers-shelves", "combo", "drawers"]) {
      for (const c of buildCompartments(t, ctx)) {
        expect(layoutCompartment(c, ctx.innerHeightMm).problems).toEqual([]);
      }
    }
  });

  it("שינוי רוחב תא מחלק את השארית בין האחרים ושומר סכום", () => {
    const comps = buildCompartments("shelves", { innerWidthMm: 2400, innerHeightMm: 2000, unitCount: 1, category: "wardrobes" });
    const next = setCompartmentWidth(comps, 0, 1000, 2400, 18);
    const widths = compartmentWidths(next, 2400, 18);
    expect(widths[0]).toBeCloseTo(1000, 3);
    expect(widths.reduce((a, b) => a + b, 0) + (next.length - 1) * 18).toBeCloseTo(2400, 3);
    expect(next.reduce((s, c) => s + c.widthShare, 0)).toBeCloseTo(1, 6);
  });
});

describe("חומרים וגימורים", () => {
  it("מתקן גימור וצבע שלא מתאימים לחומר", () => {
    const fix = fixGroupSelection(lib, "board", { materialId: "board-solid-wood", finishId: "fin-laminate", colorId: "col-white", thicknessMm: 18 });
    expect(fix.finishId).toBe("fin-natural-wood");
    expect(["col-oak", "col-walnut"]).toContain(fix.colorId);
    expect(fix.thicknessMm).toBe(20);
    expect(fix.notes.length).toBe(3);
  });

  it("חומר חזית אטום בלבד כברירת מחדל; זכוכית ומראה הם אינסרטים", () => {
    const fix = fixGroupSelection(lib, "facade", { materialId: "fac-glass" });
    expect(fix.materialId).toBe("fac-mdf");
  });

  it("כללי שילוב: צבע בתנור רק באחיד, פורניר רק בעץ", () => {
    const paint = itemById(lib, "fin-baked-paint")!;
    const veneer = itemById(lib, "fin-veneer")!;
    expect(colorAllowed(paint, itemById(lib, "col-oak")!).ok).toBe(false);
    expect(colorAllowed(paint, itemById(lib, "col-white")!).ok).toBe(true);
    expect(colorAllowed(veneer, itemById(lib, "col-white")!).ok).toBe(false);
    expect(finishAllowed(itemById(lib, "board-melamine"), veneer).ok).toBe(false);
    expect(finishAllowed(itemById(lib, "board-melamine"), veneer).reason).toContain("לא מתאים");
  });

  it("ברירות מחדל מלאות תקינות", () => {
    const { materials, notes } = fixMaterials(lib, undefined);
    expect(notes).toEqual([]);
    expect(materials.bodyMaterialId).toBeTruthy();
    expect(materials.backMaterialId).toBeTruthy();
    expect(fixMaterials(lib, materials).notes).toEqual([]);
  });

  it("פריט מושבת לא נבחר", () => {
    const l = lib.map((m) => (m.id === "board-melamine" ? { ...m, active: false } : m));
    expect(fixGroupSelection(l, "board", { materialId: "board-melamine" }).materialId).not.toBe("board-melamine");
  });
});

describe("חזיתות", () => {
  it("ברירות מחדל, דריסה אישית והחל על הכל", () => {
    let d = design("wardrobes");
    const spec = resolveSpec(d);
    expect(resolveFacade(d, "door", "door-1", 0, spec.doorType).style).toBe("flat");
    d = { ...d, facades: setFacadeOverride(d.facades, "door", "door-2", { style: "mirror", handle: "long" }) };
    const second = resolveFacade(d, "door", "door-2", 1, "hinged");
    expect(second.style).toBe("mirror");
    expect(second.handle).toBe("long");
    expect(resolveFacade(d, "door", "door-1", 0, "hinged").style).toBe("flat");
    d = { ...d, facades: applyLookToAll(d.facades, "door", second) };
    expect(resolveFacade(d, "door", "door-1", 0, "hinged").style).toBe("mirror");
    expect(d.facades!.doors!.every((x) => x.style === undefined)).toBe(true);
  });

  it("שינוי ברירת מחדל לכל הדלתות מנקה דריסות של אותו שדה", () => {
    let f = setFacadeOverride(undefined, "door", "door-1", { handle: "knob", opening: "right" });
    f = setFacadeDefaults(f, "door", { handle: "long" });
    const d = { facades: f };
    expect(resolveFacade(d, "door", "door-1", 0, "hinged").handle).toBe("long");
    expect(resolveFacade(d, "door", "door-1", 0, "hinged").opening).toBe("right");
  });

  it("שילובים לא מתאימים מוסתרים או מתוקנים", () => {
    const avail = { glass: true, mirror: true };
    expect(styleOptions("drawer", "none", avail).find((o) => o.value === "mirror")).toMatchObject({ ok: false });
    expect(styleOptions("door", "sliding", avail).find((o) => o.value === "grooved")?.reason).toContain("הזזה");
    expect(handleOptions("door", "sliding", "flat").filter((o) => o.ok).map((o) => o.value)).toEqual(["integral", "profile", "none"]);
    expect(handleOptions("door", "hinged", "mirror").find((o) => o.value === "push")?.ok).toBe(false);
    const stale = { facades: { defaults: { style: "grooved" as const, handle: "knob" as const } } };
    const r = resolveFacade(stale, "door", "door-1", 0, "sliding");
    expect(r.style).toBe("flat");
    expect(r.handle).toBe("profile");
    expect(resolveFacade({ facades: { defaults: { style: "mirror" as const } } }, "door", "x", 0, "hinged", { glass: true, mirror: false }).style).toBe("flat");
  });

  it("פתיחה אוטומטית מתחלפת בין שמאל לימין", () => {
    const d = design("wardrobes");
    expect([0, 1, 2, 3].map((i) => resolveFacade(d, "door", `door-${i + 1}`, i, "hinged").opening)).toEqual(["left", "right", "left", "right"]);
  });
});

describe("פריסה", () => {
  it("ארון 300x240x60 עם 7 דלתות: דלתות שוות עם מרווחים", () => {
    let d = design("wardrobes");
    d = { ...d, ...setDimensions(d, { widthMm: 3000, heightMm: 2400, depthMm: 600 }) } as FurnitureDesign;
    d = { ...d, ...setStructure(d, { doorCount: 7 }) } as FurnitureDesign;
    const layout = buildLayout(resolveSpec(d));
    expect(layout.doors).toHaveLength(7);
    const w = layout.doors.map((x) => x.x1 - x.x0);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(0.001);
    expect(layout.doors[0].x0).toBeGreaterThan(-1500);
    expect(layout.doors[6].x1).toBeLessThan(1500);
    for (let i = 1; i < 7; i++) expect(layout.doors[i].x0 - layout.doors[i - 1].x1).toBeCloseTo(3, 6);
    expect(layout.zFront).toBeLessThan(300);
  });

  it("הדלתות מתעדכנות אוטומטית עם הרוחב, עד שהמשתמש קובע בעצמו", () => {
    let d = design("wardrobes");
    expect(resolveSpec(d).doorCount).toBe(5);
    d = { ...d, ...setDimensions(d, { widthMm: 1200, heightMm: 2400, depthMm: 600 }) } as FurnitureDesign;
    expect(resolveSpec(d).doorCount).toBe(3);
    d = { ...d, ...setStructure(d, { doorCount: 2 }) } as FurnitureDesign;
    d = { ...d, ...setDimensions(d, { widthMm: 1800, heightMm: 2400, depthMm: 600 }) } as FurnitureDesign;
    expect(resolveSpec(d).doorCount).toBe(2);
  });

  it("שידה ללא דלתות: חזיתות מגירות חשופות; ארון עם דלתות: מגירות פנימיות", () => {
    const dresser = buildLayout(resolveSpec(design("dressers")));
    expect(dresser.doors).toHaveLength(0);
    expect(dresser.drawers.length).toBeGreaterThan(0);
    expect(dresser.drawers.every((x) => x.exposed)).toBe(true);
    let w = design("wardrobes");
    w = { ...w, ...selectTemplate(w, "drawers-shelves") } as FurnitureDesign;
    const lw = buildLayout(resolveSpec(w));
    expect(lw.drawers.length).toBeGreaterThan(0);
    expect(lw.drawers.every((x) => !x.exposed)).toBe(true);
  });

  it("דלתות הזזה: שתי מסילות וחפיפה, התאים לא יכולים להיות פתוחים", () => {
    let d = design("sliding-wardrobes");
    d = { ...d, ...editCompartment(d, 0, { open: true }) } as FurnitureDesign;
    const comps = d.interior!.compartments!.map((c, i) => (i === 0 ? { ...c, open: true } : c));
    d = { ...d, interior: { ...d.interior!, compartments: comps } };
    const layout = buildLayout(resolveSpec(d));
    expect(layout.compartments.every((c) => !c.open)).toBe(true);
    expect(new Set(layout.doors.map((x) => x.lane)).size).toBe(2);
    expect(layout.doors[1].x0).toBeLessThan(layout.doors[0].x1);
  });

  it("תא פתוח בקצה משאיר את הדלתות רק על התאים הסגורים", () => {
    let d = design("wardrobes");
    const comps = d.interior!.compartments!.map((c, i, a) => ({ ...c, open: i === a.length - 1 }));
    d = { ...d, interior: { ...d.interior!, compartments: comps } };
    const layout = buildLayout(resolveSpec(d));
    const last = layout.compartments[layout.compartments.length - 1];
    expect(last.open).toBe(true);
    expect(layout.doors[layout.doors.length - 1].x1).toBeLessThan(last.x0);
    const middle = d.interior!.compartments!.map((c, i) => ({ ...c, open: i === 1 }));
    expect(buildLayout(resolveSpec({ ...d, interior: { ...d.interior!, compartments: middle } })).compartments.some((c) => c.open)).toBe(false);
  });

  it("רהיט תלוי: גובה הרכבה והבסיס מתאפסים", () => {
    const d = design("bathroom");
    const l = buildLayout(resolveSpec(d));
    expect(l.spec.placement).toBe("wall-hung");
    expect(l.bodyBottomY).toBe(450);
    const floor = { ...d, ...setStructure(d, { placement: "floor" }) } as FurnitureDesign;
    expect(buildLayout(resolveSpec(floor)).bodyBottomY).toBe(70);
    const legs = { ...d, ...setStructure(d, { placement: "legs" }) } as FurnitureDesign;
    expect(resolveSpec(legs).base).toBe("legs");
  });

  it("עריכת תא משנה את התבנית למותאמת ושומרת על תקינות", () => {
    const d = design("wardrobes");
    const p = editCompartment(d, 1, { shelves: 99 });
    expect(p.interior!.template).toBe("custom");
    expect(p.interior!.compartments![1].shelves).toBeLessThan(30);
    const r = resizeCompartment({ ...d, ...p } as FurnitureDesign, 0, 900);
    expect(compartmentWidths(r.interior!.compartments!, resolveSpec(d).innerWidthMm, 18)[0]).toBeCloseTo(900, 3);
  });

  it("החלפת סוג דלת מעדכנת את מספר הדלתות", () => {
    const d = design("sideboards");
    const p = setDoorType(d, "sliding");
    expect(p.structure!.doorCount).toBeGreaterThanOrEqual(2);
    expect(setDoorType(d, "none").structure!.doorCount).toBe(0);
  });
});

describe("בדיקות תקינות", () => {
  it("תכנון ברירת המחדל תקין לכל קטגוריה", () => {
    for (const c of ["wardrobes", "sliding-wardrobes", "dressers", "sideboards", "bedrooms", "bookcases", "bathroom"] as const) {
      const d = design(c);
      expect(errorsOf(validateDesign(d, { limits: DEFAULT_LIMITS, library: lib })), c).toEqual([]);
    }
  });

  it("מידות מחוץ למגבלות", () => {
    const d = design("wardrobes", { dimensions: { widthMm: 10000, heightMm: 3000, depthMm: 100 } });
    const errs = errorsOf(validateDesign(d, { limits: DEFAULT_LIMITS }), 3).map((e) => e.id);
    expect(errs).toEqual(expect.arrayContaining(["width", "height", "depth"]));
  });

  it("דלתות רחבות מדי וצרות מדי עם הצעה", () => {
    const wide = design("wardrobes", { dimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 }, structure: { doorCount: 3 } });
    const w = errorsOf(validateDesign(wide, { limits: DEFAULT_LIMITS })).find((e) => e.id === "door-wide")!;
    expect(w.message).toContain("5 דלתות");
    const narrow = design("wardrobes", { dimensions: { widthMm: 1000, heightMm: 2400, depthMm: 600 }, structure: { doorCount: 6 } });
    expect(errorsOf(validateDesign(narrow, { limits: DEFAULT_LIMITS })).some((e) => e.id === "door-narrow")).toBe(true);
    const one = design("sliding-wardrobes", { structure: { doorCount: 1 } });
    expect(errorsOf(validateDesign(one, { limits: DEFAULT_LIMITS })).some((e) => e.id === "sliding-count")).toBe(true);
  });

  it("מגבלות שהנגר משנה משפיעות על הבדיקה", () => {
    const d = design("wardrobes");
    const tight = { ...DEFAULT_LIMITS, byCategory: { ...DEFAULT_LIMITS.byCategory, wardrobes: { ...DEFAULT_LIMITS.byCategory.wardrobes, maxWidthMm: 2000 } } };
    expect(errorsOf(validateDesign(d, { limits: tight })).some((e) => e.id === "width")).toBe(true);
  });

  it("אזהרת מדף ארוך ושגיאת תא צר", () => {
    let d = design("wardrobes", { dimensions: { widthMm: 1800, heightMm: 2400, depthMm: 600 } });
    d = { ...d, interior: { template: "custom", compartments: [{ id: "c1", widthShare: 1, shelves: 3, drawers: 0, hangingRod: "none" }] } };
    expect(warningsOf(validateDesign(d, { limits: DEFAULT_LIMITS })).some((w) => w.id.endsWith("span"))).toBe(true);
    d = { ...d, interior: { template: "custom", compartments: [{ id: "c1", widthShare: 0.9, shelves: 1, drawers: 0, hangingRod: "none" }, { id: "c2", widthShare: 0.1, shelves: 1, drawers: 0, hangingRod: "none" }] } };
    expect(errorsOf(validateDesign(d, { limits: DEFAULT_LIMITS }), 4).length).toBeGreaterThan(0);
  });

  it("שילוב חומרים לא חוקי נתפס", () => {
    const d = design("wardrobes");
    const bad = { ...d, materials: { ...d.materials, bodyMaterialId: "board-melamine", bodyFinishId: "fin-veneer" } };
    expect(errorsOf(validateDesign(bad, { limits: DEFAULT_LIMITS, library: lib }), 6).length).toBeGreaterThan(0);
  });
});
