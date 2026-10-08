"use client";

// نشان آواتار کاربر — چهار حالت: آواتار کارتونی (vector) / عکس شخصی / ایموجی / حروف اول نام
// ذخیره در User.avatar به‌صورت JSON: {type, color?, emoji?, photo?, config?}
import { cn } from "@/lib/utils";
import {
  VectorAvatar,
  parseVectorConfig,
  type VectorAvatarConfig,
} from "./vector-avatar";

export interface AvatarData {
  type: "initials" | "emoji" | "photo" | "vector";
  color?: string;
  emoji?: string;
  photo?: string; // dataURL (JPEG کوچک‌شده سمت کلاینت)
  config?: VectorAvatarConfig; // پیکربندی آواتار کارتونی
}

/** رنگ‌های پیشنهادی آواتار — از پالت برند هایپر زیتون */
export const AVATAR_COLORS = [
  "#0F7B6C", // سبز پسته
  "#B8860B", // طلایی
  "#8C4A2F", // نخی/کویری
  "#5B7DB1", // آبی خاکستری ملایم
  "#7B5EA7", // بنفش ملایم
  "#C25E5E", // آجری
  "#4E8D5B", // سبز روشن
  "#6B8E23", // زیتونی
];

/** ایموجی‌های پیشنهادی برای آواتار شخصی */
export const AVATAR_EMOJIS = [
  "🌿", "🥜", "🌱", "🌻", "🤝", "🙂", "😄", "🧕",
  "🛒", "💳", "📦", "🏷️", "✨", "🌙", "☀️", "🔥",
  "💧", "🎯", "📍", "📞", "🥇", "🌼", "🫒", "🍇",
];

/** تجزیه امن رشته JSON آواتار */
export function parseAvatar(raw?: string | null): AvatarData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    if (d.type === "vector")
      return { type: "vector", config: parseVectorConfig(d.config) };
    if (d.type === "photo" && typeof d.photo === "string" && d.photo.startsWith("data:image/"))
      return { type: "photo", photo: d.photo };
    if (d.type === "emoji" && typeof d.emoji === "string" && d.emoji.length <= 8)
      return { type: "emoji", emoji: d.emoji, color: typeof d.color === "string" ? d.color : undefined };
    return { type: "initials", color: typeof d.color === "string" ? d.color : undefined };
  } catch {
    return null;
  }
}

/** حرف اول نام‌خانوادگی (آخرین واژه نام) — طبق خواسته مدیریت:
 *  فقط یک حرف؛ ترکیب حروف اول و آخر گاهی واژه‌های زشت می‌سازد */
export function initialsOf(fullName: string): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  // آخرین واژه = نام‌خانوادگی
  return [...parts[parts.length - 1]][0] ?? "؟";
}

const SIZE_CLASS: Record<string, { box: string; text: string }> = {
  sm: { box: "size-8", text: "text-[11px]" },
  md: { box: "size-10", text: "text-sm" },
  lg: { box: "size-16", text: "text-xl" },
  xl: { box: "size-24", text: "text-3xl" },
};

/** نشان آواتار — با فالبک خودکار به حروف اول نام */
export function AvatarBadge({
  fullName,
  avatar,
  size = "md",
  className,
}: {
  fullName: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const data = parseAvatar(avatar);
  const s = SIZE_CLASS[size] ?? SIZE_CLASS.md;

  if (data?.type === "vector" && data.config) {
    return (
      <VectorAvatar
        config={data.config}
        size={size}
        className={cn("shadow-sm", className)}
        title={`آواتار ${fullName}`}
      />
    );
  }

  if (data?.type === "photo" && data.photo) {
    return (
      <img
        src={data.photo}
        alt={`آواتار ${fullName}`}
        className={cn(s.box, "rounded-full object-cover border border-primary/30 shadow-sm", className)}
      />
    );
  }

  const color = data?.color ?? "#0F7B6C";
  const isHex = /^#[0-9a-fA-F]{6}$/.test(color);
  const bg = isHex ? `${color}1f` : "rgba(15,123,108,0.12)";
  const fg = isHex ? color : "#0F7B6C";
  const border = isHex ? `${color}59` : "rgba(15,123,108,0.35)";

  if (data?.type === "emoji" && data.emoji) {
    return (
      <span
        aria-hidden="true"
        className={cn(s.box, "flex items-center justify-center rounded-full border select-none", className)}
        style={{
          backgroundColor: bg,
          borderColor: border,
          fontSize: size === "xl" ? "2rem" : size === "lg" ? "1.4rem" : size === "md" ? "1.05rem" : "0.9rem",
        }}
      >
        {data.emoji}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        s.box,
        s.text,
        "flex items-center justify-center rounded-full border font-extrabold select-none",
        className
      )}
      style={{ backgroundColor: bg, color: fg, borderColor: border }}
    >
      {initialsOf(fullName)}
    </span>
  );
}
