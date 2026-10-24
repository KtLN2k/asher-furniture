"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import type { ShopSettings } from "@/domain/project";
import { PageContainer, PageHeader } from "./shell/page";
import { Button } from "./ui/button";
import { cn } from "./ui/cn";
import { LibraryEditor } from "./settings/library-editor";
import { LimitsEditor } from "./settings/limits-editor";
import { DeviceSettings } from "./settings/device-settings";
import { IS_STATIC_APP } from "@/lib/app-env";
import { Field, TextInput } from "./ui/field";
import { Card, ErrorNotice, LoadingBlock } from "./ui/misc";
import { useToast } from "./ui/toast";

const TABS = [
  { key: "shop", label: "פרטי העסק" },
  { key: "library", label: "ספריית חומרים" },
  { key: "limits", label: "מגבלות מידות" },
  // באפליקציה הארוזה בלבד: אחסון במכשיר וחיבור לשרת
  ...(IS_STATIC_APP ? [{ key: "device", label: "מכשיר וחיבור" }] : []),
] as const;

export function SettingsView() {
  const s = useAsync(() => api.getSettings(), []);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("shop");
  return (
    <PageContainer>
      <PageHeader title="הגדרות" subtitle="פרטי העסק, חומרים וגימורים, ומגבלות התכנון של הנגרייה." />
      <div role="tablist" aria-label="אזורי הגדרות" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`settings-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-12 rounded-control border-2 px-5 text-lg font-semibold transition",
              tab === t.key ? "border-wood-600 bg-wood-50 text-wood-700" : "border-sand-300 bg-white text-ink-700 hover:border-wood-400",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "shop" && (
        <>
          {s.loading && !s.data && <LoadingBlock />}
          {s.error && <ErrorNotice message={s.error} onRetry={s.reload} />}
          {s.data && <SettingsForm initial={s.data} />}
        </>
      )}
      {tab === "library" && <LibraryEditor />}
      {tab === "limits" && <LimitsEditor />}
      {tab === "device" && <DeviceSettings />}
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
