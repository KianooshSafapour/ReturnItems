import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { digitsOnly, isValidIranMobile } from "@/lib/validators";

/** اعتبارسنجی رشته JSON آواتار — {type: initials|emoji|photo|vector, ...} */
function validateAvatar(raw: unknown): string | null | { error: string } | undefined {
  if (raw === null) return null; // پاک‌کردن آواتار
  if (raw === undefined) return undefined; // بدون تغییر
  if (typeof raw !== "string") return { error: "قالب آواتار نامعتبر است" };
  if (raw === "") return null;
  if (raw.length > 300_000)
    return { error: "حجم تصویر آواتار بیش از حد مجاز است (حداکثر ~۲۵۰ کیلوبایت)" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "قالب آواتار JSON معتبر نیست" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return { error: "قالب آواتار نامعتبر است" };
  const d = parsed as Record<string, unknown>;
  const type = String(d.type ?? "");
  if (!["initials", "emoji", "photo", "vector"].includes(type))
    return { error: "نوع آواتار باید initials، emoji، photo یا vector باشد" };
  if (d.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(d.color ?? "")))
    return { error: "رنگ آواتار باید کد HEX شش‌رقمی باشد (مثل #0F7B6C)" };
  if (d.emoji !== undefined && [...String(d.emoji ?? "")].length > 2)
    return { error: "ایموجی آواتار حداکثر یک نویسه باشد" };
  if (type === "photo") {
    const photo = String(d.photo ?? "");
    if (!photo.startsWith("data:image/"))
      return { error: "تصویر آواتار باید dataURL تصویر باشد" };
    if (photo.length > 250_000)
      return { error: "تصویر آواتار خیلی بزرگ است — حداکثر ~۲۵۰ کیلوبایت (خودکار کوچک می‌شود)" };
  }
  if (type === "vector") {
    // آواتار دو‌بعدی ساخته‌شده در سامانه — اعتبارسنجی سخت‌گیرانه مقادیر
    const cfg = (d.config ?? {}) as Record<string, unknown>;
    const hexKeys = ["bg", "skin", "hairColor", "clothColor"];
    for (const k of hexKeys) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(cfg[k] ?? "")))
        return { error: "رنگ‌های آواتار کارتونی باید HEX معتبر باشند" };
    }
    const strKeys = ["hair", "eyes", "brows", "mouth", "glasses", "facialHair", "clothing"];
    for (const k of strKeys) {
      if (String(cfg[k] ?? "").length > 20)
        return { error: "قالب آواتار کارتونی نامعتبر است" };
    }
    if (raw.length > 4_000) return { error: "پیکربندی آواتار بیش از حد بزرگ است" };
  }
  return raw;
}

/** مشخصات شخصی کاربر جاری (برای پیش‌پرکردن فرم حساب من) */
export async function GET() {
  try {
    const session = await requireUser();
    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) return jsonError("کاربر یافت نشد", 404);
    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** به‌روزرسانی مشخصات شخصی (نام کامل / شماره تماس / آواتار) — هر کاربری برای حساب خودش */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => null);

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) return jsonError("کاربر یافت نشد", 404);

    const data: { fullName?: string; phone?: string | null; avatar?: string | null } = {};
    const changedLabels: string[] = [];

    if (body?.fullName !== undefined) {
      const fullName = String(body.fullName ?? "").trim();
      if (fullName.length < 3 || fullName.length > 100)
        return jsonError("نام کامل باید ۳ تا ۱۰۰ نویسه باشد");
      if (fullName !== user.fullName) {
        data.fullName = fullName;
        changedLabels.push("نام کامل");
      }
    }

    if (body?.phone !== undefined) {
      const raw = body.phone === null ? "" : String(body.phone).trim();
      if (raw === "") {
        // رشته خالی = پاک‌کردن شماره تماس
        if (user.phone) {
          data.phone = null;
          changedLabels.push("شماره تماس");
        }
      } else {
        if (!isValidIranMobile(raw))
          return jsonError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود");
        const phone = digitsOnly(raw);
        if (phone !== user.phone) {
          data.phone = phone;
          changedLabels.push("شماره تماس");
        }
      }
    }

    if (body?.avatar !== undefined) {
      const avatar = validateAvatar(body.avatar);
      if (avatar && typeof avatar === "object" && "error" in avatar)
        return jsonError(avatar.error);
      const avatarValue = avatar === undefined ? undefined : (avatar as string | null);
      if (avatarValue !== undefined && avatarValue !== user.avatar) {
        data.avatar = avatarValue;
        changedLabels.push("آواتار");
      }
    }

    if (changedLabels.length > 0) {
      await db.user.update({ where: { id: user.id }, data });
      await db.activityLog.create({
        data: {
          userId: user.id,
          action: "user_update",
          detail: `به‌روزرسانی مشخصات شخصی: ${changedLabels.join("، ")}`,
          entityId: user.id,
        },
      });
    }

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        fullName: data.fullName ?? user.fullName,
        role: user.role,
        phone: data.phone !== undefined ? data.phone : user.phone,
        avatar: data.avatar !== undefined ? data.avatar : user.avatar,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
