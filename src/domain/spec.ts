import type { CategoryKey } from "./catalog";
import { capsFor, suggestDoorCount } from "./capabilities";
import type { BaseType, DoorType, FurnitureDesign, Placement } from "./design";
import { buildCompartments, normalizeShares, type Compartment } from "./interior";

export const DEFAULT_BODY_T = 18;
export const DEFAULT_FACADE_T = 18;
export const DEFAULT_BACK_T = 4;

/**
 * תמונה מלאה ומנורמלת של הרהיט: כל ברירות המחדל והכללים כבר הופעלו.
 * ממנה נגזרים הגיאומטריה, ההמחשות והבדיקות (מקור אמת אחד לכולם). מידות במ״מ.
 */
export interface Spec {
  category: CategoryKey;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  placement: Placement;
  base: BaseType;
  baseHeightMm: number;
  mountHeightMm: number;
  unitCount: number;
  doorType: DoorType;
  doorCount: number;
  bodyT: number;
  facadeT: number;
  backT: number;
  compartments: Compartment[];
  /** גובה הגוף בלי הבסיס. */
  bodyHeightMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  hasDimensions: boolean;
}

export function effectiveStructure(category: CategoryKey, s: FurnitureDesign["structure"], facadeDoorType: DoorType | undefined, widthMm: number) {
  const caps = capsFor(category);
  let placement: Placement = s?.placement && caps.placements.includes(s.placement) ? s.placement : caps.defaultPlacement;
  if (!caps.placements.includes(placement)) placement = caps.placements[0];
  let base: BaseType;
  let baseHeightMm = 0;
  if (placement === "wall-hung") {
    base = "none";
  } else if (placement === "legs") {
    base = "legs";
    baseHeightMm = s?.baseHeightMm ?? caps.defaultBaseMm.legs;
  } else {
    base = s?.base === "none" ? "none" : "plinth";
    baseHeightMm = base === "plinth" ? (s?.baseHeightMm ?? caps.defaultBaseMm.plinth) : 0;
  }
  const mountHeightMm = placement === "wall-hung" ? (s?.mountHeightMm ?? caps.defaultMountMm) : 0;

  let doorType: DoorType = facadeDoorType && caps.doorTypes.includes(facadeDoorType) ? facadeDoorType : caps.defaultDoorType;
  let doorCount = s?.doorCount ?? suggestDoorCount(widthMm, doorType);
  if (doorType === "none") doorCount = 0;
  if (doorCount === 0) doorType = "none";
  return { placement, base, baseHeightMm, mountHeightMm, doorType, doorCount };
}

export function resolveSpec(design: FurnitureDesign): Spec {
  const category: CategoryKey = design.category ?? "wardrobes";
  const caps = capsFor(category);
  const dims = design.dimensions ?? caps.defaultDims;
  const widthMm = Math.max(100, dims.widthMm);
  const heightMm = Math.max(100, dims.heightMm);
  const depthMm = Math.max(80, dims.depthMm);
  const st = effectiveStructure(category, design.structure, design.facades?.doorType, widthMm);
  const bodyT = design.materials?.thicknessMm ?? DEFAULT_BODY_T;
  const facadeT = design.materials?.facadeThicknessMm ?? DEFAULT_FACADE_T;
  const backT = design.materials?.backThicknessMm ?? DEFAULT_BACK_T;
  const bodyHeightMm = Math.max(60, heightMm - st.baseHeightMm);
  const innerWidthMm = Math.max(40, widthMm - 2 * bodyT);
  const innerHeightMm = Math.max(40, bodyHeightMm - 2 * bodyT);
  const unitCount = design.structure?.unitCount ?? 1;
  const given = design.interior?.compartments;
  const compartments = normalizeShares(
    given && given.length
      ? given
      : buildCompartments(design.interior?.template && design.interior.template !== "custom" ? design.interior.template : caps.defaultTemplate, {
          innerWidthMm,
          innerHeightMm,
          unitCount,
          category,
        }),
  );
  return {
    category,
    widthMm,
    heightMm,
    depthMm,
    ...st,
    unitCount,
    bodyT,
    facadeT,
    backT,
    compartments,
    bodyHeightMm,
    innerWidthMm,
    innerHeightMm,
    hasDimensions: Boolean(design.dimensions),
  };
}
