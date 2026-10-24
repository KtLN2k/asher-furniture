"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { invalidateLibraryCache } from "@/lib/use-library";
import { useAsync } from "@/lib/use-async";
import {
  COLOR_TYPE_LABELS,
  LIBRARY_KINDS,
  LIBRARY_KIND_LABELS,
  allowedFinishIds,
  colorHex,
  colorType,
  finishColorTypes,
  finishRoughness,
  itemsOf,
  surfaceOf,
  thicknessOptions,
  type ColorType,
  type LibraryItem,
  type LibraryKind,
  type Surface,
} from "@/domain/materials";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { ConfirmDialog, Dialog } from "../ui/dialog";
import { Field, TextInput } from "../ui/field";
import { Card, ErrorNotice, LoadingBlock } from "../ui/misc";
import { useToast } from "../ui/toast";

const SURFACE_LABELS: Record<Surface, string> = { opaque: "אטום (לוח)", glass: "זכוכית", mirror: "מראה" };
const KIND_HINTS: Record<LibraryKind, string> = {
  board: "חומרי הגוף: צדדים, מדפים ומחיצות. לכל חומר עוביים וגימורים מותרים.",
  facade: "חומרי חזיתות לדלתות ולמגירות. זכוכית ומראה הן משטחים מיוחדים.",
  back: "חומרי הגב של הרהיט.",
  finish: "גימורים. לכל גימור נקבע אילו סוגי צבע מותרים, וכמה הוא מט או מבריק בהדמיה.",
  color: "צבעים ודוגמאות עץ שמופיעים בבחירה. רק צבעים שמתאימים לגימור יוצעו.",
};

function parseThicknesses(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((x) => Number(x.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n));
}

interface Draft {
  id?: string;
  kind: LibraryKind;
  name: string;
  active: boolean;
  thicknesses: string;
  finishIds: string[];
  surface: Surface;
  roughness: number;
  colorTypes: ColorType[];
  hex: string;
  ctype: ColorType;
  texture: "oak" | "walnut";
}

function draftOf(kind: LibraryKind, item?: LibraryItem): Draft {
  return {
    id: item?.id,
    kind,
    name: item?.name ?? "",
    active: item?.active ?? true,
    thicknesses: item ? thicknessOptions(item).join(", ") : "18",
    finishIds: item ? allowedFinishIds(item) : [],
    surface: item ? surfaceOf(item) : "opaque",
    roughness: item ? finishRoughness(item) : 0.6,
    colorTypes: item ? finishColorTypes(item) : ["solid"],
    hex: item ? colorHex(item) : "#cccccc",
    ctype: item ? colorType(item) : "solid",
    texture: item?.attrs.texture === "walnut" ? "walnut" : "oak",
  };
}

function attrsOf(d: Draft): Record<string, unknown> {
  switch (d.kind) {
    case "board":
      return { thicknessesMm: parseThicknesses(d.thicknesses), finishIds: d.finishIds };
    case "facade":
      return { thicknessesMm: parseThicknesses(d.thicknesses), finishIds: d.surface === "opaque" ? d.finishIds : [], surface: d.surface };
    case "back":
      return { thicknessesMm: parseThicknesses(d.thicknesses) };
    case "finish":
      return { roughness: d.roughness, colorTypes: d.colorTypes };
    case "color":
      return d.ctype === "wood" ? { hex: d.hex, type: "wood", texture: d.texture } : { hex: d.hex, type: "solid" };
  }
}

function Swatch({ item }: { item: LibraryItem }) {
  if (item.kind !== "color") return null;
  const hex = colorHex(item);
  return (
    <span
      aria-hidden
      className="size-9 shrink-0 rounded-control border border-black/10"
      style={{
        background:
          colorType(item) === "wood"
            ? `repeating-linear-gradient(95deg, ${hex} 0 6px, color-mix(in srgb, ${hex} 85%, black) 6px 8px, ${hex} 8px 14px)`
            : hex,
      }}
    />
  );
}

function describe(item: LibraryItem, library: LibraryItem[]): string {
  const finishName = (id: string) => library.find((m) => m.id === id)?.name ?? id;
  switch (item.kind) {
    case "board":
    case "facade":
      return `עובי ${thicknessOptions(item).join(" / ")} מ״מ${
        item.kind === "facade" && surfaceOf(item) !== "opaque" ? ` · ${SURFACE_LABELS[surfaceOf(item)]}` : ` · גימורים: ${allowedFinishIds(item).map(finishName).join(", ") || "—"}`
      }`;
    case "back":
      return `עובי ${thicknessOptions(item).join(" / ")} מ״מ`;
    case "finish":
      return `${finishColorTypes(item).map((t) => COLOR_TYPE_LABELS[t]).join(" ו")} · ${finishRoughness(item) >= 0.55 ? "מט" : "חצי מבריק"}`;
    case "color":
      return `${COLOR_TYPE_LABELS[colorType(item)]} · ${colorHex(item)}`;
  }
}

