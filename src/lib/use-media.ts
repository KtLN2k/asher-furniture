"use client";

import { useSyncExternalStore } from "react";

/** האם שאילתת מדיה מתקיימת כרגע. בשרת תמיד false, כדי שה-HTML הראשוני יהיה זהה אצל כולם. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
