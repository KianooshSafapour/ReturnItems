// ماژول پیامک — اتصال به پنل‌های پیامکی ایرانی و ارسال خودکار به مشتری
// خالص و بدون وابستگی به دیتابیس (قابل استفاده در سرور و کلاینت)
// مشتق‌شده از مستندات رسمی پنل‌ها (Task 2-a) — ۵ درایور یکپارچه:
//   1. ippanel (فراز اس‌ام‌اس)  2. payamakPanel (ملی پیامک / پیامیتو)
//   3. smsWebserviceV3 (پیام رسان / بهین پیامک)  4. smsir (اس‌ام‌اس آی‌آر)
//   5. webone (وب‌وان اس‌ام‌اس)  + درایور «سفارشی» برای هر پنل دیگری (HTTP/JSON)

export type SmsProviderId =
  | "faraz"
  | "melipayamak"
  | "payamito"
  | "payamresan"
  | "behinsms"
  | "smsir"
  | "webone"
  | "custom";

export interface SmsProviderMeta {
  id: SmsProviderId;
  label: string;
  /** نوع درایور پروتکلی */
  driver: "ippanel" | "payamakPanel" | "smsWebserviceV3" | "smsir" | "webone" | "custom";
  /** فیلدهای موردنیاز اتصال */
  needs: Array<"apiKey" | "username" | "password" | "sender">;
  hint: string;
  docs?: string;
}

export const SMS_PROVIDERS: SmsProviderMeta[] = [
  {
    id: "faraz",
    label: "فراز اس‌ام‌اس (IPPanel)",
    driver: "ippanel",
    needs: ["apiKey", "sender"],
    hint: "کلید API را از پنل فراز (بخش توسعه‌دهندگان ← کلیدهای دسترسی) بگیرید؛ شماره خط ارسال با +98 شروع می‌شود.",
    docs: "https://ippanel.com",
  },
  {
    id: "melipayamak",
    label: "ملی پیامک",
    driver: "payamakPanel",
    needs: ["username", "password", "sender"],
    hint: "نام کاربری و گذرواژه وب‌سرویس پنل ملی پیامک + شماره خط ارسال (مثل 5000...).",
    docs: "https://melipayamak.com",
  },
  {
    id: "payamito",
    label: "پیامیتو",
    driver: "payamakPanel",
    needs: ["username", "password", "sender"],
    hint: "پیامیتو از همان وب‌سرویس rest.payamak-panel.com استفاده می‌کند — مشخصات وب‌سرویس پنل خود را وارد کنید.",
    docs: "https://payamito.com",
  },
  {
    id: "payamresan",
    label: "پیام رسان",
    driver: "smsWebserviceV3",
    needs: ["apiKey", "sender"],
    hint: "کلید ApiKey (قالب ۱۲۳۴۵۶-XXXXXXXX) از پنل پیام رسان + شماره خط (مثل 30004040).",
    docs: "https://docs.payam-resan.com",
  },
  {
    id: "behinsms",
    label: "بهین پیامک",
    driver: "smsWebserviceV3",
    needs: ["apiKey", "sender"],
    hint: "بهین پیامک از وب‌سرویس V3 مشترک استفاده می‌کند — ApiKey و خط ارسال پنل خود را وارد کنید.",
    docs: "https://behinsms.com",
  },
  {
    id: "smsir",
    label: "اس‌ام‌اس آی‌آر (SMS.ir)",
    driver: "smsir",
    needs: ["apiKey", "sender"],
    hint: "کلید وب‌سرویس از پنل SMS.ir (بخش توسعه‌دهندگان) + شماره خط (مثل 30004505000017).",
    docs: "https://sms.ir/rest-api",
  },
  {
    id: "webone",
    label: "وب‌وان اس‌ام‌اس",
    driver: "webone",
    needs: ["username", "password", "sender"],
    hint: "نام کاربری و گذرواژه پنل وب‌وان + شماره خط ارسال.",
    docs: "https://webone-sms.com",
  },
  {
    id: "custom",
    label: "سفارشی (هر پنل دیگری — HTTP/JSON)",
    driver: "custom",
    needs: [],
    hint: "آدرس، هدرها و بدنه درخواست را خودتان تعریف کنید — با جای‌نگهدارهای {{phone}} و {{message}} و {{sender}}.",
  },
];

