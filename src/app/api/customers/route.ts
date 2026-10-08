import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

/**
 * دفترچه مشتریان — تجمیع همه مرجوعی‌ها بر اساس شماره موبایل مشتری
 * فقط مدیران (آقای نوروزی و مدیر ارشد)
 *
 * پارامترها: q (جستجوی نام/شماره)، page، pageSize، sort (recent | count | credit | debt)
 */
export async function GET(req: Request) {
  try {
    await requireOwner();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
    const sort = url.searchParams.get("sort") ?? "recent";

    // خواندن فیلدهای تجمیع (مجموعه داده کوچک — تجمیع در حافظه)
    const where: Prisma.ReturnRequestWhereInput = q
      ? {
          OR: [
            { customerPhone: { contains: q } },
            { customerName: { contains: q } },
          ],
        }
      : {};
    const rows = await db.returnRequest.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      select: {
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        exchangeValue: true,
        transferAmount: true,
        settlementType: true,
        status: true,
        submittedAt: true,
      },
    });

    // تجمیع بر اساس شماره موبایل
    const byPhone = new Map<
      string,
      {
        phone: string;
        name: string;
        returnCount: number;
        pendingCount: number;
        itemsTotal: number;
        exchangedTotal: number;
        transferredTotal: number;
        creditTotal: number;
        debtTotal: number;
        firstAt: Date;
        lastAt: Date;
      }
    >();
    for (const r of rows) {
      const phone = r.customerPhone;
      const transfer = r.transferAmount ?? r.totalAmount;
      const credit = Math.max(0, r.totalAmount - r.exchangeValue - transfer);
      const debt = r.settlementType === "debt" ? Math.max(0, r.exchangeValue - r.totalAmount) : 0;
      let c = byPhone.get(phone);
      if (!c) {
        c = {
          phone,
          name: r.customerName,
          returnCount: 0,
          pendingCount: 0,
          itemsTotal: 0,
          exchangedTotal: 0,
          transferredTotal: 0,
          creditTotal: 0,
          debtTotal: 0,
          firstAt: r.submittedAt,
          lastAt: r.submittedAt,
        };
        byPhone.set(phone, c);
      }
      // ردیف‌ها بر اساس submittedAt نزولی مرتب‌اند → اولین ردیف دیده‌شده = جدیدترین نام/تاریخ
      c.returnCount += 1;
      if (r.status === "pending") c.pendingCount += 1;
      c.itemsTotal += r.totalAmount;
      c.exchangedTotal += r.exchangeValue;
      c.transferredTotal += transfer;
      c.creditTotal += credit;
      c.debtTotal += debt;
      if (r.submittedAt < c.firstAt) c.firstAt = r.submittedAt;
    }

    let customers = [...byPhone.values()];
    if (sort === "count") customers.sort((a, b) => b.returnCount - a.returnCount || b.lastAt.getTime() - a.lastAt.getTime());
    else if (sort === "credit") customers.sort((a, b) => b.creditTotal - a.creditTotal || b.returnCount - a.returnCount);
    else if (sort === "debt") customers.sort((a, b) => b.debtTotal - a.debtTotal || b.returnCount - a.returnCount);
    else customers.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    const total = customers.length;
    const start = (page - 1) * pageSize;
    const pagedPhones = customers.slice(start, start + pageSize).map((c) => c.phone);
    // کلید دوم لایه دوگانه: تنظیم پیامک هر مشتری از دفترچه (پیش‌فرض روشن)
    const customerPrefs = await db.customer.findMany({
      where: { phone: { in: pagedPhones } },
      select: { phone: true, smsEnabled: true },
    });
    const smsByPhone = new Map(customerPrefs.map((c) => [c.phone, c.smsEnabled]));

    const paged = customers.slice(start, start + pageSize).map((c) => ({
      ...c,
      smsEnabled: smsByPhone.get(c.phone) ?? true,
      firstAt: c.firstAt.toISOString(),
      lastAt: c.lastAt.toISOString(),
    }));

    return jsonOk({
      customers: paged,
      total,
      page,
      pageSize,
      // آمار کلی برای کارت‌های بالای صفحه
      summary: {
        totalCustomers: byPhone.size,
        withCredit: [...byPhone.values()].filter((c) => c.creditTotal > 0).length,
        withDebt: [...byPhone.values()].filter((c) => c.debtTotal > 0).length,
        creditTotal: [...byPhone.values()].reduce((s, c) => s + c.creditTotal, 0),
        debtTotal: [...byPhone.values()].reduce((s, c) => s + c.debtTotal, 0),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
