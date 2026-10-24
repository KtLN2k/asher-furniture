"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaverState = "idle" | "saving" | "saved" | "error";

/** שמירה מושהית של ערך אחד (למשל פרטי לקוח), עם אפשרות להמתין לסיום לפני מעבר שלב. */
export function useDebouncedSaver<T>(save: (value: T) => Promise<unknown>, delay = 700) {
  const [state, setState] = useState<SaverState>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const run = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;
    const p = (async () => {
      while (pending.current) {
        const { value } = pending.current;
        pending.current = null;
        setState("saving");
        try {
          await saveRef.current(value);
        } catch (e) {
          pending.current = pending.current ?? { value };
          setError((e as Error).message);
          setState("error");
          return false;
        }
      }
      setError(null);
      setState("saved");
      return true;
    })().finally(() => {
      running.current = null;
    });
    running.current = p;
    return p;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), delay);
    },
    [delay, run],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (running.current) await running.current;
    if (!pending.current) return true;
    return run();
  }, [run]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { state, error, schedule, flush };
}
