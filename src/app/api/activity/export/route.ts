import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";
import * as XLSX from "xlsx";

/** برچسب فارسی کنش‌های فعالیت برای خروجی اکسل */
const ACTION_LABELS: Record<string, string> = {
  login: "ورود به سامانه",
  logout: "خروج از سامانه",
  return_submit: "ثبت مرجوعی",
  payment_record: "ثبت پرداخت",
  product_import: "ورود اطلاعات از هلو",
  product_create: "ایجاد کالا",
  product_update: "ویرایش کالا",
  user_create: "ایجاد کاربر",
  user_update: "ویرایش کاربر",
  user_role_change: "تغییر نقش کاربر",
  user_reset_password: "بازنشانی گذرواژه",
  user_password_change: "تغییر گذرواژه",
  user_activate: "فعال‌سازی کاربر",
  user_deactivate: "غیرفعال‌سازی کاربر",
  settings_update: "تغییر تنظیمات",
  db_backup: "پشتیبان‌گیری پایگاه داده",
  activity_export: "خروجی اکسل فعالیت‌ها",
};

/** خروجی اکسل گزارش فعالیت سامانه (فقط مدیر) */
export async function GET() {
  try {
    const user = await requireOwner();
    const rows = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, username: true, role: true } } },
    });

    const data = rows.map((a, i) => ({
      "ردیف": i + 1,
      "تاریخ": a.createdAt.toLocaleDateString("fa-IR"),
      "ساعت": a.createdAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
      "کنش": ACTION_LABELS[a.action] ?? a.action,
      "کاربر": a.user?.fullName ?? "—",
      "نام کاربری": a.user?.username ?? "—",
      "نقش": a.user?.role ?? "—",
      "جزئیات": a.detail ?? "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ "ردیف": "—" }]);
    XLSX.utils.book_append_sheet(wb, ws, "فعالیت سامانه");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "activity_export",
        detail: `خروجی اکسل ${rows.length} ردیف فعالیت`,
      },
    });

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="hyper-zeytoon-activity.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
