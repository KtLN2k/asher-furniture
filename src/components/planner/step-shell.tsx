"use client";

import Link from "next/link";
import { useEffect, type MutableRefObject, type ReactNode } from "react";
import type { Project } from "@/domain/project";
import type { ProjectSession } from "@/lib/use-project-session";
import { routes } from "@/lib/routes";
import { errorsOf } from "@/domain/validation";
import { ErrorNotice, LoadingBlock } from "../ui/misc";
import type { Planner } from "./use-planner";

export type StepGuard = () => Promise<string | null>;

export interface PlannerStepProps {
  session: ProjectSession;
  project: Project;
  planner: Planner;
  guardRef: MutableRefObject<StepGuard | null>;
  error: string | null;
}

/** מצבי ביניים משותפים לשלבי התכנון: בלי קטגוריה, טעינה, וחסימת המשך על שגיאות תקינות של השלב. */
export function StepShell({ step, props, children }: { step: 3 | 4 | 5 | 6; props: PlannerStepProps; children: ReactNode }) {
  const { planner, guardRef, project } = props;
  const blocking = errorsOf(planner.issues, step);
  const blockMessage = blocking[0]?.message;

  useEffect(() => {
    guardRef.current = async () => {
      if (!project.design.category) return "בחרו סוג רהיט כדי להמשיך";
      if (blockMessage) return `יש לתקן לפני שממשיכים: ${blockMessage}`;
      return null;
    };
    return () => {
      guardRef.current = null;
    };
  });

  if (!project.design.category) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="rounded-control bg-warn-50 px-4 py-3 text-warn-600">עוד לא נבחר סוג רהיט. חוזרים לשלב הקודם כדי לבחור.</p>
        <Link href={routes.wizard(project.id, 2)} className="min-h-12 rounded-control border border-sand-300 bg-white px-5 py-3 font-semibold">
          לבחירת סוג רהיט
        </Link>
      </div>
    );
  }
  if (planner.libraryError && !planner.libraryReady) return <ErrorNotice message={planner.libraryError} />;
  if (!planner.ready) return <LoadingBlock label="מכין את התכנון…" />;
  return <>{children}</>;
}
