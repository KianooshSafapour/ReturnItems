import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

/** تاریخچه فعالیت — صندوقدار: خودش، مدیر: همه */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
      200
    );
    const activities = await db.activityLog.findMany({
      where: user.role === "cashier" ? { userId: user.id } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { fullName: true, username: true, role: true } } },
    });

    return jsonOk({
      activities: activities.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt,
        user: a.user,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
