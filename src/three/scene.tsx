"use client";

import { CameraControls, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { BackSide, Box3, Vector3, type Group, type Mesh, type Object3D } from "three";
import type CameraControlsImpl from "camera-controls";
import { FurnitureMesh } from "./furniture";
import type { FurnitureModel } from "./model";
import { FrameGovernor, type QualitySettings } from "./quality";
import { Room } from "./room";

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
}

export interface SceneHandle {
  capture: () => string | null;
  stats: () => SceneStats | null;
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
  view: ViewKey;
  viewNonce: number;
  onDowngrade: () => void;
  handleRef: Ref<SceneHandle>;
}

export function SceneContent({ model, q, openIds, onToggle, roomOn, view, viewNonce, onDowngrade, handleRef }: Props) {
  const controls = useRef<CameraControlsImpl>(null);
  const furniture = useRef<Group>(null);
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
    };
  }, [q.tier]);

  useImperativeHandle(
    handleRef,
    () => ({
      capture: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      },
      stats: collect,
    }),
    [gl, scene, camera, collect],
  );

  const shadowSpan = Math.max(width, height) * 0.85 + 1.2;
  const lightPos: [number, number, number] = [-width * 0.2 - 1.2, bottom + height + 1.4, depth / 2 + 3.2];

  return (
    <>
      <color attach="background" args={[roomOn ? "#d9d6d0" : "#efeae2"]} />
      <hemisphereLight args={["#ffffff", "#c9c5bf", 0.75]} />
      <directionalLight
        position={lightPos}
        intensity={2.2}
        color="#ffffff"
        shadow-intensity={0.5}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMapSize, q.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
      />
      <Environment resolution={q.envResolution} frames={1} environmentIntensity={1.15}>
        <mesh scale={40}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#7d8083" side={BackSide} toneMapped={false} />
        </mesh>
        <Lightformer form="rect" intensity={3.2} position={[0, 5, 3]} scale={[9, 3, 1]} rotation-x={Math.PI / 2} color="#ffffff" />
        <Lightformer form="rect" intensity={2.2} position={[-5, 2.4, 1]} scale={[3, 4, 1]} rotation-y={Math.PI / 2} color="#ffffff" />
        <Lightformer form="rect" intensity={1.4} position={[5, 1.8, 2]} scale={[2.5, 3, 1]} rotation-y={-Math.PI / 2} color="#dfe8ff" />
        <Lightformer form="ring" intensity={1.2} position={[0, 2, 6]} scale={3} color="#ffffff" />
        <Lightformer form="rect" intensity={0.5} position={[0, -1, 0]} scale={[8, 8, 1]} rotation-x={-Math.PI / 2} color="#d6d2cb" />
      </Environment>

      <Room width={width} height={height} depth={depth} bottom={bottom} niche={niche} q={q} enabled={roomOn} />
      <FurnitureMesh model={model} q={q} openIds={openIds} onToggle={onToggle} groupRef={furniture} />
      {q.contactShadows && (
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.5}
          scale={Math.max(width, depth) + 2.4}
          blur={2.6}
          far={Math.min(2.2, height)}
          resolution={q.contactResolution}
          color="#2a1d10"
        />
      )}

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
