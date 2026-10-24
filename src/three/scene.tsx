"use client";

import { CameraControls, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { BackSide, Box3, Color, Vector2, Vector3, type Group, type Mesh, type Object3D, type SpotLight } from "three";
import type CameraControlsImpl from "camera-controls";
import { FurnitureMesh } from "./furniture";
import type { FurnitureModel } from "./model";
import type { RoomKey } from "@/domain/rooms";
import { PostFX, type PostHandle } from "./post";
import { RoomProbe, type ProbeHandle } from "./probe";
import { FrameGovernor, type QualitySettings } from "./quality";
import { Room } from "./room";
import { ROOM_PRESETS, type RoomPreset } from "./room-presets";

export type ViewKey = "perspective" | "front" | "side" | "top";

export const VIEW_LABELS: Record<ViewKey, string> = {
  perspective: "תלת-ממד",
  front: "חזית",
  side: "צד",
  top: "מלמעלה",
};

export interface SceneStats {
  doors: number;
  drawers: number;
  shelves: number;
  dividers: number;
  rods: number;
  handles: number;
  openDoors: number;
  openDrawers: number;
  /** מידות המעטפת של הגוף והחזיתות (בלי ידיות), במ״מ. */
  bboxMm: { width: number; height: number; depth: number; bottom: number };
  doorsInfo: Array<{ id: string; style: string; handle: string; handleColor: string; opening: string | null; open: number }>;
  tier: string;
  view: string;
  room: string;
  /** סטטוס שכבות איכות פעילות (לבדיקות). */
  fx: { ao: boolean; probe: boolean; floorReflection: boolean; clearcoat: boolean };
}

export interface HiResImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface SceneHandle {
  capture: () => string | null;
  stats: () => SceneStats | null;
  /** הדמיה ברזולוציה כפולה (מעבד תמונה מלא + עומק שדה עדין). null אם איכות ההדמיה לא מוכנה. */
  renderImage: () => HiResImage | null;
  tier: () => string;
}

const FOV = 32;

function viewDirection(view: ViewKey): Vector3 {
  switch (view) {
    case "front":
      return new Vector3(0, 0.03, 1);
    case "side":
      return new Vector3(1, 0.03, 0);
    case "top":
      return new Vector3(0, 1, 0.0001);
    default:
      return new Vector3(-0.5, 0.2, 1);
  }
}

function fitDistance(model: FurnitureModel, view: ViewKey, aspect: number): number {
  const { width, height, depth } = model.bounds;
  const t = Math.tan((FOV * Math.PI) / 360);
  let w = width;
  let h = height;
  if (view === "side") {
    w = depth;
  } else if (view === "top") {
    h = depth;
  } else if (view === "perspective") {
    w = width * 0.9 + depth * 0.7;
    h = height * 1.08;
  }
  const byH = h / 2 / t;
  const byW = w / 2 / (t * aspect);
  const extra = view === "front" ? depth / 2 : view === "side" ? width * 0.0 : 0;
  return Math.max(byH, byW) * (byW > byH ? 1.12 : 1.34) + extra + 0.35;
}

interface Props {
  model: FurnitureModel;
  q: QualitySettings;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  roomOn: boolean;
  room: RoomKey;
  view: ViewKey;
  viewNonce: number;
  onDowngrade: () => void;
  handleRef: Ref<SceneHandle>;
}

export function SceneContent({ model, q, openIds, onToggle, roomOn, room, view, viewNonce, onDowngrade, handleRef }: Props) {
  const controls = useRef<CameraControlsImpl>(null);
  const furniture = useRef<Group>(null);
  const probe = useRef<ProbeHandle>(null);
  const post = useRef<PostHandle>(null);
  const preset = ROOM_PRESETS[room];
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const governor = useMemo(() => new FrameGovernor(), []);
  const { width, height, depth, bottom, niche } = model.bounds;
  const aspect = size.width / Math.max(1, size.height);

  const target = useMemo(() => new Vector3(0, bottom + height / 2, 0), [bottom, height]);
  const viewRef = useRef(view);
  const lastFit = useRef<string>("");

  const applyView = useCallback(
    (v: ViewKey, animate: boolean) => {
      const c = controls.current;
      if (!c) return;
      const dist = fitDistance(model, v, aspect);
      const dir = viewDirection(v).normalize();
      const pos = target.clone().add(dir.multiplyScalar(dist));
      void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, animate);
      invalidate();
    },
    [model, aspect, target, invalidate],
  );

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    applyView(view, lastFit.current !== "");
    lastFit.current = `${width.toFixed(2)}|${height.toFixed(2)}|${depth.toFixed(2)}|${bottom.toFixed(2)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNonce]);

  useEffect(() => {
    const key = `${width.toFixed(2)}|${height.toFixed(2)}|${depth.toFixed(2)}|${bottom.toFixed(2)}`;
    if (lastFit.current === key || !controls.current) return;
    const c = controls.current;
    const cur = new Vector3();
    c.getPosition(cur);
    const dirNow = cur.sub(target).normalize();
    const dist = fitDistance(model, viewRef.current, aspect);
    const pos = target.clone().add(dirNow.multiplyScalar(dist));
    void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, lastFit.current !== "");
    lastFit.current = key;
    invalidate();
  }, [width, height, depth, bottom, model, aspect, target, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => e.preventDefault();
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl]);

  useFrame((_, delta) => {
    if (q.tier !== "low" && governor.push(delta)) onDowngrade();
  });

  const collect = useCallback((): SceneStats | null => {
    const root = furniture.current;
    if (!root) return null;
    const counts = { shelves: 0, dividers: 0, rods: 0 };
    const box = new Box3();
    const tmp = new Box3();
    let handleGroups = 0;
    let doors = 0;
    let drawers = 0;
    let openDoors = 0;
    let openDrawers = 0;
    const doorsInfo: SceneStats["doorsInfo"] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o: Object3D) => {
      const kind = o.userData.kind as string | undefined;
      if (!(o as Mesh).isMesh || !kind) return;
      if (kind === "shelf") counts.shelves++;
      else if (kind === "divider") counts.dividers++;
      else if (kind === "rod") counts.rods++;
      if (kind.startsWith("handle") || kind === "groove") return;
      tmp.setFromObject(o);
      box.union(tmp);
    });
    for (const g of root.children) {
      if (!g.userData.movable) continue;
      const hasHandle = g.children.some((c) => (c.userData.kind as string | undefined) === "handle");
      if (hasHandle) handleGroups++;
      if (g.userData.movable === "door") {
        doors++;
        if (g.userData.open > 0.5) openDoors++;
        doorsInfo.push({ id: g.userData.facadeId, style: g.userData.style, handle: g.userData.handle, handleColor: g.userData.handleColor, opening: g.userData.opening, open: g.userData.open });
      } else {
        drawers++;
        if (g.userData.open > 0.5) openDrawers++;
      }
    }
    const sz = box.getSize(new Vector3());
    return {
      doors,
      drawers,
      shelves: counts.shelves,
      dividers: counts.dividers,
      rods: counts.rods,
      handles: handleGroups,
      openDoors,
      openDrawers,
      bboxMm: { width: Math.round(sz.x * 1000), height: Math.round(sz.y * 1000), depth: Math.round(sz.z * 1000), bottom: Math.round(box.min.y * 1000) },
      doorsInfo,
      tier: q.tier,
      view: viewRef.current,
      room,
      fx: { ao: q.ao, probe: q.probeSize > 0, floorReflection: q.floorReflection, clearcoat: q.clearcoat },
    };
  }, [q.tier, q.ao, q.probeSize, q.floorReflection, q.clearcoat, room]);

  useImperativeHandle(
    handleRef,
    () => ({
      capture: () => {
        if (post.current) {
          const canvas = post.current.renderHiRes({ pixelRatio: Math.max(1, gl.getPixelRatio()), focus: camera.position.distanceTo(target) });
          return canvas.toDataURL("image/png");
        }
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      },
      stats: collect,
      tier: () => q.tier,
      renderImage: () => {
        const handle = post.current;
        if (!handle) return null;
        probe.current?.update();
        const css = gl.getSize(new Vector2());
        const w = css.x;
        const h = css.y;
        const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
        const maxSide = Math.min(gl.capabilities.maxTextureSize, coarse ? 2600 : 4096);
        const wanted = Math.max(gl.getPixelRatio(), 1) * 2;
        const ratio = Math.max(1, Math.min(wanted, maxSide / Math.max(w, h)));
        const focus = camera.position.distanceTo(target);
        const canvas = handle.renderHiRes({ pixelRatio: ratio, focus });
        return { canvas, width: canvas.width, height: canvas.height };
      },
    }),
    [gl, scene, camera, collect, q.tier, target],
  );

  const shadowSpan = Math.max(width, height) * 0.85 + 1.2;
  const lightPos: [number, number, number] = [-width * 0.2 - 1.2, bottom + height + 1.4, depth / 2 + 3.2];
  const wallH = Math.max(2.9, bottom + height + 0.55);
  const probePos: [number, number, number] = [0, bottom + Math.min(height, 2.4) * 0.5, depth / 2 + 0.35];
  const probeSignature = `${room}|${roomOn}|${width.toFixed(2)}|${height.toFixed(2)}|${depth.toFixed(2)}|${bottom.toFixed(2)}|${q.tier}`;
  const shell = useMemo(() => envShell(preset), [preset]);

  return (
    <>
      <color attach="background" args={[roomOn ? shell.background : "#efeae2"]} />
      <hemisphereLight args={["#ffffff", "#bdbcba", 0.25 * preset.ambient]} />
      <directionalLight
        position={lightPos}
        intensity={1.9}
        color="#ffffff"
        shadow-intensity={0.55}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMapSize, q.shadowMapSize]}
        shadow-bias={q.shadowType === "variance" ? -0.0002 : -0.0004}
        shadow-normalBias={0.02}
        shadow-radius={q.shadowType === "variance" ? 7 : 5}
        shadow-blurSamples={16}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
      />
      {preset.spot && roomOn && (
        <CeilingSpot
          position={[width * 0.12, wallH - 0.06, depth / 2 + 0.55]}
          aim={[0, bottom + height * 0.45, -depth / 2]}
          intensity={11 * preset.ambient}
        />
      )}
      <Environment key={`${room}|${q.envResolution}`} resolution={q.envResolution} frames={1} environmentIntensity={0.9 * preset.ambient}>
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[18, 6.4, 18]} />
          {shell.faces.map((c, i) => (
            <meshBasicMaterial key={i} attach={`material-${i}`} color={c} side={BackSide} toneMapped={false} />
          ))}
        </mesh>
        <Lightformer form="rect" intensity={3.4} position={[0, 4.6, 3]} scale={[9, 3.2, 1]} rotation-x={Math.PI / 2} color="#ffffff" />
        <Lightformer form="rect" intensity={1.6} position={[-5, 2.4, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} color="#ffffff" />
        <Lightformer form="rect" intensity={preset.window ? 4 : 1.2} position={[5, 1.8, 0.5]} scale={[2.6, 3, 1]} rotation-y={-Math.PI / 2} color="#e6efff" />
        <Lightformer form="rect" intensity={2.4} position={[0, 2.2, 7]} scale={[7, 2.2, 1]} rotation-y={Math.PI} color="#f4f8ff" />
        <Lightformer form="ring" intensity={1} position={[0, 2, 6]} scale={3} color="#ffffff" />
      </Environment>

      <Room width={width} height={height} depth={depth} bottom={bottom} niche={niche} q={q} enabled={roomOn} room={room} />
      <FurnitureMesh model={model} q={q} openIds={openIds} onToggle={onToggle} groupRef={furniture} />
      {q.probeSize > 0 && roomOn && <RoomProbe size={q.probeSize} position={probePos} furniture={furniture} signature={probeSignature} handleRef={probe} />}
      {q.contactShadows && (
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.55}
          scale={Math.max(width, depth) + 2.4}
          blur={2.2}
          far={Math.min(2.2, height)}
          resolution={q.contactResolution}
          color="#14110e"
        />
      )}
      {q.ao && <PostFX handleRef={post} />}

      <CameraControls
        ref={controls}
        makeDefault
        minDistance={0.8}
        maxDistance={Math.max(width, height, depth) * 5 + 4}
        maxPolarAngle={Math.PI / 2 - 0.015}
        smoothTime={0.22}
        draggingSmoothTime={0.12}
        dollySpeed={0.6}
      />
    </>
  );
}

export { FOV };

const mix = (hex: string, k: number): Color => new Color(hex).multiplyScalar(k);

function floorHex(p: RoomPreset): string {
  const f = p.floor;
  return f.kind === "parquet" ? f.parquet.hex : f.kind === "tile" ? f.tile.hex : f.hex;
}

/** מעטפת הסביבה לתאורה: קירות, תקרה ורצפה בצבעי החדר, כדי שהאור המוחזר יקבל את הגוון שלהם. */
function envShell(p: RoomPreset): { faces: Color[]; background: string } {
  const wall = mix(p.wall, 0.9);
  const ceiling = mix(p.ceiling, 1.2);
  const floor = mix(floorHex(p), 0.75);
  return { faces: [wall, wall, ceiling, floor, wall, wall], background: p.wall };
}

/** ספוט תקרה רחב ורך: יוצר מעבר הארה עדין על הקיר והחזיתות, כמו בהדמיות מוצר. */
function CeilingSpot({ position, aim, intensity }: { position: [number, number, number]; aim: [number, number, number]; intensity: number }) {
  const ref = useRef<SpotLight>(null);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.target.position.set(aim[0], aim[1], aim[2]);
    l.target.updateMatrixWorld();
  }, [aim]);
  return <spotLight ref={ref} position={position} angle={1.05} penumbra={1} intensity={intensity} decay={1.7} distance={9} color="#ffffff" />;
}
