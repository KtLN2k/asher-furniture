"use client";

import { useId, useMemo } from "react";
import type { FurnitureDesign } from "@/domain/design";
import { resolveFacade, type FacadeKind } from "@/domain/facades";
import { buildLayout } from "@/domain/layout";
import { itemsOf, surfaceLook, surfaceOf, type Library } from "@/domain/materials";
import { resolveSpec } from "@/domain/spec";
import { cn } from "../ui/cn";

export type ElevationMode = "dimensions" | "interior" | "facades" | "mini";

export interface FacadeRef {
  kind: FacadeKind;
  id: string;
}

interface Props {
  design: FurnitureDesign;
  library: Library;
  mode: ElevationMode;
  selectedComp?: number | null;
  onSelectComp?: (index: number) => void;
  /** פריטי חזית נבחרים (דלתות/מגירות). */
  selectedFacades?: FacadeRef[];
  onSelectFacade?: (ref: FacadeRef) => void;
  className?: string;
  label?: string;
}

const INK = "#4a4038";
const LINE = "#9d8b78";
const SEL = "#774a2b";

const cmText = (mm: number) => (Math.round(mm) / 10).toLocaleString("he-IL", { maximumFractionDigits: 1 });

/**
 * מבט חזית דו-ממדי (SVG) שנגזר מאותה פריסה (buildLayout) כמו מודל התלת-ממד.
 * משמש להמחשת מידות, לבחירת תאים בחלוקה הפנימית ולבחירת דלתות ומגירות בחזיתות.
 */
