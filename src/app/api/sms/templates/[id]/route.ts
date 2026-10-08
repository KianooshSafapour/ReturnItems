import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/** ویرایش قالب پیامک — فقط مدیران */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await requireOwner();
    const { id } = await params;
    const body = await req.json().catch(() => null);

    const template = await db.smsTemplate.findUnique({ where: { id } });
    if (!template) return jsonError("قالب پیام یافت نشد", 404);

    const data: Record<string, string | boolean> = {};
    const changed: string[] = [];

    if (body?.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (title.length < 2 || title.length > 60)
        return jsonError("نام نوع پیام باید ۲ تا ۶۰ نویسه باشد");
      if (title !== template.title) {
        const dup = await db.smsTemplate.findFirst({
          where: { title, id: { not: id } },
        });
        if (dup) return jsonError(`نوع پیام «${title}» قبلاً تعریف شده است`);
        data.title = title;
        changed.push("نام");
      }
    }
    if (body?.body !== undefined) {
      const text = String(body.body ?? "").trim();
      if ([...text].length < 5)
        return jsonError("متن پیام حداقل ۵ نویسه باشد");
      if ([...text].length > 612)
        return jsonError("متن پیام بیش از حد طولانی است (حداکثر ~۶۱۲ نویسه)");
      if (text !== template.body) {
        data.body = text;
        changed.push("متن");
      }
    }
    if (body?.isActive !== undefined) {
      const isActive = body.isActive === true;
      if (isActive !== template.isActive) {
        data.isActive = isActive;
        changed.push(isActive ? "فعال‌سازی" : "غیرفعال‌سازی");
      }
    }

    if (changed.length === 0) return jsonOk({ ok: true, changed: [] });

    const updated = await db.smsTemplate.update({ where: { id }, data });
    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "sms_template_update",
        detail: `ویرایش قالب پیام «${updated.title}»: ${changed.join("، ")}`,
        entityId: id,
      },
    });
    return jsonOk({ ok: true, changed });
  } catch (e) {
    return handleApiError(e);
  }
}

/** حذف قالب پیامک — فقط مدیران */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await requireOwner();
    const { id } = await params;
    const template = await db.smsTemplate.findUnique({ where: { id } });
    if (!template) return jsonError("قالب پیام یافت نشد", 404);

    // گزارش‌های ارسال قبلی حفظ می‌شوند (templateId → null با SetNull)
    await db.smsTemplate.delete({ where: { id } });
    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "sms_template_delete",
        detail: `حذف قالب پیام «${template.title}»`,
      },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
