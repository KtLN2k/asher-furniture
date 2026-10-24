"use client";

import { useCallback, useEffect, useMemo } from "react";
import { categoryDefaults, type SectionPatch } from "@/domain/edit";
import { emptyDesign, type FurnitureDesign } from "@/domain/design";
import type { Limits } from "@/domain/limits";
import { fixMaterials, type Library } from "@/domain/materials";
import { validateDesign, type Issue } from "@/domain/validation";
import { useLibrary } from "@/lib/use-library";
import { roomOf, type RoomKey } from "@/domain/rooms";
import type { Project } from "@/domain/project";
import type { ProjectSession } from "@/lib/use-project-session";

export interface Planner {
  design: FurnitureDesign;
  library: Library;
  limits: Limits;
  libraryReady: boolean;
  libraryError: string | null;
  issues: Issue[];
  /** מחיל עדכון על סעיפי העיצוב ושומר אוטומטית. */
  apply: (patch: SectionPatch) => void;
  /** מוכן לעריכה: יש קטגוריה, מידות וחומרים. */
  ready: boolean;
  /** חדר ההדמיה שנבחר, ושמירת בחירה חדשה בפרויקט. */
  room: RoomKey;
  setRoom: (room: RoomKey) => void;
  /** שומר תמונה ממוזערת מההדמיה האחרונה על הפרויקט. */
  saveThumbnail: (dataUrl: string) => void;
}

/** מחבר את מודל העיצוב של הפרויקט לספרייה, למגבלות ולבדיקות התקינות. */
const EMPTY = emptyDesign();

export function usePlanner(session: ProjectSession, project: Project | null, active: boolean): Planner {
  const lib = useLibrary();
  const design = project?.design ?? EMPTY;
  const { update } = session;

  const apply = useCallback((patch: SectionPatch) => update({ design: patch }), [update]);
  const setRoom = useCallback((room: RoomKey) => update({ design: { presentation: { room } } }), [update]);
  const saveThumbnail = useCallback((thumbnail: string) => update({ thumbnail }), [update]);

  const issues = useMemo(() => validateDesign(design, { limits: lib.limits, library: lib.library }), [design, lib.limits, lib.library]);

  const needsDefaults = active && Boolean(design.category) && !design.dimensions;
  const needsMaterials = active && Boolean(design.category) && lib.ready && !design.materials;
  const category = design.category;
  const { library, ready: libReady } = lib;

  useEffect(() => {
    if (!category || !active) return;
    if (needsDefaults) {
      if (!libReady) return;
      apply(categoryDefaults(category, library));
    } else if (needsMaterials) {
      apply({ materials: fixMaterials(library, undefined).materials });
    }
  }, [active, category, needsDefaults, needsMaterials, libReady, library, apply]);

  return {
    design,
    library: lib.library,
    limits: lib.limits,
    libraryReady: lib.ready,
    libraryError: lib.error,
    issues,
    apply,
    room: roomOf(design.presentation),
    setRoom,
    saveThumbnail,
    ready: Boolean(design.category && design.dimensions && design.materials),
  };
}
