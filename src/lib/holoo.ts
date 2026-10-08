// پردازش فایل‌های اکسل کالا — سازگار با فرمت هلو APEX (سیستم‌گروپ)
// سروری: فقط در API Routes استفاده شود
import * as XLSX from "xlsx";

export interface ParsedProduct {
  code: string | null;
  name: string;
  barcode: string | null;
  unit: string;
  price: number; // ریال
  stock: number | null;
  category: string | null;
}

export interface HolooParseResult {
  products: ParsedProduct[];
  headerRow: number;
  mapping: Record<string, string | null>;
  totalRows: number;
  sheetName: string;
  errors: string[];
  notes: string[]; // توضیحات نگاشت (مثل استنباط بارکد از کد کالا)
}

/** نام‌های ممکن برای هر ستون (هلو، آپکس و فرمت‌های عمومی) */
const COLUMN_ALIASES: Record<string, string[]> = {
  code: [
    "کد کالا", "کدکالا", "کد", "شمارنده", "شناسه کالا", "شناسه",
    "کد یکتا", "کدیکس", "کالا", "کد کالا(هلو)", "gcode", "code", "id", "product code",
  ],
  name: [
    "نام کالا", "نامکالا", "شرح کالا", "شرح", "نام", "عنوان کالا", "عنوان",
    "کالا", "gname", "name", "title", "product name", "description",
  ],
  barcode: [
    "بارکد", "بارکدکالا", "بار کد", "شماره بارکد", "بارکد کالا", "bn",
    "barcode", "bar code", "gtin", "ean", "upc",
  ],
  unit: [
    "واحد کالا", "واحدکالا", "واحد شمارش", "نام واحد", "واحد", "واحد اندازه‌گیری",
    "unit", "uom",
  ],
  price: [
    "قیمت فروش", "قیمتفروش", "قیمت فروش (ریال)", "قیمت فروش(ریال)", "قیمت فروش - ریال",
    "قیمت مصرف‌کننده", "قیمت مصرف کننده", "قیمت مصرف‌کننده (ریال)",
    "قیمت", "مبلغ", "فی", "قیمت واحد", "قیمت واحد (ریال)",
    "sale price", "price", "retail price",
  ],
  priceBuy: [
    "میانگین قیمت خرید", "آخرین قیمت خرید", "قیمت خرید", "قیمت خرید (ریال)",
    "فی خرید", "buy price", "cost", "purchase price",
  ],
  stock: [
    "موجودی", "موجودی انبار", "مقدار", "تعداد", "موجودی فعلی", "تعداد موجود",
    "quantity", "qty", "stock", "inventory", "existing",
  ],
  category: [
    "گروه کالا", "گروهکالا", "گروه", "دسته‌بندی", "دسته بندی", "دسته",
    "سرفصل", "category", "group",
  ],
};

/** ستون‌هایی که هرگز نباید نقش داده‌ای بگیرند (محاسباتی/شماره ردیف هلو) */
const EXCLUDED_HEADERS: string[] = [
  "ردیف", "مقدار دوم", "تعداد فی خرید", // تعداد × فی خرید = ارزش کل موجودی (محاسبه‌ای)
  "جمع", "جمع کل", "مبلغ کل", "ارزش کل", "row", "no", "total",
];

/** یکسان‌سازی نویسه‌های عربی/فارسی — خروجی هلو با ك و ي عربی است */
function normalizeFa(s: string): string {
  return s
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/[\u064A\u0649]/g, "\u06CC") // ي/ى → ی
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/[\u0623\u0625]/g, "\u0627") // أ/إ → ا
    .replace(/\u0640/g, "") // کشیده (ـ)
    .replace(/[\u0640\u200B-\u200E\u2066-\u2069]/g, ""); // نویسه‌های جهت/مخفی
}

function normalizeHeader(h: unknown): string {
  return normalizeFa(String(h ?? ""))
    .replace(/[\u200c\u200f\u200e]/g, "") // حذف نیم‌فاصله و نویسه‌های جهت
    .replace(/[\u064B-\u065F\u0670]/g, "") // حذف اعراب
    .replace(/[*·\u2022]/g, "") // حذف ستاره (مثل «تعداد*في خريد»)
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLowerCase();
}

function matchColumn(header: unknown, aliases: string[]): boolean {
  const h = normalizeHeader(header);
  if (!h) return false;
  // ستون‌های محاسوبی/ردیف هلو را دقیقاً رد می‌کنیم
  if (EXCLUDED_HEADERS.some((x) => h === normalizeHeader(x) || h.replace(/ /g, "") === normalizeHeader(x).replace(/ /g, "")))
    return false;
  return aliases.some((a) => {
    const n = normalizeHeader(a);
    return h === n || h.replace(/ /g, "") === n.replace(/ /g, "");
  });
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v));
  return String(v).trim();
}

