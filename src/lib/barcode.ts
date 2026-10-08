// بارکدهای داخلی فروشگاه — تولید EAN-13 با پیش‌شماره ۲ (بازه داخلی فروشگاهی)
// طبق استاندارد GS1، پیش‌شماره ۲ برای بارکدهای «درون‌فروشگاهی» (in-store) رزرو شده است
// این ماژول ایزومورفیک است (هم مرورگر، هم سرور)

/** رقم کنترل EAN-13 (الگوریتم Mod10 وزن‌دار ۱/۳) */
export function ean13CheckDigit(body12: string): number {
  const digits = body12.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** اعتبارسنجی ساختار EAN-13 (۱۳ رقم + رقم کنترل درست) */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const body = code.slice(0, 12);
  return Number(code[12]) === ean13CheckDigit(body);
}

/** ارقام تصادفی امن — Web Crypto با جایگزین Math.random */
function randomDigits(n: number): string {
  const buf = new Uint32Array(n);
  const g = globalThis as { crypto?: { getRandomValues?: (b: Uint32Array) => Uint32Array } };
  if (typeof g.crypto?.getRandomValues === "function") {
    g.crypto.getRandomValues(buf);
    return Array.from(buf, (v) => String(v % 10)).join("");
  }
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/**
 * تولید بارکد داخلی یکتا: «2» + ۸ رقم تصادفی + ۳ رقم دنباله + رقم کنترل
 * مثال: 2 83472910 457 → بارکد ۱۳ رقمی قابل چاپ و اسکن با هر اسکنر
 */
export function generateInternalBarcode(): string {
  const body12 = `2${randomDigits(8)}${randomDigits(3).padStart(3, "0")}`;
  return body12 + ean13CheckDigit(body12);
}

/** مجموعه اقلام مرجوعی: جایگزینی بارکد غایب/تکراری با بارکد داخلی یکتا */
export function ensureUniqueBarcodes(
  items: Array<{ barcode: string | null }>
): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  for (const it of items) {
    let bc = it.barcode ?? "";
    if (bc.length < 4 || used.has(bc)) {
      let attempt = 0;
      do {
        bc = generateInternalBarcode();
        attempt++;
      } while (used.has(bc) && attempt < 20);
    }
    used.add(bc);
    result.push(bc);
  }
  return result;
}