export function getSmsProvider(id: string): SmsProviderMeta | null {
  return SMS_PROVIDERS.find((p) => p.id === id) ?? null;
}

/* ==========================================================================
   تنظیمات اتصال (ذخیره در جدول Setting)
   ========================================================================== */

export const SMS_SETTING_KEYS = [
  "sms_enabled",
  "sms_provider",
  "sms_api_key",
  "sms_username",
  "sms_password",
  "sms_sender",
  "sms_custom_url",
  "sms_custom_method",
  "sms_custom_headers",
  "sms_custom_body",
  // اطلاع‌رسانی مرجوعی به مدیران (هشدار آقای نوروزی و مدیران انتخاب‌شده)
  "sms_alert_enabled",
  "sms_alert_user_ids",
  "sms_alert_template",
  // ---- پیامک‌های خودکار (لایه ۱: کلید سراسری هر نوع پیام) ----
  "sms_customer_submit_enabled", // پیامک «مرجوعی ثبت شد» به مشتری هنگام ثبت
  "sms_customer_submit_template",
  "sms_payment_enabled", // کلید اصلی پیامک تأیید پرداخت به مشتری
  "sms_owner_notify_enabled", // پیامک «آماده پرداخت» به ثبت‌کنندگان پرداخت پس از تأیید
  "sms_owner_notify_template",
  // درج فهرست اقلام مرجوعی در همه پیامک‌ها (انتخاب مدیر)
  "sms_include_items",
] as const;
export type SmsSettingKey = (typeof SMS_SETTING_KEYS)[number];

export interface SmsConfig {
  enabled: boolean;
  provider: SmsProviderId | "";
  apiKey?: string;
  username?: string;
  password?: string;
  sender?: string;
  customUrl?: string;
  customMethod?: string;
  customHeaders?: string;
  customBody?: string;
}

export function smsConfigFromSettings(map: Record<string, string>): SmsConfig {
  return {
    enabled: map["sms_enabled"] === "1",
    provider: (map["sms_provider"] ?? "") as SmsProviderId | "",
    apiKey: map["sms_api_key"] || undefined,
    username: map["sms_username"] || undefined,
    password: map["sms_password"] || undefined,
    sender: map["sms_sender"] || undefined,
    customUrl: map["sms_custom_url"] || undefined,
    customMethod: map["sms_custom_method"] || undefined,
    customHeaders: map["sms_custom_headers"] || undefined,
    customBody: map["sms_custom_body"] || undefined,
  };
}

/** فیلدهای جاافتاده اتصال برای پنل انتخاب‌شده (برای پیام خطای دقیق) */
export function smsMissingFields(cfg: SmsConfig): string[] {
  const missing: string[] = [];
  if (cfg.provider === "custom") {
    if (!cfg.customUrl) missing.push("آدرس درخواست سفارشی");
    return missing;
  }
  const meta = getSmsProvider(cfg.provider);
  if (!meta) {
    missing.push("پنل پیامک");
    return missing;
  }
  for (const need of meta.needs) {
    if (need === "apiKey" && !cfg.apiKey) missing.push("کلید API");
    if (need === "username" && !cfg.username) missing.push("نام کاربری پنل");
    if (need === "password" && !cfg.password) missing.push("گذرواژه پنل");
    if (need === "sender" && !cfg.sender) missing.push("شماره خط ارسال");
  }
  return missing;
}

/** آیا اتصال پنل کامل و آماده ارسال است؟ */
export function smsReady(cfg: SmsConfig): boolean {
  return (
    cfg.enabled && !!cfg.provider && smsMissingFields(cfg).length === 0
  );
}

