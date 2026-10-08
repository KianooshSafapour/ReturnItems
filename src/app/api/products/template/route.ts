import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";
import { generateProductTemplate } from "@/lib/holoo";

/** دانلود فایل نمونه اکسل — دقیقاً قالب رسمی خروجی هلو APEX (۹ ستون، BIFF8 .xls) */
export async function GET() {
  try {
    await requireUser();
    const buf = generateProductTemplate();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": 'attachment; filename="hyper-zeytoon-holoo-template.xls"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
