"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LIMITS, type Limits } from "@/domain/limits";
import { seedLibrary, type Library } from "@/domain/materials";
import { api } from "./api";

export interface LibraryState {
  library: Library;
  limits: Limits;
  /** true אחרי שהספרייה נטענה מהשרת. */
  ready: boolean;
  error: string | null;
  reload: () => void;
}

let cached: { library: Library; limits: Limits } | null = null;

/** טוען את ספריית החומרים והמגבלות מהשרת (עם מטמון בזיכרון, כדי שמעבר בין שלבים יהיה מיידי). */
export function useLibrary(): LibraryState {
  const [data, setData] = useState(cached);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([api.listMaterials(), api.getLimits()])
      .then(([library, limits]) => {
        cached = { library, limits };
        if (alive) {
          setData(cached);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {
    library: data?.library ?? seedLibrary(),
    limits: data?.limits ?? DEFAULT_LIMITS,
    ready: Boolean(data),
    error,
    reload,
  };
}

export function invalidateLibraryCache() {
  cached = null;
}