function cellNumber(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return Math.round(v);
  const raw = cellText(v);
  if (!raw) return null;
  const cleaned = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,٬'\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isFinite(n) ? Math.round(n) : null;
}

/** پاک‌سازی نام کالا: حذف پیشوندهای تزیینی هلو (- و * و _) و فاصله‌های اضافی */
function cleanProductName(raw: string): string {
  return normalizeFa(raw)
    .replace(/^[\s\-*_]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** تشخیص بارکد: حفظ صفرهای ابتدایی و حذف نمایش علمی */
function cellBarcode(v: unknown): string | null {
  const raw = cellText(v);
  if (!raw) return null;
  // اگر عدد اعشاری بود (نمایش علمی اکسل) گرد می‌شود
  const cleaned = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  if (cleaned.replace(/^0+/, "").length < 4) return null; // خیلی کوتاه
  return cleaned;
}

/* در هلو APEX ستون بارکد جداگانه‌ای وجود ندارد —
   «كد كالا» همان بارکد است (هم کدهای داخلی و هم بارکدهای EAN در آن ستون ذخیره می‌شوند).
   بنابراین هرگاه فایل ستون بارکد نداشت، مقدار كد كالا هم به‌عنوان بارکد ثبت می‌شود. */

/** تجزیه فایل اکسل اقلام کالا (سازگار با خروجی هلو APEX) */
export function parseProductWorkbook(buffer: Buffer | ArrayBuffer): HolooParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("فایل هیچ شیتی ندارد");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
  if (rows.length === 0) throw new Error("فایل خالی است");

  // یافتن سطر سرستون (در ۶ سطر نخست): سطری که بیشترین تطبیق را دارد
  let headerRow = 0;
  let best = { idx: 0, count: 0, cols: {} as Record<string, number> };
  const limit = Math.min(6, rows.length);
  for (let r = 0; r < limit; r++) {
    const cols: Record<string, number> = {};
    let count = 0;
    rows[r].forEach((cell, c) => {
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (cols[key] === undefined && matchColumn(cell, aliases)) {
          cols[key] = c;
          count++;
        }
      }
    });
    if (count > best.count) best = { idx: r, count, cols };
  }
  headerRow = best.idx;
  const cols = best.cols;

  if (!cols.name && !cols.barcode && !cols.code) {
    throw new Error(
      "سرستون‌های فایل شناسایی نشد. لطفاً از فایل نمونه استفاده کنید (ستون‌های: کد کالا، نام کالا، بارکد، واحد کالا، قیمت فروش، موجودی، گروه کالا)"
    );
  }

  const products: ParsedProduct[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  let totalRows = 0;

  // در هلو، كد كالا همان بارکد است — اگر فایل ستون بارکد جداگانه نداشت
  const inferBarcode = !cols.barcode;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => cellText(c) === "")) continue;

    const name = cols.name !== undefined ? cleanProductName(cellText(row[cols.name])) : "";
    const code = cols.code !== undefined ? cellText(row[cols.code]) : "";
    // هلو: كد كالا = بارکد (ستون جداگانه وجود ندارد)
    const barcode = cols.barcode !== undefined ? cellBarcode(row[cols.barcode]) : code || null;
    const unit = cols.unit !== undefined ? cellText(row[cols.unit]) || "عدد" : "عدد";
    let price = cols.price !== undefined ? cellNumber(row[cols.price]) : null;
    if (price === null && cols.priceBuy !== undefined) {
      price = cellNumber(row[cols.priceBuy]);
    }
    const stock = cols.stock !== undefined ? cellNumber(row[cols.stock]) : null;
    const category = cols.category !== undefined ? cellText(row[cols.category]) : "";

    // سطرهای جمع/خالی (مثل سطر آخر خروجی هلو) رد می‌شوند
    if (!name && !barcode && !code) continue;
    totalRows++;

    if (!name) {
      errors.push(`سطر ${r + 1}: نام کالا خالی است — نادیده گرفته شد`);
      continue;
    }

    products.push({
      code: code || null,
      name: name.slice(0, 200),
      // در فرمت هلو بارکد = کد؛ برای فایل‌های دارای ستون بارکد، مقدار همان ستون است
      barcode: barcode && barcode.length >= 4 ? barcode : null,
      unit: unit.slice(0, 30) || "عدد",
      price: price ?? 0,
      stock,
      category: category || null,
    });
  }

  if (inferBarcode) {
    notes.push(
      "فرمت هلو APEX ستون بارکد جداگانه ندارد — مقدار «كد كالا» هم به‌عنوان بارکد ثبت شد (در هلو، کد کالا همان بارکد است)"
    );
  }
  if (cols.price === undefined && cols.priceBuy !== undefined) {
    notes.push("ستون قیمت فروش یافت نشد؛ از قیمت خرید استفاده شد");
  }

  return {
    products,
    headerRow: headerRow + 1,
    mapping: {
      code: cols.code !== undefined ? cellText(rows[headerRow][cols.code]) : null,
      name: cols.name !== undefined ? cellText(rows[headerRow][cols.name]) : null,
      barcode: cols.barcode !== undefined ? cellText(rows[headerRow][cols.barcode]) : null,
      unit: cols.unit !== undefined ? cellText(rows[headerRow][cols.unit]) : null,
      price: cols.price !== undefined ? cellText(rows[headerRow][cols.price]) : null,
      stock: cols.stock !== undefined ? cellText(rows[headerRow][cols.stock]) : null,
      category: cols.category !== undefined ? cellText(rows[headerRow][cols.category]) : null,
    },
    totalRows,
    sheetName,
    errors: errors.slice(0, 30),
    notes,
  };
}

