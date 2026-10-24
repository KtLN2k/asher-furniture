export type Tier = "high" | "medium" | "low";
export type QualityChoice = Tier | "auto";

export interface QualitySettings {
  tier: Tier;
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  contactShadows: boolean;
  contactResolution: number;
  envResolution: number;
  /** טקסטורות פרוצדורליות (עץ, פרקט) ומפות בליטה. */
  textures: boolean;
  textureSize: number;
  bump: boolean;
  /** מראה זכוכית/מראה עם השתקפות סביבה. */
  reflections: boolean;
  /** גודל טקסטורת הרצפה והקירות (פיקסלים). */
  floorTextureSize: number;
  /** גודל קובייה לבדיקת השתקפות חדר אמיתי (0 = כבוי): מראה וחזיתות מבריקות משקפות את החדר. */
  probeSize: number;
  /** חסימת אור סביבתית (GTAO) ומעבד תמונה: רק באיכות גבוהה. */
  ao: boolean;
  /** השתקפות הרצפה ברהיט (מחזירור). */
  floorReflection: boolean;
  /** שכבת לק עדינה לחזיתות (MeshPhysicalMaterial). */
  clearcoat: boolean;
  /** חיתוך קצוות מעוגל של חזיתות: 0 כבוי, אחרת מספר מקטעים. */
  bevelSegments: number;
  shadowType: "percentage" | "variance";
}

export const TIER_LABELS: Record<Tier, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };

export const QUALITY_PRESETS: Record<Tier, QualitySettings> = {
  high: {
    tier: "high",
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    contactShadows: true,
    contactResolution: 1024,
    envResolution: 256,
    textures: true,
    textureSize: 1024,
    bump: true,
    reflections: true,
    floorTextureSize: 2048,
    probeSize: 256,
    ao: true,
    floorReflection: true,
    clearcoat: true,
    bevelSegments: 2,
    shadowType: "variance",
  },
  medium: {
    tier: "medium",
    dpr: [1, 1.5],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    contactShadows: true,
    contactResolution: 512,
    envResolution: 128,
    textures: true,
    textureSize: 512,
    bump: true,
    reflections: true,
    floorTextureSize: 1024,
    probeSize: 128,
    ao: false,
    floorReflection: false,
    clearcoat: true,
    bevelSegments: 1,
    shadowType: "percentage",
  },
  low: {
    tier: "low",
    dpr: [1, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    contactShadows: true,
    contactResolution: 256,
    envResolution: 64,
    textures: true,
    textureSize: 256,
    bump: false,
    reflections: false,
    floorTextureSize: 512,
    probeSize: 0,
    ao: false,
    floorReflection: false,
    clearcoat: false,
    bevelSegments: 0,
    shadowType: "percentage",
  },
};

export interface DeviceInfo {
  userAgent: string;
  cores: number;
  memoryGb: number | null;
  coarsePointer: boolean;
  screenMin: number;
  dpr: number;
  renderer?: string;
}

/** בחירת דרגת איכות לפי המכשיר. אנדרואיד חלש (מעט ליבות או זיכרון) מקבל איכות נמוכה מההתחלה. */
export function pickTier(d: DeviceInfo): Tier {
  const android = /android/i.test(d.userAgent);
  const mobile = android || /iphone|ipad|mobile/i.test(d.userAgent) || (d.coarsePointer && d.screenMin < 900);
  const software = /swiftshader|llvmpipe|software/i.test(d.renderer ?? "");
  if (software) return "low";
  if (android) {
    if (d.cores <= 4 || (d.memoryGb !== null && d.memoryGb <= 3)) return "low";
    return "medium";
  }
  if (mobile) return d.cores <= 4 ? "low" : "medium";
  if (d.cores >= 8 && (d.memoryGb === null || d.memoryGb >= 8)) return "high";
  return "medium";
}

export function readDevice(renderer?: string): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: nav.userAgent,
    cores: nav.hardwareConcurrency || 4,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    screenMin: Math.min(window.screen.width, window.screen.height),
    dpr: window.devicePixelRatio || 1,
    renderer,
  };
}

export const nextLower = (t: Tier): Tier => (t === "high" ? "medium" : "low");

const KEY = "asher:quality";

export function readChoice(): QualityChoice {
  try {
    const q = new URLSearchParams(window.location.search).get("quality");
    if (q === "high" || q === "medium" || q === "low" || q === "auto") return q;
    const v = localStorage.getItem(KEY);
    if (v === "high" || v === "medium" || v === "low") return v;
  } catch {
    /* אחסון לא זמין */
  }
  return "auto";
}

export function saveChoice(c: QualityChoice): void {
  try {
    if (c === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch {
    /* אחסון לא זמין */
  }
}

/** מדד FPS נע: מתעלם מפערים ארוכים (המסך היה במנוחה) ומחזיר true כשמומלץ להוריד איכות. */
export class FrameGovernor {
  private samples: number[] = [];
  private slowWindows = 0;
  constructor(
    private windowSize = 40,
    private slowMs = 36,
  ) {}

  push(deltaSeconds: number): boolean {
    const ms = deltaSeconds * 1000;
    if (ms > 250 || ms <= 0) return false;
    this.samples.push(ms);
    if (this.samples.length < this.windowSize) return false;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (avg > this.slowMs) this.slowWindows++;
    else this.slowWindows = 0;
    if (this.slowWindows >= 2) {
      this.slowWindows = 0;
      return true;
    }
    return false;
  }

  reset(): void {
    this.samples = [];
    this.slowWindows = 0;
  }
}
