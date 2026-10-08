import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { canSubmitReturns, requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api-helpers";
import { returnCodeFromDate } from "@/lib/jalali";
import { digitsOnly, isValidCardNumber, isValidIranMobile } from "@/lib/validators";
import { ensureUniqueBarcodes } from "@/lib/barcode";
import { notifyCustomerOfSubmission } from "@/lib/sms-alerts";
import { Prisma } from "@prisma/client";

/** فهرست مرجوعی‌ها — صندوقدار: فقط خودش، مدیر: همه */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status"); // pending | paid | all
    const q = (sp.get("q") ?? "").trim();
    const page = Math.max(parseInt(sp.get("page") ?? "1", 10) || 1, 1);
    const pageSize = Math.min(parseInt(sp.get("pageSize") ?? "20", 10) || 20, 50);
    // بازه تاریخ ثبت — from/to (رشته ISO)؛ اگر to ساعت نداشت، تا پایان همان روز لحاظ می‌شود
    const from = sp.get("from");
    const to = sp.get("to");

    const where: Prisma.ReturnRequestWhereInput = {};
    // mine=1 → فقط مرجوعی‌های ثبت‌شده توسط خود کاربر (برای مدیرانِ صندوقدار)
    if (user.role === "cashier" || sp.get("mine") === "1") where.cashierId = user.id;
    if (status === "pending" || status === "paid" || status === "approved") where.status = status;
    // active = در جریان: هم در انتظار تأیید مدیر کل، هم در انتظار انتقال وجه
    else if (status === "active") where.status = { in: ["pending", "approved"] };
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: digitsOnly(q) || q } },
        { items: { some: { name: { contains: q } } } },
      ];
    }

    // ---- فیلتر بازه زمانی ثبت (submittedAt) — تاریخ‌های نامعتبر بی‌اثرند ----
    const submittedAt: Prisma.DateTimeFilter = {};
    if (from) {
      const fd = new Date(from);
      if (!isNaN(fd.getTime())) submittedAt.gte = fd;
    }
    if (to) {
      const td = new Date(to);
      if (!isNaN(td.getTime())) {
        const isMidnight =
          td.getUTCHours() === 0 && td.getUTCMinutes() === 0 && td.getUTCSeconds() === 0;
        // نیمه‌شب = درخواست «تا آخر آن روز»؛ زمان‌دار = همان لحظه
        submittedAt.lte = isMidnight ? new Date(td.getTime() + 24 * 3600 * 1000 - 1) : td;
      }
    }
    if (submittedAt.gte !== undefined || submittedAt.lte !== undefined) {
      where.submittedAt = submittedAt;
    }

    const [total, rows] = await Promise.all([
      db.returnRequest.count({ where }),
      db.returnRequest.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          cashier: { select: { fullName: true, username: true } },
          _count: { select: { items: true } },
          payment: { select: { transferredAt: true, bankName: true, referenceNumber: true } },
        },
      }),
    ]);

    return jsonOk({
      total,
      page,
      pageSize,
      returns: rows.map((r) => ({
        id: r.id,
        code: r.code,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        totalAmount: r.totalAmount,
        exchangeValue: r.exchangeValue,
        transferAmount: r.transferAmount ?? r.totalAmount,
        settlementType: r.settlementType,
        status: r.status,
        cashierName: r.cashier.fullName,
        submittedAt: r.submittedAt,
        itemCount: r._count.items,
        payment: r.payment
          ? {
              bankName: r.payment.bankName,
              transferredAt: r.payment.transferredAt,
              referenceNumber: r.payment.referenceNumber,
            }
          : null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

interface ItemInput {
  productId?: string | null;
  name?: string;
  barcode?: string | null;
  code?: string | null;
  quantity?: number;
  unitPrice?: number;
}

/** مشتق نوع تسویه از مبالغ — full | exchange | partial | debt */
function deriveSettlementType(total: number, exchange: number, transfer: number) {
  if (exchange > total) return "debt";
  if (exchange > 0 && transfer + exchange === total) return "exchange";
  if (transfer + exchange < total) return "partial";
  return "full";
}

/** ثبت مرجوعی جدید — توسط صندوقدارها و مدیران دارای مجوز «ثبت مرجوعی» (canActAsCashier) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canSubmitReturns(user))
      return jsonError(
        "ثبت مرجوعی برای صندوقدارها و مدیران دارای مجوز «صندوقداری» مجاز است — این مجوز را از بخش کاربران دریافت کنید",
        403
      );
    const body = await req.json().catch(() => null);

    const customerName = String(body?.customerName ?? "").trim();
    const customerPhone = digitsOnly(String(body?.customerPhone ?? ""));
    const customerCardNumber = digitsOnly(String(body?.customerCardNumber ?? ""));
    const purchaseAt = new Date(body?.purchaseAt ?? "");
    const reason = String(body?.reason ?? "").trim();
    const note = String(body?.note ?? "").trim() || null;
    const items: ItemInput[] = Array.isArray(body?.items) ? body.items : [];

    // ---- تسویه با مشتری ----
    const exchangeValue = Math.max(
      0,
      Math.min(Math.floor(Number(body?.exchangeValue ?? 0)) || 0, 2_000_000_000)
    );
    const transferAmount = Math.max(
      0,
      Math.min(Math.floor(Number(body?.transferAmount ?? 0)) || 0, 2_000_000_000)
    );
    const transferNote = String(body?.transferNote ?? "").trim().slice(0, 500) || null;

    if (customerName.length < 2) return jsonError("نام مشتری را کامل وارد کنید");
    if (!isValidIranMobile(customerPhone))
      return jsonError("شماره موبایل مشتری معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
    if (!isValidCardNumber(customerCardNumber))
      return jsonError("شماره کارت بانکی مشتری معتبر نیست (۱۶ رقم با الگوریتم لان)");
    if (isNaN(purchaseAt.getTime())) return jsonError("زمان خرید مشتری را انتخاب کنید");
    if (purchaseAt.getTime() > Date.now() + 60_000)
      return jsonError("زمان خرید نمی‌تواند در آینده باشد");
    if (reason.length < 2) return jsonError("دلیل مرجوعی را انتخاب یا بنویسید");
    if (items.length === 0) return jsonError("حداقل یک کالا به فهرست مرجوعی اضافه کنید");

    const cleanItems: Array<{
      productId: string | null;
      name: string;
      barcode: string | null;
      code: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];
    for (const it of items) {
      const name = String(it.name ?? "").trim();
      // مقدار اعشاری مجاز است — کالاهای وزنی (سوسیس/آجیل/خواربار) با ترازو توزین می‌شوند
      const quantity = Math.round(Number(it.quantity ?? 0) * 1000) / 1000;
      const unitPrice = Math.floor(Number(it.unitPrice ?? 0));
      if (!name) return jsonError("نام یکی از اقلام خالی است");
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999)
        return jsonError(`مقدار کالای «${name}» نامعتبر است — عددی بزرگ‌تر از صفر (حتی اعشاری مثل ۰٫۵) وارد کنید`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 500000000)
        return jsonError(`قیمت کالای «${name}» نامعتبر است`);
      const barcode = it.barcode ? digitsOnly(String(it.barcode)) || null : null;
      cleanItems.push({
        productId: it.productId ?? null,
        name: name.slice(0, 200),
        barcode,
        code: it.code ? String(it.code) : null,
        quantity,
        unitPrice,
        lineTotal: Math.round(quantity * unitPrice),
      });
    }

    // ---- بارکد برای همه اقلام: جایگزینی بارکد غایب/تکراری با بارکد داخلی EAN-13 ----
    const uniqueBarcodes = ensureUniqueBarcodes(cleanItems);
    cleanItems.forEach((it, i) => {
      it.barcode = uniqueBarcodes[i];
    });

    const totalAmount = cleanItems.reduce((s, i) => s + i.lineTotal, 0);
    if (totalAmount > 2000000000)
      return jsonError("مبلغ کل مرجوعی از سقف مجاز بیشتر است");

    // ---- اعتبارسنجی منطق تسویه ----
    if (exchangeValue > totalAmount && transferAmount > 0)
      return jsonError(
        "وقتی ارزش کالای جایگزین از جمع مرجوعی بیشتر است (بدهی مشتری)، انتقال وجه امکان‌پذیر نیست — مبلغ انتقالی را صفر کنید"
      );
    if (exchangeValue <= totalAmount && transferAmount > totalAmount - exchangeValue)
      return jsonError(
        "مبلغ قابل انتقال نمی‌تواند از «جمع اقلام منهای ارزش کالای جایگزین» بیشتر باشد"
      );
    if (transferAmount + exchangeValue < totalAmount && !transferNote)
      return jsonError(
        "مبلغ انتقالی کمتر از ارزش اقلام است — دلیل کسری/اعتبار مشتری را در توضیح تسویه بنویسید"
      );
    if (exchangeValue > totalAmount && !transferNote)
      return jsonError(
        "ارزش کالای جایگزین از جمع مرجوعی بیشتر است — توضیح بدهی مشتری را در توضیح تسویه بنویسید"
      );
    const settlementType = deriveSettlementType(totalAmount, exchangeValue, transferAmount);

    // شماره پیگیری یکتا
    let code = returnCodeFromDate(new Date(), 1);
    for (let attempt = 0; attempt < 6; attempt++) {
      const seq = (await db.returnRequest.count({})) + 1 + attempt * 37;
      code = returnCodeFromDate(new Date(), seq);
      const exists = await db.returnRequest.findUnique({ where: { code } });
      if (!exists) break;
    }

    const created = await db.returnRequest.create({
      data: {
        code,
        customerName: customerName.slice(0, 120),
        customerPhone,
        customerCardNumber,
        purchaseAt,
        reason: reason.slice(0, 300),
        note,
        totalAmount,
        exchangeValue,
        transferAmount,
        transferNote,
        settlementType,
        status: "pending",
        cashierId: user.id,
        items: { create: cleanItems },
      },
      include: { items: true, cashier: { select: { fullName: true } } },
    });

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "return_submit",
        detail:
          transferAmount !== totalAmount || exchangeValue > 0
            ? `ثبت مرجوعی ${code} برای ${customerName} — ${items.length} قلم (تسویه: ${settlementType}، انتقالی ${transferAmount} ریال)`
            : `ثبت مرجوعی ${code} برای ${customerName} — ${items.length} قلم`,
        entityId: created.id,
      },
    });

    // دفترچه مشتری — رکورد دائمی برای تنظیم پیامک هر مشتری (لایه دوم)
    await db.customer.upsert({
      where: { phone: customerPhone },
      create: { phone: customerPhone, name: customerName.slice(0, 120) },
      update: { name: customerName.slice(0, 120) },
    });

    // 📱 پیامک خودکار «مرجوعی ثبت شد» به مشتری — fire-and-forget (هرگز ثبت را خراب نمی‌کند)
    // اطلاع مدیران در سامانه (زنگ اعلان) و پیامک «آماده پرداخت» پس از تأیید مدیر کل ارسال می‌شود
    void notifyCustomerOfSubmission({
      id: created.id,
      code: created.code,
      customerName: created.customerName,
      customerPhone: created.customerPhone,
      totalAmount: created.totalAmount,
      transferAmount,
      items: created.items.map((it) => ({ name: it.name, quantity: it.quantity })),
      cashierName: created.cashier.fullName,
    });

    return jsonOk(
      {
        id: created.id,
        code: created.code,
        totalAmount: created.totalAmount,
        transferAmount,
        exchangeValue,
        settlementType,
        submittedAt: created.submittedAt,
        itemCount: created.items.length,
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}
