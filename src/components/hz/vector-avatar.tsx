"use client";

// آواتار دوبعدی شخصی‌سازی‌شده (سبک بیت‌موجی/فلت SVG) — سبک و بدون سنگینی
// کاربر پوست/مو/چشم/ابرو/لب/عینک/ریش/لباس/پس‌زمینه را خودش می‌سازد
// ذخیره در User.avatar: {type:"vector", config:{...}}

import { cn } from "@/lib/utils";

/* ==========================================================================
   پیکربندی و گزینه‌ها
   ========================================================================== */

export type HairStyle =
  | "short"
  | "side"
  | "curly"
  | "wavy"
  | "buzz"
  | "bun"
  | "ponytail"
  | "long"
  | "hijab"
  | "cap"
  | "none";

export type EyeStyle = "normal" | "happy" | "wink" | "surprised" | "closed";
export type BrowStyle = "normal" | "thick" | "thin" | "raised";
export type MouthStyle = "smile" | "grin" | "neutral" | "laugh";
export type GlassesStyle = "none" | "round" | "square" | "sun";
export type FacialHairStyle = "none" | "mustache" | "beard" | "stubble";
export type ClothingStyle = "tshirt" | "collar" | "hoodie";

export interface VectorAvatarConfig {
  bg: string;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  glasses: GlassesStyle;
  facialHair: FacialHairStyle;
  clothing: ClothingStyle;
  clothColor: string;
}

export const VECTOR_SKIN_TONES: Array<{ value: string; label: string }> = [
  { value: "#FFE0BD", label: "بسیار روشن" },
  { value: "#F5D0A9", label: "روشن" },
  { value: "#E8B98D", label: "گندمی" },
  { value: "#D9A066", label: "برنزه" },
  { value: "#B87A4B", label: "قهوه‌ای روشن" },
  { value: "#8D5524", label: "قهوه‌ای تیره" },
];

export const VECTOR_HAIR_STYLES: Array<{ value: HairStyle; label: string }> = [
  { value: "short", label: "کوتاه" },
  { value: "side", label: "چنج‌دار" },
  { value: "curly", label: "فر" },
  { value: "wavy", label: "موج‌دار" },
  { value: "buzz", label: "اصلاح‌شده" },
  { value: "bun", label: "گیره‌ای" },
  { value: "ponytail", label: "دم‌اسبی" },
  { value: "long", label: "بلند" },
  { value: "hijab", label: "مقنعه" },
  { value: "cap", label: "کلاه" },
  { value: "none", label: "بدون مو" },
];

export const VECTOR_HAIR_COLORS: Array<{ value: string; label: string }> = [
  { value: "#1B1B1B", label: "مشکی" },
  { value: "#3B2A20", label: "قهوه‌ای تیره" },
  { value: "#5C4033", label: "قهوه‌ای" },
  { value: "#8B5A2B", label: "شاه‌بلوطی" },
  { value: "#A0522D", label: "مسی" },
  { value: "#BFA100", label: "طلایی" },
  { value: "#9B9B9B", label: "خاکستری" },
  { value: "#E8E8E8", label: "سفید" },
];

export const VECTOR_EYE_STYLES: Array<{ value: EyeStyle; label: string }> = [
  { value: "normal", label: "معمولی" },
  { value: "happy", label: "شاد" },
  { value: "wink", label: "چشمک" },
  { value: "surprised", label: "متعجب" },
  { value: "closed", label: "بسته" },
];

export const VECTOR_BROW_STYLES: Array<{ value: BrowStyle; label: string }> = [
  { value: "normal", label: "معمولی" },
  { value: "thick", label: "پرپشت" },
  { value: "thin", label: "ظریف" },
  { value: "raised", label: "بالاآمده" },
];

export const VECTOR_MOUTH_STYLES: Array<{ value: MouthStyle; label: string }> = [
  { value: "smile", label: "لبخند" },
  { value: "grin", label: "خنده" },
  { value: "neutral", label: "خنثی" },
  { value: "laugh", label: "قهقهه" },
];

