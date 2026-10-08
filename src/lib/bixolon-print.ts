// چاپ مستقیم روی چاپگر حرارتی Bixolon SRP-330II (۸۰ میلی‌متری) از طریق «Web Print SDK»
// سرویس محلی Bixolon روی همین رایانهٔ صندوق اجرا می‌شود و کارهای چاپ JSON را روی HTTP
// می‌پذیرد — چاپ بدون باز شدن پنجرهٔ چاپ مرورگر (درخواست صریح مدیریت فروشگاه).
//
// پروتکل (بر اساس مستندات رسمی Bixolon):
//  - آدرس پایه: http://127.0.0.1:{port}/WebPrintSDK/  (پورت قابل تنظیم، پیش‌فرض 18080)
//  - ارسال کار: POST /WebPrintSDK/{LogicalName} با بدنهٔ {"id":N,"functions":{"func0":{...},...}}
//    هر تابع: {"printText" | "cutPaper" | "setCharacterset" | "printBitmap": [آرگومان‌ها]}
//  - پاسخ: {"RequestID":N,"ResponseID":N,"Result":"ready" | "progress" | <نتیجهٔ نهایی>}
//    پرس‌وجو: POST /WebPrintSDK/{LogicalName}/checkStatus با {"RequestID":N}
//    هر ~۵۰۰ میلی‌ثانیه تا حداکثر ۱۲ بار — تا وقتی Result نه "ready" باشد و نه "progress"
//  - کد HTTP 404 = سرویس اجراست اما چاپگری با این نام منطقی ثبت نشده
//  - خطای fetch/شبکه = سرویس روی این رایانه اجرا نمی‌شود (یا مرورگر دسترسی به شبکهٔ محلی را بسته)
//
// توجه: این ماژول فقط در مرورگر معنا دارد (سرویس روی رایانهٔ مشتری اجراست).
// هیچ‌گاه استثنا بیرون نمی‌رود — همهٔ توابع {ok, error?} برمی‌گردانند.

/** صفحهٔ دانلود رسمی درایور/SDK چاپگر Bixolon (برای راهنمای نصب) */
export const BIXOLON_SDK_DOWNLOAD_URL = "https://www.bixolon.com/download_view.php?idx=25";

/** تنظیمات اتصال به سرویس Web Print SDK روی رایانهٔ فروشگاه */
export interface BixolonSettings {
  /** نام منطقی چاپگر ثبت‌شده در برنامهٔ Bixolon (پیش‌فرض SDK: Printer1) */
  logicalName: string;
  /** پورت سرویس محلی (پیش‌فرض: 18080) */
  port: number;
}

/** نتیجهٔ هر عملیات چاپ — بدون پرتاب استثنا */
export interface BixolonResult {
  ok: boolean;
  error?: string;
}

/** یک سطر متن برای حالت چاپ متنی (ثانویه — کیفیت پایین‌تر از حالت تصویری) */
export interface BixolonTextLine {
  text: string;
  /** تراز افقی: ۰=چپ، ۱=وسط، ۲=راست — پیش‌فرض: راست (مناسب متن فارسی) */
  align?: 0 | 1 | 2;
  bold?: boolean;
  /** بزرگ‌نمایی افقی ۰..۷ */
  hMag?: number;
  /** بزرگ‌نمایی عمودی ۰..۷ */
  vMag?: number;
}

/* ---------- پیام‌های خطای فارسی ---------- */
const ERR_SERVICE_DOWN = "سرویس Bixolon روی این رایانه در حال اجرا نیست";
const ERR_PRINTER_NOT_FOUND = "سرویس فعال است اما چاپگری با این نام ثبت نشده";

