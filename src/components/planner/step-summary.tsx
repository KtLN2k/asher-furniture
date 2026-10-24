"use client";

import { Pencil } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BASE_LABELS, DOOR_TYPE_LABELS, PLACEMENT_LABELS, TEMPLATE_LABELS, type TemplateKey } from "@/domain/capabilities";
import { categoryLabel } from "@/domain/catalog";
import { HANDLE_COLOR_INFO, HANDLE_INFO, OPENING_INFO, STYLE_INFO, resolveFacade } from "@/domain/facades";
import { compartmentWidths } from "@/domain/interior";
import { buildLayout } from "@/domain/layout";
import { itemById } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";
import { warningsOf } from "@/domain/validation";
import { LazyViewer } from "../viewer/viewer-lazy";
import { Button } from "../ui/button";
import { Field, TextArea } from "../ui/field";
import { Card } from "../ui/misc";
import { IssueList, Notice } from "./atoms";
import { StepShell, type PlannerStepProps } from "./step-shell";

export type SummaryProps = PlannerStepProps & { goTo: (step: number) => void };

export function StepSummary(props: SummaryProps) {
  return (
    <StepShell step={6} props={props}>
      <Inner {...props} />
    </StepShell>
  );
}

const cm = (mm: number) => (mm / 10).toLocaleString("he-IL", { maximumFractionDigits: 1 });

function Section({ title, step, goTo, children, testId }: { title: string; step: number; goTo: (s: number) => void; children: ReactNode; testId: string }) {
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={() => goTo(step)} data-testid={`edit-step-${step}`}>
          <Pencil className="size-4" aria-hidden /> עריכה
        </Button>
      </div>
      <dl className="divide-y divide-sand-200">{children}</dl>
    </Card>
  );
}

function Row({ k, v, testId }: { k: string; v: ReactNode; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-ink-500">{k}</dt>
      <dd className="min-w-0 break-words text-end font-semibold" data-testid={testId}>
        {v}
      </dd>
    </div>
  );
}

