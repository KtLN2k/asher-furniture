import { describe, expect, it } from "vitest";
import type { FurnitureDesign } from "@/domain/design";
import { categoryDefaults, selectTemplate, setDimensions, setDoorType, setPlacement, setStructure } from "@/domain/edit";
import { setFacadeDefaults, setFacadeOverride } from "@/domain/facades";
import { buildLayout } from "@/domain/layout";
import { seedLibrary } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";
import { buildFurnitureModel, type ModelNode } from "@/three/model";

const library = seedLibrary();

function design(category: NonNullable<FurnitureDesign["category"]>, ...patches: Array<(d: FurnitureDesign) => Partial<FurnitureDesign>>): FurnitureDesign {
  let d = { schemaVersion: 1, category, ...categoryDefaults(category, library) } as FurnitureDesign;
  for (const p of patches) d = { ...d, ...p(d) };
  return d;
}

const kinds = (nodes: ModelNode[], kind: string) => nodes.filter((n) => n.kind === kind).length;

describe("מודל תלת-ממד פרמטרי", () => {
  it("מספר הדלתות, המדפים והמחיצות במודל תואם לפריסת הנתונים", () => {
    const d = design("wardrobes", (x) => setDimensions(x, { widthMm: 3000, heightMm: 2400, depthMm: 600 }), (x) => setStructure(x, { doorCount: 7 }));
    const layout = buildLayout(resolveSpec(d));
    const model = buildFurnitureModel(d, { library });
    expect(model.stats.doors).toBe(7);
    expect(model.moving.filter((p) => p.kind === "door")).toHaveLength(7);
    expect(model.stats.shelves).toBe(layout.shelves.length);
    expect(model.stats.rods).toBe(layout.rods.length);
    expect(model.stats.dividers).toBe(layout.dividerX.length);
    expect(kinds(model.fixed, "shelf")).toBe(layout.shelves.length);
  });

  it("מידות המעטפת במטרים תואמות למידות שהוזנו", () => {
    const d = design("wardrobes", (x) => setDimensions(x, { widthMm: 3000, heightMm: 2400, depthMm: 600 }));
    const { bounds } = buildFurnitureModel(d, { library });
    expect(bounds.width).toBeCloseTo(3, 5);
    expect(bounds.height).toBeCloseTo(2.4, 5);
    expect(bounds.depth).toBeCloseTo(0.6, 5);
    expect(bounds.bottom).toBe(0);
  });

  it("ידית ארוכה לכל דלת: ידית אחת לדלת, ובלי ידית (לחיצה) אין צורה", () => {
    const base = design("wardrobes", (x) => setStructure(x, { doorCount: 4 }));
    const long = { ...base, facades: setFacadeDefaults(base.facades, "door", { handle: "long", handleColor: "black" }) };
    expect(buildFurnitureModel(long, { library }).stats.handles).toBe(4);
    const push = { ...base, facades: setFacadeDefaults(base.facades, "door", { handle: "push" }) };
    expect(buildFurnitureModel(push, { library }).stats.handles).toBe(0);
    const mixed = { ...long, facades: setFacadeOverride(long.facades, "door", "door-2", { handle: "none" }) };
    expect(buildFurnitureModel(mixed, { library }).stats.handles).toBe(3);
  });

  it("דלתות ציר נפתחות על ציר אנכי, ודלתות הזזה בהזזה אופקית", () => {
    const hinged = buildFurnitureModel(design("wardrobes", (x) => setStructure(x, { doorCount: 2 })), { library });
    expect(hinged.moving.filter((p) => p.kind === "door").every((p) => p.motion.type === "hinge")).toBe(true);
    const sliding = buildFurnitureModel(design("sliding-wardrobes"), { library });
    expect(sliding.moving.filter((p) => p.kind === "door").every((p) => p.motion.type === "slide")).toBe(true);
  });

  it("בלי דלתות: המגירות נחשפות בחזית ומזיזות קדימה בפתיחה", () => {
    const d = design("dressers", (x) => selectTemplate(x, "drawers"), (x) => setDoorType(x, "none"));
    const model = buildFurnitureModel(d, { library });
    expect(model.stats.doors).toBe(0);
    expect(model.stats.drawers).toBeGreaterThan(0);
    const drawer = model.moving.find((p) => p.kind === "drawer")!;
    expect(drawer.exposed).toBe(true);
    expect(drawer.motion).toMatchObject({ type: "pull" });
  });

  it("רגליים מרימות את הגוף, ורהיט תלוי מקבל גובה הרכבה", () => {
    const legs = buildFurnitureModel(design("wardrobes", (x) => setPlacement(x, "legs")), { library });
    expect(kinds(legs.fixed, "foot")).toBeGreaterThanOrEqual(4);
    const hung = buildFurnitureModel(design("sideboards", (x) => setPlacement(x, "wall-hung")), { library });
    expect(hung.bounds.bottom).toBeGreaterThan(0);
  });

  it("שינוי צבע דלת בודדת משנה רק אותה", () => {
    const base = design("wardrobes", (x) => setStructure(x, { doorCount: 3 }));
    const d = { ...base, facades: setFacadeOverride(base.facades, "door", "door-2", { colorId: "col-walnut" }) };
    const model = buildFurnitureModel(d, { library });
    const colors = model.moving
      .filter((p) => p.kind === "door")
      .map((p) => (p.children.find((c) => c.kind.startsWith("door")) as { material: { hex: string } } | undefined)?.material.hex);
    expect(new Set(colors).size).toBe(2);
    expect(colors[0]).toBe(colors[2]);
    expect(colors[1]).not.toBe(colors[0]);
  });

  it("עובי לוח מהחומרים משפיע על רוחב הגוף הפנימי", () => {
    const thin = design("wardrobes");
    const thick = { ...thin, materials: { ...thin.materials, thicknessMm: 25 } };
    expect(resolveSpec(thick).innerWidthMm).toBe(resolveSpec(thin).innerWidthMm - 14);
    const a = buildFurnitureModel(thin, { library });
    const b = buildFurnitureModel(thick, { library });
    expect(b.bounds.width).toBe(a.bounds.width);
  });
});