export const VECTOR_GLASSES_STYLES: Array<{ value: GlassesStyle; label: string }> = [
  { value: "none", label: "بدون عینک" },
  { value: "round", label: "گرد" },
  { value: "square", label: "مربعی" },
  { value: "sun", label: "آفتابی" },
];

export const VECTOR_FACIAL_HAIR_STYLES: Array<{ value: FacialHairStyle; label: string }> = [
  { value: "none", label: "بدون ریش" },
  { value: "mustache", label: "سبیل" },
  { value: "beard", label: "ریش کامل" },
  { value: "stubble", label: "ریش سه‌روزه" },
];

export const VECTOR_CLOTHING_STYLES: Array<{ value: ClothingStyle; label: string }> = [
  { value: "tshirt", label: "تی‌شرت" },
  { value: "collar", label: "یقه‌دار" },
  { value: "hoodie", label: "هودی" },
];

export const VECTOR_CLOTH_COLORS: Array<{ value: string; label: string }> = [
  { value: "#0F7B6C", label: "سبز پسته" },
  { value: "#1F6E8C", label: "لاجوردی" },
  { value: "#B8860B", label: "طلایی" },
  { value: "#8C4A2F", label: "نخی" },
  { value: "#7B5EA7", label: "بنفش" },
  { value: "#C25E5E", label: "آجری" },
  { value: "#4E8D5B", label: "سبز" },
  { value: "#37474F", label: "زغالی" },
];

export const VECTOR_BG_COLORS: Array<{ value: string; label: string }> = [
  { value: "#DFF3EC", label: "نعنایی" },
  { value: "#FFF3D6", label: "کرم" },
  { value: "#E3ECFF", label: "آبی کم‌رنگ" },
  { value: "#FBE4E4", label: "صورتی" },
  { value: "#EFE7F7", label: "یاسی" },
  { value: "#E8EDE7", label: "خاکستری سبز" },
  { value: "#F5E9DC", label: "شنی" },
  { value: "#E0F0F6", label: "فیروزه‌ای" },
];

export const DEFAULT_VECTOR_CONFIG: VectorAvatarConfig = {
  bg: "#DFF3EC",
  skin: "#F5D0A9",
  hair: "short",
  hairColor: "#3B2A20",
  eyes: "normal",
  brows: "normal",
  mouth: "smile",
  glasses: "none",
  facialHair: "none",
  clothing: "tshirt",
  clothColor: "#0F7B6C",
};

/** انتخاب تصادفی برای دکمه «شبیه خودم بساز!» */
export function randomVectorConfig(): VectorAvatarConfig {
  const pick = <T,>(arr: Array<{ value: T }>): T =>
    arr[Math.floor(Math.random() * arr.length)].value;
  return {
    bg: pick(VECTOR_BG_COLORS),
    skin: pick(VECTOR_SKIN_TONES),
    hair: pick(VECTOR_HAIR_STYLES),
    hairColor: pick(VECTOR_HAIR_COLORS),
    eyes: pick(VECTOR_EYE_STYLES),
    brows: pick(VECTOR_BROW_STYLES),
    mouth: pick(VECTOR_MOUTH_STYLES),
    glasses: pick(VECTOR_GLASSES_STYLES),
    facialHair: pick(VECTOR_FACIAL_HAIR_STYLES),
    clothing: pick(VECTOR_CLOTHING_STYLES),
    clothColor: pick(VECTOR_CLOTH_COLORS),
  };
}

