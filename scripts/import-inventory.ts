// ورود بانک کالا از دو فایل اکسل هلو — بدون حذف/پاک‌سازی هیچ داده‌ای (upsert با رفع تکرار)
//   ۱) inventory-full.xlsx — کاتالوگ کامل (۱۴٬۷xx کالا) — همه بارکدها در ستون‌های كد2..كد52
//   ۲) inventory.xlsx  — موجودی جاری (تازه‌تر) — بروزرسانی قیمت/موجودی کالاهای موجود
// اجرا: bun scripts/import-inventory.ts
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";

const db = new PrismaClient({ log: ["warn", "error"] });

const FULL_PATH = "/home/z/my-project/upload/inventory-full.xlsx";
const CURRENT_PATH = "/home/z/my-project/upload/inventory.xlsx";

/* ---------- نرمال‌سازی ---------- */

/** نویسه‌های عربی هلو → فارسی + فشرده‌سازی فاصله‌ها */
function normalizeText(s: unknown): string {
  return String(s ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[ \t\u00A0]+/g, " ")
    .trim();
}

/** نام کالا — نرمال + حذف نشانگرهای ابتدای نام هلو (- و *) */
function normalizeName(s: unknown): string {
  return normalizeText(s)
    .replace(/^[-*]\s+/, "")
    .trim();
}

/** ارقام فارسی/عربی → لاتین */
function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** عدد سلول اکسل (عدد خام یا متن با جداکننده) */
function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = toEnDigits(String(v)).replace(/[,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** کد کالا — متن نرمال‌شده (بدون پسوند .0 اکسل) */
function normalizeCode(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return toEnDigits(normalizeText(v));
}

/** بارکد معتبر — فقط ارقام ۴ تا ۲۰ رقمی (نویسه‌های مزاحم هلو حذف می‌شوند) */
function cleanBarcode(v: unknown): string | null {
  if (v == null || v === "") return null;
  let s = typeof v === "number" ? String(v) : toEnDigits(String(v));
  // حذف نشانگر * و حرکات مزاحم و فاصله‌ها
  s = s.replace(/[*\s\u064B-\u0652]/g, "").trim();
  if (!/^\d{4,20}$/.test(s)) return null;
  return s;
}

/* ---------- خواندن فایل‌ها ---------- */

interface FullRow {
  code: string;
  name: string;
  category: string | null;
  stock: number | null;
  salePrice: number | null;
  unit: string | null;
  barcodes: string[];
}

interface CurrentRow {
  stock: number | null;
  salePrice: number | null;
}

function readSheet(path: string): XLSX.WorkSheet {
  if (!fs.existsSync(path)) throw new Error(`فایل یافت نشد: ${path}`);
  const wb = XLSX.readFile(path, { type: "file" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(`شیت یافت نشد در ${path}`);
  return ws;
}

/** پیدا کردن ردیف سرستون (نرمال‌شده) */
function headerIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] ?? []).map((c) => normalizeText(c));
    if (cells.includes("نام کالا") || cells.includes("کد کالا")) return i;
  }
  return -1;
}

