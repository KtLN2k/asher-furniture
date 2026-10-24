"use client";

import { useState } from "react";
import { Plus, User, X } from "lucide-react";
import type { CustomerRef } from "@/domain/project";
import { api } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/use-async";
import { cn } from "../ui/cn";
import { inputClasses } from "../ui/field";

export function CustomerPicker({
  selected,
  query,
  onQuery,
  onSelect,
  onCreate,
  onClear,
  creating,
  error,
}: {
  selected: CustomerRef | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (c: CustomerRef) => void;
  onCreate: (name: string) => void;
  onClear: () => void;
  creating: boolean;
  error?: string | null;
}) {
  const [focused, setFocused] = useState(false);
  const debounced = useDebounced(query.trim(), 200);
  const list = useAsync((signal) => api.listCustomers(debounced, signal), [debounced]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control border border-wood-400 bg-wood-50 px-4 py-3" data-testid="selected-customer">
        <div className="flex min-w-0 items-center gap-3">
          <User className="size-6 shrink-0 text-wood-600" aria-hidden />
          <span className="truncate text-lg font-bold">{selected.name}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-3 font-semibold text-wood-700 hover:bg-wood-100"
        >
          <X className="size-4" aria-hidden /> החלפה
        </button>
      </div>
    );
  }

  const exact = list.data?.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase());
  const matches = (list.data ?? []).slice(0, 5);
  const showList = focused && (matches.length > 0 || (query.trim() && !exact));

  return (
    <div className="relative">
      <input
        id="customer-input"
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="הקלידו שם לקוח, או בחרו מהרשימה"
        autoComplete="off"
        maxLength={120}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "customer-error" : undefined}
        className={inputClasses}
      />
      {error && (
        <p id="customer-error" role="alert" className="mt-1 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
      {showList && (
        <ul
          role="listbox"
          aria-label="לקוחות"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-control border border-sand-200 bg-white shadow-lift"
        >
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onSelect({ id: c.id, name: c.name, phone: c.phone, address: c.address })}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-start hover:bg-cream-100"
              >
                <span className="truncate font-semibold">{c.name}</span>
                {c.phone && (
                  <span dir="ltr" className="shrink-0 text-sm text-ink-500">
                    {c.phone}
                  </span>
                )}
              </button>
            </li>
          ))}
          {query.trim() && !exact && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                disabled={creating}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onCreate(query.trim())}
                className={cn("flex min-h-12 w-full items-center gap-2 px-4 text-start font-semibold text-wood-700 hover:bg-wood-50", matches.length > 0 && "border-t border-sand-200")}
              >
                <Plus className="size-5 shrink-0" aria-hidden />
                <span className="truncate">הוספת ״{query.trim()}״ כלקוח חדש</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
