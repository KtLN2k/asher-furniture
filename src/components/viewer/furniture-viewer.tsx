"use client";

import { Canvas } from "@react-three/fiber";
import { NeutralToneMapping } from "three";
import { Camera, DoorOpen, Eye, Home, Maximize2, Minimize2, Settings2 } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { FurnitureDesign } from "@/domain/design";
import type { Library } from "@/domain/materials";
import { cn } from "../ui/cn";
import { buildFurnitureModel } from "@/three/model";
import {
  QUALITY_PRESETS,
  TIER_LABELS,
  nextLower,
  pickTier,
  readChoice,
  readDevice,
  saveChoice,
  type QualityChoice,
  type Tier,
} from "@/three/quality";
import { FOV, SceneContent, VIEW_LABELS, type SceneHandle, type ViewKey } from "@/three/scene";

declare global {
  interface Window {
    __asherScene?: {
      stats: SceneHandle["stats"];
      capture: SceneHandle["capture"];
      ready: boolean;
    };
  }
}

function probeWebGL(): { ok: boolean; renderer?: string } {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ok: false };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined;
    return { ok: true, renderer };
  } catch {
    return { ok: false };
  }
}

export interface ViewerProps {
  design: FurnitureDesign;
  library: Library;
  /** שם הקובץ בצילום. */
  name?: string;
  /** תצוגה קטנה: פחות כפתורים. */
  compact?: boolean;
  className?: string;
  onExpand?: () => void;
  expanded?: boolean;
  initialView?: ViewKey;
}

const VIEW_ORDER: ViewKey[] = ["perspective", "front", "side", "top"];

