import Link from "next/link";
import type { ReactNode } from "react";
import { Archive, Clock, User } from "lucide-react";
import { categoryLabel, TOTAL_STEPS } from "@/domain/catalog";
import type { ProjectSummary } from "@/domain/project";
import { formatDate } from "@/lib/format";
import { CategoryArt, PlaceholderArt } from "../illustrations/category-art";
import { StatusBadge } from "../ui/status-badge";

export function ProjectThumb({ project, className }: { project: Pick<ProjectSummary, "category"> & { thumbnail?: string | null }; className?: string }) {
  if (project.thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- תמונה מקומית (data URL) מההדמיה, אין מה לייעל
      <img src={project.thumbnail} alt="" data-testid="project-thumbnail" className={`${className ?? ""} object-cover`} />
    );
  }
  return project.category ? (
    <CategoryArt category={project.category} className={className} />
  ) : (
    <PlaceholderArt className={className} />
  );
}

export function ProjectCard({ project, menu }: { project: ProjectSummary; menu?: ReactNode }) {
  const archived = Boolean(project.archivedAt);
  return (
    <article
      data-testid="project-card"
      data-project-id={project.id}
      className="relative flex gap-3 overflow-hidden rounded-card border border-sand-200 bg-white p-3 shadow-card transition hover:border-wood-400"
    >
      <div className="size-24 shrink-0 overflow-hidden rounded-2xl bg-sand-200 sm:size-28">
        <ProjectThumb project={project} className="size-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="min-w-0">
          <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug [overflow-wrap:anywhere]">
            <Link
              href={`/projects/${project.id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-card"
            >
              {project.name}
            </Link>
          </h3>
          <p className="flex items-center gap-1.5 truncate text-base text-ink-500">
            <User className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{project.customer?.name ?? "ללא לקוח"}</span>
          </p>
          <p className="truncate text-sm text-ink-500">{categoryLabel(project.category) ?? "סוג הרהיט עוד לא נבחר"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={project.status} />
          {archived && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-ink-500">
              <Archive className="size-4" aria-hidden /> בארכיון
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-sm text-ink-500">
            <Clock className="size-4" aria-hidden /> {formatDate(project.updatedAt)}
          </span>
          {project.status !== "completed" && (
            <span className="text-sm text-ink-500">
              שלב {Math.min(project.wizardStep, TOTAL_STEPS)} מתוך {TOTAL_STEPS}
            </span>
          )}
        </div>
      </div>
      {menu && <div className="relative z-10 -me-1 -mt-1 self-start">{menu}</div>}
    </article>
  );
}
