import type { CategoryKey } from "./catalog";
import { capsFor, suggestDoorCount, type TemplateKey } from "./capabilities";
import type { DoorType, FurnitureDesign, Placement } from "./design";
import {
  addCompartment,
  buildCompartments,
  maxDrawers,
  maxShelves,
  normalizeShares,
  removeCompartment,
  setCompartmentWidth,
  type Compartment,
} from "./interior";
import { fixMaterials, type Library } from "./materials";
import { resolveSpec } from "./spec";

/**
 * פעולות עריכה טהורות על מודל הרהיט. כל פעולה מחזירה עדכון חלקי (סעיפים שהשתנו) שמוכן לשמירה.
 * כך כל כלל (למשל התאמת מספר הדלתות לרוחב) חי במקום אחד, ונבדק ביחידות.
 */
export type SectionPatch = Partial<Pick<FurnitureDesign, "dimensions" | "structure" | "interior" | "facades" | "materials" | "presentation">>;

export function categoryDefaults(category: CategoryKey, library: Library | null): SectionPatch {
  const caps = capsFor(category);
  const dims = caps.defaultDims;
  const doorType = caps.defaultDoorType;
  const design: FurnitureDesign = {
    schemaVersion: 1,
    category,
    dimensions: dims,
    structure: { placement: caps.defaultPlacement, unitCount: 1, doorCount: suggestDoorCount(dims.widthMm, doorType) },
    facades: { doorType },
  };
  const spec = resolveSpec(design);
  const patch: SectionPatch = {
    dimensions: dims,
    structure: design.structure,
    facades: design.facades,
    interior: {
      template: caps.defaultTemplate,
      compartments: buildCompartments(caps.defaultTemplate, { innerWidthMm: spec.innerWidthMm, innerHeightMm: spec.innerHeightMm, unitCount: 1, category }),
    },
  };
  if (library) patch.materials = fixMaterials(library, undefined).materials;
  return patch;
}

function withPatch(design: FurnitureDesign, patch: SectionPatch): FurnitureDesign {
  return { ...design, ...patch } as FurnitureDesign;
}

/** מחדש את התאים לפי התבנית הנוכחית (אם היא לא מותאמת אישית). */
function refreshInterior(design: FurnitureDesign): SectionPatch["interior"] | undefined {
  const tpl = design.interior?.template;
  if (!tpl || tpl === "custom") return undefined;
  const spec = resolveSpec(design);
  return {
    template: tpl,
    compartments: buildCompartments(tpl, { innerWidthMm: spec.innerWidthMm, innerHeightMm: spec.innerHeightMm, unitCount: spec.unitCount, category: spec.category }),
  };
}

export function setDimensions(design: FurnitureDesign, dims: { widthMm: number; heightMm: number; depthMm: number }): SectionPatch {
  const before = resolveSpec(design);
  const next = withPatch(design, { dimensions: dims });
  const patch: SectionPatch = { dimensions: dims };
  if (before.doorCount > 0 && before.doorCount === suggestDoorCount(before.widthMm, before.doorType)) {
    const count = suggestDoorCount(dims.widthMm, before.doorType);
    patch.structure = { ...(design.structure ?? {}), doorCount: count };
    next.structure = patch.structure;
  }
  const interior = refreshInterior(next);
  if (interior) patch.interior = interior;
  return patch;
}

export function setStructure(design: FurnitureDesign, change: Partial<NonNullable<FurnitureDesign["structure"]>>): SectionPatch {
  const spec = resolveSpec(design);
  const merged = { ...(design.structure ?? {}), ...change };
  if (change.placement !== undefined) {
    delete merged.baseHeightMm;
    delete merged.mountHeightMm;
    if (change.placement === "legs") merged.base = "legs";
    else if (change.placement === "wall-hung") merged.base = "none";
    else if (merged.base === "legs") merged.base = "plinth";
  }
  if (merged.doorCount === undefined) merged.doorCount = spec.doorCount;
  const next = withPatch(design, { structure: merged });
  const patch: SectionPatch = { structure: merged };
  if (change.doorCount !== undefined && spec.doorType !== "none" && change.doorCount === 0) {
    patch.facades = { ...(design.facades ?? {}), doorType: "none" };
  } else if (change.doorCount !== undefined && change.doorCount > 0 && spec.doorType === "none") {
    const caps = capsFor(spec.category);
    const type = caps.doorTypes.find((t) => t !== "none");
    if (type) patch.facades = { ...(design.facades ?? {}), doorType: type };
  }
  const interior = refreshInterior({ ...next, ...patch } as FurnitureDesign);
  if (interior) patch.interior = interior;
  return patch;
}

export function setPlacement(design: FurnitureDesign, placement: Placement): SectionPatch {
  return setStructure(design, { placement });
}

export function setDoorType(design: FurnitureDesign, type: DoorType): SectionPatch {
  const spec = resolveSpec(design);
  const doorCount = type === "none" ? 0 : suggestDoorCount(spec.widthMm, type);
  const structure = { ...(design.structure ?? {}), doorCount };
  const facades = { ...(design.facades ?? {}), doorType: type };
  return { structure, facades };
}

export function selectTemplate(design: FurnitureDesign, template: TemplateKey): SectionPatch {
  const spec = resolveSpec(design);
  if (template === "custom") return { interior: { template, compartments: spec.compartments } };
  return {
    interior: {
      template,
      compartments: buildCompartments(template, { innerWidthMm: spec.innerWidthMm, innerHeightMm: spec.innerHeightMm, unitCount: spec.unitCount, category: spec.category }),
    },
  };
}

function customInterior(design: FurnitureDesign, compartments: Compartment[]): SectionPatch {
  return { interior: { template: "custom", compartments: normalizeShares(compartments) } };
}

export function editCompartment(design: FurnitureDesign, index: number, change: Partial<Omit<Compartment, "id" | "widthShare">>): SectionPatch {
  const spec = resolveSpec(design);
  const comps = spec.compartments.map((c, i) => {
    if (i !== index) return c;
    const next = { ...c, ...change };
    if (change.hangingRod === "long") next.shelves = Math.min(next.shelves, 1);
    if (change.hangingRod && change.hangingRod !== "none" && next.shelves === 0) next.shelves = 1;
    next.shelves = Math.min(next.shelves, Math.max(maxShelves(next, spec.innerHeightMm), 0));
    next.drawers = Math.min(next.drawers, Math.max(maxDrawers(next, spec.innerHeightMm), 0));
    return next;
  });
  return customInterior(design, comps);
}

export function resizeCompartment(design: FurnitureDesign, index: number, widthMm: number): SectionPatch {
  const spec = resolveSpec(design);
  return customInterior(design, setCompartmentWidth(spec.compartments, index, widthMm, spec.innerWidthMm, spec.bodyT));
}

export function addCompartmentTo(design: FurnitureDesign): SectionPatch {
  return customInterior(design, addCompartment(resolveSpec(design).compartments));
}

export function removeCompartmentAt(design: FurnitureDesign, index: number): SectionPatch {
  return customInterior(design, removeCompartment(resolveSpec(design).compartments, index));
}

export function equalizeCompartments(design: FurnitureDesign): SectionPatch {
  const comps = resolveSpec(design).compartments;
  return customInterior(design, comps.map((c) => ({ ...c, widthShare: 1 / comps.length })));
}
