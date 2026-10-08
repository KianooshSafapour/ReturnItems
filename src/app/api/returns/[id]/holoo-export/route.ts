import { db } from "@/lib/db";
import { requireUser, isManager } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-helpers";
import { generateHolooReturnDocument } from "@/lib/holoo";

/**
 * خروجی «برگشت از فروش» قابل ورود به هلو APEX — فایل .xls (Excel 97-2003)
 * با ستون‌های رسمی هلو: «نام کالا» / «متراژ/تعداد» / «فی» — نام شیت انگلیسی.
 * در هلو: فرم فاکتور برگشت از فروش باز می‌شود، طرف حساب/تاریخ دستی انتخاب می‌شود و
 * سطرهای اقلام با راست‌کلیک ← اکسل ← ورود اطلاعات از فایل اکسل، از همین فایل می‌آیند.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isManager(user))
      return jsonError("خروجی هلو تنها برای مدیران مجاز است", 403);

    const { id } = await params;
    const r = await db.returnRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) return jsonError("مرجوعی یافت نشد", 404);
    if (user.role === "cashier" && r.cashierId !== user.id)
      return jsonError("دسترسی به این مرجوعی ندارید", 403);

    const buf = generateHolooReturnDocument(
      r.code,
      r.items.map((it) => ({
        name: it.name, // نام دقیق کالا از بانک هلو (شناسه ورود در هلو)
        quantity: it.quantity, // مثبت — اعشار کالای وزنی
        unitPrice: it.unitPrice, // ریال
      }))
    );

    // نام فایل انگلیسی (الزام هلو) — از کد مرجوعی
    const fileName = `hz-return-${r.code.replace(/[^A-Za-z0-9-]/g, "")}.xls`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