export function LibraryEditor() {
  const list = useAsync(() => api.listMaterials(), []);
  const toast = useToast();
  const [kind, setKind] = useState<LibraryKind>("board");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<LibraryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const library = useMemo(() => list.data ?? [], [list.data]);
  const items = itemsOf(library, kind);
  const finishes = itemsOf(library, "finish");

  const refresh = () => {
    invalidateLibraryCache();
    list.reload();
  };

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const attrs = attrsOf(draft);
      if (draft.id) await api.patchMaterial(draft.id, { name: draft.name, active: draft.active, attrs });
      else await api.createMaterial({ kind: draft.kind, name: draft.name, active: draft.active, attrs });
      toast(draft.id ? "הפריט עודכן" : "הפריט נוסף");
      setDraft(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: LibraryItem) {
    try {
      await api.patchMaterial(item.id, { active: !item.active });
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api.deleteMaterial(toDelete.id);
      toast("הפריט נמחק");
      setToDelete(null);
      refresh();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (list.loading && !list.data) return <LoadingBlock />;
  if (list.error) return <ErrorNotice message={list.error} onRetry={list.reload} />;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const toggleIn = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="flex flex-col gap-4" data-testid="library-editor">
      <p className="max-w-2xl text-ink-600">
        כאן מגדירים אילו חומרים, עוביים, גימורים וצבעים זמינים בתכנון, ואילו שילובים מותרים. הערכים ההתחלתיים הם דוגמאות לתכנון בלבד, ולא מחירון או מפרט ייצור.
      </p>
      <div role="tablist" aria-label="סוגי פריטים בספרייה" className="flex flex-wrap gap-2">
        {LIBRARY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            data-testid={`lib-tab-${k}`}
            onClick={() => setKind(k)}
            className={cn(
              "min-h-12 rounded-control border-2 px-4 font-semibold transition",
              kind === k ? "border-wood-600 bg-wood-50 text-wood-700" : "border-sand-300 bg-white text-ink-700 hover:border-wood-400",
            )}
          >
            {LIBRARY_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="text-ink-500">{KIND_HINTS[kind]}</p>

      <ul className="flex flex-col gap-2" data-testid="lib-list">
        {items.map((item) => (
          <li key={item.id}>
            <Card className={cn("flex flex-wrap items-center gap-3 p-3", !item.active && "opacity-70")} data-testid={`lib-item-${item.id}`}>
              <Swatch item={item} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {item.name}
                  {!item.active && <span className="ms-2 rounded-full bg-sand-200 px-2 py-0.5 text-sm font-medium text-ink-600">מושבת</span>}
                </p>
                <p className="text-sm text-ink-500">{describe(item, library)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void toggle(item)} data-testid={`lib-toggle-${item.id}`}>
                {item.active ? "השבתה" : "הפעלה"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setError(null); setDraft(draftOf(kind, item)); }} data-testid={`lib-edit-${item.id}`}>
                <Pencil className="size-4" aria-hidden /> עריכה
              </Button>
              <Button variant="danger-ghost" size="sm" onClick={() => { setDeleteError(null); setToDelete(item); }} aria-label={`מחיקת ${item.name}`}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </Card>
          </li>
        ))}
        {items.length === 0 && <li className="text-ink-500">אין פריטים בקטגוריה הזו.</li>}
      </ul>
      <div>
        <Button onClick={() => { setError(null); setDraft(draftOf(kind)); }} data-testid="lib-add">
          <Plus className="size-5" aria-hidden /> הוספת פריט ל{LIBRARY_KIND_LABELS[kind]}
        </Button>
      </div>

      <Dialog
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? "עריכת פריט" : "פריט חדש"}
        footer={
          <>
            <Button onClick={() => void save()} loading={busy} data-testid="lib-save">
              שמירה
            </Button>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
              ביטול
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4" data-testid="lib-form">
            <Field label="שם">{(p) => <TextInput {...p} data-testid="lib-name" value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />}</Field>

            {(draft.kind === "board" || draft.kind === "facade" || draft.kind === "back") && (
              <Field label="עוביים זמינים (מ״מ)" hint="מספרים מופרדים בפסיק, למשל 17, 18, 25">
                {(p) => <TextInput {...p} data-testid="lib-thicknesses" dir="ltr" className="text-end" value={draft.thicknesses} onChange={(e) => set({ thicknesses: e.target.value })} />}
              </Field>
            )}

            {draft.kind === "facade" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-base font-semibold text-ink-700">סוג משטח</legend>
                {(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => (
                  <label key={s} className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="surface" className="size-5 accent-wood-600" checked={draft.surface === s} onChange={() => set({ surface: s })} />
                    {SURFACE_LABELS[s]}
                  </label>
                ))}
              </fieldset>
            )}

            {(draft.kind === "board" || (draft.kind === "facade" && draft.surface === "opaque")) && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-base font-semibold text-ink-700">גימורים מותרים לחומר</legend>
                {finishes.map((f) => (
                  <label key={f.id} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" className="size-5 accent-wood-600" data-testid={`lib-finish-${f.id}`} checked={draft.finishIds.includes(f.id)} onChange={() => set({ finishIds: toggleIn(draft.finishIds, f.id) })} />
                    {f.name}
                  </label>
                ))}
              </fieldset>
            )}

            {draft.kind === "finish" && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-semibold text-ink-700">
                    ברק בהדמיה: <span dir="ltr">{draft.roughness.toFixed(2)}</span> <span className="font-normal text-ink-500">(0 מבריק, 1 מט)</span>
                  </span>
                  <input type="range" min={0} max={1} step={0.05} value={draft.roughness} onChange={(e) => set({ roughness: Number(e.target.value) })} className="accent-wood-600" />
                </label>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-base font-semibold text-ink-700">סוגי צבע מותרים</legend>
                  {(Object.keys(COLOR_TYPE_LABELS) as ColorType[]).map((t) => (
                    <label key={t} className="flex min-h-11 items-center gap-3">
                      <input type="checkbox" className="size-5 accent-wood-600" checked={draft.colorTypes.includes(t)} onChange={() => set({ colorTypes: toggleIn(draft.colorTypes, t) })} />
                      {COLOR_TYPE_LABELS[t]}
                    </label>
                  ))}
                </fieldset>
              </>
            )}

            {draft.kind === "color" && (
              <>
                <div className="flex items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-base font-semibold text-ink-700">גוון</span>
                    <input type="color" aria-label="בחירת גוון" value={draft.hex} onChange={(e) => set({ hex: e.target.value })} className="h-12 w-16 cursor-pointer rounded-control border border-sand-300 bg-white p-1" />
                  </label>
                  <Field label="קוד צבע">
                    {(p) => <TextInput {...p} data-testid="lib-hex" dir="ltr" className="text-end" value={draft.hex} maxLength={7} onChange={(e) => set({ hex: e.target.value })} />}
                  </Field>
                </div>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-base font-semibold text-ink-700">סוג</legend>
                  {(Object.keys(COLOR_TYPE_LABELS) as ColorType[]).map((t) => (
                    <label key={t} className="flex min-h-11 items-center gap-3">
                      <input type="radio" name="ctype" className="size-5 accent-wood-600" checked={draft.ctype === t} onChange={() => set({ ctype: t })} />
                      {COLOR_TYPE_LABELS[t]}
                    </label>
                  ))}
                </fieldset>
                {draft.ctype === "wood" && (
                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-base font-semibold text-ink-700">דוגמת עץ בהדמיה</legend>
                    {(["oak", "walnut"] as const).map((t) => (
                      <label key={t} className="flex min-h-11 items-center gap-3">
                        <input type="radio" name="texture" className="size-5 accent-wood-600" checked={draft.texture === t} onChange={() => set({ texture: t })} />
                        {t === "oak" ? "אלון (גרגר רחב)" : "אגוז (גרגר צפוף)"}
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}

            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" className="size-5 accent-wood-600" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
              פעיל (מוצג בבחירה בתכנון)
            </label>
            {error && (
              <p role="alert" className="font-medium text-danger-600" data-testid="lib-error">
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={() => void remove()} title="מחיקת פריט" confirmLabel="מחיקה" busy={busy}>
        <p>למחוק את ״{toDelete?.name}״ מהספרייה? אפשר גם להשבית אותו במקום.</p>
        {deleteError && (
          <p role="alert" className="mt-3 font-medium text-danger-600">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
