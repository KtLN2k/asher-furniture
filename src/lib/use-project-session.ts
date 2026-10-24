"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyDesign } from "@/domain/design";
import type { CategoryKey } from "@/domain/catalog";
import type { Project, ProjectPatch } from "@/domain/project";
import { ApiError, api } from "./api";
import { applyPatch, mergePatches, type LocalExtras } from "./project-patch";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

const DEBOUNCE_MS = 700;
const RETRY_MS = [3000, 6000, 12000];
const backupKey = (id: string) => `asher:draft:${id}`;

interface Backup {
  baseRevision: number;
  patch: ProjectPatch;
}

function draftStub(initialCategory: CategoryKey | null): Project {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    status: "draft",
    category: initialCategory,
    customer: null,
    thumbnail: null,
    wizardStep: 1,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    notes: "",
    furnitureId: "",
    design: { ...emptyDesign(), category: initialCategory },
  };
}

export interface ProjectSession {
  projectId: string | null;
  /** מזהה עדכני גם בתוך פונקציות אסינכרוניות (בלי תלות ברינדור). */
  getId: () => string | null;
  project: Project | null;
  loading: boolean;
  loadError: { message: string; notFound: boolean } | null;
  saveState: SaveState;
  saveError: string | null;
  recovered: boolean;
  conflict: Project | null;
  /** עולה בכל פעם שהפרויקט הוחלף מבחוץ (טעינת גרסה עדכנית), כדי שטפסים יאותחלו מחדש. */
  epoch: number;
  update: (patch: ProjectPatch, local?: LocalExtras) => void;
  /** ממתין לשמירה של כל מה שממתין. מחזיר true אם הכול נשמר. */
  flush: () => Promise<boolean>;
  retryNow: () => void;
  resolveConflict: (mode: "reload" | "overwrite") => void;
  dismissRecovered: () => void;
}

/**
 * מחזיק פרויקט פתוח וששומר אוטומטית לשרת:
 *  - עדכונים נצברים ונשלחים אחרי 700ms של שקט, בקשה אחת בכל רגע.
 *  - כשל רשת/שרת: הנתונים נשארים במסך ובגיבוי מקומי, ונשלחים שוב אוטומטית (וגם כשהרשת חוזרת).
 *  - שני חלונות על אותו פרויקט: זיהוי התנגשות לפי מספר גרסה.
 *  - `id === null`: פרויקט חדש. הרשומה נוצרת בשרת ברגע שיש שם.
 */
