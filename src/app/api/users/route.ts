import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { defaultPermissionsForRole, hashPassword, requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/** فهرست کاربران (مدیر) — مرتب‌سازی با اولویت نقش: مالک ← مدیر ارشد ← مدیر کل ← صندوقدار */
export async function GET() {
  try {
    await requireOwner();
    const users = await db.user.findMany({
      include: {
        _count: { select: { returnRequests: true, payments: true } },
      },
    });
    const ROLE_ORDER: Record<string, number> = { owner: 0, gm: 1, admin: 2, cashier: 3 };
    users.sort(
      (a, b) =>
        (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );
    return jsonOk({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        phone: u.phone,
        avatar: u.avatar,
        isActive: u.isActive,
        createdAt: u.createdAt,
        canActAsCashier: u.canActAsCashier,
        canApproveReturns: u.canApproveReturns,
        canRecordPayment: u.canRecordPayment,
        returnCount: u._count.returnRequests,
        paymentCount: u._count.payments,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ایجاد حساب جدید (مدیر) — صندوقدار یا حساب مدیریتی با نقش مشخص + مجوزهای عملیاتی */
export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner();
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = String(body?.fullName ?? "").trim();
    const phone = String(body?.phone ?? "").trim() || null;
    const role = ["cashier", "owner", "gm", "admin"].includes(String(body?.role))
      ? String(body?.role)
      : "cashier";

    if (!/^[a-z0-9_.-]{3,30}$/.test(username))
      return jsonError("نام کاربری باید ۳ تا ۳۰ نویسه لاتین/عدد باشد");
    if (password.length < 6) return jsonError("گذرواژه حداقل ۶ نویسه باشد");
    if (fullName.length < 3) return jsonError("نام کامل صندوقدار را وارد کنید");
    // ایجاد حساب «مدیر ارشد سامانه» فقط توسط خود مدیر ارشد مجاز است
    if (role === "admin" && owner.role !== "admin")
      return jsonError("ایجاد حساب مدیر ارشد تنها توسط مدیر ارشد سامانه امکان‌پذیر است");

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return jsonError("این نام کاربری قبلاً ثبت شده است");

    // مجوزها: پیش‌فرض نقش + بازنویسی صریح مدیر (فقط بولی‌های ارسال‌شده)
    const defaults = defaultPermissionsForRole(role as "cashier");
    const perms = {
      canActAsCashier:
        typeof body?.canActAsCashier === "boolean" ? body.canActAsCashier : defaults.canActAsCashier,
      canApproveReturns:
        typeof body?.canApproveReturns === "boolean"
          ? body.canApproveReturns
          : defaults.canApproveReturns,
      canRecordPayment:
        typeof body?.canRecordPayment === "boolean"
          ? body.canRecordPayment
          : defaults.canRecordPayment,
    };

    const user = await db.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        fullName: fullName.slice(0, 100),
        role,
        phone,
        ...perms,
      },
    });

    const roleLabels: Record<string, string> = {
      cashier: "صندوقدار",
      gm: "مدیر کل",
      owner: "مدیر فروشگاه",
      admin: "مدیر ارشد سامانه",
    };
    await db.activityLog.create({
      data: {
        userId: owner.id,
        action: "user_create",
        detail: `ایجاد حساب ${roleLabels[role] ?? role} «${fullName}» (${username})`,
        entityId: user.id,
      },
    });

    return jsonOk({ id: user.id, username: user.username }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
