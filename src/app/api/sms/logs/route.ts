import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

/** تاریخچه ارسال پیامک به مشتریان — فقط مدیران */
export async function GET(req: NextRequest) {
  try {
    await requireOwner();
    const limit = Math.min(
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50),
      200
    );
    const logs = await db.smsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        template: { select: { title: true } },
        request: { select: { code: true, customerName: true } },
      },
    });
    return jsonOk({
      logs: logs.map((l) => ({
        id: l.id,
        phone: l.phone,
        message: l.message,
        amount: l.amount,
        status: l.status,
        provider: l.provider,
        error: l.status === "failed" ? l.response : null,
        templateTitle: l.template?.title ?? null,
        requestCode: l.request?.code ?? null,
        customerName: l.request?.customerName ?? null,
        createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