/** ساخت فایل نمونه اکسل — دقیقاً همان قالب رسمی خروجی هلو APEX (۹ ستون) */
export function generateProductTemplate(): Buffer {
  // سرستون‌ها عیناً از خروجی واقعی هلو (نویسه‌های عربی ك و ي)
  const data = [
    [
      "رديف",
      "كد كالا",
      "نام كالا",
      "مقدار",
      "مقدار دوم",
      "نام واحد",
      "قيمت خريد",
      "قيمت فروش",
      "تعداد*في خريد",
    ],
    [1, "6261234567890", "شیر کم‌چرب پگاه ۱ لیتری", 24, 0, "عدد", 42000, 58000, 1008000],
    [2, "6261234567891", "روغن سرخ‌کردنی لادن ۱.۶ لیتری", 12, 0, "عدد", 550000, 648000, 6600000],
    [3, "6261234567892", "خرمای مضافتی ممتاز ۱ کیلوگرم", 75, 0, "کیلوگرم", 470000, 550000, 35250000],
    [4, "", "", "", "", "", "", "", ""], // سطر جمع انتهایی هلو
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 38 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "inventory");
  // خروجی BIFF8 (.xls) — همان فرمتی که هلو APEX صادر می‌کند
  return XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer;
}

export interface ExportReturnRow {
  code: string;
  submittedAt: Date;
  cashier: string;
  customerName: string;
  customerPhone: string;
  customerCard: string;
  purchaseAt: Date;
  totalAmount: number;
  exchangeValue?: number;
  transferAmount?: number;
  transferNote?: string | null;
  settlementType?: string;
  status: string;
  bankName?: string;
  accountNumber?: string;
  referenceNumber?: string;
  transferredAt?: Date;
  items: {
    code?: string | null;
    name: string;
    barcode?: string | null;
    quantity: number;
    unitPrice: number;
  }[];
}

/* ============================================================
   ورود «کدهای یک کالا» (بارکدهای چندگانه هلو) از اکسل
   دو قالب پذیرفته می‌شود:
   ۱) قالب رسمی ورود لیستی کدهای هلو: ستون‌های «نام کالا» + «کد» (هر سطر یک کد)
   ۲) خروجی گزارش «مشخصات کالا» هلو (رديف/كد كالا/نام كالا/گروه‌ها/…) —
      یک سطر به‌ازای هر کد؛ نام کالا تکرار می‌شود
   ============================================================ */

export interface ParsedBarcodeAlias {
  name: string;
  code: string;
}

export interface BarcodeAliasParseResult {
  rows: ParsedBarcodeAlias[];
  headerRow: number;
  mapping: Record<string, string | null>;
  totalRows: number;
  sheetName: string;
  errors: string[];
  detectedFormat: "codes-of-product" | "product-specs" | "unknown";
}

const ALIAS_NAME_ALIASES = ["نام کالا", "نامکالا", "شرح کالا", "شرح", "نام", "عنوان", "name", "title"];
const ALIAS_CODE_ALIASES = ["کد", "كد", "کد کالا", "كد كالا", "کدکالا", "شمارنده", "بارکد", "کد دوم", "code", "barcode"];

