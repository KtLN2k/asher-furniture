"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { CATEGORY_KEYS, TOTAL_STEPS, WIZARD_STEPS, type CategoryKey } from "@/domain/catalog";
import { useProjectSession } from "@/lib/use-project-session";
import { cn } from "../ui/cn";
import { Button, IconButton, LinkButton } from "../ui/button";
import { ErrorNotice, LoadingBlock } from "../ui/misc";
import { SaveIndicator } from "./save-indicator";
import { Stepper } from "./stepper";
import { ProjectSummary, StepDetails, StepType, type StepGuard } from "./steps";
import { StepDimensions } from "../planner/step-dimensions";
import { StepInterior } from "../planner/step-interior";
import { StepFacades } from "../planner/step-facades";
import { StepMaterials } from "../planner/step-materials";
import { StepSummary } from "../planner/step-summary";
import { usePlanner } from "../planner/use-planner";
import { useMedia } from "@/lib/use-media";
import { PreviewPanel } from "./preview-panel";

export function WizardRoot({ routeId }: { routeId: string | null }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WizardInner routeId={routeId} />
    </Suspense>
  );
}

function WizardInner({ routeId }: { routeId: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const typeParam = sp.get("type");
  const initialCategory = routeId ? null : (CATEGORY_KEYS.find((k) => k === typeParam) as CategoryKey | undefined) ?? null;

  const session = useProjectSession(routeId, {
    initialCategory,
    onCreated: (p) => window.history.replaceState(null, "", `/projects/${p.id}/wizard?step=1`),
  });
  const { project } = session;

  const guardRef = useRef<StepGuard | null>(null);
  const [stepErrorState, setStepError] = useState<{ step: number; msg: string } | null>(null);
  const [furthestState, setFurthest] = useState(1);
  const [leaving, setLeaving] = useState(false);

  const stepParam = Number(sp.get("step"));
  const stepFromUrl = Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= TOTAL_STEPS ? stepParam : null;
  const step = routeId === null ? 1 : (stepFromUrl ?? Math.min(project?.wizardStep ?? 1, TOTAL_STEPS));
  const def = WIZARD_STEPS[step - 1];

  const planner = usePlanner(session, project, Boolean(project) && step >= 3);
  const desktop = useMedia("(min-width: 1024px)");
  const withPreview = step >= 3 && step <= 6;

  const loaded = Boolean(project);
  const savedStep = project?.wizardStep;
  const { update } = session;
  useEffect(() => {
    if (loaded && session.getId() && savedStep !== step) update({ wizardStep: step });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, step, savedStep]);

  const furthest = Math.max(furthestState, step, savedStep ?? 1);
  const stepError = stepErrorState && stepErrorState.step === step ? stepErrorState.msg : null;

  async function go(target: number) {
    if (target > step || target === step) {
      const err = guardRef.current ? await guardRef.current() : null;
      if (err) {
        setStepError({ step, msg: err });
        return;
      }
    }
    setStepError(null);
    setFurthest((f) => Math.max(f, target));
    const ok = await session.flush();
    const id = session.getId();
    if (!ok || !id) return;
    router.push(`/projects/${id}/wizard?step=${target}`);
  }

  async function leave(to: string) {
    setLeaving(true);
    if (guardRef.current && step === 1 && !project?.name.trim()) {
      router.push(to);
      return;
    }
    await session.flush();
    router.push(to);
  }

  if (session.loading) return <LoadingBlock label="פותח את הפרויקט…" />;
  if (session.loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-12">
        <ErrorNotice message={session.loadError.notFound ? "הפרויקט לא נמצא. ייתכן שנמחק." : session.loadError.message} />
        <LinkButton href="/projects" variant="secondary">
          חזרה להפרויקטים שלי
        </LinkButton>
      </div>
    );
  }
  if (!project) return <LoadingBlock />;

  const lastStep = step === TOTAL_STEPS;
  const plannerProps = { session, project, planner, guardRef, error: stepError };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-sand-200 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
          <IconButton label="סגירה וחזרה להפרויקטים שלי" onClick={() => void leave("/projects")}>
            <X className="size-6" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold" data-testid="wizard-project-name">
              {project.name.trim() || "פרויקט חדש"}
            </p>
            <SaveIndicator state={session.saveState} hasProject={Boolean(session.projectId)} onRetry={session.retryNow} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6">
          <Stepper current={step} maxReached={furthest} onGo={(n) => void go(n)} />
        </div>
      </header>

      {session.recovered && (
        <div role="status" className="mx-auto mt-3 flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <p className="flex-1 rounded-control bg-info-50 px-4 py-2 text-info-600">שחזרנו שינויים שלא הספיקו להישמר בפעם הקודמת.</p>
          <Button variant="ghost" size="sm" onClick={session.dismissRecovered}>
            הבנתי
          </Button>
        </div>
      )}

      {session.conflict && (
        <div role="alertdialog" aria-label="התנגשות בשמירה" className="mx-auto mt-3 w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-card border border-warn-600/40 bg-warn-50 p-4">
            <p className="font-semibold text-warn-600">הפרויקט הזה עודכן בינתיים בחלון או במכשיר אחר.</p>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => session.resolveConflict("reload")}>
                טעינת הגרסה העדכנית
              </Button>
              <Button size="sm" variant="secondary" onClick={() => session.resolveConflict("overwrite")}>
                שמירת השינויים שלי
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={cn("mx-auto grid w-full max-w-6xl flex-1 content-start gap-6 px-4 py-5 sm:px-6 grid-cols-1", step !== 7 && "lg:grid-cols-[minmax(0,1fr)_26rem]")}>
        <section aria-labelledby="step-title" className="min-w-0">
          <h1 id="step-title" className="text-2xl font-extrabold md:text-3xl">
            {def.title}
          </h1>
          <p className="mb-5 mt-1 text-ink-500">{def.subtitle}</p>
          {stepError && step !== 1 && step !== 2 && (
            <p role="alert" className="mb-3 font-semibold text-danger-600">
              {stepError}
            </p>
          )}
          {step === 1 && <StepDetails key={session.epoch} session={session} project={project} guardRef={guardRef} error={stepError} />}
          {step === 2 && <StepType key={session.epoch} session={session} project={project} guardRef={guardRef} error={stepError} />}
          {withPreview && !desktop && <PreviewPanel planner={planner} name={project.name} desktop={false} />}
          {step === 3 && <StepDimensions key={session.epoch} {...plannerProps} />}
          {step === 4 && <StepInterior key={session.epoch} {...plannerProps} />}
          {step === 5 && <StepFacades key={session.epoch} {...plannerProps} />}
          {step === 6 && <StepMaterials key={session.epoch} {...plannerProps} />}
          {step === 7 && <StepSummary key={session.epoch} {...plannerProps} goTo={(n) => void go(n)} />}
        </section>

        {step !== 7 && (
          <aside aria-label={withPreview ? "תצוגה מקדימה בתלת-ממד" : "סיכום הפרויקט"} className="hidden lg:block">
            <div className="sticky top-40">
              {withPreview && desktop ? (
                <PreviewPanel planner={planner} name={project.name} desktop />
              ) : (
                !withPreview && (
                  <>
                    <h2 className="mb-2 text-lg font-bold">סיכום הפרויקט</h2>
                    <ProjectSummary project={project} />
                  </>
                )
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-sand-200 bg-white/95 pb-[var(--safe-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          {step === 1 ? (
            <Link
              href="/projects"
              onClick={(e) => {
                e.preventDefault();
                void leave("/projects");
              }}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-control border border-sand-300 bg-white px-5 text-lg font-semibold hover:border-wood-400"
            >
              <ArrowRight className="size-5" aria-hidden /> חזרה
            </Link>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => void go(step - 1)}>
              <ArrowRight className="size-5" aria-hidden /> חזרה
            </Button>
          )}
          {lastStep ? (
            <Button size="lg" className="flex-1 md:min-w-56 md:flex-none" loading={leaving} onClick={() => void leave("/projects")}>
              שמירה וסיום
            </Button>
          ) : (
            <Button size="lg" className="flex-1 md:min-w-56 md:flex-none" onClick={() => void go(step + 1)}>
              המשך <ArrowLeft className="size-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
