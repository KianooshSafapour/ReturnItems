import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { digitsOnly } from "@/lib/validators";

/** جستجوی کالا (حالت پیش‌فرض) یا فهرست صفحه‌بندی‌شده بانک کالا (mode=list) */
export async function GET(req: NextRequest) {
  try {
    await requireUser();

    // حالت فهرست: صفحه‌بندی + فیلتر نام/بارکد/کد + فیلتر دسته
    if (req.nextUrl.searchParams.get("mode") === "list") {
      return listProducts(req);
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const barcode = digitsOnly(req.nextUrl.searchParams.get("barcode") ?? "");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "8", 10) || 8, 25);
    if (barcode && barcode.length >= 4) {
      // بارکد اصلی کالا (كد كالا نخست در هلو)
      const exact = await db.product.findFirst({
        where: { barcode, isActive: true },
      });
      if (exact) return jsonOk({ products: [serialize(exact, [])] });
      // بارکدهای جایگزین — هلو هر کالا را با چند «كد كالا» تعریف می‌کند و
      // گزارش موجودی فقط بارکد نخست را می‌آورد؛ بقیه اینجا ثبت شده‌اند
      const alias = await db.productBarcode.findFirst({
        where: { code: barcode },
        include: { product: true },
      });
      if (alias && alias.product.isActive) {
        const extras = await db.productBarcode.findMany({
          where: { productId: alias.productId },
          select: { code: true },
        });
        return jsonOk({
          products: [serialize(alias.product, extras.map((e) => e.code))],
        });
      }
    }

    if (!q) return jsonOk({ products: [] });

    // جستجو با نام یا بارکد یا کد کالا (شامل بارکدهای جایگزین)
    const products = await db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { barcode: { contains: digitsOnly(q) && digitsOnly(q).length >= 4 ? digitsOnly(q) : q } },
          { code: { contains: q } },
          {
            extraBarcodes: {
              some: { code: { contains: digitsOnly(q) && digitsOnly(q).length >= 4 ? digitsOnly(q) : q } },
            },
          },
        ],
      },
      orderBy: [{ name: "asc" }],
      take: limit,
      include: { extraBarcodes: { select: { code: true } } },
    });
    return jsonOk({ products: products.map((p) => serialize(p, p.extraBarcodes.map((e) => e.code))) });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ایجاد کالای جدید در بانک کالا — فقط مدیر ارشد/مالک */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireOwner();
    const body = await req.json().catch(() => null);

    const name = String(body?.name ?? "").trim();
    const unit = String(body?.unit ?? "").trim() || "عدد";
    const code = String(body?.code ?? "").trim() || null;
    const barcodeRaw = String(body?.barcode ?? "").trim();
    const barcode = digitsOnly(barcodeRaw) || null;
    const category = String(body?.category ?? "").trim() || null;
    const price = Math.floor(Number(body?.price ?? 0));
    const stockRaw = body?.stock;
    const stock =
      stockRaw === null || stockRaw === undefined || stockRaw === ""
        ? null
        : Math.floor(Number(stockRaw));

    if (name.length < 2) return jsonError("نام کالا حداقل ۲ نویسه باشد");
    if (name.length > 200) return jsonError("نام کالا حداکثر ۲۰۰ نویسه باشد");
    if (!Number.isFinite(price) || price < 0 || price > 500_000_000)
      return jsonError("قیمت فروش نامعتبر است (۰ تا ۵۰۰ میلیون ریال)");
    if (stock !== null && (!Number.isFinite(stock) || stock < 0))
      return jsonError("موجودی نامعتبر است");

    // هلو: کد کالا همان بارکد است — ستون واحد «كد كالا» هر دو را پر می‌کند
    const holooCode = code ?? barcode;
    const finalCode = holooCode;
    const finalBarcode = holooCode;

    // یکتایی کد/بارکد
    if (finalCode) {
      const dup = await db.product.findFirst({ where: { code: finalCode } });
      if (dup) return jsonError(`این کد/بارکد قبلاً برای «${dup.name}» ثبت شده است`);
    }

    const product = await db.product.create({
      data: { name, unit: unit.slice(0, 40), code: finalCode, barcode: finalBarcode, category, price, stock },
    });

    await db.activityLog.create({
      data: {
        userId: manager.id,
        action: "product_create",
        detail: `ایجاد کالای جدید «${name}» — قیمت ${price} ریال${finalCode ? ` — کد/بارکد ${finalCode}` : ""}`,
        entityId: product.id,
      },
    });

    return jsonOk(serialize(product), 201);
  } catch (e) {
    return handleApiError(e);
  }
}

/** فهرست صفحه‌بندی‌شده بانک کالا (بدون ثبت در تاریخچه — عملیات خواندنی) */
async function listProducts(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20),
    100
  );
  const q = (sp.get("q") ?? "").trim();
  const category = (sp.get("category") ?? "").trim();

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (q) {
    const qDigits = digitsOnly(q);
    where.OR = [
      { name: { contains: q } },
      { barcode: { contains: qDigits.length >= 4 ? qDigits : q } },
      { code: { contains: q } },
      {
        extraBarcodes: {
          some: { code: { contains: qDigits.length >= 4 ? qDigits : q } },
        },
      },
    ];
  }
  if (category) where.category = category;

  const [products, total, categoryRows] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { extraBarcodes: { select: { code: true } } },
    }),
    db.product.count({ where }),
    db.product.findMany({
      where: { isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  const categories = categoryRows
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c))
    .sort((a, b) => a.localeCompare(b, "fa"));

  return jsonOk({
    products: products.map((p) => serialize(p, p.extraBarcodes.map((e) => e.code))),
    total,
    page,
    pageSize,
    categories,
  });
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
  },
  extraBarcodes: string[] = []
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
    extraBarcodes,
  };
}
