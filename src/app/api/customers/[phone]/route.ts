import { db } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/**
 * سابقه کامل یک مشتری بر اساس شماره موبایل
 * در دسترس همه کاربران واردشده (صندوقدار برای شناسایی مشتری سر میز مرجوعی، مدیر برای دفترچه)
 * توجه: شماره کارت بانکی هرگز بازگردانده نمی‌شود
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await requireUser();
    const { phone: raw } = await params;
    const phone = raw.replace(/\D/g, "");
    if (phone.length < 10) return jsonOk({ found: false, phone: raw, returns: [] });

    const rows = await db.returnRequest.findMany({
      where: { customerPhone: phone },
      orderBy: { submittedAt: "desc" },
      select: {
        code: true,
        totalAmount: true,
        exchangeValue: true,
        transferAmount: true,
        settlementType: true,
        status: true,
        submittedAt: true,
        customerName: true,
        cashier: { select: { fullName: true } },
        items: { select: { quantity: true } },
      },
    });

    if (rows.length === 0)
      return jsonOk({ found: false, phone, returns: [] });

    let itemsTotal = 0;
    let exchangedTotal = 0;
    let transferredTotal = 0;
    let creditTotal = 0;
    let debtTotal = 0;
    let pendingCount = 0;
    for (const r of rows) {
      const transfer = r.transferAmount ?? r.totalAmount;
      itemsTotal += r.totalAmount;
      exchangedTotal += r.exchangeValue;
      transferredTotal += transfer;
      creditTotal += Math.max(0, r.totalAmount - r.exchangeValue - transfer);
      if (r.settlementType === "debt") debtTotal += Math.max(0, r.exchangeValue - r.totalAmount);
      if (r.status === "pending") pendingCount += 1;
    }

    // تنظیم پیامک این مشتری (کلید دوم لایه دوگانه — پیش‌فرض روشن)
    const pref = await db.customer.findUnique({
      where: { phone },
      select: { smsEnabled: true },
    });

    return jsonOk({
      found: true,
      phone,
      name: rows[0].customerName,
      smsEnabled: pref?.smsEnabled ?? true,
      returnCount: rows.length,
      pendingCount,
      itemsTotal,
      exchangedTotal,
      transferredTotal,
      creditTotal,
      debtTotal,
      firstAt: rows[rows.length - 1].submittedAt.toISOString(),
      lastAt: rows[0].submittedAt.toISOString(),
      returns: rows.slice(0, 50).map((r) => ({
        id: r.code,
        code: r.code,
        status: r.status as "pending" | "paid",
        settlementType: r.settlementType,
        totalAmount: r.totalAmount,
        exchangeValue: r.exchangeValue,
        transferAmount: r.transferAmount ?? r.totalAmount,
        itemCount: r.items.reduce((s, i) => s + i.quantity, 0),
        submittedAt: r.submittedAt.toISOString(),
        cashierName: r.cashier.fullName,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * تغییر تنظیم پیامک یک مشتری (مدیران) — کلید دوم لایه دوگانه خاموش‌کردن پیامک‌های خودکار.
 * بدنه: { smsEnabled: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const manager = await requireOwner();
    const { phone: raw } = await params;
    const phone = raw.replace(/\D/g, "");
    if (!/^09\d{9}$/.test(phone))
      return jsonError("شماره موبایل مشتری نامعتبر است");

    const body = await req.json().catch(() => null);
    if (typeof body?.smsEnabled !== "boolean")
      return jsonError("مقدار smsEnabled باید true یا false باشد");

    // رکورد مشتری را اگر نبود از آخرین مرجوعی می‌سازیم
    const existing = await db.customer.findUnique({ where: { phone } });
    let name = existing?.name;
    if (!name) {
      const last = await db.returnRequest.findFirst({
        where: { customerPhone: phone },
        orderBy: { submittedAt: "desc" },
        select: { customerName: true },
      });
      name = last?.customerName ?? "مشتری";
    }

    const updated = await db.customer.upsert({
      where: { phone },
      create: { phone, name, smsEnabled: body.smsEnabled },
      update: { smsEnabled: body.smsEnabled, name: existing?.name ?? name },
    });

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "customer_sms_toggle",
        detail: `${body.smsEnabled ? "فعال‌سازی" : "خاموش‌کردن"} پیامک‌های خودکار مشتری «${updated.name}» (${phone})`,
        entityId: updated.id,
      },
    });

    return jsonOk({ phone, smsEnabled: updated.smsEnabled });
  } catch (e) {
    return handleApiError(e);
  }
}
