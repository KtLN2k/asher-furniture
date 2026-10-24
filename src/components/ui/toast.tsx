"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "./cn";

type Tone = "ok" | "error";
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => undefined);

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, text, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);
  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-md animate-[toast-in_0.2s_ease-out] items-center gap-3 rounded-control px-4 py-3 text-base font-medium text-white shadow-lift",
              t.tone === "ok" ? "bg-ink-900" : "bg-danger-600",
            )}
          >
            {t.tone === "ok" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
