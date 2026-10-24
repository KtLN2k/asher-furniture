"use client";

import { useState } from "react";
import type { Customer } from "@/domain/project";
import { Button } from "../ui/button";
import { Field, TextArea, TextInput } from "../ui/field";

export interface CustomerFormValues {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export function CustomerForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Customer>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (v: CustomerFormValues) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<CustomerFormValues>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  });
  const [touched, setTouched] = useState(false);
  const nameError = touched && !v.name.trim() ? "יש להזין שם לקוח" : null;
  const set = (k: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (v.name.trim()) onSubmit({ ...v, name: v.name.trim() });
      }}
    >
      <Field label="שם הלקוח" error={nameError}>
        {(p) => <TextInput {...p} value={v.name} onChange={set("name")} maxLength={120} autoComplete="name" placeholder="לדוגמה: משפחת לוי" />}
      </Field>
      <Field label="טלפון" optional>
        {(p) => <TextInput {...p} type="tel" inputMode="tel" dir="ltr" className="text-end" value={v.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" placeholder="050-1234567" />}
      </Field>
      <Field label="כתובת" optional>
        {(p) => <TextInput {...p} value={v.address} onChange={set("address")} maxLength={200} autoComplete="street-address" />}
      </Field>
      <Field label="הערות" optional>
        {(p) => <TextArea {...p} value={v.notes} onChange={set("notes")} maxLength={2000} />}
      </Field>
      {error && (
        <p role="alert" className="font-medium text-danger-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
}
