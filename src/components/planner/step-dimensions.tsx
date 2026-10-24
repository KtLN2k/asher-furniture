"use client";

import { capsFor, BASE_LABELS, PLACEMENT_LABELS, suggestDoorCount } from "@/domain/capabilities";
import { setDimensions, setStructure } from "@/domain/edit";
import type { Placement } from "@/domain/design";
import { resolveSpec } from "@/domain/spec";
import { warningsOf } from "@/domain/validation";
import { CardGrid, Block, IssueList, NumberStepper, OptionCard, Segmented, Notice } from "./atoms";
import { ElevationSvg } from "./elevation";
import { StepShell, type PlannerStepProps } from "./step-shell";
import { Card } from "../ui/misc";

const cm = (mm: number) => mm / 10;

function PlacementArt({ placement }: { placement: Placement }) {
  return (
    <svg viewBox="0 0 120 80" className="block w-full" aria-hidden>
      <rect width="120" height="80" fill="#f5efe4" />
      <rect x="0" y="62" width="120" height="18" fill="#e7dac6" />
      {placement === "wall-hung" && <rect x="0" y="0" width="120" height="62" fill="#e2dad0" />}
      {placement === "floor" && (
        <>
          <rect x="30" y="14" width="60" height="44" rx="2" fill="#fbf9f5" stroke="#cdb998" />
          <rect x="34" y="58" width="52" height="4" fill="#6a5a4c" />
        </>
      )}
      {placement === "legs" && (
        <>
          <rect x="30" y="14" width="60" height="40" rx="2" fill="#fbf9f5" stroke="#cdb998" />
          <rect x="34" y="54" width="3" height="8" fill="#8a8a8c" />
          <rect x="83" y="54" width="3" height="8" fill="#8a8a8c" />
        </>
      )}
      {placement === "wall-hung" && <rect x="30" y="10" width="60" height="34" rx="2" fill="#fbf9f5" stroke="#cdb998" />}
    </svg>
  );
}

export function StepDimensions(props: PlannerStepProps) {
  return (
    <StepShell step={3} props={props}>
      <Inner {...props} />
    </StepShell>
  );
}

