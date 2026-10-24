"use client";

import { useState } from "react";
import { DOOR_TYPE_LABELS } from "@/domain/capabilities";
import { capsFor } from "@/domain/capabilities";
import { setDoorType } from "@/domain/edit";
import type { DoorType } from "@/domain/design";
import {
  HANDLE_COLOR_INFO,
  POSITION_INFO,
  applyLookToAll,
  handleOptions,
  openingOptions,
  resolveFacade,
  setFacadeDefaults,
  setFacadeOverride,
  showsHandlePosition,
  styleOptions,
  type FacadeKind,
} from "@/domain/facades";
import { buildLayout } from "@/domain/layout";
import { HANDLE_COLORS, HANDLE_POSITIONS } from "@/domain/design";
import { colorAllowed, itemById, itemsOf, surfaceLook, surfaceOf } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";
import { Block, CardGrid, IssueList, OptionCard, Segmented, Notice } from "./atoms";
import { ElevationSvg, type FacadeRef } from "./elevation";
import { HandleArt, StyleArt } from "./facade-art";
import { StepShell, type PlannerStepProps } from "./step-shell";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Card } from "../ui/misc";

export function StepFacades(props: PlannerStepProps) {
  return (
    <StepShell step={5} props={props}>
      <Inner {...props} />
    </StepShell>
  );
}

type Selection = { kind: FacadeKind; id: string | "all" };

