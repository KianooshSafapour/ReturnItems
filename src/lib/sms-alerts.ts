// پیامک‌های خودکار سامانه — fire-and-forget (هرگز مانع عملیات اصلی نمی‌شوند)
//  ۱) notifyCustomerOfSubmission: «مرجوعی ثبت شد» → مشتری (بلافاصله پس از ثبت)
//  ۲) notifyPaymentApproversOfApproval: «آماده پرداخت» → ثبت‌کنندگان پرداخت (آقای نوروزی) پس از تأیید مدیر کل
// لایه دوگانه خاموش‌کردن: کلید سراسری هر نوع پیام (Setting) + کلید هر مشتری (Customer.smsEnabled)
// درج اقلام مرجوعی: کلید سراسری «sms_include_items» + جای‌نگهدار {{اقلام}}
import { db } from "@/lib/db";
import {
  SMS_SETTING_KEYS,
  DEFAULT_CUSTOMER_SUBMIT_TEMPLATE,
  DEFAULT_OWNER_NOTIFY_TEMPLATE,
  autoSmsSettingsFromMap,
  formatItemsForSms,
  normalizeIranMobile,
  renderSmsTemplate,
  sendSms,
  smsConfigFromSettings,
  smsReady,
} from "@/lib/sms";

/** خواندن کل نقشه تنظیمات پیامک (اتصال + پیامک‌های خودکار) */
async function readSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({
    where: { key: { in: SMS_SETTING_KEYS as unknown as string[] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

interface ReturnSmsInput {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  /** مبلغ قابل انتقال به کارت مشتری */
  transferAmount: number;
  items: Array<{ name: string; quantity?: number }>;
  cashierName?: string;
}

/** ساخت متن نهایی قالب + فهرست اقلام (اگر فعال باشد) */
function renderWithItems(
  template: string,
  vars: Parameters<typeof renderSmsTemplate>[1],
  items: Array<{ name: string; quantity?: number }>,
  includeItems: boolean
): string {
  const itemsList = includeItems
    ? formatItemsForSms(items.map((i) => ({ name: i.name, quantity: i.quantity })))
    : undefined;
  let text = renderSmsTemplate(template, { ...vars, itemsList });
  if (includeItems && itemsList && !text.includes(itemsList)) {
    // اگر قالب جای‌نگهدار {{اقلام}} نداشت، فهرست را به انتهای پیام می‌چسبانیم
    text = `${text}\nاقلام: ${itemsList}`;
  }
  return text;
}

async function logSms(
  requestId: string,
  phone: string,
  message: string,
  result: Awaited<ReturnType<typeof sendSms>>
) {
  await db.smsLog.create({
    data: {
      requestId,
      phone,
      message,
      status: result.ok ? "sent" : "failed",
      provider: result.provider,
      messageId: result.messageId ?? null,
      response: result.ok
        ? result.responseSummary?.slice(0, 500) ?? null
        : result.error?.slice(0, 500) ?? null,
    },
  });
}

/**
 * ۱) پیامک «مرجوعی شما ثبت شد» به مشتری — بلافاصله پس از ثبت مرجوعی.
 * شرط ارسال: کلید سراسری روشن + پنل آماده + مشتری smsEnabled + شماره معتبر.
 */
export async function notifyCustomerOfSubmission(ret: ReturnSmsInput): Promise<void> {
  try {
    const map = await readSettingsMap();
    const auto = autoSmsSettingsFromMap(map);
    if (!auto.customerSubmitEnabled) {
      console.log(`[sms-submit] کلید سراسری پیامک ثبت مرجوعی خاموش است — ${ret.code}`);
      return;
    }
    const cfg = smsConfigFromSettings(map);
    if (!smsReady(cfg)) {
      console.warn("[sms-submit] پنل پیامک آماده نیست — پیامک ثبت به مشتری ارسال نشد");
      return;
    }

    // لایه دوم: تنظیم هر مشتری (پیش‌فرض روشن)
    const phone = normalizeIranMobile(ret.customerPhone);
    if (!phone) {
      console.warn(`[sms-submit] شماره مشتری ${ret.customerPhone} نامعتبر است — رد شد`);
      return;
    }
    const customer = await db.customer.findUnique({ where: { phone } });
    if (customer && !customer.smsEnabled) {
      console.log(`[sms-submit] پیامک مشتری ${phone} خاموش شده است — ${ret.code}`);
      return;
    }

    const storeName = map["storeName"] || "هایپر زیتون";
    const text = renderWithItems(
      auto.customerSubmitTemplate || DEFAULT_CUSTOMER_SUBMIT_TEMPLATE,
      {
        customerName: ret.customerName,
        amountRial: ret.transferAmount > 0 ? ret.transferAmount : ret.totalAmount,
        trackingCode: ret.code,
        storeName,
        cashierName: ret.cashierName,
        itemCount: ret.items.length,
      },
      ret.items,
      auto.includeItems
    );

    const result = await sendSms(cfg, phone, text);
    await logSms(ret.id, phone, text, result);
    if (!result.ok) {
      console.warn(`[sms-submit] ارسال به ${phone} ناموفق: ${result.error}`);
    } else {
      await db.activityLog.create({
        data: {
          action: "sms_sent",
          detail: `پیامک خودکار «ثبت مرجوعی ${ret.code}» به ${phone} ارسال شد`,
          entityId: ret.id,
        },
      });
    }
  } catch (e) {
    console.warn("[sms-submit] خطا (بی‌اثر بر ثبت مرجوعی):", e);
  }
}

/**
 * ۲) پیامک «آماده پرداخت» به ثبت‌کنندگان پرداخت (آقای نوروزی + منتخب‌های صریح)
 * پس از تأیید مرجوعی دارای انتقال وجه توسط مدیر کل.
 * تأییدکننده می‌تواند با چک‌باکس «بدون پیامک» ارسال را برای همان تأیید خاموش کند.
 */
export async function notifyPaymentApproversOfApproval(
  ret: ReturnSmsInput,
  approverName: string
): Promise<void> {
  try {
    const map = await readSettingsMap();
    const auto = autoSmsSettingsFromMap(map);
    if (!auto.ownerNotifyEnabled) {
      console.log(`[sms-owner] کلید سراسری پیامک آماده پرداخت خاموش است — ${ret.code}`);
      return;
    }
    const cfg = smsConfigFromSettings(map);
    if (!smsReady(cfg)) {
      console.warn("[sms-owner] پنل پیامک آماده نیست — پیامک آماده پرداخت ارسال نشد");
      return;
    }

    // گیرندگان: کاربران فعال با مجوز ثبت پرداخت
    const payers = await db.user.findMany({
      where: { isActive: true, canRecordPayment: true },
      select: { fullName: true, phone: true },
    });
    if (payers.length === 0) {
      console.warn("[sms-owner] هیچ کاربر فعالی با مجوز ثبت پرداخت یافت نشد");
      return;
    }

    const storeName = map["storeName"] || "هایپر زیتون";
    const text = renderWithItems(
      auto.ownerNotifyTemplate || DEFAULT_OWNER_NOTIFY_TEMPLATE,
      {
        customerName: ret.customerName,
        amountRial: ret.transferAmount,
        trackingCode: ret.code,
        storeName,
        approverName,
        itemCount: ret.items.length,
      },
      ret.items,
      auto.includeItems
    );

    for (const p of payers) {
      const phone = normalizeIranMobile(p.phone ?? "");
      if (!phone) {
        console.warn(`[sms-owner] شماره ${p.fullName} نامعتبر است — رد شد`);
        continue;
      }
      const result = await sendSms(cfg, phone, text);
      await logSms(ret.id, phone, text, result);
      if (!result.ok) {
        console.warn(`[sms-owner] ارسال به ${p.fullName} (${phone}) ناموفق: ${result.error}`);
      }
    }
  } catch (e) {
    console.warn("[sms-owner] خطا (بی‌اثر بر تأیید):", e);
  }
}