function matchAliasColumn(header: unknown, aliases: string[]): boolean {
  const h = normalizeHeader(header);
  if (!h) return false;
  return aliases.some((a) => {
    const n = normalizeHeader(a);
    return h === n || h.replace(/ /g, "") === n.replace(/ /g, "");
  });
}

/** تجزیه فایل اکسل بارکدهای جایگزین — سازگار با هر دو قالب خروجی هلو */
export function parseBarcodeAliasesWorkbook(buffer: Buffer | ArrayBuffer): BarcodeAliasParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("فایل هیچ شیتی ندارد");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
  if (rows.length === 0) throw new Error("فایل خالی است");

  // یافتن سطر سرستون (۶ سطر نخست): سطری که هم «نام کالا» و هم «کد» دارد
  let headerRow = 0;
  let nameCol = -1;
  let codeCol = -1;
  const limit = Math.min(6, rows.length);
  for (let r = 0; r < limit; r++) {
    let nc = -1;
    let cc = -1;
    rows[r].forEach((cell, c) => {
      if (nc === -1 && matchAliasColumn(cell, ALIAS_NAME_ALIASES)) nc = c;
      if (cc === -1 && matchAliasColumn(cell, ALIAS_CODE_ALIASES)) cc = c;
    });
    if (nc !== -1 && cc !== -1 && nc !== cc) {
      headerRow = r;
      nameCol = nc;
      codeCol = cc;
      break;
    }
  }
  if (nameCol === -1 || codeCol === -1) {
    throw new Error(
      "سرستون‌های فایل شناسایی نشد — فایل باید ستون‌های «نام کالا» و «کد» (یا «کد کالا») را داشته باشد. " +
        "از گزارش «مشخصات کالا» هلو یا قالب «کدهای یک کالا» استفاده کنید."
    );
  }

  // تشخیص قالب: اگر ستون‌های گزارش مشخصات کالا (گروه/واحد/قیمت) کنارشان بود
  const headerCells = rows[headerRow].map((c) => normalizeHeader(c));
  const hasSpecs = headerCells.some((h) => h.includes("گروه") || h.includes("واحد") || h.includes("قیمت"));
  const detectedFormat: BarcodeAliasParseResult["detectedFormat"] = hasSpecs
    ? "product-specs"
    : "codes-of-product";

  const out: ParsedBarcodeAlias[] = [];
  const errors: string[] = [];
  let totalRows = 0;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => cellText(c) === "")) continue;
    const name = cleanProductName(cellText(row[nameCol]));
    const code = cellBarcode(row[codeCol]);
    // سطرهای جمع/خالی انتهایی گزارش‌های هلو رد می‌شوند
    if (!name && !code) continue;
    if (/^جمع|^مجموع|^total/i.test(name)) continue;
    totalRows++;
    if (!name || !code) {
      errors.push(`سطر ${r + 1}: نام کالا یا کد خالی است — نادیده گرفته شد`);
      continue;
    }
    out.push({ name: name.slice(0, 200), code });
  }

  return {
    rows: out,
    headerRow: headerRow + 1,
    mapping: {
      name: cellText(rows[headerRow][nameCol]),
      code: cellText(rows[headerRow][codeCol]),
    },
    totalRows,
    sheetName,
    errors: errors.slice(0, 30),
    detectedFormat,
  };
}

/** ساخت فایل نمونه «کدهای یک کالا» — قالب رسمی ورود لیستی هلو (نام کالا + کد) */
export function generateBarcodeAliasTemplate(): Buffer {
  const data = [
    ["نام كالا", "كد"],
    ["سوسیس کوکتل کلاسیک ۵۰۰ گرمی", "6261234567890"],
    ["سوسیس کوکتل کلاسیک ۵۰۰ گرمی", "6269876543210"],
    ["آجیل مخلوط ممتاز ۱ کیلوگرمی", "6265554443332"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 40 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1"); // نام شیت انگلیسی (الزام هلو)
  return XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer;
}

/* ============================================================
   خروجی «برگشت از فروش» برای ورود به هلو APEX
   بر اساس مستندات رسمی هلو (help.holoo.co.ir — 06d8-0-1):
   · هلو سطرهای اقلام فاکتور را از اکسل می‌گیرد (نه سربرگ سند)
   · ستون‌ها: «نام کالا» / «متراژ/تعداد» / «فی» — عیناً مثل فرم فاکتور
   · فرمت فایل: Excel 97-2003 (.xls) — نام فایل و نام شیت انگلیسی
   · مقادیر عددی خام (بدون فرمول/جداکننده) — تعداد مثبت (اعشار مجاز)
   · نام کالا باید با بانک کالای هلو یکی باشد (نام‌ها از خروجی هلو آمده‌اند)
   ============================================================ */

export interface HolooReturnDocItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

/** نام شیت انگلیسی امن (الزام هلو: نام شیت حتماً انگلیسی باشد) */
function safeSheetName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 28) || "Sheet1";
  return cleaned;
}