/** تجزیه امن پیکربندی آواتار ذخیره‌شده */
export function parseVectorConfig(raw: unknown): VectorAvatarConfig {
  const d = (raw ?? {}) as Record<string, unknown>;
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  const one = <T extends string>(v: unknown, allowed: Array<{ value: T }>, fallback: T): T =>
    typeof v === "string" && allowed.some((a) => a.value === v) ? (v as T) : fallback;
  return {
    bg: hex(d.bg, DEFAULT_VECTOR_CONFIG.bg),
    skin: hex(d.skin, DEFAULT_VECTOR_CONFIG.skin),
    hair: one(d.hair, VECTOR_HAIR_STYLES, DEFAULT_VECTOR_CONFIG.hair),
    hairColor: hex(d.hairColor, DEFAULT_VECTOR_CONFIG.hairColor),
    eyes: one(d.eyes, VECTOR_EYE_STYLES, DEFAULT_VECTOR_CONFIG.eyes),
    brows: one(d.brows, VECTOR_BROW_STYLES, DEFAULT_VECTOR_CONFIG.brows),
    mouth: one(d.mouth, VECTOR_MOUTH_STYLES, DEFAULT_VECTOR_CONFIG.mouth),
    glasses: one(d.glasses, VECTOR_GLASSES_STYLES, DEFAULT_VECTOR_CONFIG.glasses),
    facialHair: one(d.facialHair, VECTOR_FACIAL_HAIR_STYLES, DEFAULT_VECTOR_CONFIG.facialHair),
    clothing: one(d.clothing, VECTOR_CLOTHING_STYLES, DEFAULT_VECTOR_CONFIG.clothing),
    clothColor: hex(d.clothColor, DEFAULT_VECTOR_CONFIG.clothColor),
  };
}

/* ==========================================================================
   رندر SVG — بوم ۲۰۰×۲۰۰ فلت
   ========================================================================== */

/** تیره‌کردن رنگ HEX برای سایه (ضریب ۰٫۸) */
function shade(hex: string, k = 0.82): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) return hex;
  const ch = [1, 2, 3].map((i) =>
    Math.round(parseInt(m[i], 16) * k)
      .toString(16)
      .padStart(2, "0")
  );
  return `#${ch.join("")}`;
}

function darkenLess(hex: string): string {
  return shade(hex, 0.9);
}

const HEAD_CX = 100;
const HEAD_CY = 86;
const HEAD_RX = 36;
const HEAD_RY = 40;

/* ---------- مو ---------- */

/** موی پشت سر (پیش از صورت): مدل‌های بلند/دم‌اسبی/گیره‌ای */
function HairBehind({ hair, color }: { hair: HairStyle; color: string }) {
  if (hair === "long")
    return (
      <g fill={color}>
        <path d="M58,72 C50,120 52,150 62,160 C74,166 86,160 84,150 C74,122 74,92 80,70 Z" />
        <path d="M142,72 C150,120 148,150 138,160 C126,166 114,160 116,150 C126,122 126,92 120,70 Z" />
      </g>
    );
  if (hair === "ponytail")
    return (
      <g fill={color}>
        <ellipse cx="138" cy="102" rx="10" ry="24" />
        <ellipse cx="62" cy="98" rx="7" ry="14" opacity="0.85" />
      </g>
    );
  if (hair === "bun")
    return <circle cx="100" cy="36" r="12" fill={color} />;
  if (hair === "wavy")
    return (
      <g fill={color}>
        <path d="M60,78 C56,104 62,120 70,126 C64,110 68,92 74,78 Z" />
        <path d="M140,78 C144,104 138,120 130,126 C136,110 132,92 126,78 Z" />
      </g>
    );
  return null;
}

/** کلاه سرِ مو — هلال روی نیمه بالای سر */
function HairCap({ color, variant }: { color: string; variant: "short" | "side" | "curly" | "wavy" | "buzz" | "bun" | "ponytail" | "long" | "capBase" }) {
  // هلال پایه
  const cap = (
    <path
      d="M64,86 C64,52 79,42 100,42 C121,42 136,52 136,86 C136,70 127,61 100,61 C73,61 64,70 64,86 Z"
      fill={color}
    />
  );
  switch (variant) {
    case "buzz":
      return (
        <path
          d="M66,82 C66,54 80,44 100,44 C120,44 134,54 134,82 C134,72 124,64 100,64 C76,64 66,72 66,82 Z"
          fill={color}
          opacity="0.9"
        />
      );
    case "curly":
      return (
        <g fill={color}>
          {cap}
          <circle cx="72" cy="56" r="11" />
          <circle cx="86" cy="45" r="11" />
          <circle cx="100" cy="41" r="11" />
          <circle cx="114" cy="45" r="11" />
          <circle cx="128" cy="56" r="11" />
          <circle cx="64" cy="70" r="9" />
          <circle cx="136" cy="70" r="9" />
        </g>
      );
    case "side":
      return (
        <g fill={color}>
          {cap}
          {/* چنج مورب */}
          <path d="M100,42 C88,46 80,56 78,70 C84,62 92,56 102,52 C110,49 122,52 128,58 C124,48 114,42 100,42 Z" />
        </g>
      );
    case "wavy":
      return (
        <g fill={color}>
          <path
            d="M64,86 C64,52 79,42 100,42 C121,42 136,52 136,86 C136,80 134,74 131,69 C126,76 124,68 120,74 C116,80 112,72 108,76 C104,80 96,80 92,76 C88,72 84,80 80,74 C76,68 74,76 69,69 C66,74 64,80 64,86 Z"
            fillRule="evenodd"
          />
        </g>
      );
    default:
      return cap;
  }
}