/* ---------- فایل ۱: کاتالوگ کامل ---------- */
async function parseFull(): Promise<{ rows: FullRow[]; skipped: number; issues: string[] }> {
  const ws = readSheet(FULL_PATH);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const hi = headerIndex(rows);
  if (hi < 0) throw new Error("سرستون «نام کالا» در inventory-full.xlsx یافت نشد");
  const headers = (rows[hi] ?? []).map((c) => normalizeText(c));

  const col = (name: string) => headers.findIndex((h) => h === name);
  const cName = col("نام کالا");
  const cCode = col("کد کالا");
  const cMain = col("گروه اصلی");
  const cSub = col("گروه فرعی");
  const cStock = col("موجودی");
  const cPrice = col("فی فروش");
  const cUnit = col("واحد های کالا");
  // ستون‌های كد2..كد52 — بارکدهای چندگانه هلو
  const barcodeCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => /^کد\d+$/.test(h) && i !== cCode)
    .map(({ i }) => i);

  console.log(`  سرستون ردیف ${hi + 1} — ${headers.length} ستون، ${barcodeCols.length} ستون بارکد (کد2..کد${barcodeCols.length + 1})`);

  const out: FullRow[] = [];
  const issues: string[] = [];
  const seenCodes = new Map<string, number>();
  let skipped = 0;

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = normalizeName(row[cName]);
    const code = normalizeCode(row[cCode]);
    if (!name && !code) {
      skipped++;
      continue;
    }
    // کد تکراری در خود فایل — ردیف نخست مبناست
    if (code && seenCodes.has(code)) {
      skipped++;
      if (issues.length < 30) issues.push(`کد تکراری در فایل کامل: ${code} (${name})`);
      continue;
    }
    if (code) seenCodes.set(code, r);

    const main = normalizeText(row[cMain]);
    const sub = normalizeText(row[cSub]);
    const barcodes: string[] = [];
    for (const bc of barcodeCols) {
      const b = cleanBarcode(row[bc]);
      if (b && b !== code && !barcodes.includes(b)) barcodes.push(b);
    }

    out.push({
      code,
      name: name || `کد ${code}`,
      category: main ? (sub ? `${main} · ${sub}` : main) : sub || null,
      stock: parseNum(row[cStock]),
      salePrice: parseNum(row[cPrice]),
      unit: normalizeText(row[cUnit]) || null,
      barcodes,
    });
  }
  return { rows: out, skipped, issues };
}

/* ---------- فایل ۲: موجودی جاری ---------- */
function parseCurrent(): Map<string, CurrentRow> {
  const ws = readSheet(CURRENT_PATH);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const hi = headerIndex(rows);
  if (hi < 0) throw new Error("سرستون «نام کالا» در inventory.xlsx یافت نشد");
  const headers = (rows[hi] ?? []).map((c) => normalizeText(c));
  const cCode = headers.findIndex((h) => h === "کد کالا");
  const cStock = headers.findIndex((h) => h === "مقدار");
  const cPrice = headers.findIndex((h) => h === "قیمت فروش");

  const map = new Map<string, CurrentRow>();
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const code = normalizeCode(row[cCode]);
    if (!code) continue;
    if (!map.has(code)) {
      map.set(code, {
        stock: parseNum(row[cStock]),
        salePrice: parseNum(row[cPrice]),
      });
    }
  }
  return map;
}

