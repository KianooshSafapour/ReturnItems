import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

/** آمار و گزارش‌های مدیریتی */
export async function GET() {
  try {
    await requireOwner();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days14 = new Date(startOfDay.getTime() - 13 * 24 * 3600 * 1000);

    const [
      pendingRows,
      approvedRows,
      paidCount,
      paidSum,
      paidCountMonth,
      paidSumMonth,
      totalCount,
      cashierUsers,
      cashierAgg,
      topProducts,
      recentReturns,
      lowStockProducts,
      lowStockCount,
      outOfStockCount,
      bankUpdated,
    ] = await Promise.all([
      // ردیف‌های در انتظار تأیید مدیر کل (همه انواع)
      db.returnRequest.findMany({
        where: { status: "pending" },
        select: { transferAmount: true, totalAmount: true },
      }),
      // ردیف‌های تأییدشده — تفکیک «در انتظار پرداخت» از «بایگانی تبادلی»
      db.returnRequest.findMany({
        where: { status: "approved" },
        select: { transferAmount: true, totalAmount: true },
      }),
      db.returnRequest.count({ where: { status: "paid" } }),
      db.returnRequest.aggregate({ where: { status: "paid" }, _sum: { totalAmount: true } }),
      db.returnRequest.count({ where: { status: "paid", submittedAt: { gte: startOfMonth } } }),
      db.returnRequest.aggregate({
        where: { status: "paid", submittedAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      db.returnRequest.count({}),
      // صندوقدارها = نقش صندوقدار + مدیران دارای مجوز صندوقداری
      db.user.findMany({
        where: { OR: [{ role: "cashier" }, { canActAsCashier: true }] },
        select: {
          id: true,
          fullName: true,
          isActive: true,
        },
      }),
      // تجمیع عملکرد هر صندوقدار: تعداد، جمع مبلغ، آخرین فعالیت
      db.returnRequest.groupBy({
        by: ["cashierId"],
        _count: { _all: true },
        _sum: { totalAmount: true },
        _max: { submittedAt: true },
      }),
      db.returnItem.groupBy({
        by: ["name"],
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 6,
      }),
      db.returnRequest.findMany({
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: { cashier: { select: { fullName: true } } },
      }),
      // هشدار موجودی — کالاهای رو به اتمام بر اساس آخرین بروزرسانی بانک کالا (هلو)
      db.product.findMany({
        where: { isActive: true, stock: { lte: 5 } },
        orderBy: [{ stock: "asc" }, { name: "asc" }],
        take: 8,
        select: { id: true, name: true, stock: true, unit: true, code: true },
      }),
      db.product.count({ where: { isActive: true, stock: { lte: 5 } } }),
      db.product.count({ where: { isActive: true, stock: 0 } }),
      db.product.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ]);

    // در انتظار تأیید مدیر کل — همه مرجوعی‌های pending (تبادلی و وجه‌دار)
    const pendingCount = pendingRows.length;
    const pendingTotalAmount = pendingRows.reduce((s, r) => s + (r.transferAmount ?? r.totalAmount), 0);
    // تأییدشده + وجه‌دار → در انتظار انتقال وجه (اقدام آقای نوروزی)
    const awaitingPaymentRows = approvedRows.filter((r) => (r.transferAmount ?? r.totalAmount) > 0);
    const awaitingPaymentCount = awaitingPaymentRows.length;
    const awaitingPaymentTotalAmount = awaitingPaymentRows.reduce(
      (s, r) => s + (r.transferAmount ?? r.totalAmount),
      0
    );
    // تأییدشده تبادلی → بایگانی نهایی
    const approvedArchivedCount = approvedRows.length - awaitingPaymentRows.length;
    const approvedArchivedTotalAmount =
      approvedRows.reduce((s, r) => s + r.totalAmount, 0) -
      awaitingPaymentRows.reduce((s, r) => s + r.totalAmount, 0);

    // سری زمانی ۱۴ روز اخیر
    const recentItems = await db.returnRequest.findMany({
      where: { submittedAt: { gte: days14 } },
      select: { submittedAt: true, totalAmount: true },
    });
    const series: Array<{ date: string; count: number; amount: number }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(days14.getTime() + i * 24 * 3600 * 1000);
      const next = new Date(d.getTime() + 24 * 3600 * 1000);
      const dayItems = recentItems.filter(
        (r) => r.submittedAt >= d && r.submittedAt < next
      );
      series.push({
        date: d.toISOString().slice(0, 10),
        count: dayItems.length,
        amount: dayItems.reduce((s, r) => s + r.totalAmount, 0),
      });
    }

    return jsonOk({
      // در انتظار تأیید مدیر کل
      pendingCount,
      pendingTotalAmount,
      // تأییدشده و وجه‌دار — در انتظار انتقال وجه به کارت مشتری
      awaitingPaymentCount,
      awaitingPaymentTotalAmount,
      // تأییدشده تبادلی — بایگانی نهایی
      approvedArchivedCount,
      approvedArchivedTotalAmount,
      paidCount,
      paidTotalAmount: paidSum._sum.totalAmount ?? 0,
      paidCountMonth,
      paidTotalAmountMonth: paidSumMonth._sum.totalAmount ?? 0,
      totalCount,
      cashiers: cashierUsers.map((c) => {
        const agg = cashierAgg.find((a) => a.cashierId === c.id);
        return {
          id: c.id,
          fullName: c.fullName,
          isActive: c.isActive,
          returnCount: agg?._count._all ?? 0,
          totalAmount: agg?._sum.totalAmount ?? 0,
          lastActivityAt: agg?._max.submittedAt ?? null,
        };
      }),
      topProducts: topProducts.map((p) => ({
        name: p.name,
        quantity: p._sum.quantity ?? 0,
        amount: p._sum.lineTotal ?? 0,
      })),
      recentReturns: recentReturns.map((r) => ({
        id: r.id,
        code: r.code,
        customerName: r.customerName,
        totalAmount: r.totalAmount,
        transferAmount: r.transferAmount ?? r.totalAmount,
        settlementType: r.settlementType,
        status: r.status,
        submittedAt: r.submittedAt,
        cashierName: r.cashier.fullName,
      })),
      series,
      lowStock: {
        products: lowStockProducts,
        total: lowStockCount,
        outOfStock: outOfStockCount,
        bankUpdatedAt: bankUpdated?.updatedAt ?? null,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