/* ---------- مقنعه (حجاب) ---------- */

function Hijab({ skin, clothColor }: { skin: string; clothColor: string }) {
  const fabric = clothColor;
  const fabricDark = darkenLess(fabric);
  return (
    <g>
      {/* روسری پشت و روی شانه‌ها */}
      <path
        d="M56,66 C48,110 52,142 64,154 C78,162 122,162 136,154 C148,142 152,110 144,66 C142,96 138,124 130,138 C120,146 80,146 70,138 C62,124 58,96 56,66 Z"
        fill={fabricDark}
      />
      {/* بدنه روسری دور سر */}
      <ellipse cx={HEAD_CX} cy={HEAD_CY - 2} rx={HEAD_RX + 5} ry={HEAD_RY + 5} fill={fabric} />
      {/* صورت — بیضی کوچک‌تر که قاب مقنعه را نشان می‌دهد */}
      <ellipse cx={HEAD_CX} cy={HEAD_CY + 2} rx={HEAD_RX - 7} ry={HEAD_RY - 7} fill={skin} />
      {/* لبه پایینی مقنعه زیر چانه */}
      <path
        d={`M${HEAD_CX - 15},${HEAD_CY + 34} C${HEAD_CX - 6},${HEAD_CY + 42} ${HEAD_CX + 6},${HEAD_CY + 42} ${HEAD_CX + 15},${HEAD_CY + 34} C${HEAD_CX + 10},${HEAD_CY + 46} ${HEAD_CX - 10},${HEAD_CY + 46} ${HEAD_CX - 15},${HEAD_CY + 34} Z`}
        fill={fabricDark}
      />
      {/* چین ساده روی مقنعه */}
      <path
        d={`M${HEAD_CX - 38},${HEAD_CY - 4} C${HEAD_CX - 42},${HEAD_CY + 24} ${HEAD_CX - 34},${HEAD_CY + 44} ${HEAD_CX - 24},${HEAD_CY + 52}`}
        stroke={fabricDark}
        strokeWidth="2.5"
        fill="none"
        opacity="0.7"
      />
    </g>
  );
}

/* ---------- کلاه ---------- */

function Cap({ color }: { color: string }) {
  return (
    <g>
      {/* سقف کلاه — بالای خط ابرو (چشم‌ها هرگز زیر کلاه نمی‌مانند) */}
      <path d="M62,58 C62,32 78,20 100,20 C122,20 138,32 138,58 Z" fill={color} />
      {/* لبه کلاه به سمت بینی — باریک و بالای ابروها */}
      <path d="M58,52 C57,57 62,60 70,60 L130,60 C138,60 143,57 142,52 C124,57 76,57 58,52 Z" fill={darkenLess(color)} />
      {/* دکمه بالای کلاه */}
      <circle cx="100" cy="22" r="4" fill={darkenLess(color)} />
    </g>
  );
}

/* ---------- چشم‌ها ---------- */