/* ==========================================================================
   اطلاع‌رسانی مرجوعی به مدیران — هشدار پیامکی هنگام ثبت مرجوعی جدید
   ========================================================================== */

export interface SmsAlertConfig {
  /** فعال/غیرفعال بودن هشدار مرجوعی به مدیران */
  enabled: boolean;
  /** شناسه کاربران مدیریتی که پیامک هشدار دریافت می‌کنند */
  userIds: string[];
  /** متن پیام هشدار (با جای‌نگهدارها) */
  template: string;
}

export const DEFAULT_SMS_ALERT_TEMPLATE =
  "🔔 مرجوعی جدید در {{فروشگاه}}\n{{مشتری}} — {{مبلغ_تومان}} تومان\nسند {{شماره_پیگیری}} · ثبت توسط {{صندوقدار}}";

/** پیامک خودکار «مرجوعی ثبت شد» به مشتری — بلافاصله پس از ثبت مرجوعی توسط صندوقدار */
export const DEFAULT_CUSTOMER_SUBMIT_TEMPLATE =
  "سلام {{مشتری}} عزیز 🌿\nمرجوعی شما در {{فروشگاه}} ثبت شد.\nسند {{شماره_پیگیری}} — {{مبلغ_تومان}} تومان\nوجه تا اسرع وقت به کارت شما منتقل می‌شود.";

/** پیامک «آماده پرداخت» به ثبت‌کنندگان پرداخت (آقای نوروزی) — پس از تأیید مدیر کل */
export const DEFAULT_OWNER_NOTIFY_TEMPLATE =
  "🔔 {{فروشگاه}}: مرجوعی {{شماره_پیگیری}} تأیید شد\n{{مشتری}} — {{مبلغ_تومان}} تومان آماده انتقال به کارت مشتری\nتأییدکننده: {{تأییدکننده}}";

/** خواندن کلیدهای پیامک‌های خودکار از نقشه تنظیمات (با پیش‌فرض) */
export interface AutoSmsSettings {
  customerSubmitEnabled: boolean;
  customerSubmitTemplate: string;
  paymentEnabled: boolean;
  ownerNotifyEnabled: boolean;
  ownerNotifyTemplate: string;
  includeItems: boolean;
}

export function autoSmsSettingsFromMap(map: Record<string, string>): AutoSmsSettings {
  return {
    // پیش‌فرض روشن — فقط با «0» خاموش می‌شود
    customerSubmitEnabled: map["sms_customer_submit_enabled"] !== "0",
    customerSubmitTemplate:
      map["sms_customer_submit_template"] || DEFAULT_CUSTOMER_SUBMIT_TEMPLATE,
    paymentEnabled: map["sms_payment_enabled"] !== "0",
    ownerNotifyEnabled: map["sms_owner_notify_enabled"] !== "0",
    ownerNotifyTemplate: map["sms_owner_notify_template"] || DEFAULT_OWNER_NOTIFY_TEMPLATE,
    // پیش‌فرض خاموش — فقط با «1» روشن می‌شود
    includeItems: map["sms_include_items"] === "1",
  };
}

/** فهرست فشرده اقلام مرجوعی برای درج در پیامک — «کالا ×۲٫۵، کالای دوم ×۱» */
export function formatItemsForSms(
  items: Array<{ name: string; quantity?: number }>,
  maxLen = 120
): string {
  const parts = items.map((it) =>
    it.quantity != null && it.quantity !== 1
      ? `${it.name} ×${String(it.quantity).replace(".", "\u066B")}`
      : it.name
  );
  let text = parts.join("، ");
  if (text.length > maxLen) {
    // کوتاه‌سازی هوشمند — قطع روی مرز کالا و افزودن «و n قلم دیگر»
    let out = "";
    let count = 0;
    for (const p of parts) {
      if ((out + p).length > maxLen - 14) break;
      out += (count > 0 ? "، " : "") + p;
      count++;
    }
    const rest = parts.length - count;
    text = rest > 0 ? `${out} و ${rest} قلم دیگر` : out;
  }
  return text;
}

