import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";
import { stat } from "fs/promises";
import { resolve } from "path";

/** نمای کلی سامانه — اختصاصی مدیر ارشد (کیانوش صفاپور) و مالک فروشگاه (آقای نوروزی) */
export async function GET() {
  try {
    await requireOwner();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      users,
      productsTotal,
      productsActive,
      productsWithBarcode,
      categories,
      returnsTotal,
      returnsPending,
      returnsPaid,
      paymentAgg,
      settlementRows,
      activityToday,
    ] = await Promise.all([
      db.user.findMany({ select: { role: true, isActive: true } }),
      db.product.count({}),
      db.product.count({ where: { isActive: true } }),
      db.product.count({ where: { NOT: [{ barcode: null }] } }),
      db.product.findMany({ select: { category: true }, distinct: ["category"] }),
      db.returnRequest.count({}),
      db.returnRequest.count({ where: { status: "pending" } }),
      db.returnRequest.count({ where: { status: "paid" } }),
      db.payment.aggregate({ _sum: { amount: true }, _count: true }),
      db.returnRequest.findMany({
        select: {
          totalAmount: true,
          exchangeValue: true,
          transferAmount: true,
          settlementType: true,
        },
      }),
      db.activityLog.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

    // آمار تسویه‌ها
    const settlement = { full: 0, exchange: 0, partial: 0, debt: 0, debtTotal: 0, customerCreditTotal: 0 };
    for (const r of settlementRows) {
      const transfer = r.transferAmount ?? r.totalAmount;
      const type = r.settlementType || "full";
      if (type in settlement)
        settlement[type as keyof typeof settlement] =
          (settlement[type as keyof typeof settlement] as number) + 1;
      if (type === "debt") settlement.debtTotal += r.exchangeValue - r.totalAmount;
      // اعتبار باقی‌مانده مشتری (کسری توضیح‌دار)
      if (transfer + r.exchangeValue < r.totalAmount)
        settlement.customerCreditTotal += r.totalAmount - r.exchangeValue - transfer;
    }

    // حجم پایگاه داده
    let dbSizeBytes = 0;
    try {
      const dbPath = resolve(process.cwd(), "db", "custom.db");
      dbSizeBytes = (await stat(dbPath)).size;
    } catch {
      dbSizeBytes = 0;
    }

    return jsonOk({
      users: {
        total: users.length,
        active: users.filter((u) => u.isActive).length,
        cashiers: users.filter((u) => u.role === "cashier").length,
        managers: users.filter((u) => u.role === "owner" || u.role === "admin").length,
      },
      products: {
        total: productsTotal,
        active: productsActive,
        withBarcode: productsWithBarcode,
        categories: categories.filter((c) => c.category).length,
      },
      returns: { total: returnsTotal, pending: returnsPending, paid: returnsPaid },
      payments: {
        count: paymentAgg._count,
        totalAmount: paymentAgg._sum.amount ?? 0,
      },
      settlement,
      activityToday,
      dbSizeBytes,
      serverTime: now.toISOString(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
