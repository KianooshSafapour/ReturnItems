import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

/**
 * اعلان‌های مدیر — دو دسته (گردش کار جدید):
 * · در انتظار تأیید مدیر کل: همه مرجوعی‌های «در انتظار» (تبادلی و وجه‌دار)
 * · در انتظار انتقال وجه: مرجوعی‌های «تأییدشده» دارای وجه — اقدام آقای نوروزی (پیامک آماده پرداخت گرفته است)
 */
export async function GET() {
  try {
    const user = await requireOwner();
    const [pendingRows, approvedRows, latest] = await Promise.all([
      db.returnRequest.findMany({
        where: { status: "pending" },
        select: { transferAmount: true, totalAmount: true, settlementType: true },
      }),
      db.returnRequest.findMany({
        where: { status: "approved" },
        select: { transferAmount: true, totalAmount: true, settlementType: true },
      }),
      db.returnRequest.findMany({
        where: { status: { in: ["pending", "approved"] } },
        orderBy: { submittedAt: "desc" },
        take: 6,
        include: { cashier: { select: { fullName: true } } },
      }),
    ]);

    // در انتظار تأیید مدیر کل: همه وضعیت pending
    const awaitingApproval = pendingRows;
    // در انتظار انتقال وجه: تأییدشده + دارای وجه
    const awaitingPayment = approvedRows.filter((r) => (r.transferAmount ?? r.totalAmount) > 0);

    return jsonOk({
      pendingCount: awaitingApproval.length,
      pendingTotalAmount: awaitingPayment.reduce(
        (s, r) => s + (r.transferAmount ?? r.totalAmount),
        0
      ),
      awaitingPaymentCount: awaitingPayment.length,
      awaitingApprovalCount: awaitingApproval.length,
      // مجوزهای کاربر جاری — زنگ اعلان فقط دسته‌های مرتبط را نشان می‌دهد
      canApproveReturns: user.canApproveReturns,
      canRecordPayment: user.canRecordPayment,
      serverTime: new Date().toISOString(),
      latest: latest.map((r) => ({
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
    });
  } catch (e) {
    return handleApiError(e);
  }
}