function Inner({ planner }: PlannerStepProps) {
  const { design, library, limits, issues, apply } = planner;
  const spec = resolveSpec(design);
  const caps = capsFor(spec.category);
  const lim = limits.byCategory[spec.category];
  const hasDoors = caps.doorTypes.some((t) => t !== "none");
  const err = (id: string) => issues.find((i) => i.id === id && i.level === "error")?.message ?? null;
  const dimErr = (id: string, label: string) => (err(id) ? `${label} מחוץ לטווח המותר` : null);
  const suggested = suggestDoorCount(spec.widthMm, spec.doorType === "none" ? caps.doorTypes.find((t) => t !== "none") ?? "hinged" : spec.doorType);

  const setDims = (patch: Partial<{ widthMm: number; heightMm: number; depthMm: number }>) =>
    apply(setDimensions(design, { widthMm: spec.widthMm, heightMm: spec.heightMm, depthMm: spec.depthMm, ...patch }));

  return (
    <div className="flex flex-col gap-8" data-testid="step-dimensions">
      {caps.note && <Notice>{caps.note}</Notice>}

      <Card className="p-3 sm:p-4" aria-label="המחשת מידות">
        <ElevationSvg design={design} library={library} mode="dimensions" className="max-h-[22rem]" label="המחשת מידות הרהיט עם חיצי מידה" />
        <p className="mt-2 text-center text-sm text-ink-500">
          עומק: <span dir="ltr" data-testid="dim-depth">{cm(spec.depthMm).toLocaleString("he-IL", { maximumFractionDigits: 1 })}</span> ס״מ
        </p>
      </Card>

      <Block title="מידות" hint="בס״מ. הטווח המותר לסוג הרהיט הזה מוצג מתחת לכל שדה.">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          <NumberStepper
            label="רוחב"
            testId="dim-width-input"
            unit="ס״מ"
            value={cm(spec.widthMm)}
            step={5}
            min={10}
            max={1000}
            onCommit={(v) => setDims({ widthMm: Math.round(v * 10) })}
            hint={`מותר ${cm(lim.minWidthMm)}–${cm(lim.maxWidthMm)}`}
            error={dimErr("width", "הרוחב")}
          />
          <NumberStepper
            label="גובה"
            testId="dim-height-input"
            unit="ס״מ"
            value={cm(spec.heightMm)}
            step={5}
            min={10}
            max={400}
            onCommit={(v) => setDims({ heightMm: Math.round(v * 10) })}
            hint={`מותר ${cm(lim.minHeightMm)}–${cm(lim.maxHeightMm)}`}
            error={dimErr("height", "הגובה")}
          />
          <NumberStepper
            label="עומק"
            testId="dim-depth-input"
            unit="ס״מ"
            value={cm(spec.depthMm)}
            step={2}
            min={5}
            max={200}
            onCommit={(v) => setDims({ depthMm: Math.round(v * 10) })}
            hint={`מותר ${cm(lim.minDepthMm)}–${cm(lim.maxDepthMm)}`}
            error={dimErr("depth", "העומק")}
          />
        </div>
      </Block>

      <Block title="מבנה">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          {hasDoors && (
            <NumberStepper
              label="מספר דלתות"
              testId="door-count-input"
              value={spec.doorCount}
              min={0}
              max={16}
              decimals={0}
              onCommit={(v) => apply(setStructure(design, { doorCount: v }))}
              hint={spec.doorCount === 0 ? "ללא דלתות" : spec.doorCount === suggested ? "מותאם אוטומטית לרוחב" : `מומלץ ${suggested} לפי הרוחב`}
              error={err("door-wide") ?? err("door-narrow") ?? err("sliding-count")}
            />
          )}
          <NumberStepper
            label="מספר יחידות"
            testId="unit-count-input"
            value={spec.unitCount}
            min={1}
            max={12}
            decimals={0}
            onCommit={(v) => apply(setStructure(design, { unitCount: v }))}
            hint="מודולים שמורכבים זה לצד זה (משפיע על חלוקת התאים)"
          />
        </div>
      </Block>

      <Block title="מיקום" hint="איך הרהיט מוצב">
        <CardGrid label="מיקום הרהיט" cols="grid-cols-1 sm:grid-cols-3">
          {caps.placements.map((p) => (
            <OptionCard
              key={p}
              testId={`placement-${p}`}
              selected={spec.placement === p}
              onClick={() => apply(setStructure(design, { placement: p }))}
              title={PLACEMENT_LABELS[p].label}
              hint={PLACEMENT_LABELS[p].hint}
              preview={<PlacementArt placement={p} />}
            />
          ))}
        </CardGrid>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          {spec.placement === "floor" && (
            <Segmented
              label="בסיס"
              testId="base"
              value={spec.base}
              options={[
                { value: "plinth", label: BASE_LABELS.plinth },
                { value: "none", label: BASE_LABELS.none },
              ]}
              onChange={(b) => apply(setStructure(design, { base: b, ...(b === "none" ? { baseHeightMm: 0 } : { baseHeightMm: undefined }) }))}
            />
          )}
          {spec.placement === "legs" && <Notice>בסיס: רגליים (ממקמים את הרהיט מעל הרצפה).</Notice>}
          {spec.placement === "wall-hung" && <Notice>תלוי על הקיר: אין בסיס.</Notice>}
          {(spec.placement === "legs" || (spec.placement === "floor" && spec.base === "plinth")) && (
            <NumberStepper
              label={spec.placement === "legs" ? "גובה הרגליים" : "גובה הצוקל"}
              testId="base-height-input"
              unit="ס״מ"
              value={cm(spec.baseHeightMm)}
              step={0.5}
              min={1}
              max={40}
              onCommit={(v) => apply(setStructure(design, { baseHeightMm: Math.round(v * 10) }))}
              hint="נכלל בגובה הכולל של הרהיט"
            />
          )}
          {spec.placement === "wall-hung" && (
            <NumberStepper
              label="גובה מהרצפה עד תחתית הרהיט"
              testId="mount-height-input"
              unit="ס״מ"
              value={cm(spec.mountHeightMm)}
              step={5}
              min={0}
              max={200}
              onCommit={(v) => apply(setStructure(design, { mountHeightMm: Math.round(v * 10) }))}
            />
          )}
        </div>
        <Segmented
          label="התקנה"
          testId="installation"
          value={design.structure?.installation ?? "freestanding"}
          options={[
            { value: "freestanding", label: "עומד חופשי" },
            { value: "niche", label: "בנוי בנישה (בין קירות)" },
          ]}
          onChange={(v) => apply(setStructure(design, { installation: v }))}
        />
      </Block>

      <IssueList issues={issues} step={3} />
      {warningsOf(issues, 3).length === 0 && issues.filter((i) => i.step === 3).length === 0 && (
        <Notice tone="ok" testId="dims-ok">
          המידות והמבנה תקינים.
        </Notice>
      )}
    </div>
  );
}
