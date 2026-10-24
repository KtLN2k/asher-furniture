"use client";

import { AlertTriangle, Check, Info, Minus, Plus, XCircle } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { Issue } from "@/domain/validation";
import { cn } from "../ui/cn";

export function Block({ title, hint, children, testId }: { title: string; hint?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-3" data-testid={testId}>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {hint && <p className="text-ink-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const fmt = (v: number, decimals: number) => v.toLocaleString("he-IL", { maximumFractionDigits: decimals, useGrouping: false });

/**
 * שדה מספר עם כפתורי + ו-: מקלדת או לחיצה. מחויב בעזיבת השדה או Enter, כפתורים מחילים מיד.
 * הערך המוצג ביחידות תצוגה (למשל ס״מ), וה-onCommit מקבל אותן כמות שהן.
 */
export function NumberStepper({
  label,
  value,
  onCommit,
  step = 1,
  min = 0,
  max = 10000,
  unit,
  hint,
  error,
  decimals = 1,
  testId,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  error?: string | null;
  decimals?: number;
  testId?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string | null) => {
    if (raw === null) return;
    setDraft(null);
    const n = Number(raw.replace(",", ".").trim());
    if (!Number.isFinite(n) || raw.trim() === "") return;
    const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
    if (rounded !== value) onCommit(Math.max(min, Math.min(max, rounded)));
  };
  const bump = (dir: 1 | -1) => {
    setDraft(null);
    const next = Math.round((value + dir * step) * 10 ** decimals) / 10 ** decimals;
    onCommit(Math.max(min, Math.min(max, next)));
  };
  const btn =
    "flex size-12 shrink-0 items-center justify-center rounded-control border border-sand-300 bg-white text-ink-700 transition hover:border-wood-400 active:scale-95 disabled:opacity-40";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} aria-label={`הקטנת ${label}`} onClick={() => bump(-1)} disabled={value <= min}>
          <Minus className="size-5" aria-hidden />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            data-testid={testId}
            inputMode="decimal"
            dir="ltr"
            value={draft ?? fmt(value, decimals)}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(draft);
              }
            }}
            className={cn(
              "min-h-12 w-full rounded-control border bg-white px-2 text-center text-xl font-bold tabular-nums text-ink-900 transition focus:border-wood-500 focus:outline-none focus:ring-4 focus:ring-wood-100",
              error ? "border-danger-600" : "border-sand-300",
            )}
          />
          {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-500">{unit}</span>}
        </div>
        <button type="button" className={btn} aria-label={`הגדלת ${label}`} onClick={() => bump(1)} disabled={value >= max}>
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      {(error || hint) && <p className={cn("text-sm", error ? "font-medium text-danger-600" : "text-ink-500")}>{error ?? hint}</p>}
    </div>
  );
}

export function OptionCard({
  selected,
  disabled,
  reason,
  onClick,
  title,
  hint,
  preview,
  testId,
  className,
}: {
  selected: boolean;
  disabled?: boolean;
  reason?: string;
  onClick: () => void;
  title: string;
  hint?: string;
  preview?: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      data-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={cn(
        "relative flex w-full flex-col items-stretch gap-1.5 overflow-hidden rounded-card border-2 bg-white p-2.5 text-start shadow-card transition active:scale-[0.98]",
        selected ? "border-wood-600 ring-4 ring-wood-100" : "border-sand-200 hover:border-wood-400",
        disabled && "cursor-not-allowed opacity-60 hover:border-sand-200 active:scale-100",
        className,
      )}
    >
      {preview && <div className="overflow-hidden rounded-control bg-cream-100">{preview}</div>}
      <span className="px-1 text-base font-bold leading-tight">{title}</span>
      {(reason || hint) && <span className={cn("px-1 text-sm leading-snug", disabled ? "text-warn-600" : "text-ink-500")}>{disabled && reason ? reason : hint}</span>}
      {selected && (
        <span className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-wood-600 text-white shadow-card">
          <Check className="size-4" aria-label="נבחר" />
        </span>
      )}
    </button>
  );
}

export function CardGrid({ children, label, cols = "grid-cols-2 md:grid-cols-3" }: { children: ReactNode; label: string; cols?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3", cols)}>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean; reason?: string }>;
  onChange: (v: T) => void;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <span className="text-base font-semibold text-ink-700" id={`${testId ?? label}-l`}>
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-disabled={o.disabled || undefined}
            title={o.disabled ? o.reason : undefined}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
            onClick={() => {
              if (!o.disabled) onChange(o.value);
            }}
            className={cn(
              "min-h-12 rounded-control border-2 px-4 text-base font-semibold transition active:scale-[0.98]",
              value === o.value ? "border-wood-600 bg-wood-50 text-wood-700" : "border-sand-300 bg-white text-ink-700 hover:border-wood-400",
              o.disabled && "cursor-not-allowed opacity-50 hover:border-sand-300",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {options.filter((o) => o.disabled && o.reason).length > 0 && (
        <p className="text-sm text-warn-600">
          {options
            .filter((o) => o.disabled && o.reason)
            .map((o) => `${o.label}: ${o.reason}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

export function IssueList({ issues, step }: { issues: Issue[]; step?: number }) {
  const list = step === undefined ? issues : issues.filter((i) => i.step === step);
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-2" data-testid="issue-list" aria-label="בדיקות תקינות">
      {list.map((i) => (
        <li
          key={i.id}
          role={i.level === "error" ? "alert" : "status"}
          data-level={i.level}
          className={cn(
            "flex items-start gap-3 rounded-control border px-4 py-3",
            i.level === "error" ? "border-danger-600/30 bg-danger-50 text-danger-700" : "border-warn-600/30 bg-warn-50 text-warn-600",
          )}
        >
          {i.level === "error" ? <XCircle className="mt-0.5 size-5 shrink-0" aria-label="שגיאה" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-label="אזהרה" />}
          <span className="font-medium">{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function Notice({ children, tone = "info", testId }: { children: ReactNode; tone?: "info" | "ok"; testId?: string }) {
  return (
    <p data-testid={testId} role="status" className={cn("flex items-start gap-2 rounded-control px-4 py-3", tone === "info" ? "bg-info-50 text-info-600" : "bg-ok-50 text-ok-600")}>
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
