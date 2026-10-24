import type { RoomKey } from "@/domain/rooms";
import { PARQUET_OAK, type ParquetOptions, type TileOptions } from "./textures";

export type FloorSpec =
  | { kind: "parquet"; parquet: ParquetOptions; tint: string; gloss: number }
  | { kind: "tile"; tile: TileOptions; tint: string; gloss: number }
  | { kind: "concrete"; hex: string; tint: string; gloss: number };

export interface RoomPreset {
  key: RoomKey;
  wall: string;
  wallRough: number;
  /** חיפוי קרמי על הקירות (חדר רחצה). */
  wallTile?: TileOptions;
  ceiling: string;
  skirting: string;
  skirtingHeight: number;
  floor: FloorSpec;
  rug?: { hex: string; border: string; width: number; depth: number; round?: boolean };
  window?: boolean;
  /** ספוט תקרה (כמו בתמונת היעד). */
  spot?: boolean;
  /** עוצמת תאורת התקרה היחסית. */
  ambient: number;
}

export const ROOM_PRESETS: Record<RoomKey, RoomPreset> = {
  bedroom: {
    key: "bedroom",
    wall: "#5d5c5a",
    wallRough: 0.94,
    ceiling: "#f1f0ee",
    skirting: "#c9b9a3",
    skirtingHeight: 0.08,
    floor: { kind: "parquet", parquet: PARQUET_OAK, tint: "#ffffff", gloss: 0.22 },
    spot: true,
    ambient: 1,
  },
  living: {
    key: "living",
    wall: "#d9d0c3",
    wallRough: 0.92,
    ceiling: "#f6f4f0",
    skirting: "#f1efe9",
    skirtingHeight: 0.1,
    floor: { kind: "parquet", parquet: { hex: "#8f7a62", columns: 10, rows: 2, variation: 0.09, roughness: 0.46 }, tint: "#ffffff", gloss: 0.38 },
    rug: { hex: "#8f9396", border: "#6f7478", width: 2.6, depth: 1.9 },
    window: true,
    spot: true,
    ambient: 1.1,
  },
  kids: {
    key: "kids",
    wall: "#a9c9d4",
    wallRough: 0.9,
    ceiling: "#f7f6f3",
    skirting: "#ffffff",
    skirtingHeight: 0.08,
    floor: { kind: "parquet", parquet: { hex: "#e0cba3", columns: 14, rows: 3, variation: 0.06, roughness: 0.52 }, tint: "#ffffff", gloss: 0.28 },
    rug: { hex: "#f1b84b", border: "#e0793d", width: 1.9, depth: 1.9, round: true },
    window: true,
    ambient: 1.15,
  },
  bathroom: {
    key: "bathroom",
    wall: "#e4e8ea",
    wallRough: 0.35,
    wallTile: { hex: "#c3cfd3", grout: "#98a3a8", nx: 8, ny: 4, variation: 0.012, roughness: 0.2 },
    ceiling: "#f4f6f7",
    skirting: "#d6dbde",
    skirtingHeight: 0.07,
    floor: { kind: "tile", tile: { hex: "#62686c", grout: "#4a4f52", nx: 4, ny: 4, variation: 0.035, roughness: 0.16 }, tint: "#ffffff", gloss: 0.55 },
    spot: true,
    ambient: 1.1,
  },
  neutral: {
    key: "neutral",
    wall: "#dfdedb",
    wallRough: 0.95,
    ceiling: "#f2f2f0",
    skirting: "#f2f2f0",
    skirtingHeight: 0.06,
    floor: { kind: "concrete", hex: "#b3b3b1", tint: "#ffffff", gloss: 0.14 },
    ambient: 1.05,
  },
};
