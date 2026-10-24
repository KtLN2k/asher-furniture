"use client";

import { useEffect, useState } from "react";
import type { Planner } from "../planner/use-planner";
import { LazyViewer } from "../viewer/viewer-lazy";

/**
 * תצוגת תלת-ממד חיה לצד שלבי התכנון. תמיד קנבס WebGL אחד בלבד:
 * במסך רחב — בצד; בטלפון — בראש השלב, עם הגדלה למסך מלא.
 */
export function PreviewPanel({ planner, name, desktop }: { planner: Planner; name: string; desktop: boolean }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  if (!planner.ready) return null;
  const common = { design: planner.design, library: planner.library, name };

  if (expanded) {
    return (
      <div role="dialog" aria-modal="true" aria-label="תצוגת תלת-ממד מוגדלת" className="fixed inset-0 z-50 bg-cream-50 p-2" data-testid="preview-expanded">
        <LazyViewer {...common} className="h-full rounded-control" expanded onExpand={() => setExpanded(false)} />
      </div>
    );
  }

  if (desktop) {
    return (
      <div data-testid="preview-panel" className="h-[28rem] xl:h-[32rem]">
        <LazyViewer {...common} compact className="h-full" onExpand={() => setExpanded(true)} />
      </div>
    );
  }

  return (
    <div data-testid="preview-panel" className="mb-5 h-64 sm:h-80">
      <LazyViewer {...common} compact className="h-full" onExpand={() => setExpanded(true)} />
    </div>
  );
}
