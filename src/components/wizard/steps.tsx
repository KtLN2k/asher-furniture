"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { Check, Hammer } from "lucide-react";
import { FURNITURE_CATEGORIES, categoryLabel, statusLabel, stepByNumber, type CategoryKey } from "@/domain/catalog";
import type { CustomerRef, Project } from "@/domain/project";
import { ApiError, api } from "@/lib/api";
import { useDebouncedSaver } from "@/lib/use-saver";
import type { ProjectSession } from "@/lib/use-project-session";
import { CategoryArt } from "../illustrations/category-art";
import { cn } from "../ui/cn";
import { Field, TextArea, TextInput } from "../ui/field";
import { Card } from "../ui/misc";
import { CustomerPicker } from "./customer-picker";

export type StepGuard = () => Promise<string | null>;

export interface StepProps {
  session: ProjectSession;
  project: Project;
  guardRef: MutableRefObject<StepGuard | null>;
  error: string | null;
}

const NAME_EXAMPLES = ["ארון חדר הורים — משפחת לוי", "מזנון סלון — כהן", "שידת מגירות — ניסיון"];

export function StepDetails({ session, project, guardRef, error }: StepProps) {
  const [name, setName] = useState(project.name);
  const [notes, setNotes] = useState(project.notes);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const trial = project.status === "trial";
  const customer = project.customer;

  const customerSaver = useDebouncedSaver<{ id: string; phone: string; address: string }>((v) =>
    api.patchCustomer(v.id, { phone: v.phone, address: v.address }),
  );

  async function createCustomer(rawName: string): Promise<CustomerRef | null> {
    setCreating(true);
    setCustomerError(null);
    try {
      const existing = (await api.listCustomers(rawName)).find((c) => c.name.trim().toLowerCase() === rawName.trim().toLowerCase());
      const c = existing ?? (await api.createCustomer({ name: rawName }));
      const ref: CustomerRef = { id: c.id, name: c.name, phone: c.phone, address: c.address };
      session.update({ customerId: ref.id }, { customer: ref });
      setQuery("");
      return ref;
    } catch (e) {
      setCustomerError((e as ApiError).message);
      return null;
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    guardRef.current = async () => {
      if (!name.trim()) return "יש להזין שם לפרויקט כדי להמשיך";
      if (!trial && !customer && query.trim()) {
        const ref = await createCustomer(query.trim());
        if (!ref) return "לא הצלחנו להוסיף את הלקוח. נסו שוב.";
      }
      if (!(await customerSaver.flush())) return "פרטי הלקוח לא נשמרו. נסו שוב.";
      return null;
    };
    return () => {
      guardRef.current = null;
    };
  });

  const editCustomer = (patch: Partial<Pick<CustomerRef, "phone" | "address">>) => {
    if (!customer) return;
    const next = { ...customer, ...patch };
    session.update({}, { customer: next });
    customerSaver.schedule({ id: next.id, phone: next.phone, address: next.address });
  };

  const nameMissing = Boolean(error) && !name.trim();

  return (
    <div className="flex flex-col gap-6">
      <Field label="שם הפרויקט" error={nameMissing ? "יש להזין שם לפרויקט" : null}>
        {(p) => (
          <>
            <TextInput
              {...p}
              autoFocus={!project.name}
              value={name}
              maxLength={120}
              placeholder="לדוגמה: ארון חדר הורים — משפחת לוי"
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) session.update({ name: e.target.value });
              }}
            />
            {!name.trim() && (
              <div className="flex flex-wrap gap-2 pt-1">
                {NAME_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setName(ex);
                      session.update({ name: ex });
                    }}
                    className="min-h-11 rounded-full border border-sand-300 bg-white px-3 text-sm text-ink-600 hover:border-wood-400"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Field>

      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-control border border-sand-300 bg-white px-4 py-2">
        <span>
          <span className="block text-lg font-semibold">פרויקט ניסיון</span>
          <span className="block text-sm text-ink-500">ללא לקוח, לבדיקה והדמיה ראשונית</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={trial}
          onChange={(e) =>
            e.target.checked
              ? session.update({ status: "trial", customerId: null }, { customer: null })
              : session.update({ status: "draft" })
          }
          className="peer sr-only"
        />
        <span aria-hidden className="relative h-8 w-14 shrink-0 rounded-full bg-sand-300 transition peer-checked:bg-wood-600 peer-focus-visible:outline peer-focus-visible:outline-4 peer-focus-visible:outline-wood-400 after:absolute after:start-1 after:top-1 after:size-6 after:rounded-full after:bg-white after:transition-all peer-checked:after:start-7" />
      </label>

      {!trial && (
        <section className="flex flex-col gap-3" aria-labelledby="customer-label">
          <label id="customer-label" htmlFor="customer-input" className="text-base font-semibold text-ink-700">
            לקוח <span className="font-normal text-ink-500">(לא חובה)</span>
          </label>
          <CustomerPicker
            selected={customer}
            query={query}
            onQuery={setQuery}
            onSelect={(c) => {
              session.update({ customerId: c.id }, { customer: c });
              setQuery("");
            }}
            onCreate={(n) => void createCustomer(n)}
            onClear={() => session.update({ customerId: null }, { customer: null })}
            creating={creating}
            error={customerError}
          />
          {customer && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="טלפון הלקוח" optional>
                {(p) => (
                  <TextInput {...p} type="tel" inputMode="tel" dir="ltr" className="text-end" maxLength={40} value={customer.phone} onChange={(e) => editCustomer({ phone: e.target.value })} />
                )}
              </Field>
              <Field label="כתובת" optional>
                {(p) => <TextInput {...p} maxLength={200} value={customer.address} onChange={(e) => editCustomer({ address: e.target.value })} />}
              </Field>
              {customerSaver.state === "error" && (
                <p role="alert" className="text-sm font-medium text-danger-600 sm:col-span-2">
                  {customerSaver.error}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <Field label="תיאור והערות" optional>
        {(p) => (
          <TextArea
            {...p}
            value={notes}
            maxLength={4000}
            placeholder="כל מה שחשוב לזכור על הפרויקט"
            onChange={(e) => {
              setNotes(e.target.value);
              session.update({ notes: e.target.value });
            }}
          />
        )}
      </Field>
    </div>
  );
}

export function StepType({ session, project, guardRef, error }: StepProps) {
  useEffect(() => {
    guardRef.current = async () => (project.category ? null : "בחרו סוג רהיט כדי להמשיך");
    return () => {
      guardRef.current = null;
    };
  });

  return (
    <div>
      {error && !project.category && (
        <p role="alert" className="mb-3 font-semibold text-danger-600">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" role="radiogroup" aria-label="סוג רהיט">
        {FURNITURE_CATEGORIES.map((c) => {
          const selected = project.category === c.key;
          return (
            <li key={c.key}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`category-${c.key}`}
                onClick={() => session.update({ design: { category: c.key as CategoryKey } })}
                className={cn(
                  "relative block w-full overflow-hidden rounded-card border-2 bg-white text-center shadow-card transition active:scale-[0.98]",
                  selected ? "border-wood-600 ring-4 ring-wood-100" : "border-sand-200 hover:border-wood-400",
                )}
              >
                <CategoryArt category={c.key} className="aspect-[4/3] w-full" />
                <span className="block px-2 pb-1 pt-2.5 text-lg font-bold leading-tight">{c.label}</span>
                <span className="block px-2 pb-3 text-sm text-ink-500">{c.hint}</span>
                {selected && (
                  <span className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-full bg-wood-600 text-white shadow-card">
                    <Check className="size-5" aria-label="נבחר" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StepPlaceholder({ step, project }: { step: number; project: Project }) {
  const def = stepByNumber(step)!;
  const isSummary = def.key === "summary";
  return (
    <div className="flex flex-col gap-4">
      {isSummary && <ProjectSummary project={project} />}
      <Card className="flex flex-col items-start gap-3 p-5" data-testid="step-placeholder">
        <div className="flex items-center gap-3 text-wood-600">
          <Hammer className="size-7" aria-hidden />
          <h2 className="text-xl font-bold text-ink-900">השלב הזה ייבנה בשלב הפיתוח הבא</h2>
        </div>
        <p className="text-ink-600">
          כאן יופיעו בקרוב:
        </p>
        <ul className="list-disc space-y-1 ps-6 text-ink-700">
          {def.includes?.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="rounded-control bg-cream-100 px-4 py-3 text-sm text-ink-600">
          ההתקדמות שלכם נשמרת. אפשר לצאת עכשיו ולחזור בכל רגע בדיוק לשלב הזה דרך ״הפרויקטים שלי״.
        </p>
      </Card>
    </div>
  );
}

export function ProjectSummary({ project }: { project: Project }) {
  const rows: Array<[string, string]> = [
    ["שם הפרויקט", project.name || "—"],
    ["לקוח", project.customer?.name ?? (project.status === "trial" ? "פרויקט ניסיון" : "ללא לקוח")],
    ["סוג רהיט", categoryLabel(project.category) ?? "עוד לא נבחר"],
    ["סטטוס", statusLabel(project.status)],
  ];
  return (
    <Card className="overflow-hidden" data-testid="project-summary">
      {project.category && <CategoryArt category={project.category} className="aspect-[16/9] w-full" />}
      <dl className="divide-y divide-sand-200 px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="py-2.5">
            <dt className="text-sm text-ink-500">{k}</dt>
            <dd className="break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
