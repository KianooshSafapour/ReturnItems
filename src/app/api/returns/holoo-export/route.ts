import { db } from "@/lib/db";
import { requireUser, isManager } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { generateHolooReturnsBatch } from "@/lib/holoo";
import { Prisma } from "@prisma/client";

/**
 * خروجی گروهی «برگشت از فروش» برای هلو APEX — فایل .xls چندشیتی (هر مرجوعی یک شیت انگلیسی).
 * فقط مرجوعی‌های نهایی‌شده (پرداخت‌شده یا تأییدشده) — سطرهای اقلام هر مرجوعی در شیت خودش.
 * پارامتر days: بازه چند روز اخیر (پیش‌فرض ۳۰ روز) — با days=all همه.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!isManager(user))
      return jsonError("خروجی هلو تنها برای مدیران مجاز است", 403);

    const sp = new URL(req.url).searchParams;
    const daysParam = sp.get("days");
    const where: Prisma.ReturnRequestWhereInput = {
      status: { in: ["paid", "approved"] },
    };
    if (daysParam !== "all" && daysParam) {
      const d = parseInt(daysParam, 10);
      if (Number.isFinite(d) && d > 0) {
        where.submittedAt = { gte: new Date(Date.now() - d * 24 * 3600 * 1000) };
      }
    }

    const returns = await db.returnRequest.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: { items: true },
      take: 200,
    });
    if (returns.length === 0)
      return jsonError("در بازه انتخابی مرجوعی نهایی‌شده‌ای برای خروجی هلو نیست");

    const buf = generateHolooReturnsBatch(
      returns.map((r) => ({
        code: r.code,
        items: r.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }))
    );

    // نام فایل انگلیسی (الزام هلو) — با تاریخ جلالی
    const now = new Date();
    const j = (await import("@/lib/jalali")).toJalali(now);
    const datePart = `${j.jy}-${String(j.jm).padStart(2, "0")}-${String(j.jd).padStart(2, "0")}`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="hz-returns-${datePart}.xls"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
