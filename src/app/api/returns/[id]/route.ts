import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/** جزئیات کامل یک مرجوعی */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await db.returnRequest.findFirst({
      where: { id },
      include: {
        items: true,
        cashier: { select: { id: true, fullName: true, username: true } },
        approvedBy: { select: { fullName: true, username: true } },
        payment: {
          include: { recordedBy: { select: { fullName: true, username: true } } },
        },
        smsLogs: {
          orderBy: { createdAt: "desc" },
          include: { template: { select: { title: true } } },
        },
      },
    });
    if (!r) return jsonError("مرجوعی یافت نشد", 404);
    if (user.role === "cashier" && r.cashierId !== user.id)
      return jsonError("دسترسی به این مرجوعی ندارید", 403);
    // تنظیم پیامک این مشتری (لایه دوم — برای هشدار فرم پرداخت)
    const customerPref = await db.customer.findUnique({
      where: { phone: r.customerPhone },
      select: { smsEnabled: true },
    });
    return jsonOk({
      id: r.id,
      code: r.code,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerCardNumber: r.customerCardNumber,
      customerSmsEnabled: customerPref?.smsEnabled ?? true,
      purchaseAt: r.purchaseAt,
      reason: r.reason,
      note: r.note,
      totalAmount: r.totalAmount,
      exchangeValue: r.exchangeValue,
      transferAmount: r.transferAmount ?? r.totalAmount,
      transferNote: r.transferNote,
      settlementType: r.settlementType,
      status: r.status,
      submittedAt: r.submittedAt,
      cashier: r.cashier,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      items: r.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        name: it.name,
        barcode: it.barcode,
        code: it.code,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
      payment: r.payment
        ? {
            bankName: r.payment.bankName,
            accountNumber: r.payment.accountNumber,
            cardNumber: r.payment.cardNumber,
            referenceNumber: r.payment.referenceNumber,
            transferredAt: r.payment.transferredAt,
            amount: r.payment.amount,
            recordedBy: r.payment.recordedBy,
          }
        : null,
      smsLogs: r.smsLogs.map((l) => ({
        id: l.id,
        phone: l.phone,
        message: l.message,
        status: l.status,
        provider: l.provider,
        templateTitle: l.template?.title ?? null,
        createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