function Eyes({ style }: { style: EyeStyle }) {
  const LX = 86;
  const RX = 114;
  const Y = 84;
  const ink = "#26221E";

  const normalEye = (cx: number) => (
    <g key={cx}>
      <ellipse cx={cx} cy={Y} rx="7.5" ry="8.5" fill="#FFFFFF" />
      <circle cx={cx} cy={Y + 0.5} r="3.6" fill={ink} />
      <circle cx={cx - 1.4} cy={Y - 1.6} r="1.3" fill="#FFFFFF" />
    </g>
  );
  const arcEye = (cx: number, key: string) => (
    <path
      key={key}
      d={`M${cx - 8},${Y + 1} Q${cx},${Y - 9} ${cx + 8},${Y + 1}`}
      stroke={ink}
      strokeWidth="3.2"
      strokeLinecap="round"
      fill="none"
    />
  );

  switch (style) {
    case "happy":
      return (
        <g>
          {arcEye(LX, "l")}
          {arcEye(RX, "r")}
        </g>
      );
    case "wink":
      return (
        <g>
          {normalEye(LX)}
          {arcEye(RX, "r")}
        </g>
      );
    case "surprised":
      return (
        <g>
          <ellipse cx={LX} cy={Y} rx="9" ry="10" fill="#FFFFFF" />
          <ellipse cx={RX} cy={Y} rx="9" ry="10" fill="#FFFFFF" />
          <circle cx={LX} cy={Y + 1} r="3" fill={ink} />
          <circle cx={RX} cy={Y + 1} r="3" fill={ink} />
          <circle cx={LX - 1.2} cy={Y - 1.5} r="1" fill="#FFFFFF" />
          <circle cx={RX - 1.2} cy={Y - 1.5} r="1" fill="#FFFFFF" />
        </g>
      );
    case "closed":
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={`M${LX - 7},${Y} L${LX + 7},${Y}`} />
          <path d={`M${RX - 7},${Y} L${RX + 7},${Y}`} />
        </g>
      );
    default:
      return (
        <g>
          {normalEye(LX)}
          {normalEye(RX)}
        </g>
      );
  }
}

/* ---------- ابروها ---------- */

function Brows({ style, hairColor }: { style: BrowStyle; hairColor: string }) {
  const ink = shade(hairColor, 0.72);
  const Y = style === "raised" ? 66 : 70;
  const w = style === "thick" ? 5.5 : style === "thin" ? 2.2 : 3.4;
  const tilt = style === "raised" ? -2 : 0;
  return (
    <g stroke={ink} strokeWidth={w} strokeLinecap="round" fill="none">
      <path d={`M77,${Y + tilt} Q86,${Y - 4 + tilt} 95,${Y + tilt + 1}`} />
      <path d={`M105,${Y + tilt + 1} Q114,${Y - 4 + tilt} 123,${Y + tilt}`} />
    </g>
  );
}

/* ---------- بینی و لب ---------- */

