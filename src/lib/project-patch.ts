import { mergeDesign } from "@/domain/design";
import type { CustomerRef, Project, ProjectPatch } from "@/domain/project";

export interface LocalExtras {
  customer?: CustomerRef | null;
}

/** מיזוג שני עדכונים חלקיים: סעיפי עיצוב נשמרים לפי סעיף, כל השאר נדרס. */
export function mergePatches(a: ProjectPatch | null, b: ProjectPatch): ProjectPatch {
  if (!a) return { ...b, design: b.design ? { ...b.design } : undefined };
  const design = a.design || b.design ? { ...a.design, ...b.design } : undefined;
  const out: ProjectPatch = { ...a, ...b };
  if (design) out.design = design;
  else delete out.design;
  return out;
}

/** החלה אופטימית של עדכון על הפרויקט המקומי (לפני שהשרת אישר). */
export function applyPatch(project: Project, patch: ProjectPatch, extras: LocalExtras = {}): Project {
  const next: Project = { ...project };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.wizardStep !== undefined) next.wizardStep = patch.wizardStep;
  if (patch.thumbnail !== undefined) next.thumbnail = patch.thumbnail;
  if (patch.archived !== undefined) next.archivedAt = patch.archived ? (project.archivedAt ?? new Date().toISOString()) : null;
  if (patch.design) {
    next.design = mergeDesign(project.design, patch.design);
    next.category = next.design.category ?? null;
  }
  if (patch.customerId === null) next.customer = null;
  if (extras.customer !== undefined) next.customer = extras.customer;
  return next;
}
