import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { parseProductWorkbook } from "@/lib/holoo";

const MAX_SIZE = 16 * 1024 * 1024; // ۱۶ مگابایت (فایل‌های بزرگ هلو)

/** درج/به‌روزرسانی بانک کالا از فایل اکسل (سازگار با خروجی هلو APEX) */
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

    const priceUnit = String(form.get("priceUnit") ?? "rial"); // rial | toman
    const multiplier = priceUnit === "toman" ? 10 : 1;

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseProductWorkbook(buffer);
    if (result.products.length === 0) {
      return jsonError("هیچ کالای معتبری در فایل یافت نشد");
    }

    let created = 0;
    let updated = 0;
    let duplicates = 0;
    const errors: string[] = [...result.errors];
    const dedupSeen = new Set<string>();

    // بارگذاری یک‌باره کالاهای موجود برای هم‌خوانی سریع (بارکد → کالا، کد → کالا، نام → کالا)
    type ExistingProduct = {
      id: string;
      code: string | null;
      barcode: string | null;
      name: string;
      category: string | null;
    };
    const existing: ExistingProduct[] = await db.product.findMany({
      select: { id: true, code: true, barcode: true, name: true, category: true },
    });
    const byBarcode = new Map<string, ExistingProduct>();
    const byCode = new Map<string, ExistingProduct>();
    const byName = new Map<string, ExistingProduct>();
    for (const p of existing) {
      if (p.barcode && !byBarcode.has(p.barcode)) byBarcode.set(p.barcode, p);
      if (p.code && !byCode.has(p.code)) byCode.set(p.code, p);
      if (!byBarcode.has(p.name) && !byCode.has(p.name)) byName.set(p.name, p);
    }
    const matchedIds = new Set<string>();

    type CreateData = {
      name: string; barcode: string | null; code: string | null;
      unit: string; price: number; stock: number | null; category: string | null;
    };
    type UpdateData = { id: string; data: CreateData };
    const creates: CreateData[] = [];
    const updates: UpdateData[] = [];

    for (const p of result.products) {
      const price = Math.min(p.price * multiplier, 2000000000);
      const data: CreateData = {
        name: p.name,
        barcode: p.barcode,
        code: p.code,
        unit: p.unit,
        price,
        stock: p.stock,
        category: p.category,
      };

      // اولویت هم‌خوانی: بارکد → کد کالا → نام دقیق
      let ex: ExistingProduct | null = null;
      if (p.barcode) ex = byBarcode.get(p.barcode) ?? null;
      if (!ex && p.code) ex = byCode.get(p.code) ?? null;
      if (!ex && !p.barcode && !p.code) ex = byName.get(p.name) ?? null;

      // حذف تکراری‌های داخل خود فایل (کد یکسان) — اولین رخداد ملاک است
      const dedupKey = p.barcode ?? p.code ?? `name:${p.name}`;
      if (dedupSeen.has(dedupKey)) {
        duplicates++;
        continue;
      }
      dedupSeen.add(dedupKey);

      if (ex && !matchedIds.has(ex.id)) {
        matchedIds.add(ex.id);
        updates.push({
          id: ex.id,
          data: {
            ...data,
            // اگر فایل جدید ستونی ندارد، مقدار قبلی حفظ می‌شود
            barcode: data.barcode ?? ex.barcode,
            code: data.code ?? ex.code,
            category: data.category ?? ex.category,
          },
        });
      } else if (!ex) {
        creates.push(data);
      }
    }

    // درج گروهی (تراکنش‌های ۵۰۰تایی) — سریع برای فایل‌های چند هزار سطری هلو
    for (let i = 0; i < creates.length; i += 500) {
      const chunk = creates.slice(i, i + 500);
      try {
        await db.$transaction(chunk.map((d) => db.product.create({ data: d })));
        created += chunk.length;
      } catch {
        // در صورت خطای دسته‌ای، سطر به سطر ادامه می‌دهیم
        for (const d of chunk) {
          try {
            await db.product.create({ data: d });
            created++;
          } catch {
            errors.push(`کالا «${d.name}»: ثبت نشد`);
          }
        }
      }
    }

    // به‌روزرسانی گروهی (تراکنش‌های ۲۰۰تایی)
    for (let i = 0; i < updates.length; i += 200) {
      const chunk = updates.slice(i, i + 200);
      await db.$transaction(
        chunk.map((u) =>
          db.product.update({ where: { id: u.id }, data: { ...u.data, updatedAt: new Date() } })
        )
      );
      updated += chunk.length;
    }

    await db.activityLog.create({
      data: {
        userId: owner.id,
        action: "product_import",
        detail: `ورود ${created} کالای جدید و به‌روزرسانی ${updated} کالا از فایل «${file.name}»`,
      },
    });

    if (duplicates > 0) {
      result.notes.push(`${duplicates} ردیف تکراری (کد/بارکد یکسان) در فایل نادیده گرفته شد`);
    }

    return jsonOk({
      total: result.totalRows,
      created,
      updated,
      duplicates,
      invalid: result.totalRows - created - updated - duplicates,
      headerRow: result.headerRow,
      mapping: result.mapping,
      sheetName: result.sheetName,
      errors: errors.slice(0, 20),
      notes: result.notes,
      priceUnit,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
