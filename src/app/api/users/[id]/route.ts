import { db } from "@/lib/db";
import { defaultPermissionsForRole, hashPassword, requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { digitsOnly, isValidIranMobile } from "@/lib/validators";

/** ویرایش کاربر توسط مدیر: مشخصات (نام کامل، نام کاربری، شماره تماس)، گذرواژه و وضعیت */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireOwner();
    const { id } = await params;
    const body = await req.json().catch(() => null);

    const user = await db.user.findUnique({ where: { id } });
    if (!user) return jsonError("کاربر یافت نشد", 404);

    // حفاظت: مدیر نمی‌تواند حساب خودش را غیرفعال کند
    if (user.id === owner.id && body?.isActive === false)
      return jsonError("نمی‌توانید حساب خودتان را غیرفعال کنید");

    // ----- مدیریت نقش (فقط مدیر ارشد/مالک — با محافظ‌ها) -----
    let roleChange: string | null = null;
    if (body?.role !== undefined && String(body.role) !== user.role) {
      const role = String(body.role);
      if (!["cashier", "owner", "gm", "admin"].includes(role))
        return jsonError("نقش نامعتبر است (صندوقدار / مدیر کل / مدیر فروشگاه / مدیر ارشد)");
      if (user.id === owner.id)
        return jsonError("نمی‌توانید نقش حساب خودتان را تغییر دهید");
      // حداقل یک مدیر ارشد/مالک فعال باید باقی بماند
      const privileged = await db.user.count({
        where: { role: { in: ["owner", "admin"] }, isActive: true, id: { not: user.id } },
      });
      if (privileged === 0)
        return jsonError(
          "حداقل یک حساب مدیر ارشد/مالک فعال باید همیشه موجود باشد — ابتدا مدیر دیگری بسازید"
        );
      roleChange = role;
    }

    // ----- مجوزهای عملیاتی (canActAsCashier / canApproveReturns / canRecordPayment) -----
    // با تغییر نقش، پیش‌فرض‌های نقش جدید اعمال می‌شود مگر اینکه مقدار صریح ارسال شده باشد
    const permData: {
      canActAsCashier?: boolean;
      canApproveReturns?: boolean;
      canRecordPayment?: boolean;
    } = {};
    const permLabels: Array<[keyof typeof permData, string]> = [
      ["canActAsCashier", "ثبت مرجوعی (صندوقداری)"],
      ["canApproveReturns", "تأیید مرجوعی"],
      ["canRecordPayment", "ثبت پرداخت و انتقال وجه"],
    ];
    const effectiveRole = (roleChange ?? user.role) as "cashier";
    const roleDefaults = defaultPermissionsForRole(effectiveRole);
    const permChanged: string[] = [];
    for (const [key, label] of permLabels) {
      const explicit = body?.[key];
      if (typeof explicit === "boolean") {
        // مقدار صریح مدیر همیشه مقدم است
        if (explicit !== user[key]) {
          permData[key] = explicit;
          permChanged.push(label);
        }
      } else if (roleChange) {
        // تغییر نقش بدون مقدار صریح → پیش‌فرض نقش جدید
        const def = roleDefaults[key];
        if (def !== user[key]) {
          permData[key] = def;
          permChanged.push(`${label} (پیش‌فرض نقش جدید)`);
        }
      }
    }

    // ----- اعتبارسنجی و جمع‌آوری فیلدهای مشخصات (پیش از هر تغییری) -----
    const profileData: { fullName?: string; username?: string; phone?: string | null } = {};
    const changedLabels: string[] = [];

    if (body?.fullName !== undefined) {
      const fullName = String(body.fullName ?? "").trim();
      if (fullName.length < 3 || fullName.length > 100)
        return jsonError("نام کامل باید ۳ تا ۱۰۰ نویسه باشد");
      if (fullName !== user.fullName) {
        profileData.fullName = fullName;
        changedLabels.push("نام کامل");
      }
    }

    if (body?.username !== undefined) {
      const username = String(body.username ?? "").trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,30}$/.test(username))
        return jsonError("نام کاربری باید ۳ تا ۳۰ نویسه لاتین/عدد باشد");
      if (username !== user.username) {
        const exists = await db.user.findFirst({
          where: { username, NOT: { id: user.id } },
        });
        if (exists) return jsonError("این نام کاربری قبلاً ثبت شده است");
        profileData.username = username;
        changedLabels.push("نام کاربری");
      }
    }

    if (body?.phone !== undefined) {
      const raw = body.phone === null ? "" : String(body.phone).trim();
      if (raw === "") {
        // رشته خالی = پاک‌کردن شماره تماس
        if (user.phone) {
          profileData.phone = null;
          changedLabels.push("شماره تماس");
        }
      } else {
        if (!isValidIranMobile(raw))
          return jsonError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود");
        const phone = digitsOnly(raw);
        if (phone !== user.phone) {
          profileData.phone = phone;
          changedLabels.push("شماره تماس");
        }
      }
    }

    // ----- گذرواژه (اختیاری — بازنشانی توسط مدیر) -----
    let resetPassword = false;
    if (typeof body?.password === "string" && body.password.length > 0) {
      if (body.password.length < 6)
        return jsonError("گذرواژه حداقل ۶ نویسه باشد");
      resetPassword = true;
    }

    // ----- وضعیت فعال/غیرفعال (رفتار قبلی حفظ شده) -----
    let statusChange: boolean | null = null;
    if (typeof body?.isActive === "boolean" && body.isActive !== user.isActive) {
      if (
        (user.role === "owner" || user.role === "admin") &&
        body.isActive === false
      ) {
        // آخرین مدیر ارشد/مالک نباید غیرفعال شود
        const privileged = await db.user.count({
          where: {
            role: { in: ["owner", "admin"] },
            isActive: true,
            id: { not: user.id },
          },
        });
        if (privileged === 0)
          return jsonError("آخرین حساب مدیریتی فعال را نمی‌توان غیرفعال کرد");
      }
      statusChange = body.isActive;
    }

    // ----- اعمال تغییرات -----
    if (roleChange) {
      const roleLabels: Record<string, string> = {
        cashier: "صندوقدار",
        gm: "مدیر کل",
        owner: "مدیر فروشگاه",
        admin: "مدیر ارشد سامانه",
      };
      await db.user.update({ where: { id }, data: { role: roleChange } });
      await db.activityLog.create({
        data: {
          userId: owner.id,
          action: "user_role_change",
          detail: `تغییر نقش «${user.fullName}» از ${roleLabels[user.role] ?? user.role} به ${roleLabels[roleChange]}`,
          entityId: user.id,
        },
      });
    }
    if (Object.keys(permData).length > 0) {
      await db.user.update({ where: { id }, data: permData });
      await db.activityLog.create({
        data: {
          userId: owner.id,
          action: "user_permissions_change",
          detail: `تغییر مجوزهای «${user.fullName}»: ${permChanged.join("، ")}`,
          entityId: user.id,
        },
      });
    }
    if (statusChange !== null) {
      await db.user.update({ where: { id }, data: { isActive: statusChange } });
      await db.activityLog.create({
        data: {
          userId: owner.id,
          action: statusChange ? "user_activate" : "user_deactivate",
          detail: `${statusChange ? "فعال‌سازی" : "غیرفعال‌سازی"} حساب «${user.fullName}»`,
          entityId: user.id,
        },
      });
    }

    if (resetPassword) {
      await db.user.update({
        where: { id },
        data: { passwordHash: hashPassword(body.password) },
      });
      await db.activityLog.create({
        data: {
          userId: owner.id,
          action: "user_reset_password",
          detail: `بازنشانی گذرواژه «${user.fullName}»`,
          entityId: user.id,
        },
      });
    }

    if (changedLabels.length > 0) {
      await db.user.update({ where: { id }, data: profileData });
      const newFullName = profileData.fullName ?? user.fullName;
      await db.activityLog.create({
        data: {
          userId: owner.id,
          action: "user_update",
          detail: `ویرایش کاربر «${newFullName}»: ${changedLabels.join("، ")}`,
          entityId: user.id,
        },
      });
    }

    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
