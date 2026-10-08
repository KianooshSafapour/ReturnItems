import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { digitsOnly } from "@/lib/validators";

/** ویرایش کالای بانک کالا — فقط مدیر ارشد/مالک */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await requireOwner();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object")
      return jsonError("بدنه درخواست نامعتبر است");

    const product = await db.product.findUnique({ where: { id } });
    if (!product) return jsonError("کالا یافت نشد", 404);

    // فقط فیلدهای ارسال‌شده اعمال می‌شوند
    const data: Record<string, string | number | boolean | null> = {};
    const changed: string[] = [];

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) return jsonError("نام کالا حداقل ۲ نویسه باشد");
      if (name.length > 200) return jsonError("نام کالا حداکثر ۲۰۰ نویسه باشد");
      if (name !== product.name) {
        data.name = name;
        changed.push("نام");
      }
    }
    if (body.unit !== undefined) {
      const unit = String(body.unit).trim() || "عدد";
      if (unit !== product.unit) {
        data.unit = unit.slice(0, 40);
        changed.push("واحد");
      }
    }
    if (body.code !== undefined || body.barcode !== undefined) {
      // هلو: کد کالا همان بارکد است — یک ستون واحد هر دو فیلد را به‌روز می‌کند
      const source =
        body.code !== undefined
          ? String(body.code).trim()
          : String(body.barcode).trim();
      const code = source || null;
      if ((code ?? "") !== (product.code ?? "") || (code ?? "") !== (product.barcode ?? "")) {
        if (code) {
          const dup = await db.product.findFirst({
            where: { code, id: { not: id } },
          });
          if (dup) return jsonError(`این کد/بارکد قبلاً برای «${dup.name}» ثبت شده است`);
        }
        data.code = code;
        data.barcode = code;
        changed.push("کد/بارکد");
      }
    }
    if (body.category !== undefined) {
      const category = String(body.category).trim() || null;
      if (category !== product.category) {
        data.category = category;
        changed.push("دسته");
      }
    }
    if (body.price !== undefined) {
      const price = Math.floor(Number(body.price));
      if (!Number.isFinite(price) || price < 0 || price > 500_000_000)
        return jsonError("قیمت فروش نامعتبر است (۰ تا ۵۰۰ میلیون ریال)");
      if (price !== product.price) {
        data.price = price;
        changed.push("قیمت");
      }
    }
    if (body.stock !== undefined) {
      const stock =
        body.stock === null || body.stock === "" ? null : Math.floor(Number(body.stock));
      if (stock !== null && (!Number.isFinite(stock) || stock < 0))
        return jsonError("موجودی نامعتبر است");
      if (stock !== product.stock) {
        data.stock = stock;
        changed.push("موجودی");
      }
    }
    if (body.isActive !== undefined) {
      const isActive = body.isActive === true;
      if (isActive !== product.isActive) {
        data.isActive = isActive;
        changed.push(isActive ? "فعال‌سازی" : "غیرفعال‌سازی");
      }
    }

    // ---- بارکدهای جایگزین (هلو: چند «كد كالا» برای یک کالا) ----
    let newBarcodes: string[] | null = null;
    if (Array.isArray(body.extraBarcodes)) {
      const rawList: string[] = (body.extraBarcodes as unknown[]).map((b) =>
        digitsOnly(String(b ?? ""))
      );
      const clean = [...new Set(rawList.filter((b) => b.length >= 4 && b.length <= 20))];
      // بارکد جایگزین نباید با کد اصلی کالا یکی باشد
      const mainCode = digitsOnly(String(body.code ?? body.barcode ?? product.code ?? ""));
      const finalList = clean.filter((b) => b !== mainCode);
      // یکتایی در کل بانک کالا: نه کد اصلی کالای دیگر، نه بارکد جایگزین کالای دیگر
      for (const b of finalList) {
        const dupMain = await db.product.findFirst({
          where: { barcode: b, id: { not: id } },
          select: { name: true },
        });
        if (dupMain) return jsonError(`بارکد ${b} کد اصلی «${dupMain.name}» است — قابل استفاده نیست`);
        const dupAlias = await db.productBarcode.findFirst({
          where: { code: b, productId: { not: id } },
          include: { product: { select: { name: true } } },
        });
        if (dupAlias)
          return jsonError(
            `بارکد ${b} قبلاً برای «${dupAlias.product.name}» ثبت شده است`
          );
      }
      newBarcodes = finalList;
    }

    if (changed.length === 0 && newBarcodes === null)
      return jsonOk({ ok: true, changed: [] });

    if (Object.keys(data).length > 0) {
      await db.product.update({ where: { id }, data });
    }

    // جایگزینی مجموع بارکدهای جایگزین
    if (newBarcodes !== null) {
      await db.productBarcode.deleteMany({ where: { productId: id } });
      if (newBarcodes.length > 0) {
        await db.productBarcode.createMany({
          data: newBarcodes.map((b) => ({ productId: id, code: b })),
        });
      }
      if (!changed.includes("بارکدهای جایگزین")) changed.push("بارکدهای جایگزین");
    }

    const updated = await db.product.findUniqueOrThrow({
      where: { id },
      include: { extraBarcodes: { select: { code: true } } },
    });

    if (changed.length > 0) {
      await db.activityLog.create({
        data: {
          userId: manager.id,
          action: "product_update",
          detail: `ویرایش کالای «${updated.name}»: ${changed.join("، ")}`,
          entityId: id,
        },
      });
    }

    return jsonOk({
      ok: true,
      changed,
      product: serialize(updated),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

function serialize(
  p: {
    id: string;
    code: string | null;
    barcode: string | null;
    name: string;
    unit: string;
    price: number;
    stock: number | null;
    category: string | null;
    extraBarcodes?: Array<{ code: string }>;
  }
) {
  return {
    id: p.id,
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    unit: p.unit,
    price: p.price,
    stock: p.stock,
    category: p.category,
    extraBarcodes: (p.extraBarcodes ?? []).map((e) => e.code),
  };
}
