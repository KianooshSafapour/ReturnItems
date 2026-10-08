import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/** تغییر گذرواژه توسط خود کاربر (هر نقشی) — با تأیید گذرواژه فعلی */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => null);

    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");

    if (!currentPassword) return jsonError("گذرواژه فعلی الزامی است");
    if (newPassword.length < 6)
      return jsonError("گذرواژه جدید حداقل ۶ نویسه باشد");

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) return jsonError("کاربر یافت نشد", 404);

    if (!verifyPassword(currentPassword, user.passwordHash))
      return jsonError("گذرواژه فعلی نادرست است");

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "user_password_change",
        detail: "تغییر گذرواژه توسط خود کاربر",
        entityId: user.id,
      },
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