function Inner({ planner }: PlannerStepProps) {
  const { design, library, issues, apply } = planner;
  const spec = resolveSpec(design);
  const layout = buildLayout(spec);
  const caps = capsFor(spec.category);
  const avail = {
    glass: itemsOf(library, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "glass"),
    mirror: itemsOf(library, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "mirror"),
  };

  const hasDoors = layout.doors.length > 0;
  const hasDrawers = layout.drawers.length > 0;
  const [sel, setSel] = useState<Selection>({ kind: "door", id: "all" });
  const kind: FacadeKind = sel.kind === "door" && !hasDoors ? "drawer" : sel.kind === "drawer" && !hasDrawers ? "door" : sel.kind;
  const items = kind === "door" ? layout.doors.map((d) => ({ id: d.id, index: d.index, label: `דלת ${d.index + 1}` })) : layout.drawers.map((d) => ({ id: d.id, index: d.index, label: `תא ${d.compIndex + 1}, מגירה ${d.id.split(":")[1]}`, exposed: d.exposed }));
  const selId = sel.id !== "all" && items.some((i) => i.id === sel.id) ? sel.id : "all";
  const first = items[0];
  const target = selId === "all" ? first : items.find((i) => i.id === selId)!;
  const hasTarget = Boolean(target);

  const look = hasTarget ? resolveFacade(design, kind, target.id, target.index, spec.doorType, avail) : null;
  const facades = design.facades;
  const overrides = (kind === "door" ? facades?.doors : facades?.drawers)?.filter((o) => Object.keys(o).some((k) => k !== "id" && k !== "target")) ?? [];

  type Patch = NonNullable<NonNullable<typeof facades>["defaults"]>;
  const change = (patch: Patch) => {
    if (selId === "all") apply({ facades: setFacadeDefaults(facades, kind, patch) });
    else apply({ facades: setFacadeOverride(facades, kind, selId, patch) });
  };

  const facadeFinish = itemById(library, design.materials?.facadeFinishId);
  const colors = itemsOf(library, "color", { activeOnly: true }).filter((c) => colorAllowed(facadeFinish, c).ok);

  const selectedRefs: FacadeRef[] = (selId === "all" ? items : items.filter((i) => i.id === selId)).map((i) => ({ kind, id: i.id }));
  const hasFacadeItems = hasDoors || hasDrawers;
  const doorTypeNotes = (t: DoorType) => (t === "sliding" && spec.widthMm < 900 ? "מתאים לרוחב של 90 ס״מ ומעלה" : undefined);

  return (
    <div className="flex flex-col gap-8" data-testid="step-facades">
      <Block title="סוג דלת" hint="משפיע על כל הדלתות ברהיט.">
        <CardGrid label="סוג דלת" cols="grid-cols-2 md:grid-cols-4">
          {caps.doorTypes.map((t) => {
            const note = doorTypeNotes(t);
            return (
              <OptionCard
                key={t}
                testId={`doortype-${t}`}
                selected={spec.doorType === t}
                disabled={Boolean(note)}
                reason={note}
                onClick={() => apply(setDoorType(design, t))}
                title={DOOR_TYPE_LABELS[t].label}
                hint={DOOR_TYPE_LABELS[t].hint}
              />
            );
          })}
        </CardGrid>
      </Block>

      {!hasFacadeItems && <Notice>בעיצוב הנוכחי אין דלתות ואין מגירות גלויות. אפשר לבחור סוג דלת למעלה כדי להוסיף.</Notice>}

      {hasFacadeItems && look && (
        <>
          <Block title="מה מעצבים" hint="בחרו דלת או מגירה בציור או ברשימה. אפשר גם לעצב את כולן יחד.">
            {hasDoors && hasDrawers && (
              <Segmented
                label="סוג חזית"
                testId="facade-kind"
                value={kind}
                options={[
                  { value: "door", label: "דלתות" },
                  { value: "drawer", label: "מגירות" },
                ]}
                onChange={(k) => setSel({ kind: k, id: "all" })}
              />
            )}
            <Card className="p-3 sm:p-4">
              <ElevationSvg
                design={design}
                library={library}
                mode="facades"
                selectedFacades={selectedRefs}
                onSelectFacade={(r) => setSel({ kind: r.kind, id: r.id })}
                className="max-h-[24rem]"
                label="חזית הרהיט: בחירת דלת או מגירה לעיצוב"
              />
            </Card>
            <div className="flex flex-wrap gap-2" role="group" aria-label="בחירת פריט">
              <Chip selected={selId === "all"} onClick={() => setSel({ kind, id: "all" })} testId="facade-all">
                {kind === "door" ? "כל הדלתות" : "כל המגירות"}
              </Chip>
              {items.map((i) => (
                <Chip key={i.id} selected={selId === i.id} onClick={() => setSel({ kind, id: i.id })} testId={`facade-chip-${i.id}`}>
                  {i.label}
                </Chip>
              ))}
            </div>
            {kind === "drawer" && items.some((i) => "exposed" in i && !i.exposed) && <p className="text-sm text-ink-500">מגירות שמאחורי דלתות נראות רק כשהדלתות פתוחות, אבל גם להן אפשר להגדיר חזית.</p>}
          </Block>

          <Block title="סגנון חזית" testId="style-block">
            <CardGrid label="סגנון חזית" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {styleOptions(kind, spec.doorType, avail).map((o) => (
                <OptionCard
                  key={o.value}
                  testId={`style-${o.value}`}
                  selected={look.style === o.value}
                  disabled={!o.ok}
                  reason={o.reason}
                  onClick={() => change({ style: o.value })}
                  title={o.label}
                  hint={o.hint}
                  preview={<StyleArt style={o.value} color={surfaceLook(library, design.materials?.facadeColorId, design.materials?.facadeFinishId).hex} />}
                />
              ))}
            </CardGrid>
          </Block>

          <Block title="ידית" testId="handle-block">
            <CardGrid label="סוג ידית" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {handleOptions(kind, spec.doorType, look.style).map((o) => (
                <OptionCard
                  key={o.value}
                  testId={`handle-${o.value}`}
                  selected={look.handle === o.value}
                  disabled={!o.ok}
                  reason={o.reason}
                  onClick={() => change({ handle: o.value })}
                  title={o.label}
                  hint={o.hint}
                  preview={<HandleArt handle={o.value} color={HANDLE_COLOR_INFO[look.handleColor].hex} />}
                />
              ))}
            </CardGrid>
            {look.handle !== "none" && look.handle !== "push" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-base font-semibold text-ink-700">צבע הידית</span>
                <div role="radiogroup" aria-label="צבע ידית" className="flex flex-wrap gap-3">
                  {HANDLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={look.handleColor === c}
                      aria-label={HANDLE_COLOR_INFO[c].label}
                      data-testid={`handle-color-${c}`}
                      onClick={() => change({ handleColor: c })}
                      className={cn("flex min-h-12 items-center gap-2 rounded-control border-2 bg-white px-3 font-semibold transition active:scale-95", look.handleColor === c ? "border-wood-600 bg-wood-50" : "border-sand-300 hover:border-wood-400")}
                    >
                      <span className="size-6 rounded-full border border-black/20" style={{ background: HANDLE_COLOR_INFO[c].hex }} />
                      {HANDLE_COLOR_INFO[c].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showsHandlePosition(kind, spec.doorType, look.handle) && (
              <Segmented
                label="מיקום הידית לגובה"
                testId="handle-position"
                value={look.handlePosition}
                options={HANDLE_POSITIONS.map((p) => ({ value: p, label: POSITION_INFO[p] }))}
                onChange={(p) => change({ handlePosition: p })}
              />
            )}
          </Block>

          {kind === "door" && openingOptions("door", spec.doorType).length > 0 && (
            <Block title="כיוון פתיחה וצירים">
              {selId === "all" ? (
                <Notice>כיוון הפתיחה נקבע לכל דלת בנפרד: בחרו דלת אחת. כרגע הוא אוטומטי, כך שכל זוג דלתות נפתח מהאמצע.</Notice>
              ) : (
                <Segmented
                  label={`כיוון פתיחה: דלת ${target.index + 1}`}
                  testId="opening"
                  value={look.opening ?? "left"}
                  options={openingOptions("door", spec.doorType).map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(o) => change({ opening: o })}
                />
              )}
            </Block>
          )}

          <Block title="צבע מיוחד לחזית" hint="ברירת המחדל היא צבע החזיתות שנבחר בשלב החומרים.">
            <div role="radiogroup" aria-label="צבע חזית" className="flex flex-wrap gap-3">
              <button
                type="button"
                role="radio"
                aria-checked={!look.colorId}
                data-testid="facade-color-default"
                onClick={() => change({ colorId: undefined })}
                className={cn("min-h-12 rounded-control border-2 bg-white px-4 font-semibold", !look.colorId ? "border-wood-600 bg-wood-50" : "border-sand-300 hover:border-wood-400")}
              >
                כמו שאר החזיתות
              </button>
              {colors.map((c) => {
                const l = surfaceLook(library, c.id, design.materials?.facadeFinishId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={look.colorId === c.id}
                    data-testid={`facade-color-${c.id}`}
                    onClick={() => change({ colorId: c.id })}
                    className={cn("flex min-h-12 items-center gap-2 rounded-control border-2 bg-white px-3 font-semibold", look.colorId === c.id ? "border-wood-600 bg-wood-50" : "border-sand-300 hover:border-wood-400")}
                  >
                    <span className="size-6 rounded-full border border-black/20" style={{ background: l.hex }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Block>

          <div className="flex flex-wrap items-center gap-3">
            {selId !== "all" && (
              <Button data-testid="apply-all" variant="secondary" onClick={() => apply({ facades: applyLookToAll(facades, kind, look) })}>
                {kind === "door" ? "החל על כל הדלתות" : "החל על כל המגירות"}
              </Button>
            )}
            {overrides.length > 0 && (
              <Button
                data-testid="reset-overrides"
                variant="ghost"
                onClick={() => apply({ facades: { ...(facades ?? {}), [kind === "door" ? "doors" : "drawers"]: [] } })}
              >
                איפוס הגדרות אישיות ({overrides.length})
              </Button>
            )}
          </div>
        </>
      )}

      <IssueList issues={issues} step={5} />
    </div>
  );
}

function Chip({ selected, onClick, children, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      className={cn("min-h-11 rounded-full border-2 px-4 text-base font-semibold transition active:scale-95", selected ? "border-wood-600 bg-wood-600 text-white" : "border-sand-300 bg-white text-ink-700 hover:border-wood-400")}
    >
      {children}
    </button>
  );
}
