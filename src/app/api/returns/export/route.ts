import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";
import { generateReturnsExport, type ExportReturnRow } from "@/lib/holoo";

/** خروجی اکسل آرشیو مرجوعی‌ها (فقط مدیر) */
export async function GET() {
  try {
    await requireOwner();
    const returns = await db.returnRequest.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        cashier: { select: { fullName: true } },
        items: true,
        payment: true,
      },
    });

    const rows: ExportReturnRow[] = returns.map((r) => ({
      code: r.code,
      submittedAt: r.submittedAt,
      cashier: r.cashier.fullName,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerCard: r.customerCardNumber,
      purchaseAt: r.purchaseAt,
      totalAmount: r.totalAmount,
      exchangeValue: r.exchangeValue,
      transferAmount: r.transferAmount ?? r.totalAmount,
      transferNote: r.transferNote,
      settlementType: r.settlementType,
      status: r.status,
      bankName: r.payment?.bankName,
      accountNumber: r.payment?.accountNumber ?? undefined,
      referenceNumber: r.payment?.referenceNumber ?? undefined,
      transferredAt: r.payment?.transferredAt,
      items: r.items.map((it) => ({
        code: it.code,
        name: it.name,
        barcode: it.barcode,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    }));

    const buf = generateReturnsExport(rows);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="hyper-zeytoon-returns.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