function Nose({ skin }: { skin: string }) {
  const ink = shade(skin, 0.68);
  return (
    <path
      d="M100,88 C97,94 96,97 98,99 C100,100.5 103,99.5 104,97"
      stroke={ink}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Mouth({ style }: { style: MouthStyle }) {
  const ink = "#26221E";
  switch (style) {
    case "grin":
      return (
        <g>
          <path d="M85,104 C90,120 110,120 115,104 C106,109 94,109 85,104 Z" fill={ink} />
          <path d="M88,105.5 C92,108.5 108,108.5 112,105.5 C106,104.5 94,104.5 88,105.5 Z" fill="#FFFFFF" />
        </g>
      );
    case "laugh":
      return (
        <g>
          <ellipse cx="100" cy="109" rx="11" ry="9" fill={ink} />
          <path
            d="M91,113 C95,119 105,119 109,113 C105,117 95,117 91,113 Z"
            fill="#E7788A"
          />
          <path d="M89,105 Q100,101 111,105 Q100,108 89,105 Z" fill="#FFFFFF" />
        </g>
      );
    case "neutral":
      return (
        <path
          d="M92,108 L108,108"
          stroke={ink}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      );
    default: // smile
      return (
        <path
          d="M87,104 Q100,117 113,104"
          stroke={ink}
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

/* ---------- عینک ---------- */

function Glasses({ style }: { style: GlassesStyle }) {
  const frame = "#2E2A26";
  if (style === "none") return null;
  if (style === "round")
    return (
      <g stroke={frame} strokeWidth="2.6" fill="none">
        <circle cx="86" cy="84" r="11" />
        <circle cx="114" cy="84" r="11" />
        <path d="M97,84 L103,84" />
        <path d="M75,84 L66,80" strokeLinecap="round" />
        <path d="M125,84 L134,80" strokeLinecap="round" />
      </g>
    );
  if (style === "square")
    return (
      <g stroke={frame} strokeWidth="2.6" fill="none">
        <rect x="74" y="74" width="23" height="20" rx="4" />
        <rect x="103" y="74" width="23" height="20" rx="4" />
        <path d="M97,82 L103,82" />
        <path d="M74,82 L65,79" strokeLinecap="round" />
        <path d="M126,82 L135,79" strokeLinecap="round" />
      </g>
    );
  // sun
  return (
    <g>
      <rect x="73" y="73" width="25" height="19" rx="5" fill="#2A2622" stroke={frame} strokeWidth="2" />
      <rect x="102" y="73" width="25" height="19" rx="5" fill="#2A2622" stroke={frame} strokeWidth="2" />
      <path d="M98,81 L102,81" stroke={frame} strokeWidth="2.6" />
      <path d="M73,81 L65,78" stroke={frame} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M127,81 L135,78" stroke={frame} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M77,78 L83,78" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </g>
  );
}

/* ---------- ریش و سبیل ---------- */

function FacialHair({ style, hairColor }: { style: FacialHairStyle; hairColor: string }) {
  const color = shade(hairColor, 0.78);
  if (style === "none") return null;
  if (style === "mustache")
    return (
      <path
        d="M100,101 C96,97.5 89,98 86.5,103 C91,105.5 96,104.5 99,102.5 C101,104.5 106,105.5 110.5,103 C108,98 101,97.5 100,101 Z"
        fill={color}
      />
    );
  // beard / stubble — قاب دور فک پایین صورت
  const jaw = (
    <path
      d="M64,88 C64,116 78,132 100,132 C122,132 136,116 136,88 C136,112 124,121 100,121 C76,121 64,112 64,88 Z"
      fill={color}
    />
  );
  if (style === "stubble") return <g opacity="0.4">{jaw}</g>;
  return (
    <g>
      {jaw}
      {/* سبیل ریش کامل — روی گوشه‌های لب */}
      <path
        d="M100,101 C96,97.5 89,98 86.5,103 C91,105.5 96,104.5 99,102.5 C101,104.5 106,105.5 110.5,103 C108,98 101,97.5 100,101 Z"
        fill={color}
      />
    </g>
  );
}

/* ---------- لباس ---------- */

function Clothing({
  style,
  clothColor,
  skin,
}: {
  style: ClothingStyle;
  clothColor: string;
  skin: string;
}) {
  const base = clothColor;
  const dark = darkenLess(base);
  const darker = shade(base, 0.7);
  // شانه‌ها
  const shoulders = (
    <path d="M26,200 C26,158 60,142 100,142 C140,142 174,158 174,200 Z" fill={base} />
  );
  // گردن
  const neck = <rect x="87" y="116" width="26" height="30" rx="9" fill={shade(skin, 0.9)} />;

  switch (style) {
    case "collar":
      return (
        <g>
          {neck}
          {shoulders}
          {/* یقه باز */}
          <path d="M88,144 L100,160 L112,144 L106,140 L100,150 L94,140 Z" fill="#F7F4EF" />
          <path d="M88,144 L100,160 L96,163 L84,148 Z" fill="#FFFFFF" />
          <path d="M112,144 L100,160 L104,163 L116,148 Z" fill="#FFFFFF" />
          {/* دکمه */}
          <circle cx="100" cy="172" r="2.6" fill={darker} />
          <circle cx="100" cy="184" r="2.6" fill={darker} />
        </g>
      );
    case "hoodie":
      return (
        <g>
          {neck}
          {/* کلاه هودی پشت سر */}
          <path
            d="M62,108 C52,122 48,142 54,156 L146,156 C152,142 148,122 138,108 C130,96 114,92 100,92 C86,92 70,96 62,108 Z"
            fill={dark}
          />
          {shoulders}
          {/* جیب کانگرو */}
          <path d="M64,180 C72,174 88,174 96,180 L96,192 L64,192 Z" fill={darker} opacity="0.6" />
          <path d="M136,180 C128,174 112,174 104,180 L104,192 L136,192 Z" fill={darker} opacity="0.6" />
          {/* کش‌های هودی */}
          <path d="M92,150 L90,172" stroke="#F0EDE6" strokeWidth="3" strokeLinecap="round" />
          <path d="M108,150 L110,172" stroke="#F0EDE6" strokeWidth="3" strokeLinecap="round" />
          <circle cx="90" cy="173" r="2.4" fill="#F0EDE6" />
          <circle cx="110" cy="173" r="2.4" fill="#F0EDE6" />
        </g>
      );
    default: // tshirt
      return (
        <g>
          {neck}
          {shoulders}
          {/* یقه گرد */}
          <path
            d="M88,144 C92,152 108,152 112,144 C110,140 90,140 88,144 Z"
            fill={dark}
          />
        </g>
      );
  }
}

/* ==========================================================================
   مؤلفه اصلی — رندر کامل آواتار
   ========================================================================== */

const SIZE_CLASS: Record<string, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-16",
  xl: "size-24",
  xxl: "size-36",
};

export function VectorAvatar({
  config,
  size = "md",
  className,
  title,
}: {
  config: VectorAvatarConfig;
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  className?: string;
  title?: string;
}) {
  const isHijab = config.hair === "hijab";
  const isCap = config.hair === "cap";

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={title ?? "آواتار کارتونی کاربر"}
      className={cn(
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        "shrink-0 rounded-full border border-primary/20 bg-background select-none",
        className
      )}
    >
      {/* پس‌زمینه */}
      <circle cx="100" cy="100" r="100" fill={config.bg} />
      {/* الگوی نقطه‌ای ظریف */}
      <g fill="#FFFFFF" opacity="0.35">
        <circle cx="34" cy="40" r="7" />
        <circle cx="166" cy="40" r="7" />
        <circle cx="24" cy="120" r="5" />
        <circle cx="176" cy="120" r="5" />
        <circle cx="60" cy="180" r="6" />
        <circle cx="140" cy="180" r="6" />
      </g>

      {/* موی پشت (برای مدل‌های بلند/دم‌اسبی/گیره‌ای/موج‌دار) */}
      {!isHijab && !isCap && <HairBehind hair={config.hair} color={config.hairColor} />}

      {/* لباس + گردن */}
      <Clothing style={config.clothing} clothColor={config.clothColor} skin={config.skin} />

      {/* گوش‌ها */}
      {!isHijab && (
        <g fill={config.skin}>
          <ellipse cx="64" cy="90" rx="6" ry="9" />
          <ellipse cx="136" cy="90" rx="6" ry="9" />
        </g>
      )}

      {/* سر */}
      {isHijab ? (
        <Hijab skin={config.skin} clothColor={config.clothColor} />
      ) : (
        <>
          <ellipse cx={HEAD_CX} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} fill={config.skin} />
          {/* سایه ملایم زیر فک */}
          <ellipse cx={HEAD_CX} cy={HEAD_CY + 26} rx={HEAD_RX - 10} ry="8" fill={shade(config.skin, 0.93)} />
          {/* موی جلو */}
          {config.hair !== "none" && (
            <HairCap
              color={config.hairColor}
              variant={
                isCap
                  ? "capBase"
                  : config.hair === "buzz"
                    ? "buzz"
                    : config.hair === "curly"
                      ? "curly"
                      : config.hair === "side"
                        ? "side"
                        : config.hair === "wavy"
                          ? "wavy"
                          : "short"
              }
            />
          )}
          {isCap && <Cap color={config.clothColor} />}
        </>
      )}

      {/* چهره — روی موی جلو نیست؛ چهره همیشه روی سر (مقنعه هم ابرو/چشم/عینک دارد) */}
      <Brows style={config.brows} hairColor={config.hairColor} />
      <Eyes style={config.eyes} />
      <Nose skin={config.skin} />
      <Mouth style={config.mouth} />
      <Glasses style={config.glasses} />
      {!isHijab && <FacialHair style={config.facialHair} hairColor={config.hairColor} />}
    </svg>
  );
}
