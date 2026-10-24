"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { ProjectCard } from "../projects/project-card";
import { PageContainer } from "../shell/page";
import { Button, LinkButton } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Card, ErrorNotice, LoadingBlock } from "../ui/misc";
import { useToast } from "../ui/toast";
import { CustomerForm } from "./customer-form";

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const data = useAsync((signal) => api.getCustomer(id, signal), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (data.loading && !data.data) return <PageContainer><LoadingBlock /></PageContainer>;
  if (data.error || !data.data) {
    return (
      <PageContainer>
        <ErrorNotice message={data.error ?? "הלקוח לא נמצא"} onRetry={data.reload} />
        <LinkButton href="/customers" variant="secondary" className="mt-4">
          חזרה ללקוחות
        </LinkButton>
      </PageContainer>
    );
  }
  const { customer, projects } = data.data;

  return (
    <PageContainer className="flex flex-col gap-6">
      <div>
        <Link href="/customers" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-wood-600">
          <ArrowRight className="size-5" aria-hidden /> כל הלקוחות
        </Link>
        <h1 className="text-3xl font-extrabold">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-xl font-bold">פרטי לקוח</h2>
          <CustomerForm
            key={customer.updatedAt}
            initial={customer}
            submitLabel="שמירת שינויים"
            busy={busy}
            error={error}
            onSubmit={async (v) => {
              setBusy(true);
              setError(null);
              try {
                await api.patchCustomer(id, v);
                toast("הפרטים נשמרו");
                data.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>

        <section aria-labelledby="cust-projects">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="cust-projects" className="text-xl font-bold">
              פרויקטים ({projects.length})
            </h2>
          </div>
          {projects.length === 0 ? (
            <p className="rounded-card border border-dashed border-sand-300 bg-cream-100/60 p-6 text-center text-ink-500">
              אין עדיין פרויקטים ללקוח זה. פתחו פרויקט חדש ובחרו אותו בשלב הראשון.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
          <LinkButton href="/projects/new" variant="secondary" className="mt-3 w-full">
            <Plus className="size-5" aria-hidden /> פרויקט חדש
          </LinkButton>
        </section>
      </div>

      <div>
        <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-5" aria-hidden /> מחיקת לקוח
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="מחיקת לקוח"
        confirmLabel="כן, מחק את הלקוח"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.deleteCustomer(id);
            toast("הלקוח נמחק");
            router.replace("/customers");
          } catch (e) {
            toast((e as Error).message, "error");
            setBusy(false);
          }
        }}
      >
        <p>
          האם למחוק את <strong>״{customer.name}״</strong>?
          {projects.length > 0 && " הפרויקטים של הלקוח לא יימחקו, הם יישארו ללא לקוח."}
        </p>
      </ConfirmDialog>
    </PageContainer>
  );
}