export function smsAlertConfigFromSettings(map: Record<string, string>): SmsAlertConfig {
  let userIds: string[] = [];
  try {
    const parsed = JSON.parse(map["sms_alert_user_ids"] ?? "[]");
    if (Array.isArray(parsed))
      userIds = parsed.filter((x) => typeof x === "string" && x.length > 0);
  } catch {
    userIds = [];
  }
  return {
    enabled: map["sms_alert_enabled"] === "1",
    userIds,
    template: map["sms_alert_template"] || DEFAULT_SMS_ALERT_TEMPLATE,
  };
}

/* ==========================================================================
   نرمال‌سازی شماره موبایل ایران
   ========================================================================== */

/** تبدیل ارقام فارسی/عربی به لاتین */
export function toEnDigitsSms(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** نرمال‌سازی به شکل استاندارد داخلی 09xxxxxxxxx — یا null اگر نامعتبر */
export function normalizeIranMobile(raw: string): string | null {
  let d = toEnDigitsSms(String(raw ?? "")).replace(/[\s\-()]/g, "");
  if (!d) return null;
  d = d.replace(/^\+98/, "0").replace(/^0098/, "0").replace(/^98(?=9\d{9}$)/, "0");
  if (/^9\d{9}$/.test(d)) d = "0" + d;
  if (!/^09\d{9}$/.test(d)) return null;
  return d;
}

/* ==========================================================================
   قالب پیام — جای‌نگهدارها
   ========================================================================== */

export const SMS_PLACEHOLDERS: Array<{ token: string; label: string }> = [
  { token: "{{مشتری}}", label: "نام مشتری" },
  { token: "{{مبلغ}}", label: "مبلغ پرداخت (ریال، با جداکننده)" },
  { token: "{{مبلغ_تومان}}", label: "مبلغ پرداخت (تومان، با جداکننده)" },
  { token: "{{شماره_پیگیری}}", label: "کد رهگیری بانکی از فرم پرداخت (یا شماره سند مرجوعی)" },
  { token: "{{بانک}}", label: "بانک مبدأ انتقال" },
  { token: "{{فروشگاه}}", label: "نام فروشگاه (تنظیمات)" },
  { token: "{{تاریخ}}", label: "تاریخ امروز (شمسی)" },
  { token: "{{ساعت}}", label: "ساعت فعلی" },
  // مخصوص قالب هشدار مدیران (هنگام ثبت مرجوعی):
  { token: "{{صندوقدار}}", label: "نام صندوقداری که مرجوعی را ثبت کرده (هشدار مدیران)" },
  { token: "{{تعداد}}", label: "تعداد اقلام مرجوعی (هشدار مدیران)" },
  { token: "{{کالا}}", label: "نام اولین کالای مرجوعی (هشدار مدیران)" },
  // اقلام مرجوعی — فقط وقتی «درج اقلام در پیامک» فعال باشد پر می‌شود
  { token: "{{اقلام}}", label: "فهرست اقلام مرجوعی (فقط با تنظیم «درج اقلام در پیامک»)" },
  // تأییدکننده مرجوعی (پیامک آماده پرداخت به آقای نوروزی)
  { token: "{{تأییدکننده}}", label: "نام تأییدکننده مرجوعی (پیامک آماده پرداخت)" },
];

export interface SmsTemplateVars {
  customerName: string;
  amountRial: number;
  amountToman?: number;
  trackingCode: string;
  bankName?: string;
  storeName?: string;
  /** هشدار مدیران: نام صندوقدار ثبت‌کننده مرجوعی */
  cashierName?: string;
  /** هشدار مدیران: تعداد اقلام مرجوعی */
  itemCount?: number;
  /** هشدار مدیران: نام اولین کالا */
  productName?: string;
  /** فهرست فشرده اقلام — فقط وقتی «درج اقلام» فعال باشد مقدار دارد */
  itemsList?: string;
  /** نام تأییدکننده مرجوعی (پیامک آماده پرداخت) */
  approverName?: string;
}

/** جای‌گذاری مقادیر در متن قالب */
export function renderSmsTemplate(body: string, vars: SmsTemplateVars): string {
  const now = new Date();
  const faDate = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const faTime = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const toman = vars.amountToman ?? Math.floor(vars.amountRial / 10);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return String(body ?? "")
    .replaceAll("{{مشتری}}", vars.customerName || "مشتری")
    .replaceAll("{{مبلغ}}", fmt(vars.amountRial))
    .replaceAll("{{مبلغ_تومان}}", fmt(toman))
    .replaceAll("{{شماره_پیگیری}}", vars.trackingCode || "—")
    .replaceAll("{{بانک}}", vars.bankName || "بانک")
    .replaceAll("{{فروشگاه}}", vars.storeName || "فروشگاه")
    .replaceAll("{{صندوقدار}}", vars.cashierName || "صندوقدار")
    .replaceAll("{{تعداد}}", vars.itemCount != null ? String(vars.itemCount) : "—")
    .replaceAll("{{کالا}}", vars.productName || "—")
    .replaceAll("{{اقلام}}", vars.itemsList ?? "")
    .replaceAll("{{تأییدکننده}}", vars.approverName || "مدیر")
    .replaceAll("{{تاریخ}}", faDate)
    .replaceAll("{{ساعت}}", faTime)
    .trim();
}

/** طول پیام به نویسه + تعداد پارت‌های SMS (فارسی = UCS-2: ۷۰ نویسه در پارت اول، ۶۷ در ادامه) */
export function smsSegments(text: string): { chars: number; parts: number } {
  const len = [...text].length;
  if (len === 0) return { chars: 0, parts: 0 };
  if (len <= 70) return { chars: len, parts: 1 };
  return { chars: len, parts: Math.ceil(len / 67) };
}

/* ==========================================================================
   ارسال — ۵ درایور + سفارشی
   ========================================================================== */

export interface SmsSendResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  responseSummary?: string;
}

const TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

function summarize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** ارسال یک پیامک به یک شماره — بر اساس تنظیمات پنل */
export async function sendSms(
  cfg: SmsConfig,
  to: string,
  message: string
): Promise<SmsSendResult> {
  const provider = cfg.provider;
  if (!provider) return { ok: false, provider: "", error: "پنل پیامک تنظیم نشده است" };
  const missing = smsMissingFields(cfg);
  if (missing.length > 0)
    return { ok: false, provider, error: `تنظیم ناقص پنل: ${missing.join("، ")}` };

  const phone = normalizeIranMobile(to);
  if (!phone)
    return { ok: false, provider, error: `شماره موبایل مقصد نامعتبر است (${to})` };

  const text = String(message ?? "").trim();
  if (!text) return { ok: false, provider, error: "متن پیام خالی است" };
  if ([...text].length > 612)
    return { ok: false, provider, error: "متن پیام بیش از حد طولانی است (حداکثر ~۶۱۲ نویسه)" };

  const meta = getSmsProvider(provider);
  try {
    switch (meta?.driver) {
      case "ippanel":
        return await sendViaIppanel(cfg, phone, text);
      case "payamakPanel":
        return await sendViaPayamakPanel(cfg, phone, text);
      case "smsWebserviceV3":
        return await sendViaSmsWebserviceV3(cfg, phone, text);
      case "smsir":
        return await sendViaSmsIr(cfg, phone, text);
      case "webone":
        return await sendViaWebone(cfg, phone, text);
      case "custom":
        return await sendViaCustom(cfg, phone, text);
      default:
        return { ok: false, provider, error: "درایور پنل شناخته نشد" };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      provider,
      error: aborted ? "پاسخ پنل پیامک بیش از ۳۰ ثانیه طول کشید" : `خطای ارتباط با پنل پیامک: ${msg}`,
    };
  }
}