/* ---------- اجرای اصلی ---------- */
async function main() {
  console.log("📦 ورود بانک کالا از فایل‌های هلو (بدون پاک‌سازی داده‌های موجود)…");
  const t0 = Date.now();

  console.log("① خواندن inventory-full.xlsx (کاتالوگ کامل + همه بارکدها)…");
  const full = await parseFull();
  console.log(`   ${full.rows.length} کالا، ${full.skipped} ردیف رد‌شده (خالی/تکراری)`);

  console.log("② خواندن inventory.xlsx (موجودی جاری — تازه‌تر)…");
  const current = parseCurrent();
  console.log(`   ${current.size} کد کالا`);

  // ---- رفع تکرار بین دو فایل: موجودی جاری مبنای قیمت/موجودی، کاتالوگ مبنای نام/گروه/بارکد ----
  let created = 0;
  let updated = 0;
  let currentOnly = 0;
  let priceUpdated = 0;
  let stockUpdated = 0;
  let barcodesAdded = 0;
  let barcodeConflicts = 0;
  let noCodeCreated = 0;

  // نقشه مالکیت بارکد (کد اصلی هر کالا = بارکد اصلی آن)
  console.log("③ ورود/بروزرسانی کالاها…");
  let i = 0;
  for (const fr of full.rows) {
    i++;
    if (i % 3000 === 0) console.log(`   … ${i}/${full.rows.length}`);

    const cur = fr.code ? current.get(fr.code) : undefined;
    // اولویت موجودی جاری (تازه‌تر) — سپس کاتالوگ کامل
    const stock = cur?.stock ?? fr.stock;
    const price = cur?.salePrice ?? fr.salePrice;

    let product;
    if (fr.code) {
      product = await db.product.findFirst({ where: { code: fr.code } });
    } else {
      // کد خالی — تطبیق با نام
      product = await db.product.findFirst({ where: { name: fr.name } });
    }

    const data = {
      name: fr.name,
      category: fr.category,
      unit: fr.unit ?? "عدد",
      stock: stock != null ? Math.round(stock) : null,
      price: price != null ? Math.max(0, Math.round(price)) : undefined,
      isActive: true,
    };

    if (!product) {
      product = await db.product.create({
        data: {
          code: fr.code || null,
          barcode: fr.code && /^\d{4,20}$/.test(fr.code) ? fr.code : null,
          ...data,
          price: data.price ?? 0,
        },
      });
      created++;
      if (!fr.code) noCodeCreated++;
    } else {
      await db.product.update({
        where: { id: product.id },
        data: {
          ...data,
          // بارکد اصلی فقط وقتی معتبر است تنظیم شود (مقدار قبلی معتبر پاک نمی‌شود)
          ...(fr.code && /^\d{4,20}$/.test(fr.code) ? { barcode: fr.code } : {}),
        },
      });
      updated++;
      if (cur?.salePrice != null && cur.salePrice !== product.price) priceUpdated++;
      if (cur?.stock != null && Math.round(cur.stock) !== product.stock) stockUpdated++;
    }

    // ---- بارکدهای چندگانه (كد2..كد52) ----
    for (const b of fr.barcodes) {
      const existing = await db.productBarcode.findFirst({
        where: { code: b },
        select: { productId: true },
      });
      if (existing) {
        if (existing.productId !== product.id) {
          barcodeConflicts++; // بارکد به کالای دیگری تعلق دارد — اولویت با صاحب نخست
          continue;
        }
        continue; // از قبل برای همین کالا ثبت شده
      }
      // اگر بارکد = کد اصلی کالای دیگر است، تداخل ایجاد نکن
      const asMain = await db.product.findFirst({
        where: { OR: [{ code: b }, { barcode: b }] },
        select: { id: true },
      });
      if (asMain && asMain.id !== product.id) {
        barcodeConflicts++;
        continue;
      }
      await db.productBarcode.create({
        data: { productId: product.id, code: b },
      });
      barcodesAdded++;
    }
  }

  // ---- کالاهای فقط در موجودی جاری (نباید وجود داشته باشد — کامل‌تر است) ----
  const fullCodes = new Set(full.rows.filter((r) => r.code).map((r) => r.code!));
  for (const [code, cur] of current) {
    if (fullCodes.has(code)) continue;
    const exists = await db.product.findFirst({ where: { code } });
    if (exists) continue;
    await db.product.create({
      data: {
        code,
        barcode: /^\d{4,20}$/.test(code) ? code : null,
        name: `کد ${code}`,
        unit: "عدد",
        stock: cur.stock != null ? Math.round(cur.stock) : null,
        price: cur.salePrice != null ? Math.max(0, Math.round(cur.salePrice)) : 0,
      },
    });
    currentOnly++;
  }

  const totalProducts = await db.product.count();
  const totalBarcodes = await db.productBarcode.count();
  const withBarcode = await db.product.count({ where: { NOT: { barcode: null } } });

  await db.activityLog.create({
    data: {
      action: "product_import",
      detail: `ورود بانک کالا از دو فایل هلو: ${created} جدید، ${updated} بروزرسانی، ${barcodesAdded} بارکد چندگانه — جمع کل ${totalProducts} کالا`,
    },
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n✅ ورود کامل در " + secs + " ثانیه:");
  console.log(`   کالای جدید: ${created} (بدون کد: ${noCodeCreated})`);
  console.log(`   بروزرسانی: ${updated} (قیمت ${priceUpdated}، موجودی ${stockUpdated})`);
  console.log(`   فقط در موجودی جاری: ${currentOnly}`);
  console.log(`   بارکد چندگانه افزوده: ${barcodesAdded} — تداخل رد‌شده: ${barcodeConflicts}`);
  console.log(`   🔎 جمع کل بانک کالا: ${totalProducts} کالا (${withBarcode} با بارکد اصلی، ${totalBarcodes} بارکد چندگانه)`);
  if (full.issues.length > 0) {
    console.log("   ⚠ موارد قابل بررسی:");
    for (const msg of full.issues.slice(0, 10)) console.log(`     - ${msg}`);
  }
}

main()
  .catch((e) => {
    console.error("خطا:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
