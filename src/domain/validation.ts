import { categoryLabel } from "./catalog";
import type { FurnitureDesign } from "./design";
import { buildLayout } from "./layout";
import type { Limits } from "./limits";
import {
  colorAllowed,
  finishAllowed,
  itemById,
  thicknessOptions,
  type Library,
} from "./materials";
import { resolveSpec } from "./spec";

export type IssueLevel = "error" | "warning";

export interface Issue {
  id: string;
  level: IssueLevel;
  /** מספר שלב באשף שבו אפשר לתקן. */
  step: 3 | 4 | 5 | 6;
  message: string;
}

const cm = (mm: number) => `${Math.round(mm / 10)}`;
const cm1 = (mm: number) => (Math.round(mm) / 10).toLocaleString("he-IL", { maximumFractionDigits: 1 });

export interface ValidationContext {
  limits: Limits;
  library?: Library;
}

export function validateDesign(design: FurnitureDesign, ctx: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Issue) => issues.push(i);
  if (!design.category) return issues;
  const spec = resolveSpec(design);
  const layout = buildLayout(spec);
  const dimLimit = ctx.limits.byCategory[spec.category];
  const g = ctx.limits.general;
  const cat = categoryLabel(spec.category) ?? "";

  const checkRange = (key: string, label: string, v: number, min: number, max: number) => {
    if (v < min || v > max) {
      push({ id: key, level: "error", step: 3, message: `${label} (${cm(v)} ס״מ) מחוץ לטווח של ${cat}: בין ${cm(min)} ל-${cm(max)} ס״מ` });
    }
  };
  checkRange("width", "הרוחב", spec.widthMm, dimLimit.minWidthMm, dimLimit.maxWidthMm);
  checkRange("height", "הגובה", spec.heightMm, dimLimit.minHeightMm, dimLimit.maxHeightMm);
  checkRange("depth", "העומק", spec.depthMm, dimLimit.minDepthMm, dimLimit.maxDepthMm);

  if (spec.doorCount > 0) {
    const first = layout.doors[0];
    if (spec.doorType === "sliding") {
      if (spec.doorCount < 2) {
        push({ id: "sliding-count", level: "error", step: 3, message: "דלתות הזזה דורשות לפחות 2 דלתות" });
      }
      if (first) {
        const w = first.x1 - first.x0;
        if (w > g.maxSlidingDoorWidthMm) {
          const need = Math.ceil((spec.innerWidthMm + 50) / g.maxSlidingDoorWidthMm);
          push({ id: "door-wide", level: "error", step: 3, message: `דלתות ההזזה רחבות מדי (${cm(w)} ס״מ, מקסימום ${cm(g.maxSlidingDoorWidthMm)}). הגדילו ל-${need} דלתות או יותר` });
        }
      }
    } else if (first) {
      const w = first.x1 - first.x0;
      if (w > g.maxHingedDoorWidthMm) {
        const span = layout.doorSpan ? layout.doorSpan.x1 - layout.doorSpan.x0 : spec.widthMm;
        const need = Math.ceil(span / g.maxHingedDoorWidthMm);
        push({ id: "door-wide", level: "error", step: 3, message: `הדלתות רחבות מדי (${cm(w)} ס״מ, מקסימום ${cm(g.maxHingedDoorWidthMm)}). הגדילו ל-${need} דלתות או יותר` });
      } else if (w < g.minDoorWidthMm) {
        push({ id: "door-narrow", level: "error", step: 3, message: `הדלתות צרות מדי (${cm(w)} ס״מ, מינימום ${cm(g.minDoorWidthMm)}). הקטינו את מספר הדלתות` });
      }
    }
    const h = first ? first.y1 - first.y0 : 0;
    if (h > g.maxDoorHeightMm) {
      push({ id: "door-tall", level: "error", step: 3, message: `הדלתות גבוהות מדי (${cm(h)} ס״מ, מקסימום ${cm(g.maxDoorHeightMm)})` });
    }
  }

  if (spec.placement === "wall-hung" && spec.widthMm > 1500) {
    push({ id: "hung-wide", level: "warning", step: 3, message: "רהיט תלוי ברוחב כזה דורש עיגון חזק בקיר. כדאי לבדוק בשטח לפני שממשיכים" });
  }
  if (spec.unitCount > 1 && spec.widthMm / spec.unitCount < 400) {
    push({ id: "unit-narrow", level: "warning", step: 3, message: "היחידות צרות מאוד. כדאי להקטין את מספר היחידות" });
  }

  layout.compartments.forEach((c) => {
    const label = `תא ${c.index + 1}`;
    if (c.width < g.minCompartmentWidthMm) {
      push({ id: `c${c.index}-narrow`, level: "error", step: 4, message: `${label} צר מדי (${cm(c.width)} ס״מ, מינימום ${cm(g.minCompartmentWidthMm)})` });
    }
    c.elements.problems.forEach((p, i) => push({ id: `c${c.index}-p${i}`, level: "error", step: 4, message: `${label}: ${p}` }));
    if (c.source.shelves > 0 && c.width > g.maxShelfSpanMm) {
      push({
        id: `c${c.index}-span`,
        level: "warning",
        step: 4,
        message: `${label}: מדפים ברוחב ${cm(c.width)} ס״מ עלולים להתעקם. מומלץ עד ${cm(g.maxShelfSpanMm)} ס״מ או מחיצה נוספת`,
      });
    }
  });
  const ineffective = spec.compartments.some((c, i) => c.open && !layout.compartments[i].open);
  if (ineffective) {
    push({ id: "open-edge", level: "warning", step: 4, message: "תא פתוח אפשרי רק בקצה הארון ובדלתות ציר. התא יוצג עם דלת" });
  }

  const lib = ctx.library;
  if (lib && design.materials) {
    const m = design.materials;
    const body = itemById(lib, m.bodyMaterialId);
    const facade = itemById(lib, m.facadeMaterialId);
    const check = (group: string, mat: typeof body, finishId?: string, colorId?: string, thickness?: number) => {
      const finish = itemById(lib, finishId);
      if (mat && !mat.active) push({ id: `${group}-mat`, level: "error", step: 6, message: `${group}: החומר ${mat.name} הושבת בספרייה` });
      if (mat && finish) {
        const r = finishAllowed(mat, finish);
        if (!r.ok) push({ id: `${group}-fin`, level: "error", step: 6, message: `${group}: גימור ${finish.name} ${r.reason ?? "לא מתאים"}` });
      }
      const color = itemById(lib, colorId);
      if (finish && color) {
        const r = colorAllowed(finish, color);
        if (!r.ok) push({ id: `${group}-col`, level: "error", step: 6, message: `${group}: צבע ${color.name} לא מתאים לגימור ${finish.name}` });
      }
      const allowed = thicknessOptions(mat);
      if (mat && thickness !== undefined && allowed.length && !allowed.includes(thickness)) {
        push({ id: `${group}-thick`, level: "error", step: 6, message: `${group}: עובי ${thickness} מ״מ לא קיים ב${mat.name}` });
      }
    };
    check("גוף", body, m.bodyFinishId, m.bodyColorId, m.thicknessMm);
    check("חזיתות", facade, m.facadeFinishId, m.facadeColorId, m.facadeThicknessMm);
    const widest = Math.max(...layout.compartments.map((c) => c.width));
    if ((m.thicknessMm ?? 18) < 16 && widest > 700 && spec.compartments.some((c) => c.shelves > 0)) {
      push({ id: "thin-shelves", level: "warning", step: 6, message: `לוח דק (${m.thicknessMm} מ״מ) עם מדפים ברוחב ${cm1(widest)} ס״מ עלול להתעקם` });
    }
  }
  return issues;
}

export const errorsOf = (issues: Issue[], step?: number) => issues.filter((i) => i.level === "error" && (step === undefined || i.step === step));
export const warningsOf = (issues: Issue[], step?: number) => issues.filter((i) => i.level === "warning" && (step === undefined || i.step === step));