/** ۱) فراز اس‌ام‌اس / IPPanel — POST edge.ippanel.com/v1/api/send */
async function sendViaIppanel(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const e164 = "+98" + phone.slice(1);
  const res = await fetchWithTimeout("https://edge.ippanel.com/v1/api/send", {
    method: "POST",
    headers: {
      Authorization: String(cfg.apiKey ?? ""),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: String(cfg.sender ?? ""),
      message: text,
      sending_type: "webservice",
      params: { recipients: [e164] },
    }),
  });
  const data = await safeJson(res);
  const ok = res.ok && data?.meta?.status === true;
  const ids = data?.data?.message_outbox_ids;
  return {
    ok,
    provider: "faraz",
    messageId: Array.isArray(ids) ? String(ids[0] ?? "") : undefined,
    error: ok ? undefined : data?.meta?.message || `پاسخ پنل: HTTP ${res.status}`,
    responseSummary: summarize(JSON.stringify(data ?? "")),
  };
}

/** ۲) ملی پیامک / پیامیتو — POST rest.payamak-panel.com (RetStatus===1) */
async function sendViaPayamakPanel(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const res = await fetchWithTimeout(
    "https://rest.payamak-panel.com/api/SendSMS/SendSMS",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(cfg.username ?? ""),
        password: String(cfg.password ?? ""),
        to: phone,
        from: String(cfg.sender ?? ""),
        text,
      }),
    }
  );
  const data = await safeJson(res);
  const ok = data?.RetStatus === 1;
  const value = String(data?.Value ?? "");
  return {
    ok,
    provider: cfg.provider,
    messageId: ok && /^\d+$/.test(value) ? value : undefined,
    error: ok
      ? undefined
      : data?.StrRetStatus
        ? `پنل گزارش داد: ${data.StrRetStatus}${value ? ` (کد ${value})` : ""}`
        : `پاسخ پنل: HTTP ${res.status}`,
    responseSummary: summarize(JSON.stringify(data ?? "")),
  };
}

/** ۳) پیام رسان / بهین پیامک — POST api.sms-webservice.com/api/V3/SendBulk (Success===true) */
async function sendViaSmsWebserviceV3(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const destination = Number("98" + phone.slice(1)); // بدون صفر ابتدایی
  const res = await fetchWithTimeout(
    "https://api.sms-webservice.com/api/V3/SendBulk",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiKey: String(cfg.apiKey ?? ""),
        Text: text,
        Sender: Number(String(cfg.sender ?? "").replace(/\D/g, "")) || undefined,
        Recipients: [
          { Destination: destination, UserTraceId: Date.now() % 2147483647 },
        ],
      }),
    }
  );
  const data = await safeJson(res);
  const ok = data?.Success === true;
  const first = Array.isArray(data?.Result) ? data.Result[0] : null;
  return {
    ok,
    provider: cfg.provider,
    messageId: first?.Id != null ? String(first.Id) : undefined,
    error: ok
      ? undefined
      : data?.Error
        ? `پنل گزارش داد: ${data.Error}${data.ErrorCode != null ? ` (کد ${data.ErrorCode})` : ""}`
        : `پاسخ پنل: HTTP ${res.status}`,
    responseSummary: summarize(JSON.stringify(data ?? "")),
  };
}