export default function FurnitureViewer({ design, library, name, compact, className, onExpand, expanded, initialView = "perspective" }: ViewerProps) {
  const deferred = useDeferredValue(design);
  const model = useMemo(() => buildFurnitureModel(deferred, { library }), [deferred, library]);

  const [gl] = useState(() => (typeof window === "undefined" ? { ok: true } : probeWebGL()));
  const [choice, setChoice] = useState<QualityChoice>(() => (typeof window === "undefined" ? "auto" : readChoice()));
  const [autoTier, setAutoTier] = useState<Tier>(() => (typeof window === "undefined" ? "medium" : pickTier(readDevice(gl.renderer))));
  const tier: Tier = choice === "auto" ? autoTier : choice;
  const q = QUALITY_PRESETS[tier];

  const [view, setView] = useState<ViewKey>(initialView);
  const [viewNonce, setViewNonce] = useState(0);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [roomOn, setRoomOn] = useState(true);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const handle = useRef<SceneHandle>(null);

  const movableIds = useMemo(() => model.moving.map((p) => p.id), [model]);
  const allOpen = movableIds.length > 0 && movableIds.every((id) => openIds.has(id));
  const hasMovable = movableIds.length > 0;

  const toggle = useCallback((id: string) => {
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectView = (v: ViewKey) => {
    setView(v);
    setViewNonce((n) => n + 1);
  };

  const capture = () => {
    const url = handle.current?.capture();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "רהיט").trim().replace(/[\\/:*?"<>|]+/g, "-")}-הדמיה.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    window.__asherScene = {
      stats: () => handle.current?.stats() ?? null,
      capture: () => handle.current?.capture() ?? null,
      ready,
    };
    return () => {
      delete window.__asherScene;
    };
  }, [ready]);

  const downgrade = useCallback(() => {
    if (choice === "auto") setAutoTier((t) => nextLower(t));
  }, [choice]);

  const chooseQuality = (c: QualityChoice) => {
    setChoice(c);
    saveChoice(c);
    setMenu(false);
  };

  if (!gl.ok) {
    return (
      <div role="status" className={cn("flex min-h-48 items-center justify-center rounded-card border border-sand-300 bg-cream-100 p-6 text-center text-ink-600", className)} data-testid="viewer-fallback">
        הדפדפן או המכשיר הזה לא תומכים בתצוגת תלת-ממד. ההגדרות והסיכום ממשיכים לעבוד כרגיל.
      </div>
    );
  }

  const btn = "inline-flex items-center justify-center gap-1.5 rounded-full bg-white/92 px-3 text-sm font-semibold text-ink-900 shadow-card backdrop-blur transition hover:bg-white active:scale-95";
  const h = "min-h-11 min-w-11";

  return (
    <div
      data-testid="viewer"
      data-ready={ready}
      data-tier={tier}
      data-view={view}
      data-doors={model.stats.doors}
      data-drawers={model.stats.drawers}
      data-shelves={model.stats.shelves}
      data-compartments={model.stats.compartments}
      className={cn("relative isolate overflow-hidden rounded-card border border-sand-200 bg-sand-200 shadow-card", className)}
    >
      <Canvas
        key={`${q.antialias}`}
        frameloop="demand"
        shadows={q.shadows ? "percentage" : false}
        dpr={q.dpr}
        camera={{ fov: FOV, near: 0.05, far: 80, position: [3, 2, 5] }}
        gl={{ antialias: q.antialias, powerPreference: "high-performance" }}
        onCreated={({ gl: renderer }) => {
          renderer.toneMapping = NeutralToneMapping;
          renderer.toneMappingExposure = 1.3;
          setReady(true);
        }}
        aria-label="תצוגת תלת-ממד של הרהיט"
        role="img"
        className="touch-none"
      >
        <SceneContent
          model={model}
          q={q}
          openIds={openIds}
          onToggle={toggle}
          roomOn={roomOn}
          view={view}
          viewNonce={viewNonce}
          onDowngrade={downgrade}
          handleRef={handle}
        />
      </Canvas>

      {!ready && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-sand-200 text-ink-500">
          טוען תצוגת תלת-ממד…
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div role="group" aria-label="זווית מצלמה" className="pointer-events-auto flex gap-1 rounded-full bg-white/70 p-1 backdrop-blur">
          {VIEW_ORDER.map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`viewer-view-${v}`}
              aria-pressed={view === v}
              onClick={() => selectView(v)}
              className={cn(h, "rounded-full px-3 text-sm font-semibold transition active:scale-95", view === v ? "bg-wood-600 text-white shadow-card" : "text-ink-700 hover:bg-white")}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        {onExpand && (
          <button type="button" onClick={onExpand} aria-label={expanded ? "סגירת התצוגה המוגדלת" : "הגדלת התצוגה"} data-testid="viewer-expand" className={cn(btn, h, "pointer-events-auto size-11 px-0")}>
            {expanded ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-end justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          {hasMovable && (
            <button type="button" data-testid="viewer-open-all" aria-pressed={allOpen} onClick={() => setOpenIds(allOpen ? new Set() : new Set(movableIds))} className={cn(btn, h)}>
              <DoorOpen className="size-5" aria-hidden />
              {allOpen ? "סגירה" : model.stats.doors > 0 ? "פתיחת דלתות" : "פתיחת מגירות"}
            </button>
          )}
          <button type="button" data-testid="viewer-room" aria-pressed={roomOn} onClick={() => setRoomOn((v) => !v)} className={cn(btn, h)}>
            <Home className="size-5" aria-hidden />
            {compact ? <span className="sr-only">חדר</span> : "חדר"}
            {!compact && <span className="text-ink-500">{roomOn ? "פעיל" : "כבוי"}</span>}
          </button>
        </div>
        <div className="pointer-events-auto relative flex gap-2">
          <button type="button" data-testid="viewer-quality" aria-expanded={menu} aria-label={`איכות תצוגה: ${choice === "auto" ? "אוטומטי" : TIER_LABELS[choice]}`} onClick={() => setMenu((v) => !v)} className={cn(btn, h)}>
            <Settings2 className="size-5" aria-hidden />
            {!compact && <span>איכות</span>}
          </button>
          {menu && (
            <div role="menu" aria-label="איכות תצוגה" className="absolute bottom-full end-0 mb-2 w-48 rounded-control border border-sand-300 bg-white p-1 shadow-lift">
              {(["auto", "high", "medium", "low"] as QualityChoice[]).map((c) => (
                <button key={c} type="button" role="menuitemradio" aria-checked={choice === c} data-testid={`quality-${c}`} onClick={() => chooseQuality(c)} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-start text-base hover:bg-cream-100", choice === c && "font-bold text-wood-600")}>
                  <span>{c === "auto" ? "אוטומטי" : TIER_LABELS[c]}</span>
                  {c === "auto" && <span className="text-sm text-ink-500">{TIER_LABELS[autoTier]}</span>}
                </button>
              ))}
            </div>
          )}
          <button type="button" data-testid="viewer-capture" onClick={capture} className={cn(btn, h, "bg-wood-600 text-white hover:bg-wood-700")}>
            <Camera className="size-5" aria-hidden />
            {compact ? <span className="sr-only">צילום תמונה</span> : "צילום תמונה"}
          </button>
        </div>
      </div>
      {!compact && (
        <p className="pointer-events-none absolute start-3 top-16 hidden items-center gap-1 text-xs text-ink-600 md:flex">
          <Eye className="size-3.5" aria-hidden /> גררו לסיבוב, צביטה או גלגלת לזום. לחיצה על דלת או מגירה פותחת אותה.
        </p>
      )}
    </div>
  );
}
