"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import type { ShopSettings } from "@/domain/project";
import { PageContainer, PageHeader } from "./shell/page";
import { Button } from "./ui/button";
import { Field, TextInput } from "./ui/field";
import { Card, ErrorNotice, LoadingBlock } from "./ui/misc";
import { useToast } from "./ui/toast";

export function SettingsView() {
  const s = useAsync(() => api.getSettings(), []);
  return (
    <PageContainer>
      <PageHeader title="הגדרות" subtitle="פרטי העסק של הנגרייה." />
      {s.loading && !s.data && <LoadingBlock />}
      {s.error && <ErrorNotice message={s.error} onRetry={s.reload} />}
      {s.data && <SettingsForm initial={s.data} />}
      <p className="mt-6 max-w-xl text-ink-500">
        ספריית חומרים, עוביי לוחות, גימורים, ידיות ומגבלות מידות יתווספו בשלב התכנון הבא.
      </p>
    </PageContainer>
  );
}

function SettingsForm({ initial }: { initial: ShopSettings }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ShopSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setV((c) => ({ ...c, [k]: e.target.value }));

  return (
    <Card className="max-w-xl p-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            setV(await api.updateSettings(v));
            toast("ההגדרות נשמרו");
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="שם העסק" error={error}>
          {(p) => <TextInput {...p} value={v.businessName} onChange={set("businessName")} maxLength={120} />}
        </Field>
        <Field label="טלפון העסק" optional>
          {(p) => <TextInput {...p} type="tel" dir="ltr" className="text-end" value={v.businessPhone} onChange={set("businessPhone")} maxLength={40} />}
        </Field>
        <Field label="כתובת העסק" optional>
          {(p) => <TextInput {...p} value={v.businessAddress} onChange={set("businessAddress")} maxLength={200} />}
        </Field>
        <div>
          <Button type="submit" loading={busy}>
            שמירה
          </Button>
        </div>
      </form>
    </Card>
  );
}
