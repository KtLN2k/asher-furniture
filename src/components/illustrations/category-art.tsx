import type { CategoryKey } from "@/domain/catalog";

const WHITE = "#f6f3ee";
const WHITE_EDGE = "#d8cfc2";
const WOOD = "#b27a4b";
const WOOD_DARK = "#8a5a36";
const WOOD_LIGHT = "#d3a577";
const BLACK = "#262220";

function Floor() {
  return (
    <>
      <rect x="0" y="118" width="200" height="32" fill="#e7dac6" />
      <rect x="0" y="116" width="200" height="3" fill="#d9c9ae" />
    </>
  );
}

function Shadow({ x, w }: { x: number; w: number }) {
  return <ellipse cx={x} cy="121" rx={w} ry="4" fill="#5f3a21" opacity="0.18" />;
}

const arts: Record<CategoryKey, React.ReactNode> = {
  wardrobes: (
    <>
      <Shadow x={100} w={74} />
      <rect x="32" y="14" width="136" height="104" rx="3" fill={WHITE} stroke={WHITE_EDGE} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={35 + i * 33} y="17" width="31" height="98" rx="1.5" fill="#fbf9f5" stroke={WHITE_EDGE} strokeWidth="0.8" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i % 2 === 0 ? 62 + i * 33 : 38 + i * 33} y="52" width="2.4" height="30" rx="1.2" fill={BLACK} />
      ))}
      <rect x="32" y="14" width="136" height="4" fill="#000" opacity="0.05" />
    </>
  ),
  "sliding-wardrobes": (
    <>
      <Shadow x={100} w={76} />
      <rect x="26" y="12" width="148" height="106" rx="3" fill="#e9e2d6" stroke={WHITE_EDGE} />
      <rect x="29" y="15" width="56" height="100" fill={WOOD_LIGHT} stroke={WOOD} strokeWidth="0.8" />
      <rect x="72" y="15" width="56" height="100" fill="#cfdde4" stroke="#9fb4bf" strokeWidth="0.8" />
      <path d="M78 108 L108 20 L118 20 L88 108Z" fill="#fff" opacity="0.45" />
      <rect x="115" y="15" width="56" height="100" fill={WHITE} stroke={WHITE_EDGE} strokeWidth="0.8" />
      <rect x="29" y="12" width="142" height="3" fill="#7c746b" />
      <rect x="29" y="115" width="142" height="3" fill="#7c746b" />
      <rect x="80" y="55" width="2.4" height="26" rx="1.2" fill={BLACK} />
      <rect x="118" y="55" width="2.4" height="26" rx="1.2" fill={BLACK} />
    </>
  ),
  dressers: (
    <>
      <Shadow x={100} w={62} />
      <rect x="48" y="104" width="6" height="14" fill={WOOD_DARK} />
      <rect x="146" y="104" width="6" height="14" fill={WOOD_DARK} />
      <rect x="44" y="34" width="112" height="72" rx="4" fill={WOOD} stroke={WOOD_DARK} />
      <rect x="40" y="29" width="120" height="8" rx="3" fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth="0.8" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="49" y={41 + i * 21} width="102" height="18" rx="2" fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth="0.8" />
          <circle cx="100" cy={50 + i * 21} r="2.6" fill={BLACK} />
        </g>
      ))}
      <rect x="80" y="12" width="40" height="17" rx="2" fill="#fff" stroke={WHITE_EDGE} opacity="0.9" />
      <path d="M86 24 l8 -7 l6 5 l7 -6 l6 8z" fill="#9db38c" />
    </>
  ),
  sideboards: (
    <>
      <Shadow x={100} w={82} />
      {[36, 158].map((x) => (
        <rect key={x} x={x} y="94" width="5" height="24" fill={WOOD_DARK} transform={x < 100 ? "skewX(-6)" : "skewX(6)"} />
      ))}
      <rect x="28" y="62" width="144" height="36" rx="4" fill={WHITE} stroke={WHITE_EDGE} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={31 + i * 46} y="65" width="44" height="30" rx="2" fill="#fbf9f5" stroke={WHITE_EDGE} strokeWidth="0.8" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={62 + i * 46} y="74" width="2.2" height="14" rx="1.1" fill={BLACK} />
      ))}
      <rect x="24" y="58" width="152" height="6" rx="3" fill={WOOD} />
      <rect x="62" y="22" width="76" height="35" rx="3" fill="#2d2a28" />
      <rect x="64" y="24" width="72" height="31" rx="2" fill="#4a5560" />
      <rect x="94" y="57" width="12" height="3" fill="#2d2a28" />
    </>
  ),
  bedrooms: (
    <>
      <Shadow x={92} w={76} />
      <rect x="22" y="40" width="10" height="78" rx="3" fill={WOOD_DARK} />
      <rect x="22" y="40" width="110" height="38" rx="6" fill={WOOD} />
      <rect x="32" y="68" width="106" height="30" rx="5" fill="#ece4d6" stroke={WHITE_EDGE} />
      <rect x="38" y="56" width="34" height="16" rx="6" fill="#fff" stroke={WHITE_EDGE} />
      <rect x="76" y="56" width="34" height="16" rx="6" fill="#fff" stroke={WHITE_EDGE} />
      <rect x="32" y="84" width="106" height="14" rx="4" fill="#c9b79d" />
      <rect x="32" y="98" width="106" height="8" fill={WOOD_DARK} />
      <rect x="146" y="74" width="34" height="44" rx="3" fill={WOOD_LIGHT} stroke={WOOD_DARK} />
      <rect x="150" y="80" width="26" height="14" rx="2" fill={WOOD} />
      <rect x="150" y="98" width="26" height="14" rx="2" fill={WOOD} />
      <rect x="156" y="60" width="14" height="14" rx="3" fill="#f2d9a0" />
    </>
  ),
  bookcases: (
    <>
      <Shadow x={100} w={58} />
      <rect x="48" y="16" width="104" height="102" rx="3" fill={WOOD} stroke={WOOD_DARK} />
      <rect x="53" y="21" width="94" height="92" fill="#f1e6d6" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="53" y={46 + i * 22} width="94" height="3" fill={WOOD_DARK} />
      ))}
      {[
        [57, 27, 6, 19, "#7a4a2b"],
        [64, 29, 5, 17, "#a2714a"],
        [70, 26, 7, 20, "#386b46"],
        [79, 30, 5, 16, "#d3a577"],
        [118, 28, 6, 18, "#2f5f86"],
        [125, 26, 7, 20, "#8c2e21"],
        [58, 74, 8, 18, "#a2714a"],
        [68, 76, 6, 16, "#5f3a21"],
        [108, 78, 6, 14, "#386b46"],
        [116, 76, 8, 16, "#d3a577"],
      ].map(([x, y, w, h, c], i) => (
        <rect key={i} x={x as number} y={y as number} width={w as number} height={h as number} fill={c as string} />
      ))}
      <rect x="92" y="38" width="14" height="8" rx="2" fill="#9db38c" />
      <rect x="100" y="94" width="30" height="19" rx="2" fill="#fff" stroke={WHITE_EDGE} />
    </>
  ),
  bathroom: (
    <>
      <Shadow x={100} w={60} />
      <rect x="0" y="0" width="200" height="116" fill="#eef2f1" opacity="0.8" />
      <rect x="56" y="10" width="88" height="46" rx="4" fill="#dbe6ea" stroke="#aebfc6" strokeWidth="2" />
      <path d="M66 52 L96 14 L106 14 L76 52Z" fill="#fff" opacity="0.5" />
      <rect x="44" y="82" width="112" height="30" rx="4" fill={WOOD} stroke={WOOD_DARK} />
      <rect x="47" y="85" width="53" height="24" rx="2" fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth="0.8" />
      <rect x="102" y="85" width="53" height="24" rx="2" fill={WOOD_LIGHT} stroke={WOOD_DARK} strokeWidth="0.8" />
      <circle cx="92" cy="97" r="2.4" fill={BLACK} />
      <circle cx="110" cy="97" r="2.4" fill={BLACK} />
      <path d="M52 82 Q100 66 148 82Z" fill="#fff" stroke={WHITE_EDGE} />
      <rect x="97" y="68" width="6" height="8" rx="2" fill="#9aa5ab" />
    </>
  ),
};

export function CategoryArt({ category, className }: { category: CategoryKey; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" role="img" aria-hidden className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`wall-${category}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f1e6" />
          <stop offset="1" stopColor="#efe4d1" />
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#wall-${category})`} />
      <Floor />
      {arts[category]}
    </svg>
  );
}

export function PlaceholderArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="150" fill="#f1e8d9" />
      <rect x="0" y="118" width="200" height="32" fill="#e7dac6" />
      <rect x="62" y="40" width="76" height="76" rx="4" fill="none" stroke="#cdb998" strokeWidth="3" strokeDasharray="7 6" />
    </svg>
  );
}