/** ۴) اس‌ام‌اس آی‌آر — POST api.sms.ir/v1/send/bulk (status===1) */
async function sendViaSmsIr(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const lineNumber = String(cfg.sender ?? "");
  const res = await fetchWithTimeout("https://api.sms.ir/v1/send/bulk", {
    method: "POST",
    headers: {
      "X-API-KEY": String(cfg.apiKey ?? ""),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      lineNumber: /^\d+$/.test(lineNumber) ? Number(lineNumber) : lineNumber,
      messageText: text,
      mobiles: [phone],
      sendDateTime: null,
    }),
  });
  const data = await safeJson(res);
  const ok = res.ok && data?.status === 1;
  const ids = data?.data?.messageIds;
  return {
    ok,
    provider: "smsir",
    messageId: Array.isArray(ids) ? String(ids[0] ?? "") : undefined,
    error: ok
      ? undefined
      : data?.message
        ? `پنل گزارش داد: ${data.message}${data.status != null ? ` (کد ${data.status})` : ""}`
        : `پاسخ پنل: HTTP ${res.status}`,
    responseSummary: summarize(JSON.stringify(data ?? "")),
  };
}

/** ۵) وب‌وان اس‌ام‌اس — POST rest.payamakapi.ir/api/v1/SMS/Send (Status===true) */
async function sendViaWebone(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const res = await fetchWithTimeout(
    "https://rest.payamakapi.ir/api/v1/SMS/Send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        UserName: String(cfg.username ?? ""),
        Password: String(cfg.password ?? ""),
        From: String(cfg.sender ?? ""),
        To: phone,
        Message: text,
      }),
    }
  );
  const data = await safeJson(res);
  const ok = data?.Status === true;
  return {
    ok,
    provider: "webone",
    messageId: data?.Id != null ? String(data.Id) : undefined,
    error: ok
      ? undefined
      : data?.Message
        ? `پنل گزارش داد: ${data.Message}`
        : `پاسخ پنل: HTTP ${res.status}`,
    responseSummary: summarize(JSON.stringify(data ?? "")),
  };
}

/** ۶) سفارشی — درخواست HTTP دلخواه با جای‌نگهدارها */
async function sendViaCustom(cfg: SmsConfig, phone: string, text: string): Promise<SmsSendResult> {
  const url0 = String(cfg.customUrl ?? "");
  if (!url0) return { ok: false, provider: "custom", error: "آدرس درخواست سفارشی خالی است" };

  const e164 = "+98" + phone.slice(1);
  const bare98 = phone.slice(1);
  const fill = (s: string) =>
    s
      .replaceAll("{{phone}}", phone)
      .replaceAll("{{phone_e164}}", e164)
      .replaceAll("{{phone_98}}", bare98)
      .replaceAll("{{message}}", encodeURIComponent(text))
      .replaceAll("{{message_raw}}", text)
      .replaceAll("{{sender}}", String(cfg.sender ?? ""));

  const method = (cfg.customMethod ?? "POST").toUpperCase() === "GET" ? "GET" : "POST";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.customHeaders) {
    try {
      const parsed = JSON.parse(cfg.customHeaders);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        headers = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [String(k), fill(String(v ?? ""))])
        );
    } catch {
      return { ok: false, provider: "custom", error: "هدرهای سفارشی JSON معتبر نیستند" };
    }
  }

  const url = fill(url0);
  const init: RequestInit = { method, headers };
  if (method === "POST" && cfg.customBody) {
    // بدنه JSON با جای‌نگهدارها — متن پیام به‌صورت خام در JSON جای‌گذاری امن می‌شود
    let bodyStr = String(cfg.customBody);
    bodyStr = bodyStr
      .replaceAll("{{phone_e164}}", e164)
      .replaceAll("{{phone_98}}", bare98)
      .replaceAll("{{phone}}", phone)
      .replaceAll("{{sender}}", String(cfg.sender ?? ""));
    if (bodyStr.includes("{{message_raw}}")) {
      bodyStr = bodyStr.replaceAll("{{message_raw}}", JSON.stringify(text).slice(1, -1));
    } else if (bodyStr.includes("{{message}}")) {
      bodyStr = bodyStr.replaceAll("{{message}}", JSON.stringify(text).slice(1, -1));
    }
    init.body = bodyStr;
  }

  const res = await fetchWithTimeout(url, init);
  const raw = await res.text().catch(() => "");
  let ok = res.ok;
  let messageId: string | undefined;
  let error: string | undefined;
  try {
    const j = JSON.parse(raw);
    // استخراج شناسه پیام از ساختارهای رایج پنل‌ها
    messageId =
      j?.data?.message_outbox_ids?.[0] != null
        ? String(j.data.message_outbox_ids[0])
        : j?.data?.messageIds?.[0] != null
          ? String(j.data.messageIds[0])
          : j?.Id != null ? String(j.Id)
          : j?.Value != null && /^\d+$/.test(String(j.Value)) && String(j.Value).length > 6
            ? String(j.Value)
            : j?.Result?.[0]?.Id != null ? String(j.Result[0].Id)
            : undefined;

    // تشخیص موفقیت/خطا از ساختارهای رایج — تنها با سیگنال قطعی، وگرنه HTTP ملاک است
    const metaStatus = j?.meta?.status;
    const positive =
      j?.status === true || j?.Status === true || j?.Success === true ||
      j?.status === 1 || j?.RetStatus === 1 || metaStatus === true ||
      (typeof j?.status === "string" &&
        ["ok", "success", "sent", "done", "انجام شد", "موفق"].includes(j.status.toLowerCase().trim()));
    const negative =
      j?.status === false || j?.Status === false || j?.Success === false || metaStatus === false ||
      (typeof j?.status === "number" && j.status !== 1) ||
      (j?.RetStatus !== undefined && j?.RetStatus !== null && j.RetStatus !== 1) ||
      (typeof j?.status === "string" && !(positive === true));

    if (positive === true) ok = true;
    else if (negative === true) ok = false;

    const errMsg =
      j?.message || j?.Message || j?.meta?.message || j?.Error || j?.StrRetStatus ||
      (typeof j?.status === "string" && negative === true ? j.status : undefined);
    if (!ok && errMsg) error = `پنل گزارش داد: ${errMsg}`;
  } catch {
    // پاسخ غیر JSON — فقط کد وضعیت HTTP ملاک است
  }
  return {
    ok,
    provider: "custom",
    messageId,
    error: error ?? (ok ? undefined : `پاسخ پنل: HTTP ${res.status}`),
    responseSummary: summarize(raw),
  };
}

