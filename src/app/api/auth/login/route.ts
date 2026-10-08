import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!username || !password) return jsonError("نام کاربری و گذرواژه الزامی است");

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonError("نام کاربری یا گذرواژه نادرست است", 401);
    }
    if (!user.isActive) return jsonError("حساب کاربری شما غیرفعال شده است", 403);

    await setSessionCookie(user.id);
    await db.activityLog.create({
      data: { userId: user.id, action: "login", detail: "ورود موفق به سامانه" },
    });

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        canActAsCashier: user.canActAsCashier,
        canApproveReturns: user.canApproveReturns,
        canRecordPayment: user.canRecordPayment,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