/** پاسخ خام سرویس Bixolon */
interface BixolonHttpResult {
  ok: boolean;
  /** کد وضعیت HTTP (در خطای شبکه موجود نیست) */
  status?: number;
  data?: { RequestID?: number; ResponseID?: number; Result?: string };
  /** true یعنی fetch اصلاً به مقصد نرسید (سرویس خاموش / مسدودیت مرورگر) */
  networkError?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** شمارهٔ ترتیبی کارهای چاپ — یکتا در طول عمر صفحه */
let jobSeq = 0;

/** درخواست HTTP به سرویس محلی Bixolon با محدودیت زمانی — هرگز استثنا پرتاب نمی‌کند */
async function request(
  settings: BixolonSettings,
  endpointSuffix: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<BixolonHttpResult> {
  if (typeof fetch === "undefined" || typeof AbortController === "undefined") {
    // محیط بدون مرورگر (مثل رندر سرور) — سرویس فقط روی رایانهٔ مشتری قابل دسترسی است
    return { ok: false, networkError: true };
  }
  const name = encodeURIComponent(settings.logicalName.trim());
  const url = `http://127.0.0.1:${settings.port}/WebPrintSDK/${name}${endpointSuffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      // بدون keepalive/cache — درخواست یک‌بارهٔ محلی است
    });
    let data: BixolonHttpResult["data"];
    try {
      data = (await res.json()) as BixolonHttpResult["data"];
    } catch {
      data = undefined; // بدنهٔ بدون JSON — در پرس‌وجوی وضعیت دوباره تلاش می‌شود
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    // تایم‌اوت یا خطای شبکه — سرویس خاموش است یا مرورگر (PNA/محتوای ترکیبی) اجازه نداده
    return { ok: false, networkError: true };
  } finally {
    clearTimeout(timer);
  }
}

/** تبدیل پاسخ ناموفق HTTP به پیام فارسی سرراست */
function httpError(r: BixolonHttpResult): string {
  if (r.status === 404) return ERR_PRINTER_NOT_FOUND;
  if (r.networkError) return ERR_SERVICE_DOWN;
  return `پاسخ نامعتبر از سرویس چاپ (کد ${toEnStatus(r.status)})`;
}

function toEnStatus(status: number | undefined): string {
  return status === undefined ? "— HTTP" : String(status);
}

/** اعتبار سنجی سریع تنظیمات قبل از ارسال */
function validateSettings(settings: BixolonSettings): BixolonResult | null {
  if (!settings.logicalName || !settings.logicalName.trim()) {
    return { ok: false, error: "نام منطقی چاپگر خالی است" };
  }
  if (!Number.isFinite(settings.port) || settings.port < 1 || settings.port > 65535) {
    return { ok: false, error: "پورت سرویس نامعتبر است" };
  }
  return null;
}

/** تفسیر «نتیجهٔ نهایی» چاپ — رشته‌ای که نه ready است نه progress */
function interpretFinalResult(result: string): BixolonResult {
  const raw = result.trim();
  const lower = raw.toLowerCase();
  // سرویس در پایان موفق معمولاً printed/ok/خالی برمی‌گرداند؛ هر نتیجه‌ای که
  // نشانهٔ خطا باشد به کاربر گزارش می‌شود
  if (/(error|fail|abort|cancel|offline|cover[ _]?open|paper[ _]?(end|out|empty)|cutter|overheat)/.test(lower)) {
    return { ok: false, error: `چاپگر خطا برگرداند (${raw || "نامشخص"})` };
  }
  return { ok: true };
}

/** پرس‌وجوی وضعیت کار تا رسیدن به نتیجهٔ نهایی (هر ۵۰۰ms، حداکثر ۱۲ بار) */
async function pollFinalStatus(
  settings: BixolonSettings,
  requestId: number
): Promise<BixolonResult> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(500);
    const r = await request(settings, "/checkStatus", { RequestID: requestId }, 4000);
    if (!r.ok) return { ok: false, error: httpError(r) };
    const result = r.data?.Result;
    if (typeof result === "string" && result !== "ready" && result !== "progress") {
      return interpretFinalResult(result);
    }
  }
  // کار پذیرفته شد اما پاسخ نهایی در مهلت ~۶ ثانیه نیامد — چاپ در صف چاپگر در جریان است
  return { ok: true };
}

/** ارسال مجموعه‌ای از توابع چاپ + انتظار برای نتیجهٔ نهایی */
async function sendJob(
  functions: Record<string, Record<string, unknown[]>>,
  settings: BixolonSettings
): Promise<BixolonResult> {
  const invalid = validateSettings(settings);
  if (invalid) return invalid;

  const id = ++jobSeq;
  const r = await request(settings, "", { id, functions }, 12000);
  if (!r.ok) return { ok: false, error: httpError(r) };

  // برخی کارهای سبک بلافاصله نتیجهٔ نهایی برمی‌گردانند
  const initial = r.data?.Result;
  if (typeof initial === "string" && initial !== "ready" && initial !== "progress") {
    return interpretFinalResult(initial);
  }
  return pollFinalStatus(settings, r.data?.RequestID ?? id);
}

/**
 * بررسی سریع حضور سرویس و چاپگر — کار چاپ خالی با تایم‌اوت کوتاه (~۴ ثانیه).
 * 404 → «سرویس فعال است اما چاپگری با این نام ثبت نشده»؛ خطای شبکه → «سرویس اجرا نیست».
 */
export async function probeBixolon(settings: BixolonSettings): Promise<BixolonResult> {
  const invalid = validateSettings(settings);
  if (invalid) return invalid;

  const id = ++jobSeq;
  const r = await request(settings, "", { id, functions: {} }, 4000);
  if (r.ok) return { ok: true };
  return { ok: false, error: httpError(r) };
}

/**
 * چاپ تصویری رسید (کیفیت اصلی — همان چیدمان پیش‌نمایش حرارتی به‌صورت بیت‌مپ).
 * تصویر canvas با عرض ۵۱۰ نقطه (۸۰mm)، وسط‌چین و دیترینگ روشن ارسال و در پایان برش نیمه‌کاره اجرا می‌شود.
 */
export async function printReceiptBitmap(
  canvas: HTMLCanvasElement,
  settings: BixolonSettings
): Promise<BixolonResult> {
  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch {
    return { ok: false, error: "ساخت تصویر رسید ناموفق بود" };
  }
  const functions: Record<string, Record<string, unknown[]>> = {
    func0: { printBitmap: [dataUrl, 510, 1, 1] }, // dataUrl، عرض ۵۱۰ نقطه، وسط‌چین، دیترینگ روشن
    func1: { cutPaper: [1] }, // برش نیمه‌کاره
  };
  return sendJob(functions, settings);
}

/**
 * چاپ متنی سطر‌به‌سطر (حالت ثانویه — بدون قالب‌بندی تصویری).
 * ابتدا صفحه‌کد ۲۷ (فارسی) تنظیم می‌شود، سپس هر سطر با printText و در پایان برش.
 */
export async function printReceiptTextLines(
  lines: BixolonTextLine[],
  settings: BixolonSettings
): Promise<BixolonResult> {
  const functions: Record<string, Record<string, unknown[]>> = {
    func0: { setCharacterset: [27] }, // ۲۷ = صفحه‌کد فارسی (WPC1256)
  };
  const clampMag = (v: number | undefined) =>
    Math.max(0, Math.min(7, Number.isFinite(v) ? Math.round(v as number) : 0));
  lines.forEach((line, index) => {
    functions[`func${index + 1}`] = {
      printText: [
        line.text,
        clampMag(line.hMag), // بزرگ‌نمایی افقی ۰..۷
        clampMag(line.vMag), // بزرگ‌نمایی عمودی ۰..۷
        line.bold ? 1 : 0, // درشت
        0, // نگاتیو
        0, // زیرخط‌دار
        0, // نوع قلم
        line.align ?? 2, // ۰=چپ، ۱=وسط، ۲=راست (پیش‌فرض: راست برای فارسی)
      ],
    };
  });
  functions[`func${lines.length + 1}`] = { cutPaper: [1] };
  return sendJob(functions, settings);
}
