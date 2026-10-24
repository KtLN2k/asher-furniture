"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { CATEGORY_KEYS, FURNITURE_CATEGORIES, type CategoryKey } from "@/domain/catalog";
import { DEFAULT_LIMITS, limitsProblem, type DimLimit, type GeneralLimits, type Limits } from "@/domain/limits";
import { api } from "@/lib/api";
import { invalidateLibraryCache } from "@/lib/use-library";
import { useAsync } from "@/lib/use-async";
import { NumberStepper } from "../planner/atoms";
import { Button } from "../ui/button";
import { Card, ErrorNotice, LoadingBlock } from "../ui/misc";
import { useToast } from "../ui/toast";

const DIM_FIELDS: Array<{ key: keyof DimLimit; label: string }> = [
  { key: "minWidthMm", label: "רוחב מינימלי" },
  { key: "maxWidthMm", label: "רוחב מקסימלי" },
  { key: "minHeightMm", label: "גובה מינימלי" },
  { key: "maxHeightMm", label: "גובה מקסימלי" },
  { key: "minDepthMm", label: "עומק מינימלי" },
  { key: "maxDepthMm", label: "עומק מקסימלי" },
];

const GENERAL_FIELDS: Array<{ key: keyof GeneralLimits; label: string; hint: string }> = [
  { key: "maxHingedDoorWidthMm", label: "רוחב מקסימלי לדלת ציר", hint: "מעל זה המערכת מתריעה שהדלת רחבה מדי" },
  { key: "minDoorWidthMm", label: "רוחב מינימלי לדלת", hint: "דלת צרה מזה לא תיווצר אוטומטית" },
  { key: "maxDoorHeightMm", label: "גובה מקסימלי לדלת", hint: "דלת גבוהה מזה תקבל אזהרה" },
  { key: "maxSlidingDoorWidthMm", label: "רוחב מקסימלי לדלת הזזה", hint: "לכל דלת הזזה" },
  { key: "maxShelfSpanMm", label: "מרווח מקסימלי למדף", hint: "מדף רחב מזה עלול להתכופף" },
  { key: "minCompartmentWidthMm", label: "רוחב מינימלי לתא", hint: "בחלוקה הפנימית" },
];

const cm = (mm: number) => mm / 10;
const mm = (c: number) => Math.round(c * 10);

export function LimitsEditor() {
  const q = useAsync(() => api.getLimits(), []);
  if (q.loading && !q.data) return <LoadingBlock />;
  if (q.error) return <ErrorNotice message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  return <Form initial={q.data} />;
}

function Form({ initial }: { initial: Limits }) {
  const toast = useToast();
  const [v, setV] = useState<Limits>(initial);
  const [cat, setCat] = useState<CategoryKey>("wardrobes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = limitsProblem(v);

  const setDim = (key: keyof DimLimit, valueMm: number) => setV((c) => ({ ...c, byCategory: { ...c.byCategory, [cat]: { ...c.byCategory[cat], [key]: valueMm } } }));
  const setGeneral = (key: keyof GeneralLimits, valueMm: number) => setV((c) => ({ ...c, general: { ...c.general, [key]: valueMm } }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      setV(await api.updateLimits(v));
      invalidateLibraryCache();
      toast("המגבלות נשמרו");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="limits-editor">
      <p className="max-w-2xl text-ink-600">
        הטווחים שהמערכת בודקת מולם בזמן התכנון. חריגה מהטווח חוסמת המשך (מידות) או מציגה אזהרה (דלתות ומדפים). הערכים ההתחלתיים הם נקודת פתיחה לעריכה, לא תקן ייצור.
      </p>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-bold">טווחי מידות לפי סוג רהיט</h2>
        <div role="tablist" aria-label="סוג רהיט" className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={cat === k}
              onClick={() => setCat(k)}
              data-testid={`limits-tab-${k}`}
              className={`min-h-11 rounded-control border-2 px-3 font-semibold ${cat === k ? "border-wood-600 bg-wood-50 text-wood-700" : "border-sand-300 bg-white text-ink-700"}`}
            >
              {FURNITURE_CATEGORIES.find((c) => c.key === k)?.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          {DIM_FIELDS.map((f) => (
            <NumberStepper
              key={`${cat}-${f.key}`}
              label={f.label}
              testId={`limit-${f.key}`}
              unit="ס״מ"
              step={5}
              min={1}
              max={1000}
              value={cm(v.byCategory[cat][f.key])}
              onCommit={(c) => setDim(f.key, mm(c))}
            />
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-bold">כללים כלליים</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          {GENERAL_FIELDS.map((f) => (
            <NumberStepper
              key={f.key}
              label={f.label}
              hint={f.hint}
              testId={`limit-${f.key}`}
              unit="ס״מ"
              step={5}
              min={1}
              max={1000}
              value={cm(v.general[f.key])}
              onCommit={(c) => setGeneral(f.key, mm(c))}
            />
          ))}
        </div>
      </Card>

      {(problem || error) && (
        <p role="alert" className="font-semibold text-danger-600" data-testid="limits-error">
          {error ?? problem}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void save()} loading={busy} disabled={Boolean(problem)} data-testid="limits-save">
          שמירת מגבלות
        </Button>
        <Button variant="secondary" onClick={() => setV(DEFAULT_LIMITS)}>
          <RotateCcw className="size-4" aria-hidden /> שחזור ערכי התחלה
        </Button>
      </div>
    </div>
  );
}
