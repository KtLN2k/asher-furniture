import type { DoorStyle, HandleType } from "@/domain/design";

export function StyleArt({ style, color = "#f4f2ee" }: { style: DoorStyle; color?: string }) {
  return (
    <svg viewBox="0 0 90 70" className="block h-20 w-full" aria-hidden>
      <rect width="90" height="70" fill="#f1ebe0" />
      <defs>
        <linearGradient id="mir" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7fbfc" />
          <stop offset="0.5" stopColor="#bfd2d9" />
          <stop offset="1" stopColor="#eef4f6" />
        </linearGradient>
      </defs>
      <rect x="27" y="6" width="36" height="58" rx="1.5" fill={style === "mirror" ? "url(#mir)" : color} stroke="#b9a98f" strokeWidth="1" />
      {style === "framed" && <rect x="32" y="11" width="26" height="48" fill="none" stroke="#b9a98f" strokeWidth="1" />}
      {style === "grooved" &&
        [35, 41, 47, 53, 59].map((x) => <line key={x} x1={x - 2} x2={x - 2} y1="9" y2="61" stroke="#b9a98f" strokeWidth="1" />)}
      {style === "glass" && (
        <>
          <rect x="31" y="10" width="28" height="50" fill="#e3f0f4" stroke="#b9a98f" strokeWidth="1" />
          <path d="M33 54 L55 14" stroke="#fff" strokeWidth="2" opacity="0.7" />
        </>
      )}
      {style === "mirror" && <path d="M33 56 L57 12" stroke="#fff" strokeWidth="2" opacity="0.8" />}
    </svg>
  );
}

export function HandleArt({ handle, color = "#1c1c1c" }: { handle: HandleType; color?: string }) {
  return (
    <svg viewBox="0 0 90 70" className="block h-20 w-full" aria-hidden>
      <rect width="90" height="70" fill="#f1ebe0" />
      <rect x="27" y="6" width="36" height="58" rx="1.5" fill="#f7f5f1" stroke="#b9a98f" strokeWidth="1" />
      {handle === "standard" && <rect x="54" y="26" width="2.6" height="16" rx="1.3" fill={color} />}
      {handle === "long" && <rect x="55" y="30" width="2.6" height="30" rx="1" fill={color} />}
      {handle === "knob" && <circle cx="55" cy="35" r="3.2" fill={color} />}
      {handle === "integral" && <rect x="57" y="8" width="3" height="54" fill="#2a2521" opacity="0.8" />}
      {handle === "profile" && <rect x="58.5" y="6" width="4" height="58" fill={color} />}
      {handle === "push" && <circle cx="45" cy="35" r="2" fill="none" stroke="#9d8b78" strokeDasharray="1.5 1.5" />}
      {handle === "none" && <path d="M38 24 l14 22 M52 24 l-14 22" stroke="#cdb998" strokeWidth="1.5" />}
    </svg>
  );
}
