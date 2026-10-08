import { db } from "@/lib/db";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-helpers";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user) {
      await db.activityLog.create({
        data: { userId: user.id, action: "logout", detail: "خروج از سامانه" },
      });
    }
    await clearSessionCookie();
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
