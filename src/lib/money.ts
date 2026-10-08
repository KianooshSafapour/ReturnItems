// قالب‌بندی اعداد و مبالغ به فارسی + حروف‌خوانی مبالغ (ریال و تومان)
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** تبدیل ارقام فارسی/عربی به لاتین */
export function toEnDigits(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** جداکننده سه‌رقمی از راست: 1234567 → 1٬234٬567 */
export function groupDigits(numStr: string): string {
  const clean = numStr.replace(/[^\d]/g, "");
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
}

/** عدد نمایشی با ارقام فارسی و جداکننده: 1234567 → ۱٬۲۳۴٬۵۶۷ */
export function formatNumber(n: number): string {
  return toFaDigits(groupDigits(String(Math.floor(Math.abs(n)))));
}

/** مقدار/تعداد کالا با پشتیبانی اعشار — کالاهای وزنی (۰٫۵ کیلو سوسیس، ۱٫۲۵ کیلو آجیل)
 *  صفرهای انتهایی حذف می‌شوند: 2.500 → ۲٫۵ — ممیز فارسی «٫» */
export function formatQuantity(q: number): string {
  if (!Number.isFinite(q)) return "۰";
  // حداکثر ۳ رقم اعشار (دقت ترازو) و حذف صفرهای اضافی
  const rounded = Math.round(q * 1000) / 1000;
  const str = String(rounded);
  const [intPart, decPart] = str.split(".");
  const intFa = toFaDigits(groupDigits(intPart || "0"));
  if (!decPart) return intFa;
  const decFa = toFaDigits(decPart);
  return `${intFa}٫${decFa}`;
}

/** مبلغ پولی با جداکننده (بدون واحد) */
export function formatMoney(amount: number): string {
  return formatNumber(amount);
}

/** مبلغ ریالی کامل: ۱۲۳٬۴۵۶ ریال */
export function formatRial(amount: number): string {
  return `${formatMoney(amount)} ریال`;
}

/** مبلغ تومانی: ریال → تومان */
export function formatToman(amount: number): string {
  return `${formatMoney(Math.floor(amount / 10))} تومان`;
}

/** نمایش فشرده مبلغ ریالی برای کارت‌های آماری — ۳۴۲٬۰۰۰٬۰۰۰ → «۳۴ میلیون»
 *  نمایش کامل در title المان قرار می‌گیرد */
export function formatCompactRial(amount: number): string {
  const abs = Math.abs(amount);
  const fa = (n: number, digits = 1) =>
    toFaDigits(Number(n.toFixed(digits)).toLocaleString("en-US").replace(/\.0+$/, ""));
  if (abs >= 1_000_000_000) return `${fa(abs / 1_000_000_000)} میلیارد ریال`;
  if (abs >= 1_000_000) return `${fa(abs / 1_000_000)} میلیون ریال`;
  if (abs >= 10_000) return `${fa(abs / 1_000, 0)} هزار ریال`;
  return `${formatNumber(abs)} ریال`;
}

/** نمایش فشرده تومانی — ۳۴۲٬۰۰۰٬۰۰۰ ریال → «۳۴ میلیون تومان» */
export function formatCompactToman(amountRial: number): string {
  const abs = Math.abs(Math.floor(amountRial / 10));
  const fa = (n: number, digits = 1) =>
    toFaDigits(Number(n.toFixed(digits)).toLocaleString("en-US").replace(/\.0+$/, ""));
  if (abs >= 1_000_000_000) return `${fa(abs / 1_000_000_000)} میلیارد تومان`;
  if (abs >= 1_000_000) return `${fa(abs / 1_000_000)} میلیون تومان`;
  if (abs >= 10_000) return `${fa(abs / 1_000, 0)} هزار تومان`;
  return `${formatNumber(abs)} تومان`;
}

/** قالب‌بندی شماره کارت: 1234567812345678 → ۱۲۳۴-۵۶۷۸-۹۰۱۲-۳۴۵۶ */
export function formatCardNumber(card: string): string {
  const digits = toEnDigits(card).replace(/\D/g, "");
  return toFaDigits(digits.replace(/(\d{4})(?=\d)/g, "$1-"));
}

/** قالب‌بندی شماره موبایل: 09xxxxxxxxx → ۰۹xx xxx xx xx */
export function formatMobile(phone: string): string {
  const digits = toEnDigits(phone).replace(/\D/g, "");
  return toFaDigits(digits.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3 $4".replace(" $4", "")) || "");
}

// ---------- حروف‌خوانی اعداد به فارسی ----------
const YEKAN = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const DAHYEK = [
  "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده",
];
const DAHGAN = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const SADGAN = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALE = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد"];

function threeDigitToWords(n: number): string {
  const parts: string[] = [];
  const s = Math.floor(n / 100);
  const rest = n % 100;
  if (s > 0) parts.push(SADGAN[s]);
  if (rest >= 10 && rest < 20) {
    parts.push(DAHYEK[rest - 10]);
  } else {
    const d = Math.floor(rest / 10);
    const y = rest % 10;
    if (d > 0) parts.push(DAHGAN[d]);
    if (y > 0) parts.push(YEKAN[y]);
  }
  return parts.join(" و ");
}

/** تبدیل عدد صحیح به حروف فارسی */
export function numberToPersianWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "صفر";
  if (n >= 1e15) return "عدد بسیار بزرگ";
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    parts.push(`${threeDigitToWords(g)}${SCALE[i] ? " " + SCALE[i] : ""}`);
  }
  return parts.join(" و ");
}

/** حروف‌خوانی مبلغ در دو سطر: ریال و تومان (۱ تومان = ۱۰ ریال) */
export function moneyWords(amount: number): { rial: string; toman: string } {
  const rial = `${numberToPersianWords(amount)} ریال`;
  const tomans = Math.floor(amount / 10);
  const rem = amount % 10;
  const toman =
    rem === 0
      ? `${numberToPersianWords(tomans)} تومان`
      : `${numberToPersianWords(tomans)} تومان و ${numberToPersianWords(rem)} ریال`;
  return { rial, toman };
}

/** جمع دو خط حروف‌خوانی برای نمایش زیر ورودی مبلغ */
export function moneyWordsLines(amount: number): [string, string] {
  const w = moneyWords(amount);
  return [w.rial, w.toman];
}
