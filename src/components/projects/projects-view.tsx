"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Copy, FolderOpen, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { PROJECT_STATUSES, type ProjectStatus } from "@/domain/catalog";
import type { ProjectSummary } from "@/domain/project";
import { api } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/use-async";
import { PageContainer, PageHeader } from "../shell/page";
import { Button, LinkButton } from "../ui/button";
import { ConfirmDialog, Dialog } from "../ui/dialog";
import { Field, TextInput, inputClasses } from "../ui/field";
import { ActionMenu } from "../ui/menu";
import { Chip, EmptyState, ErrorNotice, LoadingBlock } from "../ui/misc";
import { useToast } from "../ui/toast";
import { ProjectCard } from "./project-card";

type Scope = "exclude" | "only";

export function ProjectsView() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [scope, setScope] = useState<Scope>("exclude");
  const q = useDebounced(search.trim(), 250);

  const list = useAsync(
    (signal) => api.listProjects({ q, status: status || undefined, archived: scope }, signal),
    [q, status, scope],
  );

  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [statusFor, setStatusFor] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    try {
      await fn();
      toast(okText);
      list.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const filtering = Boolean(q || status || scope === "only");

  return (
    <PageContainer>
      <PageHeader
        title="הפרויקטים שלי"
        subtitle="כל הפרויקטים נשמרים אוטומטית. אפשר לפתוח ולהמשיך בכל רגע."
        actions={
          <LinkButton href="/projects/new" className="max-md:hidden">
            <Plus className="size-5" aria-hidden /> פרויקט חדש
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            type="search"
            aria-label="חיפוש פרויקט לפי שם"
            placeholder="חיפוש לפי שם פרויקט או לקוח"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClasses} ps-12`}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="סינון לפי סטטוס">
          <Chip active={status === "" && scope === "exclude"} onClick={() => { setStatus(""); setScope("exclude"); }}>
            הכל
          </Chip>
          {PROJECT_STATUSES.map((s) => (
            <Chip key={s.key} active={status === s.key} onClick={() => { setStatus(s.key); if (scope === "only") setScope("exclude"); }}>
              {s.label}
            </Chip>
          ))}
          <Chip active={scope === "only"} onClick={() => { setScope(scope === "only" ? "exclude" : "only"); setStatus(""); }}>
            <Archive className="me-1.5 inline size-4" aria-hidden />
            ארכיון
          </Chip>
        </div>
      </div>

      {list.error && <ErrorNotice message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <LoadingBlock />}

      {list.data && list.data.length === 0 && (
        <EmptyState
          icon={<FolderOpen className="size-10" />}
          title={filtering ? "לא נמצאו פרויקטים" : "עדיין אין פרויקטים"}
          text={filtering ? "נסו חיפוש אחר או נקו את הסינון." : "התחילו פרויקט ראשון וכל השינויים יישמרו אוטומטית."}
          action={
            filtering ? (
              <Button variant="secondary" onClick={() => { setSearch(""); setStatus(""); setScope("exclude"); }}>
                ניקוי סינון
              </Button>
            ) : (
              <LinkButton href="/projects/new">
                <Plus className="size-5" aria-hidden /> פרויקט חדש
              </LinkButton>
            )
          }
        />
      )}

      {list.data && list.data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-busy={list.loading}>
          {list.data.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              menu={
                <ActionMenu
                  label={`פעולות עבור ${p.name}`}
                  items={[
                    { label: "פתיחה והמשך עבודה", icon: <FolderOpen className="size-5" />, onSelect: () => router.push(`/projects/${p.id}`) },
                    { label: "שינוי שם", icon: <Pencil className="size-5" />, onSelect: () => setRenaming(p) },
                    { label: "שינוי סטטוס", icon: <Tag className="size-5" />, onSelect: () => setStatusFor(p) },
                    { label: "שכפול", icon: <Copy className="size-5" />, onSelect: () => run(() => api.duplicateProject(p.id), "הפרויקט שוכפל") },
                    p.archivedAt
                      ? { label: "שחזור מהארכיון", icon: <ArchiveRestore className="size-5" />, onSelect: () => run(() => api.patchProject(p.id, { archived: false }), "הפרויקט שוחזר מהארכיון") }
                      : { label: "העברה לארכיון", icon: <Archive className="size-5" />, onSelect: () => run(() => api.patchProject(p.id, { archived: true }), "הפרויקט הועבר לארכיון") },
                    { label: "מחיקה", icon: <Trash2 className="size-5" />, danger: true, onSelect: () => setDeleting(p) },
                  ]}
                />
              }
            />
          ))}
        </div>
      )}

      <RenameDialog
        project={renaming}
        busy={busy}
        onClose={() => setRenaming(null)}
        onSave={(name) =>
          run(() => api.patchProject(renaming!.id, { name }), "השם עודכן").then(() => setRenaming(null))
        }
      />

      <Dialog open={Boolean(statusFor)} onClose={() => setStatusFor(null)} title="שינוי סטטוס">
        <div className="grid grid-cols-1 gap-2">
          {PROJECT_STATUSES.map((s) => (
            <Button
              key={s.key}
              variant={statusFor?.status === s.key ? "primary" : "secondary"}
              onClick={() => {
                const target = statusFor!;
                setStatusFor(null);
                run(() => api.patchProject(target.id, { status: s.key }), `הסטטוס עודכן: ${s.label}`);
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="מחיקת פרויקט"
        confirmLabel="כן, מחק לצמיתות"
        busy={busy}
        onConfirm={() =>
          run(() => api.deleteProject(deleting!.id), "הפרויקט נמחק").then(() => setDeleting(null))
        }
      >
        <p>
          האם למחוק את <strong>״{deleting?.name}״</strong>? הפעולה סופית ולא ניתן לשחזר. אם אתם לא בטוחים, עדיף להעביר לארכיון.
        </p>
      </ConfirmDialog>
    </PageContainer>
  );
}

function RenameDialog({
  project,
  busy,
  onClose,
  onSave,
}: {
  project: ProjectSummary | null;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <Dialog open={Boolean(project)} onClose={onClose} title="שינוי שם פרויקט">
      {project && <RenameForm key={project.id} initial={project.name} busy={busy} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function RenameForm({ initial, busy, onClose, onSave }: { initial: string; busy: boolean; onClose: () => void; onSave: (n: string) => void }) {
  const [name, setName] = useState(initial);
  const empty = !name.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) onSave(name.trim());
      }}
      className="flex flex-col gap-4"
    >
      <Field label="שם הפרויקט" error={empty ? "יש להזין שם" : null}>
        {(p) => <TextInput {...p} autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="flex gap-3">
        <Button type="submit" loading={busy} disabled={empty}>
          שמירה
        </Button>
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
