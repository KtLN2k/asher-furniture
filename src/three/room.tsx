"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { Color, RepeatWrapping, type Texture } from "three";
import type { RoomKey } from "@/domain/rooms";
import { PROBE_LAYER } from "./probe";
import type { QualitySettings } from "./quality";
import { ROOM_PRESETS, type RoomPreset } from "./room-presets";
import { concreteTexture, grainBump, parquetTexture, rugTexture, tileTexture, wallBump, type TexturePair } from "./textures";

export interface RoomProps {
  width: number;
  height: number;
  depth: number;
  bottom: number;
  niche?: boolean;
  q: QualitySettings;
  enabled: boolean;
  room: RoomKey;
}

const TILE_M = 2.4;
const SOFTBOX = new Color().setRGB(3.2, 3.2, 3.35);
const DAYLIGHT = new Color().setRGB(1.6, 1.7, 1.85);

function repeated(tex: Texture | null | undefined, rx: number, ry: number): Texture | null {
  if (!tex) return null;
  const t = tex.clone();
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function floorTextures(p: RoomPreset, q: QualitySettings): TexturePair | null {
  if (!q.textures) return null;
  const size = q.floorTextureSize;
  const f = p.floor;
  if (f.kind === "parquet") return parquetTexture(size, q.bump, f.parquet);
  if (f.kind === "tile") return tileTexture(size, q.bump, f.tile);
  return concreteTexture(Math.min(size, 1024), f.hex, q.bump);
}

/**
 * חדר לדוגמה סביב הרהיט: רצפה, שלושה קירות, סוקל, תקרה וספוט, ולפי החדר גם שטיח וחלון.
 * כבוי: רק משטח שמקבל צל. הפריטים שבשכבת הבדיקה (קיר קדמי וחלון תאורה) נראים רק בהשתקפויות.
 */
export function Room({ width, height, depth, bottom, niche, q, enabled, room }: RoomProps) {
  const preset = ROOM_PRESETS[room];
  const zWall = -depth / 2 - 0.002;
  const wallW = Math.max(9, width + 5);
  const wallH = Math.max(2.9, bottom + height + 0.55);
  const sideX = width / 2 + (niche ? 0.002 : 1.3);
  const sideLen = niche ? 3 : 7;
  const floorSize = 14;
  const showWindow = Boolean(preset.window) && !niche;

  const floor = useMemo(() => (enabled ? floorTextures(preset, q) : null), [enabled, preset, q]);
  const floorMaps = useMemo(() => {
    if (!floor) return null;
    const r = floorSize / TILE_M;
    return { map: repeated(floor.map, r, r), bump: repeated(floor.bump, r, r), rough: repeated(floor.rough, r, r) };
  }, [floor]);

  const grain = useMemo(() => (q.bump ? repeated(grainBump(256), 14, 14) : null), [q.bump]);

  const wallMaps = useMemo(() => {
    if (!enabled) return null;
    const w = preset.wallTile;
    const tile = w && q.textures ? tileTexture(Math.min(q.floorTextureSize, 1024), q.bump, w) : null;
    const back = tile ? { map: repeated(tile.map, wallW / TILE_M, wallH / TILE_M), bump: repeated(tile.bump, wallW / TILE_M, wallH / TILE_M), rough: repeated(tile.rough, wallW / TILE_M, wallH / TILE_M) } : null;
    const side = tile ? { map: repeated(tile.map, sideLen / TILE_M, wallH / TILE_M), bump: repeated(tile.bump, sideLen / TILE_M, wallH / TILE_M), rough: repeated(tile.rough, sideLen / TILE_M, wallH / TILE_M) } : null;
    const paintBump = q.bump && !tile ? repeated(wallBump(256), wallW / 0.9, wallH / 0.9) : null;
    return { back, side, paintBump };
  }, [enabled, preset, q, wallW, wallH, sideLen]);

  const rug = useMemo(() => {
    if (!enabled || !preset.rug || !q.textures) return null;
    return rugTexture(512, preset.rug.hex, preset.rug.border, Boolean(preset.rug.round));
  }, [enabled, preset, q.textures]);

  if (!enabled) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <shadowMaterial opacity={0.28} />
      </mesh>
    );
  }

  const wallMat = (side: boolean) => {
    const set = side ? wallMaps?.side : wallMaps?.back;
    return (
      <meshStandardMaterial
        color={set?.map ? "#ffffff" : preset.wall}
        map={set?.map ?? null}
        bumpMap={set?.bump ?? wallMaps?.paintBump ?? null}
        bumpScale={set ? 1 : 0.2}
        roughnessMap={set?.rough ?? null}
        roughness={preset.wallRough}
        metalness={0}
      />
    );
  };

  const rugSpec = preset.rug;
  const rugZ = depth / 2 + (rugSpec ? rugSpec.depth / 2 - 0.35 : 0);
  const skirtZ = zWall + 0.009;
  const floorColor = floor ? "#d6d2cc" : new Color("#9d8a70");
  const gloss = preset.floor.gloss;
  const floorProps = {
    color: floorColor,
    map: floorMaps?.map ?? null,
    bumpMap: floorMaps?.bump ?? grain,
    roughnessMap: floorMaps?.rough ?? null,
    bumpScale: 0.6,
    roughness: 1,
    metalness: 0,
  };

  return (
    <group name="room">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        {q.floorReflection ? (
          <MeshReflectorMaterial
            {...floorProps}
            resolution={1024}
            blur={[240, 70]}
            mixBlur={1}
            mixStrength={gloss * 1.5}
            mixContrast={1}
            mirror={0}
            depthScale={0}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
          />
        ) : (
          <meshStandardMaterial {...floorProps} roughness={preset.floor.kind === "tile" ? 0.3 : 0.55} />
        )}
      </mesh>

      <mesh position={[0, wallH / 2, zWall]} receiveShadow>
        <planeGeometry args={[wallW, wallH]} />
        {wallMat(false)}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * sideX, wallH / 2, -depth / 2 + sideLen / 2]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow>
          <planeGeometry args={[sideLen, wallH]} />
          {wallMat(true)}
        </mesh>
      ))}
      <mesh position={[0, wallH, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[wallW, 9]} />
        <meshStandardMaterial color={preset.ceiling} roughness={1} metalness={0} />
      </mesh>

      <mesh position={[0, preset.skirtingHeight / 2, skirtZ]} receiveShadow castShadow={q.shadows}>
        <boxGeometry args={[wallW, preset.skirtingHeight, 0.018]} />
        <meshStandardMaterial color={preset.skirting} roughness={0.55} />
      </mesh>
      {!niche &&
        [-1, 1].map((side) => (
          <mesh key={`sk${side}`} position={[side * (sideX - 0.009), preset.skirtingHeight / 2, -depth / 2 + sideLen / 2]} receiveShadow>
            <boxGeometry args={[0.018, preset.skirtingHeight, sideLen]} />
            <meshStandardMaterial color={preset.skirting} roughness={0.55} />
          </mesh>
        ))}

      {rugSpec && rug && (
        <mesh position={[0, 0.006, rugZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          {rugSpec.round ? <circleGeometry args={[rugSpec.width / 2, 64]} /> : <planeGeometry args={[rugSpec.width, rugSpec.depth]} />}
          <meshStandardMaterial color="#ffffff" map={rug.map} bumpMap={rug.bump} bumpScale={1.4} roughness={0.95} metalness={0} />
        </mesh>
      )}

      {showWindow && (
        <group position={[sideX - 0.012, 1.45, -depth / 2 + 2.7]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh>
            <planeGeometry args={[1.5, 1.6]} />
            <meshBasicMaterial color={DAYLIGHT} toneMapped={false} />
          </mesh>
          {[
            [0, 0.82, 1.62, 0.07],
            [0, -0.82, 1.62, 0.07],
            [0.78, 0, 0.07, 1.7],
            [-0.78, 0, 0.07, 1.7],
            [0, 0, 0.04, 1.6],
          ].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0.012]}>
              <boxGeometry args={[w, h, 0.05]} />
              <meshStandardMaterial color="#f7f6f2" roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}

      {q.probeSize > 0 && <ProbeShell preset={preset} depth={depth} width={width} height={wallH} />}
    </group>
  );
}

/** קיר קדמי וחלון תאורה גדול, גלויים רק למצלמת ההשתקפויות (שכבה נפרדת). */
function ProbeShell({ preset, depth, width, height }: { preset: RoomPreset; depth: number; width: number; height: number }) {
  const z = depth / 2 + 4.2;
  return (
    <group>
      <mesh position={[0, height / 2, z]} rotation={[0, Math.PI, 0]} layers={PROBE_LAYER}>
        <planeGeometry args={[Math.max(14, width + 8), height]} />
        <meshStandardMaterial color={preset.wall} roughness={0.95} />
      </mesh>
      <mesh position={[-width * 0.15, height * 0.5, z - 0.02]} rotation={[0, Math.PI, 0]} layers={PROBE_LAYER}>
        <planeGeometry args={[Math.max(3.4, width * 0.75), 1.7]} />
        <meshBasicMaterial color={SOFTBOX} toneMapped={false} />
      </mesh>
    </group>
  );
}
