"use client";

import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/domain/catalog";
import { cn } from "../ui/cn";

export function Stepper({
  current,
  maxReached,
  onGo,
}: {
  current: number;
  maxReached: number;
  onGo: (n: number) => void;
}) {
  return (
    <>
      <div className="lg:hidden">
        <div className="mb-1 flex items-center justify-between text-sm font-semibold text-ink-600">
          <span>
            שלב {current} מתוך {WIZARD_STEPS.length}
          </span>
          <span>{WIZARD_STEPS[current - 1]?.title}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sand-200" role="progressbar" aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length} aria-valuenow={current}>
          <div className="h-full rounded-full bg-wood-600 transition-all" style={{ width: `${(current / WIZARD_STEPS.length) * 100}%` }} />
        </div>
      </div>

      <ol className="hidden items-center gap-1 lg:flex" aria-label="שלבי האשף">
        {WIZARD_STEPS.map((s) => {
          const done = s.n < current;
          const active = s.n === current;
          const reachable = s.n <= maxReached;
          return (
            <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                disabled={!reachable || active}
                onClick={() => onGo(s.n)}
                aria-current={active ? "step" : undefined}
                aria-label={`שלב ${s.n}: ${s.title}`}
                title={s.title}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-start transition",
                  reachable && !active && "hover:bg-sand-200",
                  !reachable && "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    active && "bg-wood-600 text-white",
                    done && "bg-wood-100 text-wood-700",
                    !active && !done && "bg-sand-200 text-ink-500",
                  )}
                >
                  {done ? <Check className="size-4" aria-label="הושלם" /> : s.n}
                </span>
                <span className={cn("truncate text-sm font-semibold lg:text-base", active ? "text-ink-900" : "hidden text-ink-500 xl:inline")}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
