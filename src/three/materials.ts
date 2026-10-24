import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, type Material } from "three";
import type { MaterialSpec } from "./model";
import type { QualitySettings } from "./quality";
import { grainBump, woodTexture } from "./textures";

const cache = new Map<string, Material>();

export function getMaterial(spec: MaterialSpec, q: QualitySettings): Material {
  const key = `${spec.key}|${q.tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m: Material;
  switch (spec.kind) {
    case "wood": {
      const tex = q.textures && spec.texture ? woodTexture(spec.texture, spec.hex, q.textureSize, q.bump) : null;
      m = new MeshStandardMaterial({
        color: tex ? new Color("#ffffff") : new Color(spec.hex),
        map: tex?.map ?? null,
        bumpMap: tex?.bump ?? null,
        bumpScale: 0.6,
        roughness: Math.max(0.4, spec.roughness),
        metalness: 0,
      });
      break;
    }
    case "mirror":
      m = q.reflections
        ? new MeshPhysicalMaterial({ color: new Color(spec.hex), metalness: 1, roughness: 0.02, envMapIntensity: 1.6, clearcoat: 0.6, clearcoatRoughness: 0.02 })
        : new MeshStandardMaterial({ color: new Color(spec.hex), metalness: 0.9, roughness: 0.08, envMapIntensity: 1.3 });
      break;
    case "glass":
      m = new MeshStandardMaterial({
        color: new Color(spec.hex),
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        side: DoubleSide,
        envMapIntensity: 1.4,
      });
      break;
    case "metal":
      m = new MeshStandardMaterial({ color: new Color(spec.hex), metalness: spec.metalness, roughness: spec.roughness, envMapIntensity: 1.2 });
      break;
    case "dark":
      m = new MeshStandardMaterial({ color: new Color(spec.hex), metalness: spec.metalness, roughness: spec.roughness });
      break;
    default: {
      const bump = q.bump ? grainBump(256) : null;
      if (bump) bump.wrapS = bump.wrapT = RepeatWrapping;
      m = new MeshStandardMaterial({
        color: new Color(spec.hex),
        roughness: spec.roughness,
        metalness: 0,
        bumpMap: bump,
        bumpScale: 0.35,
      });
    }
  }
  cache.set(key, m);
  return m;
}