export function ElevationSvg({ design, library, mode, selectedComp, onSelectComp, selectedFacades = [], onSelectFacade, className, label }: Props) {
  const gid = useId().replace(/:/g, "");
  const spec = useMemo(() => resolveSpec(design), [design]);
  const layout = useMemo(() => buildLayout(spec), [spec]);
  const mini = mode === "mini";
  const dims = mode === "dimensions";

  const W = spec.widthMm;
  const top = layout.bodyTopY;
  const unit = Math.max(W, top);
  const marginL = dims ? unit * 0.16 : unit * 0.02;
  const marginB = dims ? unit * 0.16 : unit * 0.03;
  const marginT = dims ? unit * 0.04 : unit * 0.02;
  const marginR = unit * 0.02;
  const vw = W + marginL + marginR;
  const vh = top + marginT + marginB;
  const X = (x: number) => x + W / 2 + marginL;
  const Y = (y: number) => top - y + marginT;
  const sw = unit * (mini ? 0.006 : 0.0028);
  const fs = unit * 0.034;

  const bodyLook = surfaceLook(library, design.materials?.bodyColorId, design.materials?.bodyFinishId);
  const facadeBase = surfaceLook(library, design.materials?.facadeColorId, design.materials?.facadeFinishId);
  const avail = {
    glass: itemsOf(library, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "glass"),
    mirror: itemsOf(library, "facade", { activeOnly: true }).some((i) => surfaceOf(i) === "mirror"),
  };
  const t = spec.bodyT;
  const showDoors = mode === "facades" || mode === "dimensions";
  const isSel = (kind: FacadeKind, id: string) => selectedFacades.some((f) => f.kind === kind && f.id === id);

  const bodyFill = bodyLook.hex;
  const interiorFill = "#f3eee6";

  const rect = (x0: number, x1: number, y0: number, y1: number) => ({ x: X(x0), y: Y(y1), width: x1 - x0, height: y1 - y0 });

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={label ?? "מבט חזית של הרהיט"}
      data-testid={`elevation-${mode}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${gid}-mirror`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f9fb" />
          <stop offset="0.45" stopColor="#c8d8de" />
          <stop offset="1" stopColor="#eef4f6" />
        </linearGradient>
        <pattern id={`${gid}-hatch`} width={unit * 0.012} height={unit * 0.012} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={unit * 0.012} stroke="#cdb998" strokeWidth={sw * 0.8} />
        </pattern>
      </defs>

      {!mini && <rect x={0} y={Y(0)} width={vw} height={unit * 0.03} fill={`url(#${gid}-hatch)`} />}
      <line x1={0} x2={vw} y1={Y(0)} y2={Y(0)} stroke={LINE} strokeWidth={sw * 1.4} />

      {spec.base === "plinth" && spec.baseHeightMm > 0 && (
        <rect {...rect(-W / 2 + 20, W / 2 - 20, 0, spec.baseHeightMm)} fill="#6a5a4c" opacity={0.55} />
      )}
      {spec.base === "legs" &&
        [-1, 1].map((s) => (
          <rect key={s} {...rect(s * (W / 2 - 60) - 20, s * (W / 2 - 60) + 20, 0, spec.baseHeightMm)} fill="#9a9a9c" />
        ))}

      <rect {...rect(-W / 2, W / 2, layout.bodyBottomY, layout.bodyTopY)} fill={interiorFill} stroke={LINE} strokeWidth={sw} />
      <rect {...rect(-W / 2, -W / 2 + t, layout.bodyBottomY, layout.bodyTopY)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
      <rect {...rect(W / 2 - t, W / 2, layout.bodyBottomY, layout.bodyTopY)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
      <rect {...rect(-W / 2 + t, W / 2 - t, layout.bodyTopY - t, layout.bodyTopY)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
      <rect {...rect(-W / 2 + t, W / 2 - t, layout.bodyBottomY, layout.bodyBottomY + t)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
      {layout.dividerX.map((x, i) => (
        <rect key={i} {...rect(x - t / 2, x + t / 2, layout.innerY0, layout.innerY1)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
      ))}

      {layout.compartments.map((c) => (
        <g key={c.id}>
          {mode === "interior" && selectedComp === c.index && <rect {...rect(c.x0, c.x1, layout.innerY0, layout.innerY1)} fill={SEL} opacity={0.12} />}
          {layout.shelves
            .filter((s) => s.compIndex === c.index)
            .map((s) => (
              <rect key={s.id} {...rect(s.x0, s.x1, s.y - t / 2, s.y + t / 2)} fill={bodyFill} stroke={LINE} strokeWidth={sw} />
            ))}
          {layout.rods
            .filter((r) => r.compIndex === c.index)
            .map((r, i) => (
              <line key={i} x1={X(r.x0)} x2={X(r.x1)} y1={Y(r.y)} y2={Y(r.y)} stroke="#7b7f84" strokeWidth={sw * 3} strokeLinecap="round" />
            ))}
          {c.elements.drawers.map((d, j) => (
            <g key={j}>
              <rect {...rect(c.x0 + 6, c.x1 - 6, layout.innerY0 + d.y0 + 4, layout.innerY0 + d.y1 - 4)} fill="#fbf8f2" stroke={LINE} strokeWidth={sw} />
              {!mini && (
                <line x1={X((c.x0 + c.x1) / 2 - Math.min(80, c.width * 0.15))} x2={X((c.x0 + c.x1) / 2 + Math.min(80, c.width * 0.15))} y1={Y(layout.innerY0 + d.y1 - 30)} y2={Y(layout.innerY0 + d.y1 - 30)} stroke={INK} strokeWidth={sw * 2.2} strokeLinecap="round" />
              )}
            </g>
          ))}
        </g>
      ))}

      {showDoors &&
        layout.doors.map((d) => {
          const look = resolveFacade(design, "door", d.id, d.index, spec.doorType, avail);
          const fill = look.style === "mirror" ? `url(#${gid}-mirror)` : look.style === "glass" ? "#dbe9ee" : (look.colorId ? surfaceLook(library, look.colorId, design.materials?.facadeFinishId).hex : facadeBase.hex);
          const sel = isSel("door", d.id);
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          const stroke = sel ? SEL : LINE;
          return (
            <g key={d.id} opacity={d.type === "sliding" && d.lane === 0 ? 0.92 : 1}>
              <rect {...rect(d.x0, d.x1, d.y0, d.y1)} fill={fill} fillOpacity={look.style === "glass" ? 0.8 : 1} stroke={stroke} strokeWidth={sel ? sw * 3 : sw * 1.3} />
              {look.style === "framed" && <rect {...rect(d.x0 + Math.min(70, w / 4), d.x1 - Math.min(70, w / 4), d.y0 + Math.min(70, w / 4), d.y1 - Math.min(70, w / 4))} fill="none" stroke={LINE} strokeWidth={sw} />}
              {look.style === "glass" && <rect {...rect(d.x0 + 45, d.x1 - 45, d.y0 + 45, d.y1 - 45)} fill="#eef6f9" fillOpacity={0.9} stroke={LINE} strokeWidth={sw} />}
              {look.style === "grooved" &&
                Array.from({ length: Math.max(2, Math.floor(w / 70)) }, (_, k) => {
                  const gx = d.x0 + (w / (Math.max(2, Math.floor(w / 70)) + 1)) * (k + 1);
                  return <line key={k} x1={X(gx)} x2={X(gx)} y1={Y(d.y0 + h * 0.03)} y2={Y(d.y1 - h * 0.03)} stroke={LINE} strokeWidth={sw} />;
                })}
              {!mini && look.handle !== "none" && look.handle !== "push" && <HandleMark look={look.handle} d={d} side={d.type === "sliding" ? (d.lane === 1 ? "left" : "right") : look.opening === "right" ? "left" : "right"} X={X} Y={Y} sw={sw} h={h} />}
              {!mini && (
                <text x={X((d.x0 + d.x1) / 2)} y={Y(d.y1) + fs * 1.5} textAnchor="middle" fontSize={fs * 0.9} fill={INK} opacity={0.65} style={{ pointerEvents: "none" }}>
                  {d.index + 1}
                </text>
              )}
            </g>
          );
        })}

      {mode === "facades" &&
        layout.drawers
          .filter((d) => d.exposed)
          .map((d) => {
            const look = resolveFacade(design, "drawer", d.id, d.index, spec.doorType, avail);
            const sel = isSel("drawer", d.id);
            const fill = look.colorId ? surfaceLook(library, look.colorId, design.materials?.facadeFinishId).hex : facadeBase.hex;
            const cx = (d.fx0 + d.fx1) / 2;
            return (
              <g key={d.id}>
                <rect {...rect(d.fx0, d.fx1, d.fy0, d.fy1)} fill={fill} stroke={sel ? SEL : LINE} strokeWidth={sel ? sw * 3 : sw * 1.3} />
                {look.style === "framed" && <rect {...rect(d.fx0 + 40, d.fx1 - 40, d.fy0 + 25, d.fy1 - 25)} fill="none" stroke={LINE} strokeWidth={sw} />}
                {look.handle !== "none" && look.handle !== "push" && (
                  <line x1={X(cx - Math.min(look.handle === "long" ? (d.fx1 - d.fx0) * 0.3 : 80, 300))} x2={X(cx + Math.min(look.handle === "long" ? (d.fx1 - d.fx0) * 0.3 : 80, 300))} y1={Y(d.fy1 - 40)} y2={Y(d.fy1 - 40)} stroke={INK} strokeWidth={sw * 3} strokeLinecap="round" />
                )}
              </g>
            );
          })}

      {mode === "interior" &&
        layout.compartments.map((c) => (
          <rect
            key={`hit-${c.id}`}
            {...rect(c.x0, c.x1, layout.innerY0, layout.innerY1)}
            fill="transparent"
            stroke={selectedComp === c.index ? SEL : "none"}
            strokeWidth={sw * 3}
            style={{ cursor: onSelectComp ? "pointer" : undefined }}
            role="button"
            tabIndex={onSelectComp ? 0 : -1}
            aria-label={`תא ${c.index + 1}`}
            aria-pressed={selectedComp === c.index}
            data-testid={`comp-${c.index}`}
            onClick={() => onSelectComp?.(c.index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectComp?.(c.index);
              }
            }}
          />
        ))}

      {mode === "interior" &&
        layout.compartments.map((c) => (
          <text key={`n-${c.id}`} x={X((c.x0 + c.x1) / 2)} y={Y(layout.innerY1) + fs * 1.4} textAnchor="middle" fontSize={fs} fontWeight={700} fill={selectedComp === c.index ? SEL : INK} style={{ pointerEvents: "none" }}>
            {c.index + 1}
          </text>
        ))}

      {mode === "facades" &&
        layout.doors.map((d) => (
          <rect
            key={`hit-${d.id}`}
            {...rect(d.x0, d.x1, d.y0, d.y1)}
            fill="transparent"
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            aria-label={`דלת ${d.index + 1}`}
            aria-pressed={isSel("door", d.id)}
            data-testid={`facade-door-${d.index + 1}`}
            onClick={() => onSelectFacade?.({ kind: "door", id: d.id })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectFacade?.({ kind: "door", id: d.id });
              }
            }}
          />
        ))}
      {mode === "facades" &&
        layout.drawers
          .filter((d) => d.exposed)
          .map((d) => (
            <rect
              key={`hit-${d.id}`}
              {...rect(d.fx0, d.fx1, d.fy0, d.fy1)}
              fill="transparent"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              aria-label={`מגירה ${d.index + 1}`}
              aria-pressed={isSel("drawer", d.id)}
              data-testid={`facade-drawer-${d.id}`}
              onClick={() => onSelectFacade?.({ kind: "drawer", id: d.id })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectFacade?.({ kind: "drawer", id: d.id });
                }
              }}
            />
          ))}

      {dims && <DimensionArrows W={W} H={spec.heightMm} X={X} Y={Y} sw={sw} fs={fs} top={top} mount={spec.mountHeightMm} marginL={marginL} />}
    </svg>
  );
}

