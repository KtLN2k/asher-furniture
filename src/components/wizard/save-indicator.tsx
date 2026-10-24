"use client";

import { AlertTriangle, Check, CloudOff } from "lucide-react";
import type { SaveState } from "@/lib/use-project-session";
import { Spinner } from "../ui/misc";
import { cn } from "../ui/cn";

export function SaveIndicator({
  state,
  hasProject,
  onRetry,
}: {
  state: SaveState;
  hasProject: boolean;
  onRetry: () => void;
}) {
  let content: React.ReactNode;
  let tone = "text-ink-500";
  if (!hasProject && state === "idle") {
    content = "יישמר אוטומטית ברגע שתזינו שם";
  } else if (state === "saving" || state === "dirty") {
    content = (
      <>
        <Spinner className="size-4" /> שומר…
      </>
    );
  } else if (state === "saved") {
    tone = "text-ok-600";
    content = (
      <>
        <Check className="size-4" /> נשמר
      </>
    );
  } else if (state === "error") {
    tone = "text-danger-600";
    content = (
      <>
        <CloudOff className="size-4" /> לא נשמר, מנסה שוב
        <button type="button" onClick={onRetry} className="min-h-11 px-2 font-bold underline">
          נסו עכשיו
        </button>
      </>
    );
  } else if (state === "conflict") {
    tone = "text-warn-600";
    content = (
      <>
        <AlertTriangle className="size-4" /> נדרשת בחירה
      </>
    );
  } else {
    content = "הכל נשמר אוטומטית";
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="save-status"
      data-state={hasProject ? state : "draft"}
      className={cn("flex items-center gap-1.5 text-sm font-medium", tone)}
    >
      {content}
    </div>
  );
}
