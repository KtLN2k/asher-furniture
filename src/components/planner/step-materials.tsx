"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
  colorAllowed,
  colorHex,
  colorType,
  finishAllowed,
  fixBackSelection,
  fixGroupSelection,
  itemById,
  itemsOf,
  surfaceOf,
  thicknessOptions,
  type GroupSelection,
  type LibraryItem,
} from "@/domain/materials";
import type { FurnitureDesign } from "@/domain/design";
import { resolveSpec } from "@/domain/spec";
import { cn } from "../ui/cn";
import { Block, CardGrid, IssueList, Notice, OptionCard, Segmented } from "./atoms";
import { StepShell, type PlannerStepProps } from "./step-shell";

type Mat = NonNullable<FurnitureDesign["materials"]>;

function Swatch({ color, className }: { color: LibraryItem | undefined; className?: string }) {
  const wood = color?.attrs.type === "wood";
  const hex = colorHex(color);
  return (
    <span
      aria-hidden
      className={cn("block rounded-control border border-black/10", className)}
      style={{
        background: wood
          ? `repeating-linear-gradient(95deg, ${hex} 0 7px, color-mix(in srgb, ${hex} 86%, black) 7px 9px, ${hex} 9px 17px)`
          : hex,
      }}
    />
  );
}

function ColorPicker({
  testPrefix,
  label,
  finish,
  value,
  onPick,
  colors,
}: {
  testPrefix: string;
  label: string;
  finish: LibraryItem | undefined;
  value: string | undefined;
  onPick: (id: string) => void;
  colors: LibraryItem[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-base font-semibold text-ink-700">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {colors.map((c) => {
          const ok = colorAllowed(finish, c);
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={!ok.ok || undefined}
              data-testid={`${testPrefix}-${c.id}`}
              data-disabled={!ok.ok || undefined}
              onClick={() => ok.ok && onPick(c.id)}
              className={cn(
                "relative flex flex-col gap-1.5 rounded-card border-2 bg-white p-2 text-start transition active:scale-[0.98]",
                selected ? "border-wood-600 ring-4 ring-wood-100" : "border-sand-200 hover:border-wood-400",
                !ok.ok && "cursor-not-allowed opacity-50 hover:border-sand-200",
              )}
            >
              <Swatch color={c} className="h-14 w-full" />
              <span className="px-0.5 text-sm font-bold leading-tight">{c.name}</span>
              <span className="px-0.5 text-xs text-ink-500">{colorType(c) === "wood" ? "דמוי עץ" : "צבע אחיד"}</span>
              {!ok.ok && <span className="px-0.5 text-xs leading-snug text-warn-600">{ok.reason}</span>}
              {selected && (
                <span className="absolute end-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-wood-600 text-white">
                  <Check className="size-4" aria-label="נבחר" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupEditor({
  kind,
  prefix,
  title,
  hint,
  value,
  onChange,
  library,
}: {
  kind: "board" | "facade";
  prefix: "body" | "facade";
  title: string;
  hint: string;
  value: GroupSelection;
  onChange: (sel: GroupSelection, notes: string[]) => void;
  library: PlannerStepProps["planner"]["library"];
}) {
  const materials = useMemo(
    () => itemsOf(library, kind, { activeOnly: true }).filter((m) => (kind === "facade" ? surfaceOf(m) === "opaque" : true)),
    [library, kind],
  );
  const finishes = itemsOf(library, "finish", { activeOnly: true });
  const colors = itemsOf(library, "color", { activeOnly: true });
  const material = itemById(library, value.materialId);
  const finish = itemById(library, value.finishId);
  const thick = thicknessOptions(material);

  const change = (patch: GroupSelection) => {
    const fixed = fixGroupSelection(library, kind, { ...value, ...patch });
    const { notes, ...sel } = fixed;
    onChange(sel, notes);
  };

  return (
    <Block title={title} hint={hint} testId={`materials-${prefix}`}>
      <CardGrid label={`חומר ${title}`} cols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {materials.map((m) => (
          <OptionCard
            key={m.id}
            testId={`${prefix}-material-${m.id}`}
            selected={value.materialId === m.id}
            onClick={() => change({ materialId: m.id })}
            title={m.name}
            hint={`עובי ${thicknessOptions(m).join(" / ")} מ״מ`}
          />
        ))}
      </CardGrid>

      <Segmented
        label="עובי"
        testId={`${prefix}-thickness`}
        value={value.thicknessMm ?? thick[0] ?? 0}
        options={thick.map((t) => ({ value: t, label: `${t} מ״מ` }))}
        onChange={(t) => change({ thicknessMm: t })}
      />

      <Segmented
        label="גימור"
        testId={`${prefix}-finish`}
        value={value.finishId ?? ""}
        options={finishes.map((f) => {
          const ok = finishAllowed(material, f);
          return { value: f.id, label: f.name, disabled: !ok.ok, reason: ok.reason };
        })}
        onChange={(id) => change({ finishId: id })}
      />

      <ColorPicker
        testPrefix={`${prefix}-color`}
        label="צבע / דוגמה"
        finish={finish}
        value={value.colorId}
        colors={colors}
        onPick={(id) => change({ colorId: id })}
      />
    </Block>
  );
}

export function StepMaterials(props: PlannerStepProps) {
  return (
    <StepShell step={6} props={props}>
      <Inner {...props} />
    </StepShell>
  );
}

function Inner({ planner }: PlannerStepProps) {
  const { design, library, issues, apply } = planner;
  const m: Mat = design.materials ?? {};
  const [notes, setNotes] = useState<string[]>([]);
  const backs = itemsOf(library, "back", { activeOnly: true });
  const back = itemById(library, m.backMaterialId);

  const setBody = (sel: GroupSelection, n: string[]) => {
    setNotes(n);
    apply({
      materials: {
        ...m,
        bodyMaterialId: sel.materialId,
        bodyFinishId: sel.finishId,
        bodyColorId: sel.colorId,
        thicknessMm: sel.thicknessMm,
      },
    });
  };
  const setFacade = (sel: GroupSelection, n: string[]) => {
    setNotes(n);
    apply({
      materials: {
        ...m,
        facadeMaterialId: sel.materialId,
        facadeFinishId: sel.finishId,
        facadeColorId: sel.colorId,
        facadeThicknessMm: sel.thicknessMm,
      },
    });
  };
  const setBack = (patch: { materialId?: string; thicknessMm?: number }) => {
    const fixed = fixBackSelection(library, { materialId: m.backMaterialId, thicknessMm: m.backThicknessMm, ...patch });
    setNotes([]);
    apply({ materials: { ...m, backMaterialId: fixed.materialId, backThicknessMm: fixed.thicknessMm } });
  };

  const noDoors = resolveSpec(design).doorType === "none";

  return (
    <div className="flex flex-col gap-8" data-testid="step-materials">
      {notes.length > 0 && (
        <div data-testid="materials-notes" className="flex flex-col gap-2">
          {notes.map((n) => (
            <Notice key={n}>{n}</Notice>
          ))}
        </div>
      )}
      <IssueList issues={issues} step={6} />

      <GroupEditor
        kind="board"
        prefix="body"
        title="גוף הרהיט"
        hint="הצדדים, המדפים והמחיצות. רק גימורים וצבעים שמתאימים לחומר נבחרים זמינים."
        value={{ materialId: m.bodyMaterialId, finishId: m.bodyFinishId, colorId: m.bodyColorId, thicknessMm: m.thicknessMm }}
        onChange={setBody}
        library={library}
      />

      {noDoors ? (
        <Notice>בחרתם רהיט בלי דלתות, ולכן אין חזיתות לדלתות. חזיתות מגירות עדיין נלקחות מהבחירה כאן.</Notice>
      ) : null}
      <GroupEditor
        kind="facade"
        prefix="facade"
        title="חזיתות (דלתות ומגירות)"
        hint="ברירת המחדל לכל החזיתות. אפשר לשנות צבע לדלת בודדת בשלב החזיתות."
        value={{ materialId: m.facadeMaterialId, finishId: m.facadeFinishId, colorId: m.facadeColorId, thicknessMm: m.facadeThicknessMm }}
        onChange={setFacade}
        library={library}
      />
      <Notice>
        זכוכית ומראה נבחרות לכל דלת בנפרד בשלב החזיתות (סגנון ״זכוכית״ או ״מראה״).
      </Notice>

      <Block title="גב הרהיט" hint="הלוח הדק שבגב. אינו נראה מבחוץ כשהרהיט צמוד לקיר." testId="materials-back">
        <CardGrid label="חומר גב" cols="grid-cols-2 md:grid-cols-3">
          {backs.map((b) => (
            <OptionCard
              key={b.id}
              testId={`back-material-${b.id}`}
              selected={m.backMaterialId === b.id}
              onClick={() => setBack({ materialId: b.id })}
              title={b.name}
              hint={`עובי ${thicknessOptions(b).join(" / ")} מ״מ`}
            />
          ))}
        </CardGrid>
        <Segmented
          label="עובי גב"
          testId="back-thickness"
          value={m.backThicknessMm ?? 0}
          options={thicknessOptions(back).map((t) => ({ value: t, label: `${t} מ״מ` }))}
          onChange={(t) => setBack({ thicknessMm: t })}
        />
      </Block>
    </div>
  );
}