/* ==========================================================================
   قالب‌های پیش‌فرض پیام (۴ نوع اصلی — قابل ویرایش/افزودن توسط مدیران)
   ========================================================================== */

export const DEFAULT_SMS_TEMPLATES: Array<{ title: string; body: string; sortOrder: number }> = [
  {
    title: "مرجوعی کالا",
    body:
      "{{مشتری}} عزیز، وجه مرجوعی کالای شما به مبلغ {{مبلغ_تومان}} تومان با شماره پیگیری {{شماره_پیگیری}} پرداخت شد.\nاز اعتماد شما سپاسگزاریم — {{فروشگاه}}",
    sortOrder: 1,
  },
  {
    title: "اختلاف قیمت",
    body:
      "{{مشتری}} عزیز، اختلاف قیمت فاکتور خرید شما نسبت به قیمت درج‌شده روی کالا، مبلغ {{مبلغ_تومان}} تومان با پیگیری {{شماره_پیگیری}} به حساب شما بازگردانده شد.\n{{فروشگاه}}",
    sortOrder: 2,
  },
  {
    title: "خطای کارت‌خوان صندوقدار",
    body:
      "{{مشتری}} عزیز، مبلغ {{مبلغ_تومان}} تومان بابت خطای رخ‌داده هنگام کارت‌خوان، با شماره پیگیری {{شماره_پیگیری}} به حساب شما برگشت داده شد.\n{{فروشگاه}}",
    sortOrder: 3,
  },
  {
    title: "سایر موارد",
    body:
      "{{مشتری}} عزیز، مبلغ {{مبلغ_تومان}} تومان با شماره پیگیری {{شماره_پیگیری}} به حساب شما واریز شد.\n{{فروشگاه}}",
    sortOrder: 4,
  },
];
