// تبدیل تاریخ شمسی (جلالی) و میلادی — الگوریتم jalaali
// منابع: الگوریتم استاندارد خیام/بیرشک (jalaali-js, MIT)

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

function div(a: number, b: number): number {
  return ~~(a / b);
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

/** میلادی → جلالی */
export function toJalali(date: Date): JalaliDate {
  const jdn = g2d(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return d2j(jdn);
}

/** جلالی → میلادی (نیمه‌شب محلی) */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const jdn = j2d(jy, jm, jd);
  const g = d2g(jdn);
  return new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0);
}

/** طول ماه جلالی */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}

/** کبیسه سال جلالی؟ */
export function isJalaliLeap(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const JALALI_WEEKDAYS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه",
];

/** شماره روز هفته به سبک ایرانی: ۰=شنبه … ۶=جمعه */
export function iranianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** ۱۴۰۴/۰۷/۱۵ */
export function formatJalaliDate(date: Date): string {
  const j = toJalali(date);
  return fa(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
}

/** ۱۴:۳۰ */
export function formatTime(date: Date): string {
  return fa(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
}

/** ۱۴۰۴/۰۷/۱۵ – ۱۴:۳۰ */
export function formatJalaliDateTime(date: Date): string {
  return `${formatJalaliDate(date)} – ${formatTime(date)}`;
}

/** ۱۵ مهر ۱۴۰۴ */
export function formatJalaliLong(date: Date): string {
  const j = toJalali(date);
  return `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${fa(j.jy)}`;
}

/** ۱۵ مهر ۱۴۰۴، ساعت ۱۴:۳۰ (سه‌شنبه) */
export function formatJalaliFull(date: Date): string {
  const wd = JALALI_WEEKDAYS[iranianWeekday(date)];
  return `${formatJalaliLong(date)}، ساعت ${formatTime(date)} (${wd})`;
}

/** تبدیل رشته جلالی ۱۴۰۴/۰۷/۱۵ به Date */
export function parseJalaliString(s: string): Date | null {
  const parts = s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .split(/[\/\-.]/)
    .map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((p) => isNaN(p))) return null;
  const [jy, jm, jd] = parts;
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return jalaliToDate(jy, jm, Math.min(jd, jalaliMonthLength(jy, jm)));
}

/** شماره پیگیری مرجوعی: HZ-۱۴۰۴۰۷-XXXX (بر اساس تاریخ شمسی) */
export function returnCodeFromDate(date: Date, seq: number): string {
  const j = toJalali(date);
  return `HZ-${j.jy}${pad2(j.jm)}${pad2(j.jd)}-${String(seq).padStart(4, "0")}`;
}
