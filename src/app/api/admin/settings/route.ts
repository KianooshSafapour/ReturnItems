import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

// کلیدهای مجاز تنظیمات سامانه
const SETTING_KEYS = [
  "storeName",
  "storeCity",
  "storePhone",
  "managerName",
  "receiptFooter",
  "developerCredit",
] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  storeName: "هایپر زیتون",
  storeCity: "رفسنجان، کرمان",
  storePhone: "",
  managerName: "آقای نوروزی",
  receiptFooter: "از خرید شما سپاسگزاریم — کالای مرجوعی تا ۷ روز پذیرفته می‌شود",
  developerCredit: "کیانوش صفاپور (Kianoosh Safapour)",
};

/** خواندن تنظیمات — برای هر کاربر واردشده (برندینگ پوسته) */
export async function GET() {
  try {
    await requireUser();
    const rows = await db.setting.findMany({
      where: { key: { in: SETTING_KEYS as unknown as string[] } },
    });
    const map = { ...DEFAULTS } as Record<string, string>;
    for (const r of rows) map[r.key] = r.value;
    return jsonOk(map);
  } catch (e) {
    return handleApiError(e);
  }
}

/** ذخیره تنظیمات — فقط مدیر ارشد/مالک */
export async function PUT(req: NextRequest) {
  try {
    const manager = await requireOwner();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      return jsonError("بدنه درخواست نامعتبر است");

    const updates: Array<{ key: string; value: string }> = [];
    for (const k of SETTING_KEYS) {
      if (body[k] === undefined) continue;
      const value = String(body[k]).trim().slice(0, 300);
      if (k === "storeName" && value.length < 2)
        return jsonError("نام فروشگاه حداقل ۲ نویسه باشد");
      updates.push({ key: k, value });
    }
    if (updates.length === 0)
      return jsonError("هیچ تنظیمی برای ذخیره ارسال نشده است");

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        create: { key: u.key, value: u.value },
        update: { value: u.value },
      });
    }

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "settings_update",
        detail: `به‌روزرسانی تنظیمات سامانه: ${updates.map((u) => u.key).join("، ")}`,
      },
    });

    const rows = await db.setting.findMany({
      where: { key: { in: SETTING_KEYS as unknown as string[] } },
    });
    const map = { ...DEFAULTS } as Record<string, string>;
    for (const r of rows) map[r.key] = r.value;
    return jsonOk(map);
  } catch (e) {
    return handleApiError(e);
  }
}