/** ساخت فایل .xls برگشت از فروش برای «یک» مرجوعی — قابل ورود به فرم فاکتور برگشت از فروش هلو */
export function generateHolooReturnDocument(
  code: string,
  items: HolooReturnDocItem[]
): Buffer {
  const data: (string | number)[][] = [
    ["نام کالا", "متراژ/تعداد", "فی"],
    ...items.map((it) => [
      it.name,
      // مقدار مثبت (برگشت از فروش موجودی را زیاد می‌کند) — اعشار برای کالای وزنی
      Math.round(it.quantity * 1000) / 1000,
      it.unitPrice, // ریال — عدد خام بدون جداکننده
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 44 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(code));
  return XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer;
}

/** ساخت فایل .xls چندشیتی — هر مرجوعی یک شیت (ورود جداگانه هر برگشت از فروش در هلو) */
export function generateHolooReturnsBatch(
  returns: Array<{ code: string; items: HolooReturnDocItem[] }>
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const r of returns) {
    const data: (string | number)[][] = [
      ["نام کالا", "متراژ/تعداد", "فی"],
      ...r.items.map((it) => [
        it.name,
        Math.round(it.quantity * 1000) / 1000,
        it.unitPrice,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 44 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(r.code));
  }
  if (wb.SheetNames.length === 0) {
    // فایل خالی نباشد — شیت نمونه
    const ws = XLSX.utils.aoa_to_sheet([["نام کالا", "متراژ/تعداد", "فی"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer;
}

/** برچسب فارسی نوع تسویه برای خروجی اکسل */
export const SETTLEMENT_LABELS: Record<string, string> = {
  full: "انتقال کامل وجه",
  exchange: "تبادل با کالا",
  partial: "انتقال با کسری",
  debt: "بدهی مشتری",
};

/** ساخت فایل اکسل آرشیو مرجوعی‌ها (دو شیت: خلاصه + اقلام) */
export function generateReturnsExport(returns: ExportReturnRow[]): Buffer {
  const summary = returns.map((r) => ({
    "شماره مرجوعی": r.code,
    "تاریخ ثبت": r.submittedAt.toLocaleDateString("fa-IR"),
    "ساعت ثبت": r.submittedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    "صندوقدار": r.cashier,
    "نام مشتری": r.customerName,
    "موبایل مشتری": r.customerPhone,
    "کارت بانکی مشتری": r.customerCard,
    "زمان خرید": r.purchaseAt.toLocaleDateString("fa-IR"),
    "مبلغ کل اقلام (ریال)": r.totalAmount,
    "مبلغ کل اقلام (تومان)": Math.floor(r.totalAmount / 10),
    "ارزش کالای جایگزین (ریال)": r.exchangeValue ?? 0,
    "مبلغ انتقالی (ریال)": r.transferAmount ?? r.totalAmount,
    "مبلغ انتقالی (تومان)": Math.floor((r.transferAmount ?? r.totalAmount) / 10),
    "نوع تسویه": SETTLEMENT_LABELS[r.settlementType ?? "full"] ?? "انتقال کامل وجه",
    "دلیل اختلاف تسویه": r.transferNote || "",
    "وضعیت": r.status === "paid" ? "پرداخت شده" : "در انتظار پرداخت",
    "بانک پرداخت": r.bankName || "",
    "شماره حساب مبدأ": r.accountNumber || "",
    "شماره پیگیری انتقال": r.referenceNumber || "",
    "زمان انتقال": r.transferredAt ? r.transferredAt.toLocaleDateString("fa-IR") : "",
  }));
  const items = returns.flatMap((r) =>
    r.items.map((it) => ({
      "شماره مرجوعی": r.code,
      "کد کالا": it.code || "",
      "نام کالا": it.name,
      "بارکد": it.barcode || "",
      "تعداد": it.quantity,
      "قیمت واحد (ریال)": it.unitPrice,
      "مبلغ کل (ریال)": it.quantity * it.unitPrice,
    }))
  );
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary.length ? summary : [{ "شماره مرجوعی": "—" }]);
  const ws2 = XLSX.utils.json_to_sheet(items.length ? items : [{ "شماره مرجوعی": "—" }]);
  XLSX.utils.book_append_sheet(wb, ws1, "خلاصه مرجوعی");
  XLSX.utils.book_append_sheet(wb, ws2, "اقلام مرجوعی");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
