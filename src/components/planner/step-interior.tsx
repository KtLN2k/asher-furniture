"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TEMPLATE_LABELS, capsFor, type TemplateKey } from "@/domain/capabilities";
import { addCompartmentTo, editCompartment, equalizeCompartments, removeCompartmentAt, resizeCompartment, selectTemplate } from "@/domain/edit";
import { compartmentWidths, maxDrawers, maxShelves, rodAllowed } from "@/domain/interior";
import { buildLayout } from "@/domain/layout";
import { resolveSpec } from "@/domain/spec";
import { Block, CardGrid, IssueList, NumberStepper, OptionCard, Segmented, Notice } from "./atoms";
import { ElevationSvg } from "./elevation";
import { StepShell, type PlannerStepProps } from "./step-shell";
import { Button } from "../ui/button";
import { Card } from "../ui/misc";

export function StepInterior(props: PlannerStepProps) {
  return (
    <StepShell step={4} props={props}>
      <Inner {...props} />
    </StepShell>
  );
}

function Inner({ planner }: PlannerStepProps) {
  const { design, library, issues, apply } = planner;
  const spec = resolveSpec(design);
  const layout = buildLayout(spec);
  const caps = capsFor(spec.category);
  const [selected, setSelected] = useState(0);
  const sel = Math.min(selected, spec.compartments.length - 1);
  const comp = spec.compartments[sel];
  const compLayout = layout.compartments[sel];
  const widths = compartmentWidths(spec.compartments, spec.innerWidthMm, spec.bodyT);
  const template = (design.interior?.template ?? caps.defaultTemplate) as TemplateKey;

  const canOpen = spec.doorCount > 0 && spec.doorType !== "sliding";
  const atEdge = sel === 0 || sel === spec.compartments.length - 1;
  const othersClosed = spec.compartments.some((c, i) => i !== sel && !c.open);
  const openDisabledReason = !atEdge ? "תא פתוח אפשרי רק בקצה הארון" : !othersClosed && !comp.open ? "חייב להישאר לפחות תא אחד סגור" : undefined;

  const edit = (change: Parameters<typeof editCompartment>[2]) => apply(editCompartment(design, sel, change));
  const maxS = maxShelves(comp, spec.innerHeightMm);
  const maxD = maxDrawers(comp, spec.innerHeightMm);

  return (
    <div className="flex flex-col gap-8" data-testid="step-interior">
      <Block title="תבנית" hint="בחרו סידור מוכן, ואז אפשר להתאים כל תא בנפרד.">
        <CardGrid label="תבניות חלוקה פנימית" cols="grid-cols-2 md:grid-cols-3">
          {caps.templates.map((key) => {
            const previewDesign = key === "custom" ? design : { ...design, interior: selectTemplate(design, key).interior };
            return (
              <OptionCard
                key={key}
                testId={`template-${key}`}
                selected={template === key}
                onClick={() => apply(selectTemplate(design, key))}
                title={TEMPLATE_LABELS[key].label}
                hint={TEMPLATE_LABELS[key].hint}
                preview={<ElevationSvg design={previewDesign} library={library} mode="mini" className="max-h-28" label={`תצוגה מקדימה: ${TEMPLATE_LABELS[key].label}`} />}
              />
            );
          })}
        </CardGrid>
      </Block>

      <Block title="חלוקה לתאים" hint="לחצו על תא באיור כדי לערוך אותו.">
        <Card className="p-3 sm:p-4">
          <ElevationSvg design={design} library={library} mode="interior" selectedComp={sel} onSelectComp={setSelected} className="max-h-[24rem]" label="חלוקה פנימית: בחירת תא לעריכה" />
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" data-testid="add-compartment" onClick={() => apply(addCompartmentTo(design))} disabled={spec.compartments.length >= 10}>
            <Plus className="size-5" aria-hidden /> הוספת תא
          </Button>
          <Button variant="secondary" data-testid="equalize" onClick={() => apply(equalizeCompartments(design))} disabled={spec.compartments.length < 2}>
            חלוקת רוחב שווה
          </Button>
        </div>
      </Block>

      <Block title={`תא ${sel + 1} מתוך ${spec.compartments.length}`} testId="compartment-editor">
        <Card className="flex flex-col gap-5 p-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-4">
            <NumberStepper
              label="רוחב התא"
              testId="comp-width-input"
              unit="ס״מ"
              value={widths[sel] / 10}
              step={5}
              min={5}
              max={600}
              onCommit={(v) => apply(resizeCompartment(design, sel, v * 10))}
              hint={spec.compartments.length === 1 ? "תא יחיד תופס את כל הרוחב" : "שאר התאים מתאימים את עצמם"}
            />
            <NumberStepper
              label="מדפים"
              testId="comp-shelves-input"
              value={comp.shelves}
              min={0}
              max={maxS}
              decimals={0}
              onCommit={(v) => edit({ shelves: v })}
              hint={`עד ${maxS} בתא הזה`}
            />
            <NumberStepper
              label="מגירות"
              testId="comp-drawers-input"
              value={comp.drawers}
              min={0}
              max={maxD}
              decimals={0}
              onCommit={(v) => edit({ drawers: v })}
              hint={`עד ${maxD} בתא הזה`}
            />
          </div>

          {caps.allowRod ? (
            <Segmented
              label="מוט תלייה"
              testId="rod"
              value={comp.hangingRod}
              options={[
                { value: "none", label: "ללא" },
                { value: "short", label: "תלייה קצרה", ...disabledFrom(rodAllowed(comp, "short", spec.innerHeightMm)) },
                { value: "long", label: "תלייה ארוכה", ...disabledFrom(rodAllowed(comp, "long", spec.innerHeightMm)) },
              ]}
              onChange={(v) => edit({ hangingRod: v })}
            />
          ) : (
            <p className="text-sm text-ink-500">מוט תלייה לא רלוונטי לסוג הרהיט הזה.</p>
          )}

          {canOpen ? (
            <div className="flex flex-col gap-1">
              <label className={`flex min-h-12 items-center gap-3 rounded-control border border-sand-300 bg-white px-4 ${openDisabledReason ? "opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  data-testid="comp-open"
                  className="size-5 accent-[var(--color-wood-600)]"
                  checked={Boolean(comp.open)}
                  disabled={Boolean(openDisabledReason)}
                  onChange={(e) => edit({ open: e.target.checked })}
                />
                <span className="font-semibold">תא פתוח (בלי דלת)</span>
              </label>
              {openDisabledReason && <p className="text-sm text-warn-600">{openDisabledReason}</p>}
            </div>
          ) : (
            spec.doorCount > 0 && <p className="text-sm text-ink-500">בדלתות הזזה כל התאים נסגרים מאחורי הדלתות.</p>
          )}

          {compLayout.elements.rod && (
            <p className="text-sm text-ink-500">גובה פנוי לתלייה: {Math.round(compLayout.elements.rod.clearMm / 10)} ס״מ</p>
          )}

          <div>
            <Button variant="danger-ghost" size="sm" data-testid="remove-compartment" onClick={() => apply(removeCompartmentAt(design, sel))} disabled={spec.compartments.length <= 1}>
              <Trash2 className="size-5" aria-hidden /> הסרת התא
            </Button>
          </div>
        </Card>
        {template === "custom" && <Notice>החלוקה מותאמת אישית. בחירת תבנית אחרת תחליף אותה.</Notice>}
      </Block>

      <IssueList issues={issues} step={4} />
    </div>
  );
}

function disabledFrom(r: { ok: boolean; reason?: string }) {
  return r.ok ? {} : { disabled: true, reason: r.reason };
}
