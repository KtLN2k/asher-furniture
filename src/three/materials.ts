import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, type Material, type Texture } from "three";
import type { MaterialSpec } from "./model";
import type { QualitySettings } from "./quality";
import { grainBump, woodTexture } from "./textures";

const cache = new Map<string, Material>();
const reflective = new Set<MeshStandardMaterial>();
let probeEnv: Texture | null = null;

/**
 * השתקפות חדר אמיתי: המראה והחזיתות המבריקות מקבלות מפת סביבה שנלקחה מהחדר הנוכחי.
 * המפה משותפת לכל החומרים ה״משקפים״, ולכן מעדכנים אותם ביחד.
 */
export function setReflectionEnv(tex: Texture | null): void {
  probeEnv = tex;
  for (const m of reflective) {
    m.envMap = tex;
    m.needsUpdate = true;
  }
}

export function getReflectionEnv(): Texture | null {
  return probeEnv;
}

function track<T extends MeshStandardMaterial>(m: T, on: boolean): T {
  if (on) {
    reflective.add(m);
    m.envMap = probeEnv;
  }
  return m;
}

const grain = (q: QualitySettings): Texture | null => {
  if (!q.bump) return null;
  const t = grainBump(256);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
};

export function getMaterial(spec: MaterialSpec, q: QualitySettings): Material {
  const key = `${spec.key}|${q.tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m: Material;
  const glossy = Boolean(spec.reflective) && q.probeSize > 0;
  const coat = q.clearcoat ? (spec.clearcoat ?? 0) : 0;
  switch (spec.kind) {
    case "wood": {
      const tex = q.textures && spec.texture ? woodTexture(spec.texture, spec.hex, q.textureSize, q.bump) : null;
      const props = {
        color: tex ? new Color("#ffffff") : new Color(spec.hex),
        map: tex?.map ?? null,
        bumpMap: tex?.bump ?? null,
        roughnessMap: tex?.rough ?? null,
        bumpScale: 0.7,
        roughness: Math.max(0.3, spec.roughness),
        metalness: 0,
      };
      m = q.clearcoat
        ? track(new MeshPhysicalMaterial({ ...props, clearcoat: coat * 0.7, clearcoatRoughness: 0.32 }), glossy)
        : new MeshStandardMaterial(props);
      break;
    }
    case "mirror":
      m = q.reflections
        ? track(new MeshPhysicalMaterial({ color: new Color(spec.hex), metalness: 1, roughness: 0.015, envMapIntensity: 1.25, clearcoat: 0.5, clearcoatRoughness: 0.02 }), q.probeSize > 0)
        : new MeshStandardMaterial({ color: new Color(spec.hex), metalness: 0.9, roughness: 0.08, envMapIntensity: 1.3 });
      break;
    case "glass":
      m = track(
        new MeshStandardMaterial({
          color: new Color(spec.hex),
          metalness: 0,
          roughness: 0.04,
          transparent: true,
          opacity: spec.opacity,
          depthWrite: false,
          side: DoubleSide,
          envMapIntensity: 1.4,
        }),
        q.probeSize > 0,
      );
      break;
    case "metal":
      m = new MeshStandardMaterial({ color: new Color(spec.hex), metalness: spec.metalness, roughness: spec.roughness, envMapIntensity: 1.25 });
      break;
    case "dark":
      m = new MeshStandardMaterial({ color: new Color(spec.hex), metalness: spec.metalness, roughness: spec.roughness });
      break;
    default: {
      const props = { color: new Color(spec.hex), roughness: spec.roughness, metalness: 0, bumpMap: grain(q), bumpScale: 0.22 };
      m = q.clearcoat
        ? track(new MeshPhysicalMaterial({ ...props, clearcoat: coat, clearcoatRoughness: 0.3 + spec.roughness * 0.25 }), glossy)
        : new MeshStandardMaterial(props);
    }
  }
  cache.set(key, m);
  return m;
}
