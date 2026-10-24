"use client";

import { Canvas } from "@react-three/fiber";
import { NeutralToneMapping } from "three";
import { Camera, Check, DoorOpen, Download, Eye, Home, Image as ImageIcon, Maximize2, Minimize2, Settings2, Sparkles } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { FurnitureDesign } from "@/domain/design";
import type { Library } from "@/domain/materials";
import { DEFAULT_ROOM, ROOM_KEYS, ROOM_LABELS, type RoomKey } from "@/domain/rooms";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog } from "../ui/dialog";
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
  /** חדר לדוגמה (נשלט מבחוץ ונשמר בפרויקט). בלי זה: מצב מקומי. */
  room?: RoomKey;
  onRoomChange?: (room: RoomKey) => void;
  /** נקרא אחרי ״צור הדמיה״ עם תמונה ממוזערת לשמירה בפרויקט. */
  onRendered?: (thumbnail: string) => void;
}

interface RenderResult {
  state: "idle" | "working" | "done" | "error";
  url?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  message?: string;
  saved?: boolean;
}

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));

/** תמונה ממוזערת 4:3 (חיתוך מרכזי) כ-JPEG קטן, שנשמרת בפרויקט ומוצגת בכרטיסים. */
function makeThumbnail(src: HTMLCanvasElement): string {
  const w = 480;
  const h = 360;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const ratio = w / h;
  let sw = src.width;
  let sh = src.width / ratio;
  if (sh > src.height) {
    sh = src.height;
    sw = src.height * ratio;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
  let q = 0.84;
  let url = c.toDataURL("image/jpeg", q);
  while (url.length > 120_000 && q > 0.4) {
    q -= 0.1;
    url = c.toDataURL("image/jpeg", q);
  }
  return url;
}

const VIEW_ORDER: ViewKey[] = ["perspective", "front", "side", "top"];

export default function FurnitureViewer({ design, library, name, compact, className, onExpand, expanded, initialView = "perspective", room: roomProp, onRoomChange, onRendered }: ViewerProps) {
  const deferred = useDeferredValue(design);
  const model = useMemo(() => buildFurnitureModel(deferred, { library }), [deferred, library]);

  const [gl] = useState(() => (typeof window === "undefined" ? { ok: true } : probeWebGL()));
  const [choice, setChoice] = useState<QualityChoice>(() => (typeof window === "undefined" ? "auto" : readChoice()));
  const [autoTier, setAutoTier] = useState<Tier>(() => (typeof window === "undefined" ? "medium" : pickTier(readDevice(gl.renderer))));
  const tier: Tier = choice === "auto" ? autoTier : choice;
  const q = QUALITY_PRESETS[tier];
  const [jobHigh, setJobHigh] = useState(false);
  const qEff = jobHigh ? QUALITY_PRESETS.high : q;
  const [localRoom, setLocalRoom] = useState<RoomKey>(DEFAULT_ROOM);
  const room = roomProp ?? localRoom;
  const [roomMenu, setRoomMenu] = useState(false);
  const [result, setResult] = useState<RenderResult>({ state: "idle" });
  const [resultOpen, setResultOpen] = useState(false);

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

  const chooseRoom = (key: RoomKey | "off") => {
    setRoomMenu(false);
    if (key === "off") {
      setRoomOn(false);
      return;
    }
    setRoomOn(true);
    if (roomProp === undefined) setLocalRoom(key);
    onRoomChange?.(key);
  };

  const makeRender = async () => {
    if (result.state === "working") return;
    setResult({ state: "working" });
    setResultOpen(false);
    setJobHigh(true);
    try {
      let img = null;
      for (let i = 0; i < 400 && !img; i++) {
        await nextFrames(2);
        if (handle.current?.tier() === "high") img = handle.current.renderImage();
      }
      if (!img) throw new Error("ההדמיה לא הצליחה להתחיל במכשיר הזה");
      await nextFrames(1);
      const blob = await toBlob(img.canvas);
      if (!blob) throw new Error("יצירת הקובץ נכשלה");
      const thumbnail = makeThumbnail(img.canvas);
      setResult((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return { state: "done", blob, url: URL.createObjectURL(blob), width: img.width, height: img.height, saved: Boolean(onRendered) };
      });
      setResultOpen(true);
      onRendered?.(thumbnail);
    } catch (e) {
      setResult({ state: "error", message: (e as Error).message });
      setResultOpen(true);
    } finally {
      setJobHigh(false);
    }
  };

  const downloadRender = () => {
    if (!result.url) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${(name || "רהיט").trim().replace(/[\\/:*?"<>|]+/g, "-")}-הדמיה.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      data-room={roomOn ? room : "off"}
      data-rendering={result.state === "working"}
      data-doors={model.stats.doors}
      data-drawers={model.stats.drawers}
      data-shelves={model.stats.shelves}
      data-compartments={model.stats.compartments}
      className={cn("relative isolate overflow-hidden rounded-card border border-sand-200 bg-sand-200 shadow-card", className)}
    >
      <Canvas
        key={`${q.antialias}`}
        frameloop="demand"
        shadows={qEff.shadows ? qEff.shadowType : false}
        dpr={q.dpr}
        camera={{ fov: FOV, near: 0.05, far: 80, position: [3, 2, 5] }}
        gl={{ antialias: q.antialias, powerPreference: "high-performance" }}
        onCreated={({ gl: renderer }) => {
          renderer.toneMapping = NeutralToneMapping;
          renderer.toneMappingExposure = 1.0;
          setReady(true);
        }}
        aria-label="תצוגת תלת-ממד של הרהיט"
        role="img"
        className="touch-none"
      >
        <SceneContent
          model={model}
          q={qEff}
          openIds={openIds}
          onToggle={toggle}
          roomOn={roomOn}
          room={room}
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
          <div className="relative">
            <button type="button" data-testid="viewer-room" aria-haspopup="menu" aria-expanded={roomMenu} onClick={() => setRoomMenu((v) => !v)} className={cn(btn, h)}>
              <Home className="size-5" aria-hidden />
              {compact ? <span className="sr-only">חדר</span> : "חדר"}
              <span className="text-ink-500">{roomOn ? ROOM_LABELS[room] : "ללא"}</span>
            </button>
            {roomMenu && (
              <div role="menu" aria-label="חדר לדוגמה" data-testid="room-menu" className="absolute bottom-full start-0 z-10 mb-2 w-48 rounded-control border border-sand-300 bg-white p-1 shadow-lift">
                {ROOM_KEYS.map((k) => (
                  <button key={k} type="button" role="menuitemradio" aria-checked={roomOn && room === k} data-testid={`room-${k}`} onClick={() => chooseRoom(k)} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-start text-base hover:bg-cream-100", roomOn && room === k && "font-bold text-wood-600")}>
                    {ROOM_LABELS[k]}
                    {roomOn && room === k && <Check className="size-4" aria-hidden />}
                  </button>
                ))}
                <button type="button" role="menuitemradio" aria-checked={!roomOn} data-testid="room-off" onClick={() => chooseRoom("off")} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-start text-base hover:bg-cream-100", !roomOn && "font-bold text-wood-600")}>
                  ללא חדר
                  {!roomOn && <Check className="size-4" aria-hidden />}
                </button>
              </div>
            )}
          </div>
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
          <button type="button" data-testid="viewer-capture" onClick={capture} className={cn(btn, h)}>
            <Camera className="size-5" aria-hidden />
            {compact ? <span className="sr-only">צילום תמונה</span> : "צילום תמונה"}
          </button>
          <button type="button" data-testid="viewer-render" disabled={result.state === "working"} onClick={() => void makeRender()} className={cn(btn, h, "bg-wood-600 text-white hover:bg-wood-700 disabled:opacity-70")}>
            <Sparkles className="size-5" aria-hidden />
            {compact ? "הדמיה" : "צור הדמיה"}
          </button>
        </div>
      </div>
      {result.state === "working" && (
        <div role="status" data-testid="render-working" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-cream-50/85 text-ink-900 backdrop-blur-sm">
          <ImageIcon className="size-10 animate-pulse text-wood-600" aria-hidden />
          <p className="text-lg font-bold">יוצר הדמיה באיכות גבוהה…</p>
          <p className="text-sm text-ink-600">זה לוקח כמה שניות, התמונה מרונדרת ברזולוציה כפולה</p>
        </div>
      )}
      <Dialog
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        title={result.state === "error" ? "ההדמיה לא הושלמה" : "ההדמיה מוכנה"}
        className="max-w-3xl!"
        footer={
          result.state === "done" ? (
            <>
              <Button onClick={downloadRender} data-testid="render-download">
                <Download className="size-5" aria-hidden /> הורדת התמונה
              </Button>
              <Button variant="secondary" onClick={() => setResultOpen(false)}>
                סגירה
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setResultOpen(false)}>
              סגירה
            </Button>
          )
        }
      >
        {result.state === "done" && result.url && (
          <div className="flex flex-col gap-3" data-testid="render-result" data-width={result.width} data-height={result.height}>
            {/* eslint-disable-next-line @next/next/no-img-element -- תמונה זמנית מהדפדפן (blob) */}
            <img src={result.url} alt={`הדמיה של ${name || "הרהיט"}`} className="w-full rounded-control border border-sand-200" />
            <p className="text-sm text-ink-600">
              {result.width}×{result.height} פיקסלים.{" "}
              {result.saved ? (
                <span data-testid="render-saved" className="font-semibold text-ink-900">נשמרה כתמונה ממוזערת של הפרויקט.</span>
              ) : (
                "אפשר להוריד אותה למחשב."
              )}
            </p>
          </div>
        )}
        {result.state === "error" && <p role="alert" data-testid="render-error">{result.message}</p>}
      </Dialog>
      {!compact && (
        <p className="pointer-events-none absolute start-3 top-16 hidden items-center gap-1 text-xs text-ink-600 md:flex">
          <Eye className="size-3.5" aria-hidden /> גררו לסיבוב, צביטה או גלגלת לזום. לחיצה על דלת או מגירה פותחת אותה.
        </p>
      )}
    </div>
  );
}
