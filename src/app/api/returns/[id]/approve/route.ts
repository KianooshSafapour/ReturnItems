import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { notifyPaymentApproversOfApproval } from "@/lib/sms-alerts";

/**
 * تأیید مرجوعی توسط مدیر کل (خانم لطفی)، مدیر ارشد یا مالک — مجوز «تأیید مرجوعی» لازم است.
 * دو مسیر:
 *  · مرجوعی تبادلی/بدون وجه → تأیید و بایگانی نهایی (بدون پیامک)
 *  · مرجوعی دارای انتقال وجه → تأیید + پیامک «آماده پرداخت» به ثبت‌کنندگان پرداخت (آقای نوروزی)
 *    تأییدکننده می‌تواند با چک‌باکس «بدون پیامک» ارسال را برای همین تأیید خاموش کند.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user.canApproveReturns)
      return jsonError(
        "تأیید مرجوعی تنها برای مدیران دارای مجوز «تأیید مرجوعی» مجاز است",
        403
      );

    const { id } = await params;
    const r = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true, cashier: { select: { fullName: true } } },
    });
    if (!r) return jsonError("مرجوعی یافت نشد", 404);

    if (r.status !== "pending")
      return jsonError("این مرجوعی قبلاً نهایی شده است", 409);

    const body = await req.json().catch(() => null);
    // پیش‌فرض: پیامک آماده پرداخت ارسال می‌شود — مدیر می‌تواند خاموشش کند
    const notifySms = body?.notifySms !== false;

    const transferAmount = r.transferAmount ?? r.totalAmount;
    const hasTransfer = transferAmount > 0;

    const updated = await db.returnRequest.update({
      where: { id },
      data: {
        status: "approved",
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "return_approve",
        detail: hasTransfer
          ? `تأیید مرجوعی ${r.code} برای ${r.customerName} توسط ${user.fullName} — در انتظار انتقال ${transferAmount} ریال به کارت مشتری${notifySms ? " (پیامک آماده پرداخت ارسال شد)" : " (بدون پیامک)"}`
          : `تأیید و بایگانی مرجوعی تبادلی ${r.code} برای ${r.customerName} توسط ${user.fullName} (تسویه: ${r.settlementType})`,
        entityId: r.id,
      },
    });

    // 📱 پیامک «آماده پرداخت» به آقای نوروزی / ثبت‌کنندگان پرداخت — فقط مرجوعی وجه‌دار
    if (hasTransfer && notifySms) {
      void notifyPaymentApproversOfApproval(
        {
          id: r.id,
          code: r.code,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          totalAmount: r.totalAmount,
          transferAmount,
          items: r.items.map((it) => ({ name: it.name, quantity: it.quantity })),
          cashierName: r.cashier.fullName,
        },
        user.fullName
      );
    }

    return jsonOk({
      id: updated.id,
      code: updated.code,
      status: updated.status,
      approvedAt: updated.approvedAt,
      approvedBy: { fullName: user.fullName, username: user.username },
      // آیا مرجوعی در انتظار پرداخت است (وجه‌دار) یا بایگانی نهایی شد (تبادلی)
      awaitingPayment: hasTransfer,
      ownerNotified: hasTransfer && notifySms,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
