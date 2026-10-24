"use client";

import { useMemo } from "react";
import { Color, RepeatWrapping } from "three";
import type { QualitySettings } from "./quality";
import { grainBump, parquetTexture, wallBump } from "./textures";

export interface RoomProps {
  width: number;
  height: number;
  depth: number;
  bottom: number;
  niche?: boolean;
  q: QualitySettings;
  enabled: boolean;
}

/** חדר ברירת מחדל: רצפת פרקט, קיר אפור וסוקל. כבוי: רק משטח שמקבל צל. */
export function Room({ width, height, depth, bottom, niche, q, enabled }: RoomProps) {
  const zWall = -depth / 2 - 0.002;
  const wallW = Math.max(9, width + 5);
  const wallH = Math.max(2.9, bottom + height + 0.5);
  const floorSize = 14;

  const floor = useMemo(() => {
    if (!enabled || !q.textures) return null;
    const p = parquetTexture(q.textureSize, q.bump);
    const tile = 1.2;
    for (const t of [p.map, p.bump]) {
      if (!t) continue;
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(floorSize / tile, floorSize / tile);
      t.needsUpdate = true;
    }
    return p;
  }, [enabled, q.textures, q.textureSize, q.bump]);

  const wallBumpMap = useMemo(() => {
    if (!q.bump) return null;
    const t = wallBump(256).clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(wallW / 0.9, wallH / 0.9);
    t.needsUpdate = true;
    return t;
  }, [q.bump, wallW, wallH]);

  const floorBump = useMemo(() => {
    if (!q.bump || floor?.bump) return null;
    return grainBump(256);
  }, [q.bump, floor]);

  if (!enabled) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <shadowMaterial opacity={0.28} />
      </mesh>
    );
  }

  return (
    <group name="room">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial
          color={floor ? "#ffffff" : new Color("#b7a07e")}
          map={floor?.map ?? null}
          bumpMap={floor?.bump ?? floorBump}
          bumpScale={1.2}
          roughness={0.42}
          metalness={0}
        />
      </mesh>
      <mesh position={[0, wallH / 2, zWall]} receiveShadow>
        <planeGeometry args={[wallW, wallH]} />
        <meshStandardMaterial color="#6c6e72" roughness={0.96} metalness={0} bumpMap={wallBumpMap} bumpScale={0.25} />
      </mesh>
      <mesh position={[0, 0.045, zWall + 0.009]} receiveShadow castShadow={q.shadows}>
        <boxGeometry args={[wallW, 0.09, 0.018]} />
        <meshStandardMaterial color="#ecebe7" roughness={0.6} />
      </mesh>
      {niche &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * (width / 2 + 0.002), wallH / 2, -depth / 2 + 1.5]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow>
            <planeGeometry args={[3, wallH]} />
            <meshStandardMaterial color="#6c6e72" roughness={0.96} metalness={0} />
          </mesh>
        ))}
    </group>
  );
}