export function useProjectSession(
  initialId: string | null,
  opts: { initialCategory?: CategoryKey | null; onCreated?: (project: Project) => void } = {},
): ProjectSession {
  const [projectId, setProjectId] = useState<string | null>(initialId);
  const [project, setProject] = useState<Project | null>(() => (initialId ? null : draftStub(opts.initialCategory ?? null)));
  const [loading, setLoading] = useState(Boolean(initialId));
  const [loadError, setLoadError] = useState<ProjectSession["loadError"]>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [conflict, setConflict] = useState<Project | null>(null);
  const [epoch, setEpoch] = useState(0);

  const idRef = useRef<string | null>(initialId);
  const projectRef = useRef<Project | null>(project);
  const revisionRef = useRef(0);
  const pendingRef = useRef<ProjectPatch | null>(
    !initialId && opts.initialCategory ? { design: { category: opts.initialCategory } } : null,
  );
  const heldRef = useRef<ProjectPatch | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failuresRef = useRef(0);
  const loopRef = useRef<Promise<boolean> | null>(null);
  const onCreatedRef = useRef(opts.onCreated);
  useEffect(() => {
    onCreatedRef.current = opts.onCreated;
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setProj = useCallback((p: Project | null) => {
    projectRef.current = p;
    setProject(p);
  }, []);

  const writeBackup = useCallback(() => {
    const id = idRef.current;
    if (!id) return;
    try {
      if (pendingRef.current) {
        const b: Backup = { baseRevision: revisionRef.current, patch: pendingRef.current };
        localStorage.setItem(backupKey(id), JSON.stringify(b));
      } else {
        localStorage.removeItem(backupKey(id));
      }
    } catch {
      /* אחסון מקומי לא זמין: ממשיכים בלי גיבוי */
    }
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    timerRef.current = null;
    retryRef.current = null;
  };

  const runSave = useCallback((): Promise<boolean> => {
    if (loopRef.current) return loopRef.current;
    const loop = (async (): Promise<boolean> => {
      try {
        for (;;) {
          const patch = pendingRef.current;
          if (!patch) return true;
          const stub = projectRef.current;
          if (!idRef.current && !stub?.name.trim()) return true;

          pendingRef.current = null;
          if (mountedRef.current) setSaveState("saving");
          try {
            if (!idRef.current) {
              const created = await api.createProject({
                name: stub!.name.trim(),
                customerId: stub!.customer?.id ?? null,
                status: stub!.status,
                notes: stub!.notes,
              });
              idRef.current = created.id;
              revisionRef.current = created.revision;
              if (mountedRef.current) setProjectId(created.id);
              setProj({
                ...projectRef.current!,
                id: created.id,
                revision: created.revision,
                furnitureId: created.furnitureId,
                createdAt: created.createdAt,
                updatedAt: created.updatedAt,
              });
              onCreatedRef.current?.(created);
              const rest: ProjectPatch = { ...patch };
              for (const k of ["name", "customerId", "notes", "status"] as const) delete rest[k];
              if (Object.keys(rest).length) pendingRef.current = mergePatches(rest, pendingRef.current ?? {});
              continue;
            }
            const saved = await api.patchProject(idRef.current, patch, revisionRef.current);
            revisionRef.current = saved.revision;
            const cur = projectRef.current;
            if (cur) setProj({ ...cur, revision: saved.revision, updatedAt: saved.updatedAt });
            failuresRef.current = 0;
            writeBackup();
          } catch (err) {
            pendingRef.current = pendingRef.current ? mergePatches(patch, pendingRef.current) : patch;
            if (err instanceof ApiError && err.status === 409 && err.current) {
              heldRef.current = pendingRef.current;
              pendingRef.current = null;
              if (mountedRef.current) {
                setConflict(err.current);
                setSaveState("conflict");
              }
              return false;
            }
            if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
              pendingRef.current = null;
              writeBackup();
              if (mountedRef.current) {
                setSaveError(err.message);
                setSaveState("error");
              }
              return false;
            }
            writeBackup();
            const delay = RETRY_MS[Math.min(failuresRef.current, RETRY_MS.length - 1)];
            failuresRef.current += 1;
            if (mountedRef.current) {
              setSaveError((err as Error).message);
              setSaveState("error");
              retryRef.current = setTimeout(() => void runSave(), delay);
            }
            return false;
          }
        }
      } finally {
        loopRef.current = null;
      }
    })().then((ok) => {
      if (ok && mountedRef.current) {
        setSaveError(null);
        setSaveState(idRef.current && !pendingRef.current ? "saved" : pendingRef.current ? "dirty" : "idle");
      }
      return ok;
    });
    loopRef.current = loop;
    return loop;
  }, [setProj, writeBackup]);

  const update = useCallback(
    (patch: ProjectPatch, local?: LocalExtras) => {
      const cur = projectRef.current;
      if (!cur) return;
      setProj(applyPatch(cur, patch, local));
      if (Object.values(patch).every((v) => v === undefined)) return;
      pendingRef.current = mergePatches(pendingRef.current, patch);
      writeBackup();
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      setSaveError(null);
      setSaveState(idRef.current || cur.name.trim() || patch.name?.trim() ? "dirty" : "idle");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
    },
    [runSave, setProj, writeBackup],
  );

  const flush = useCallback(async () => {
    clearTimers();
    if (loopRef.current) await loopRef.current;
    if (heldRef.current) return false;
    if (!pendingRef.current) return true;
    return runSave();
  }, [runSave]);

  const retryNow = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    void runSave();
  }, [runSave]);

  const resolveConflict = useCallback(
    (mode: "reload" | "overwrite") => {
      const current = conflict;
      if (!current) return;
      setConflict(null);
      revisionRef.current = current.revision;
      if (mode === "reload") {
        heldRef.current = null;
        pendingRef.current = null;
        writeBackup();
        setProj(current);
        setEpoch((e) => e + 1);
        setSaveState("saved");
      } else {
        const mine = heldRef.current;
        heldRef.current = null;
        pendingRef.current = mine;
        void runSave();
      }
    },
    [conflict, runSave, setProj, writeBackup],
  );

  // טעינה ראשונית + שחזור שינויים שלא נשמרו
  useEffect(() => {
    if (!initialId) return;
    const ctrl = new AbortController();
    api
      .getProject(initialId, ctrl.signal)
      .then((p) => {
        revisionRef.current = p.revision;
        setProj(p);
        setLoadError(null);
        try {
          const raw = localStorage.getItem(backupKey(initialId));
          if (raw) {
            const b = JSON.parse(raw) as Backup;
            if (b.baseRevision === p.revision && b.patch) {
              setRecovered(true);
              update(b.patch);
            } else {
              localStorage.removeItem(backupKey(initialId));
            }
          }
        } catch {
          /* גיבוי פגום: מתעלמים */
        }
      })
      .catch((e: ApiError) => {
        if (e.name === "AbortError") return;
        setLoadError({ message: e.message, notFound: e.status === 404 });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  // הגנה מפני אובדן שינויים: אזהרה בסגירה, שליחה אחרונה כשהדף מוסתר, וניסיון חוזר כשהרשת חוזרת
  useEffect(() => {
    const unsent = () => Boolean(pendingRef.current || loopRef.current || heldRef.current);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsent()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const patch = pendingRef.current;
      if (patch && idRef.current && !loopRef.current) {
        void api.patchProject(idRef.current, patch, revisionRef.current, true).then(
          (saved) => {
            revisionRef.current = saved.revision;
            pendingRef.current = null;
            writeBackup();
          },
          () => undefined,
        );
      }
    };
    const onOnline = () => {
      if (pendingRef.current) void runSave();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
    };
  }, [runSave, writeBackup]);

  useEffect(() => () => clearTimers(), []);

  return {
    projectId,
    getId: () => idRef.current,
    project,
    loading,
    loadError,
    saveState,
    saveError,
    recovered,
    conflict,
    epoch,
    update,
    flush,
    retryNow,
    resolveConflict,
    dismissRecovered: () => setRecovered(false),
  };
}
