import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { digitsOnly } from "@/lib/validators";
import {
  SMS_SETTING_KEYS,
  autoSmsSettingsFromMap,
  formatItemsForSms,
  normalizeIranMobile,
  renderSmsTemplate,
  sendSms,
  smsConfigFromSettings,
  smsReady,
} from "@/lib/sms";

/** ثبت اطلاعات پرداخت/انتقال وجه — تنها کاربران دارای مجوز «ثبت پرداخت»
 *  (پیش‌فرض: آقای نوروزی + منتخب‌های صریح — مدیر کل خانم لطفی پیش‌فرض ندارد).
 *  مرجوعی باید ابتدا توسط مدیر کل تأیید شده باشد (وضعیت «تأیید شد»).
 *  پیامک تأیید پرداخت به مشتری: کلید اصلی + تنظیم هر مشتری + درج اقلام (اختیاری) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payer = await requireUser();
    if (!payer.canRecordPayment)
      return jsonError(
        "ثبت پرداخت و انتقال وجه تنها برای کاربران دارای مجوز «ثبت پرداخت» (آقای نوروزی و منتخبان) مجاز است",
        403
      );
    const { id } = await params;
    const body = await req.json().catch(() => null);

    const r = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) return jsonError("مرجوعی یافت نشد", 404);

    // مبلغ قابل انتقال — تسویه ثبت‌شده صندوقدار (سازگار با داده‌های قدیمی)
    const transferAmount = r.transferAmount ?? r.totalAmount;

    if (transferAmount === 0)
      return jsonError(
        "این مرجوعی نیاز به انتقال وجه ندارد — از دکمه «تأیید و بایگانی» (ویژه مدیر کل) استفاده کنید",
        409
      );

    if (r.status === "paid")
      return jsonError("این مرجوعی قبلاً پرداخت و بایگانی شده است", 409);

    if (r.status !== "approved")
      return jsonError(
        "این مرجوعی هنوز توسط مدیر کل تأیید نشده است — ابتدا از زبانه «در انتظار پرداخت» آن را تأیید کنید",
        409
      );

    const bankName = String(body?.bankName ?? "").trim();
    const accountNumber = String(body?.accountNumber ?? "").trim() || null;
    const cardNumber = body?.cardNumber ? digitsOnly(String(body.cardNumber)) : "";
    const referenceNumber = String(body?.referenceNumber ?? "").trim() || null;
    const transferredAt = new Date(body?.transferredAt ?? "");

    if (bankName.length < 3) return jsonError("نام بانک مبدأ را انتخاب کنید");
    if (cardNumber && !/^\d{16}$/.test(cardNumber))
      return jsonError("شماره کارت مبدأ باید ۱۶ رقم باشد");
    if (!accountNumber && !cardNumber && !referenceNumber)
      return jsonError("حداقل یکی از شماره حساب، شماره کارت یا شماره پیگیری را وارد کنید");
    if (isNaN(transferredAt.getTime())) return jsonError("زمان انتقال وجه را انتخاب کنید");
    if (transferredAt.getTime() > Date.now() + 60_000)
      return jsonError("زمان انتقال نمی‌تواند در آینده باشد");

    // ---------- پیامک اطلاع‌رسانی به مشتری ----------
    const smsEnabledByManager = body?.sms?.enabled === true;
    const smsText = String(body?.sms?.text ?? "").trim();
    const smsTemplateId = body?.sms?.templateId ? String(body.sms.templateId) : null;

    // کلیدهای لایه دوگانه + درج اقلام
    const rows = await db.setting.findMany({
      where: { key: { in: SMS_SETTING_KEYS as unknown as string[] } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    const auto = autoSmsSettingsFromMap(map);
    const smsConfig = smsConfigFromSettings(map);

    // لایه دوم: تنظیم پیامک این مشتری
    const customerPhone = normalizeIranMobile(r.customerPhone);
    const customerPref = customerPhone
      ? await db.customer.findUnique({ where: { phone: customerPhone } })
      : null;
    const customerSmsOn = customerPref?.smsEnabled ?? true;

    const payment = await db.payment.create({
      data: {
        requestId: r.id,
        amount: transferAmount,
        bankName: bankName.slice(0, 80),
        accountNumber,
        cardNumber: cardNumber || null,
        referenceNumber,
        transferredAt,
        recordedById: payer.id,
      },
    });

    await db.returnRequest.update({
      where: { id: r.id },
      data: { status: "paid" },
    });

    await db.activityLog.create({
      data: {
        userId: payer.id,
        action: "payment_record",
        detail: `ثبت پرداخت مرجوعی ${r.code} از ${bankName} — ${transferAmount} ریال`,
        entityId: r.id,
      },
    });

    // ---------- ارسال پیامک پس از ثبت موفق پرداخت ----------
    let smsResult: {
      status: "sent" | "failed" | "skipped";
      error?: string;
      phone?: string;
    } = { status: "skipped" };

    if (smsEnabledByManager && smsText) {
      if (!auto.paymentEnabled) {
        smsResult = {
          status: "skipped",
          error: "کلید اصلی «پیامک تأیید پرداخت» در مرکز پیامک خاموش است",
        };
      } else if (!customerSmsOn) {
        smsResult = {
          status: "skipped",
          error: "پیامک این مشتری در دفترچه مشتریان خاموش شده است",
        };
      } else if (!smsReady(smsConfig)) {
        smsResult = {
          status: "failed",
          error: "پیکربندی پنل پیامک کامل نیست — پیامک ارسال نشد",
        };
      } else if (!customerPhone) {
        smsResult = {
          status: "failed",
          error: "شماره موبایل مشتری نامعتبر است — پیامک ارسال نشد",
        };
      } else {
        // اگر متن هنوز جای‌نگهدار دارد (مدیر تغییرش نداد)، با داده واقعی جای‌گذاری می‌شود
        const storeNameRow = await db.setting.findUnique({ where: { key: "storeName" } });
        const itemsList = auto.includeItems
          ? formatItemsForSms(r.items.map((it) => ({ name: it.name, quantity: it.quantity })))
          : undefined;
        let finalText = /\{\{.+\}\}/.test(smsText)
          ? renderSmsTemplate(smsText, {
              customerName: r.customerName,
              amountRial: transferAmount,
              trackingCode: referenceNumber || r.code,
              bankName,
              storeName: storeNameRow?.value ?? "هایپر زیتون",
              itemsList,
            })
          : smsText;
        if (auto.includeItems && itemsList && !finalText.includes(itemsList)) {
          finalText = `${finalText}\nاقلام: ${itemsList}`;
        }

        const send = await sendSms(smsConfig, customerPhone, finalText);
        smsResult = {
          status: send.ok ? "sent" : "failed",
          error: send.ok ? undefined : send.error,
          phone: customerPhone,
        };
        // ثبت در تاریخچه ارسال — حتی خطاها (برای پیگیری)
        await db.smsLog.create({
          data: {
            requestId: r.id,
            templateId:
              smsTemplateId && (await db.smsTemplate.findUnique({ where: { id: smsTemplateId } }))
                ? smsTemplateId
                : null,
            phone: customerPhone,
            message: finalText,
            amount: transferAmount,
            status: send.ok ? "sent" : "failed",
            provider: send.provider,
            messageId: send.messageId ?? null,
            response: send.ok
              ? (send.responseSummary ?? "").slice(0, 300) || null
              : (send.error ?? "").slice(0, 300),
          },
        });
        await db.activityLog.create({
          data: {
            userId: payer.id,
            action: send.ok ? "sms_sent" : "sms_failed",
            detail: send.ok
              ? `ارسال پیامک تأیید پرداخت مرجوعی ${r.code} به ${customerPhone}`
              : `خطا در ارسال پیامک مرجوعی ${r.code} به ${customerPhone}: ${send.error ?? ""}`,
            entityId: r.id,
          },
        });
      }
    }

    return jsonOk({
      paymentId: payment.id,
      status: "paid",
      code: r.code,
      sms: smsResult,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
