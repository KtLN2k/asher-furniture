import {
  DOOR_STYLES,
  HANDLE_TYPES,
  type DoorStyle,
  type DoorType,
  type FurnitureDesign,
  type HandleColor,
  type HandlePosition,
  type HandleType,
  type Opening,
} from "./design";

export type FacadeKind = "door" | "drawer";

export const STYLE_INFO: Record<DoorStyle, { label: string; hint: string }> = {
  flat: { label: "חלקה", hint: "משטח חלק ונקי" },
  framed: { label: "עם מסגרת", hint: "מסגרת בולטת סביב פנל" },
  grooved: { label: "עם חריצים", hint: "קווי חריץ אנכיים" },
  glass: { label: "זכוכית", hint: "זכוכית במסגרת" },
  mirror: { label: "מראה", hint: "משטח מראה" },
};

export const HANDLE_INFO: Record<HandleType, { label: string; hint: string }> = {
  standard: { label: "ידית רגילה", hint: "ידית קשת קצרה" },
  long: { label: "ידית ארוכה", hint: "פס ארוך לאורך הדלת" },
  knob: { label: "כפתור", hint: "כפתור עגול קטן" },
  integral: { label: "אינטגרלית", hint: "חריץ אחיזה בקצה החזית" },
  profile: { label: "פרופיל אלומיניום", hint: "פרופיל לכל אורך הקצה" },
  push: { label: "פתיחה בלחיצה", hint: "ללא ידית, לוחצים לפתיחה" },
  none: { label: "ללא ידית גלויה", hint: "בלי שום ידית" },
};

export const HANDLE_COLOR_INFO: Record<HandleColor, { label: string; hex: string; metal: number; rough: number }> = {
  black: { label: "שחור", hex: "#161616", metal: 0.55, rough: 0.38 },
  steel: { label: "נירוסטה", hex: "#c4c7cb", metal: 1, rough: 0.3 },
  brass: { label: "פליז", hex: "#b8924a", metal: 1, rough: 0.32 },
  white: { label: "לבן", hex: "#efeeea", metal: 0.1, rough: 0.5 },
};

export const POSITION_INFO: Record<HandlePosition, string> = {
  auto: "אוטומטי",
  top: "למעלה",
  middle: "באמצע",
  bottom: "למטה",
};

export const OPENING_INFO: Record<Opening, string> = {
  left: "ציר בצד שמאל",
  right: "ציר בצד ימין",
  up: "נפתחת מעלה",
  down: "נפתחת מטה",
};

export interface Option<T> {
  value: T;
  label: string;
  hint: string;
  ok: boolean;
  /** למה האפשרות לא זמינה. */
  reason?: string;
}

export interface InsertAvailability {
  glass: boolean;
  mirror: boolean;
}

export function styleOptions(kind: FacadeKind, doorType: DoorType, avail: InsertAvailability): Option<DoorStyle>[] {
  return DOOR_STYLES.map((value) => {
    let reason: string | undefined;
    if (kind === "drawer" && (value === "glass" || value === "mirror")) reason = "לא מתאים למגירה";
    else if (value === "grooved" && doorType === "sliding") reason = "חריצים לא מתאימים לדלת הזזה";
    else if (value === "mirror" && doorType === "flap") reason = "מראה לא מתאימה לקלפה";
    else if (value === "glass" && !avail.glass) reason = "זכוכית לא פעילה בספריית החומרים";
    else if (value === "mirror" && !avail.mirror) reason = "מראה לא פעילה בספריית החומרים";
    return { value, ...STYLE_INFO[value], ok: !reason, reason };
  });
}

export function handleOptions(kind: FacadeKind, doorType: DoorType, style: DoorStyle): Option<HandleType>[] {
  return HANDLE_TYPES.map((value) => {
    let reason: string | undefined;
    if (kind === "door" && doorType === "sliding" && !["profile", "integral", "none"].includes(value)) {
      reason = "דלת הזזה נפתחת בתפיסה בקצה: ידית פרופיל או אינטגרלית";
    } else if (value === "push" && (style === "glass" || style === "mirror")) {
      reason = "פתיחה בלחיצה לא מתאימה לזכוכית ולמראה";
    }
    return { value, ...HANDLE_INFO[value], ok: !reason, reason };
  });
}

export function openingOptions(kind: FacadeKind, doorType: DoorType): Option<Opening>[] {
  if (kind !== "door") return [];
  if (doorType === "hinged") {
    return [
      { value: "left", label: OPENING_INFO.left, hint: "הדלת נפתחת מימין", ok: true },
      { value: "right", label: OPENING_INFO.right, hint: "הדלת נפתחת משמאל", ok: true },
    ];
  }
  if (doorType === "flap") {
    return [
      { value: "up", label: OPENING_INFO.up, hint: "צירים למעלה", ok: true },
      { value: "down", label: OPENING_INFO.down, hint: "צירים למטה", ok: true },
    ];
  }
  return [];
}

export function showsHandlePosition(kind: FacadeKind, doorType: DoorType, handle: HandleType): boolean {
  return kind === "door" && doorType !== "sliding" && (handle === "standard" || handle === "long" || handle === "knob");
}

