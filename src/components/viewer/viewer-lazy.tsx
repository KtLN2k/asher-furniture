"use client";

import dynamic from "next/dynamic";
import type { ViewerProps } from "./furniture-viewer";
import { cn } from "../ui/cn";

const Viewer = dynamic(() => import("./furniture-viewer"), {
  ssr: false,
  loading: () => <div role="status" className="flex h-full min-h-48 items-center justify-center rounded-card bg-sand-200 text-ink-500">טוען תצוגת תלת-ממד…</div>,
});

/** טעינה עצלה של מנוע ה-3D: הוא לא נכלל בעמודים שלא צריכים אותו. */
export function LazyViewer(props: ViewerProps) {
  return <Viewer {...props} className={cn(props.className)} />;
}
