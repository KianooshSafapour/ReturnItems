import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";

/** فهرست قالب‌های پیامک (انواع اطلاع‌رسانی) — فقط مدیران */
export async function GET() {
  try {
    await requireOwner();
    const templates = await db.smsTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk({
      templates: templates.map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        usageCount: 0, // در گزارش ارسال محاسبه می‌شود (بعداً)
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** افزودن نوع/قالب پیام جدید — مدیران می‌توانند نوع دلخواه تعریف کنند */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireOwner();
    const body = await req.json().catch(() => null);

    const title = String(body?.title ?? "").trim();
    const text = String(body?.body ?? "").trim();

    if (title.length < 2 || title.length > 60)
      return jsonError("نام نوع پیام باید ۲ تا ۶۰ نویسه باشد");
    if ([...text].length < 5)
      return jsonError("متن پیام حداقل ۵ نویسه باشد");
    if ([...text].length > 612)
      return jsonError("متن پیام بیش از حد طولانی است (حداکثر ~۶۱۲ نویسه)");

    // عنوان تکراری نباشد (در محدوده قالب‌های فعال)
    const dup = await db.smsTemplate.findFirst({ where: { title } });
    if (dup) return jsonError(`نوع پیام «${title}» قبلاً تعریف شده است`);

    const maxOrder = await db.smsTemplate.aggregate({ _max: { sortOrder: true } });
    const template = await db.smsTemplate.create({
      data: {
        title,
        body: text,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "sms_template_create",
        detail: `تعریف نوع پیام جدید «${title}»`,
        entityId: template.id,
      },
    });

    return jsonOk(
      {
        id: template.id,
        title: template.title,
        body: template.body,
        isActive: template.isActive,
        sortOrder: template.sortOrder,
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}