export interface ResolvedFacade {
  id: string;
  kind: FacadeKind;
  style: DoorStyle;
  handle: HandleType;
  handleColor: HandleColor;
  handlePosition: HandlePosition;
  opening: Opening | null;
  /** צבע חזית ספציפי; ריק = צבע החזיתות הכללי. */
  colorId?: string;
}

/** פתיחה אוטומטית: זוגות דלתות נפגשים באמצע. */
export function autoOpening(doorType: DoorType, index: number): Opening | null {
  if (doorType === "hinged") return index % 2 === 0 ? "left" : "right";
  if (doorType === "flap") return "up";
  return null;
}

function defaultHandle(kind: FacadeKind, doorType: DoorType): HandleType {
  if (kind === "door" && doorType === "sliding") return "profile";
  return "standard";
}

/**
 * החזית האפקטיבית של דלת או מגירה: דריסה אישית > ברירת מחדל של הרהיט > ברירת מחדל מערכתית.
 * שילוב לא מתאים (למשל אחרי החלפת סוג דלת) מתוקן אוטומטית, כך שהתצוגה אף פעם לא מציגה שילוב לא אפשרי.
 */
export function resolveFacade(
  design: Pick<FurnitureDesign, "facades">,
  kind: FacadeKind,
  id: string,
  index: number,
  doorType: DoorType,
  avail: InsertAvailability = { glass: true, mirror: true },
): ResolvedFacade {
  const f = design.facades;
  const defaults = (kind === "door" ? f?.defaults : f?.drawerDefaults) ?? {};
  const override = (kind === "door" ? f?.doors : f?.drawers)?.find((d) => d.id === id) ?? {};
  const pick = <K extends keyof typeof defaults>(k: K) => (override as typeof defaults)[k] ?? defaults[k];

  let style: DoorStyle = pick("style") ?? "flat";
  if (!styleOptions(kind, doorType, avail).find((o) => o.value === style)?.ok) style = "flat";

  let handle: HandleType = pick("handle") ?? defaultHandle(kind, doorType);
  const hOpts = handleOptions(kind, doorType, style);
  if (!hOpts.find((o) => o.value === handle)?.ok) {
    const preferred = defaultHandle(kind, doorType);
    handle = hOpts.find((o) => o.value === preferred)?.ok ? preferred : (hOpts.find((o) => o.ok && o.value !== "none")?.value ?? "none");
  }

  let opening: Opening | null = null;
  if (kind === "door") {
    const allowed = openingOptions("door", doorType).map((o) => o.value);
    const wanted = pick("opening");
    opening = wanted && allowed.includes(wanted) ? wanted : autoOpening(doorType, index);
  }
  return {
    id,
    kind,
    style,
    handle,
    handleColor: pick("handleColor") ?? "black",
    handlePosition: pick("handlePosition") ?? "auto",
    opening,
    colorId: pick("colorId"),
  };
}

type Override = NonNullable<NonNullable<FurnitureDesign["facades"]>["defaults"]>;
type Facades = NonNullable<FurnitureDesign["facades"]>;

const OVERRIDE_KEYS = ["style", "handle", "handleColor", "handlePosition", "opening", "colorId"] as const;

function clean<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** עדכון הגדרות לדלת/מגירה אחת (דריסה אישית). */
export function setFacadeOverride(facades: Facades | undefined, kind: FacadeKind, id: string, patch: Override): Facades {
  const base: Facades = { ...(facades ?? {}) };
  const key = kind === "door" ? "doors" : "drawers";
  const list = [...(base[key] ?? [])];
  const i = list.findIndex((d) => d.id === id);
  const prev = i >= 0 ? list[i] : { id, target: kind };
  const next = clean({ ...prev, ...patch }) as NonNullable<Facades["doors"]>[number];
  if (i >= 0) list[i] = next;
  else list.push(next);
  base[key] = list;
  return base;
}

/** עדכון ברירת המחדל לכל הדלתות/המגירות. דריסות אישיות של אותם שדות מוסרות כדי שהשינוי יחול על כולן. */
export function setFacadeDefaults(facades: Facades | undefined, kind: FacadeKind, patch: Override): Facades {
  const base: Facades = { ...(facades ?? {}) };
  const dKey = kind === "door" ? "defaults" : "drawerDefaults";
  const lKey = kind === "door" ? "doors" : "drawers";
  base[dKey] = clean({ ...(base[dKey] ?? {}), ...patch });
  const keys = Object.keys(patch) as Array<keyof Override>;
  base[lKey] = (base[lKey] ?? [])
    .map((o) => {
      const copy: Record<string, unknown> = { ...o };
      for (const k of keys) delete copy[k];
      return copy as typeof o;
    })
    .filter((o) => OVERRIDE_KEYS.some((k) => o[k] !== undefined));
  return base;
}

/** "החל על הכל": מעתיק את המראה המלא של פריט אחד לכל השאר (בלי כיוון הפתיחה, שתלוי במיקום). */
export function applyLookToAll(facades: Facades | undefined, kind: FacadeKind, look: ResolvedFacade): Facades {
  const patch: Override = {
    style: look.style,
    handle: look.handle,
    handleColor: look.handleColor,
    handlePosition: look.handlePosition,
    colorId: look.colorId,
  };
  const base = setFacadeDefaults(facades, kind, patch);
  const dKey = kind === "door" ? "defaults" : "drawerDefaults";
  if (look.colorId === undefined && base[dKey]) delete base[dKey]!.colorId;
  return base;
}
