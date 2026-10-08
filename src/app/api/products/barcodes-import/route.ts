import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { parseBarcodeAliasesWorkbook, generateBarcodeAliasTemplate } from "@/lib/holoo";

const MAX_SIZE = 16 * 1024 * 1024; // ۱۶ مگابایت

/**
 * ورود «کدهای یک کالا» (بارکدهای چندگانه هلو) از اکسل —
 * کالاهایی که در هلو چند «كد كالا» (بارکد) دارند از گزارش موجودی فقط بارکد اولشان می‌آید؛
 * این مسیر بارکدهای بعدی را به‌عنوان نام‌های جایگزین به بانک کالا می‌چسباند تا
 * اسکن/جستجوی هر یک از بارکدها همان کالا را پیدا کند.
 *
 * دو قالب پذیرفته می‌شود:
 * ۱) قالب رسمی ورود لیستی کدهای هلو: «نام کالا» + «کد»
 * ۲) خروجی گزارش «مشخصات کالا» هلو (یک سطر به‌ازای هر کد)
 */
export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner();
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("درخواست نامعتبر است");

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("فایل اکسل انتخاب نشده است");
    if (file.size > MAX_SIZE) return jsonError("حجم فایل نباید بیشتر از ۱۶ مگابایت باشد");
    const name = file.name.toLowerCase();
    if (!/\.(xlsx|xls|xlsm|csv)$/.test(name)) {
      return jsonError("فقط فایل‌های اکسل (xls / xlsx / csv) پذیرفته می‌شوند");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseBarcodeAliasesWorkbook(buffer);
    if (result.rows.length === 0) {
      return jsonError("هیچ ردیف «نام کالا + کد» معتبری در فایل یافت نشد");
    }

    // نقشه‌های هم‌خوانی: نام نرمال → کالا، کد اصلی/بارکد اصلی → کالا
    const products = await db.product.findMany({
      select: { id: true, name: true, code: true, barcode: true },
    });
    const byName = new Map<string, { id: string; name: string; code: string | null; barcode: string | null }>();
    for (const p of products) {
      const key = p.name.trim();
      if (!byName.has(key)) byName.set(key, p);
    }
    const byCode = new Map<string, { id: string; name: string; code: string | null; barcode: string | null }>();
    for (const p of products) {
      if (p.code && !byCode.has(p.code)) byCode.set(p.code, p);
      if (p.barcode && !byCode.has(p.barcode)) byCode.set(p.barcode, p);
    }

    // همه بارکدهای جایگزین موجود (برای جلوگیری از تداخل بین کالاها)
    const existingAliases = await db.productBarcode.findMany({
      select: { productId: true, code: true },
    });
    const aliasOwner = new Map<string, string>(); // code → productId
    for (const a of existingAliases) if (!aliasOwner.has(a.code)) aliasOwner.set(a.code, a.productId);

    let matchedProducts = 0;
    let aliasesAdded = 0;
    let alreadyPrimary = 0; // کدی که همان بارکد اصلی کالاست
    let duplicates = 0;
    let unknown = 0;
    const unknownNames = new Set<string>();
    const errors: string[] = [...result.errors];
    const touchedProducts = new Set<string>();

    type AliasCreate = { productId: string; code: string };
    const creates: AliasCreate[] = [];
    const seenInFile = new Set<string>(); // `${productId}:${code}`

    for (const row of result.rows) {
      // هم‌خوانی: اول نام دقیق، بعد کد (اگر کدِ ردیف همان کد اصلی کالای دیگری باشد به آن کالا می‌چسبد)
      let product = byName.get(row.name) ?? null;
      if (!product) product = byCode.get(row.code) ?? null;

      if (!product) {
        unknown++;
        if (unknownNames.size < 12) unknownNames.add(row.name);
        continue;
      }

      // کد ورودی همان کد اصلی/بارکد اصلی کالاست — نیازی به نام جایگزین نیست
      if (product.code === row.code || product.barcode === row.code) {
        alreadyPrimary++;
        touchedProducts.add(product.id);
        continue;
      }

      // تداخل: این کد قبلاً به کالای دیگری چسبیده (اصلی یا جایگزین)
      const otherOwner = byCode.get(row.code)?.id ?? aliasOwner.get(row.code) ?? null;
      if (otherOwner && otherOwner !== product.id) {
        errors.push(
          `کد ${row.code} («${row.name}») قبلاً به کالای دیگری اختصاص دارد — نادیده گرفته شد`
        );
        duplicates++;
        continue;
      }

      const key = `${product.id}:${row.code}`;
      if (seenInFile.has(key) || aliasOwner.get(row.code) === product.id) {
        duplicates++;
        continue;
      }
      seenInFile.add(key);
      touchedProducts.add(product.id);
      creates.push({ productId: product.id, code: row.code });
    }

    // درج گروهی
    for (let i = 0; i < creates.length; i += 500) {
      const chunk = creates.slice(i, i + 500);
      try {
        await db.$transaction(
          chunk.map((c) =>
            db.productBarcode.create({
              data: c,
            })
          )
        );
        aliasesAdded += chunk.length;
      } catch {
        for (const c of chunk) {
          try {
            await db.productBarcode.create({ data: c });
            aliasesAdded++;
          } catch {
            duplicates++;
          }
        }
      }
    }
    matchedProducts = touchedProducts.size;

    await db.activityLog.create({
      data: {
        userId: owner.id,
        action: "barcode_alias_import",
        detail: `ورود ${aliasesAdded} بارکد جایگزین برای ${matchedProducts} کالا از فایل «${file.name}» (قالب: ${result.detectedFormat})`,
      },
    });

    return jsonOk({
      total: result.totalRows,
      matchedProducts,
      aliasesAdded,
      alreadyPrimary,
      duplicates,
      unknown,
      unknownNames: Array.from(unknownNames),
      headerRow: result.headerRow,
      mapping: result.mapping,
      sheetName: result.sheetName,
      detectedFormat: result.detectedFormat,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** دانلود فایل نمونه «کدهای یک کالا» (نام کالا + کد) — قالب رسمی ورود لیستی هلو */
export async function GET() {
  try {
    await requireOwner();
    const buf = generateBarcodeAliasTemplate();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": 'attachment; filename="holoo-codes-of-product-sample.xls"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