function HandleMark({ look, d, side, X, Y, sw, h }: { look: string; side: "left" | "right"; d: { x0: number; x1: number; y0: number; y1: number }; X: (x: number) => number; Y: (y: number) => number; sw: number; h: number }) {
  const x = side === "left" ? d.x0 + 30 : d.x1 - 30;
  const len = look === "long" ? Math.min(h * 0.5, 1300) : look === "standard" ? 160 : look === "knob" ? 30 : look === "profile" ? h : h * 0.94;
  const yMid = look === "long" ? d.y0 + 60 + len / 2 : (d.y0 + d.y1) / 2;
  return <line x1={X(x)} x2={X(x)} y1={Y(yMid - len / 2)} y2={Y(yMid + len / 2)} stroke={look === "integral" ? "#2a2521" : INK} strokeWidth={sw * (look === "knob" ? 6 : look === "profile" ? 4 : 3)} strokeLinecap="round" />;
}

function DimensionArrows({ W, H, X, Y, sw, fs, top, mount, marginL }: { W: number; H: number; X: (x: number) => number; Y: (y: number) => number; sw: number; fs: number; top: number; mount: number; marginL: number }) {
  const arrow = fs * 0.55;
  const yLine = Y(0) + fs * 2.4;
  const xLine = X(-W / 2) - marginL * 0.55;
  const yBottom = Y(mount);
  const yTop = Y(top);
  void H;
  const pill = (cx: number, cy: number, text: string, testId: string) => (
    <g data-testid={testId}>
      <rect x={cx - fs * 2.2} y={cy - fs * 0.85} width={fs * 4.4} height={fs * 1.7} rx={fs * 0.85} fill="#fff" stroke={SEL} strokeWidth={sw} />
      <text x={cx} y={cy + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={700} fill={SEL} direction="ltr">
        {text}
      </text>
    </g>
  );
  return (
    <g stroke={SEL} strokeWidth={sw * 1.4} fill={SEL}>
      <line x1={X(-W / 2)} x2={X(-W / 2)} y1={Y(0)} y2={yLine + arrow} strokeWidth={sw} />
      <line x1={X(W / 2)} x2={X(W / 2)} y1={Y(0)} y2={yLine + arrow} strokeWidth={sw} />
      <line x1={X(-W / 2)} x2={X(W / 2)} y1={yLine} y2={yLine} />
      <path d={`M${X(-W / 2)} ${yLine} l${arrow * 1.6} -${arrow * 0.6} v${arrow * 1.2} z`} stroke="none" />
      <path d={`M${X(W / 2)} ${yLine} l-${arrow * 1.6} -${arrow * 0.6} v${arrow * 1.2} z`} stroke="none" />
      {pill(X(0), yLine, `${cmText(W)} ס״מ`, "dim-width")}

      <line x1={X(-W / 2)} x2={xLine - arrow} y1={yTop} y2={yTop} strokeWidth={sw} />
      <line x1={X(-W / 2)} x2={xLine - arrow} y1={yBottom} y2={yBottom} strokeWidth={sw} />
      <line x1={xLine} x2={xLine} y1={yTop} y2={yBottom} />
      <path d={`M${xLine} ${yTop} l-${arrow * 0.6} ${arrow * 1.6} h${arrow * 1.2} z`} stroke="none" />
      <path d={`M${xLine} ${yBottom} l-${arrow * 0.6} -${arrow * 1.6} h${arrow * 1.2} z`} stroke="none" />
      {pill(xLine, (yTop + yBottom) / 2, `${cmText(top - mount)} ס״מ`, "dim-height")}
    </g>
  );
}
