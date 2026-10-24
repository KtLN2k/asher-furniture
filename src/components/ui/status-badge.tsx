import { statusLabel, type ProjectStatus } from "@/domain/catalog";
import { cn } from "./cn";

const styles: Record<ProjectStatus, string> = {
  draft: "bg-sand-200 text-ink-700",
  trial: "bg-info-50 text-info-600",
  planning: "bg-wood-50 text-wood-600",
  quote: "bg-warn-50 text-warn-600",
  approved: "bg-ok-50 text-ok-600",
  in_progress: "bg-wood-100 text-wood-700",
  completed: "bg-ok-600 text-white",
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold", styles[status], className)}>
      {statusLabel(status)}
    </span>
  );
}