function Inner({ planner, project, session, goTo }: SummaryProps) {
  const { design, library, issues } = planner;
  const spec = resolveSpec(design);
  const layout = useMemo(() => buildLayout(spec), [spec]);
  const m = design.materials ?? {};
  const [notes, setNotes] = useState(design.notes ?? "");

  const name = (id: string | undefined) => itemById(library, id)?.name ?? "—";
  const widths = compartmentWidths(spec.compartments, spec.innerWidthMm, spec.bodyT);
  const template = (design.interior?.template ?? "custom") as TemplateKey;
  const shelves = spec.compartments.reduce((n, c) => n + c.shelves, 0);
  const drawers = spec.compartments.reduce((n, c) => n + c.drawers, 0);
  const rods = spec.compartments.filter((c) => c.hangingRod).length;
  const avail = {
    glass: itemById(library, "fac-glass")?.active ?? false,
    mirror: itemById(library, "fac-mirror")?.active ?? false,
  };
  const doors = layout.doors.map((d) => resolveFacade(design, "door", d.id, d.index, spec.doorType, avail, spec.doorCount));
  const warnings = warningsOf(issues);

  return (
    <div className="flex flex-col gap-6" data-testid="step-summary">
      <div className="h-[22rem] md:h-[30rem]">
        <LazyViewer design={design} library={library} name={project.name || "רהיטי-אשר"} className="h-full" room={planner.room} onRoomChange={planner.setRoom} onRendered={planner.saveThumbnail} />
      </div>

      {warnings.length > 0 && <IssueList issues={warnings} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="פרטי הפרויקט" step={1} goTo={goTo} testId="summary-project">
          <Row k="שם" v={project.name || "—"} />
          <Row k="לקוח" v={project.customer?.name ?? (project.status === "trial" ? "פרויקט ניסיון" : "ללא לקוח")} />
          <Row k="סוג רהיט" v={categoryLabel(design.category) ?? "—"} testId="sum-category" />
        </Section>

        <Section title="מידות ומבנה" step={3} goTo={goTo} testId="summary-dimensions">
          <Row k="רוחב × גובה × עומק" v={<span dir="ltr">{`${cm(spec.widthMm)} × ${cm(spec.heightMm)} × ${cm(spec.depthMm)} ס״מ`}</span>} testId="sum-dims" />
          <Row k="התקנה" v={PLACEMENT_LABELS[spec.placement].label} />
          <Row k="בסיס" v={spec.base === "none" ? BASE_LABELS.none : `${BASE_LABELS[spec.base]} ${cm(spec.baseHeightMm)} ס״מ`} />
          <Row k="סוג דלתות" v={DOOR_TYPE_LABELS[spec.doorType].label} testId="sum-door-type" />
          <Row k="מספר דלתות" v={spec.doorCount} testId="sum-door-count" />
        </Section>

        <Section title="חלוקה פנימית" step={4} goTo={goTo} testId="summary-interior">
          <Row k="תבנית" v={TEMPLATE_LABELS[template]?.label ?? "מותאמת אישית"} />
          <Row k="תאים" v={spec.compartments.length} testId="sum-compartments" />
          <Row k="מדפים" v={shelves} testId="sum-shelves" />
          <Row k="מגירות" v={drawers} testId="sum-drawers" />
          <Row k="מוטות תליה" v={rods} />
          <Row k="רוחב התאים" v={<span dir="ltr">{widths.map((w) => cm(w)).join(" · ")} ס״מ</span>} />
        </Section>

        <Section title="חומרים וצבעים" step={6} goTo={goTo} testId="summary-materials">
          <Row k="גוף" v={`${name(m.bodyMaterialId)} ${m.thicknessMm ?? spec.bodyT} מ״מ`} testId="sum-body-material" />
          <Row k="גימור וצבע גוף" v={`${name(m.bodyFinishId)}, ${name(m.bodyColorId)}`} testId="sum-body-color" />
          <Row k="חזיתות" v={`${name(m.facadeMaterialId)} ${m.facadeThicknessMm ?? spec.facadeT} מ״מ`} />
          <Row k="גימור וצבע חזיתות" v={`${name(m.facadeFinishId)}, ${name(m.facadeColorId)}`} testId="sum-facade-color" />
          <Row k="גב" v={`${name(m.backMaterialId)} ${m.backThicknessMm ?? spec.backT} מ״מ`} />
        </Section>
      </div>

      {doors.length > 0 && (
        <Section title="דלתות וידיות" step={5} goTo={goTo} testId="summary-doors">
          <ul className="flex flex-col divide-y divide-sand-200" data-testid="sum-doors">
            {doors.map((d, i) => (
              <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2" data-testid={`sum-door-${i + 1}`}>
                <span className="font-semibold">דלת {i + 1}</span>
                <span className="text-end text-ink-700">
                  {STYLE_INFO[d.style].label} · {HANDLE_INFO[d.handle].label}
                  {d.handle !== "none" && d.handle !== "push" && d.handle !== "integral" ? ` ${HANDLE_COLOR_INFO[d.handleColor].label}` : ""}
                  {d.opening ? ` · ${OPENING_INFO[d.opening]}` : ""}
                  {d.colorId ? ` · צבע ${name(d.colorId)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Field label="הערות לנגר" optional>
        {(p) => (
          <TextArea
            {...p}
            data-testid="design-notes"
            value={notes}
            maxLength={4000}
            placeholder="פרטים לייצור, בקשות מיוחדות, מידות קיר, מה שחשוב לזכור"
            onChange={(e) => {
              setNotes(e.target.value);
              session.update({ design: { notes: e.target.value } });
            }}
          />
        )}
      </Field>

      <Notice>
        כל זה נשמר אוטומטית. הפקת מסמך לשליחה ללקוח, רשימת חלקים וחיתוכים ותמחור יתווספו בשלבים הבאים של המערכת.
      </Notice>
    </div>
  );
}
