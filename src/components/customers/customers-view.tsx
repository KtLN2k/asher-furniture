"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Phone, Plus, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/use-async";
import { PageContainer, PageHeader } from "../shell/page";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { inputClasses } from "../ui/field";
import { EmptyState, ErrorNotice, LoadingBlock } from "../ui/misc";
import { useToast } from "../ui/toast";
import { CustomerForm } from "./customer-form";

export function CustomersView() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const list = useAsync((signal) => api.listCustomers(q, signal), [q]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title="לקוחות"
        subtitle="כרטיס לקוח נוצר גם תוך כדי פתיחת פרויקט חדש."
        actions={
          <Button onClick={() => { setError(null); setAdding(true); }}>
            <Plus className="size-5" aria-hidden /> לקוח חדש
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          aria-label="חיפוש לקוח"
          placeholder="חיפוש לפי שם או טלפון"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClasses} ps-12`}
        />
      </div>

      {list.error && <ErrorNotice message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <LoadingBlock />}
      {list.data && list.data.length === 0 && (
        <EmptyState
          icon={<Users className="size-10" />}
          title={q ? "לא נמצאו לקוחות" : "עדיין אין לקוחות"}
          text={q ? "נסו חיפוש אחר." : "הוסיפו לקוח ראשון, או צרו אותו תוך כדי פרויקט חדש."}
        />
      )}
      {list.data && list.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                data-testid="customer-card"
                className="flex min-h-20 items-center justify-between gap-3 rounded-card border border-sand-200 bg-white p-4 shadow-card transition hover:border-wood-400"
              >
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{c.name}</div>
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-ink-500">
                      <Phone className="size-4" aria-hidden />
                      <span dir="ltr">{c.phone}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-1.5 truncate text-ink-500">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-wood-50 px-3 py-1 text-sm font-semibold text-wood-600">
                  {c.projectCount === 0 ? "אין פרויקטים" : c.projectCount === 1 ? "פרויקט אחד" : `${c.projectCount} פרויקטים`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="לקוח חדש">
        <CustomerForm
          submitLabel="שמירת לקוח"
          busy={busy}
          error={error}
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            setBusy(true);
            setError(null);
            try {
              const c = await api.createCustomer(v);
              toast("הלקוח נוסף");
              setAdding(false);
              router.push(`/customers/${c.id}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Dialog>
    </PageContainer>
  );
}
