// سرویس پیامک آزمایشی (شبیه‌ساز پنل) — برای تست یکپارچه ارسال پیامک در محیط توسعه
// پورت ۳۰۴۰ — POST /send پاسخ موفق به سبک IPPanel برمی‌گرداند
// در محیط واقعی از پنل پیامکی (فراز/ملی پیامک/...) استفاده می‌شود؛ این سرویس فقط برای QA داخلی است
import Bun from "bun";

const PORT = 3040;

interface SendBody {
  from_number?: string;
  message?: string;
  sending_type?: string;
  params?: { recipients?: string[] };
  [k: string]: unknown;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "mock-sms", port: PORT });
    }

    if (req.method === "POST" && url.pathname === "/send") {
      let body: SendBody = {};
      try {
        body = (await req.json()) as SendBody;
      } catch {
        /* بدنه خالی هم قابل قبول است */
      }
      const recipient = body.params?.recipients?.[0] ?? body.to ?? body.To ?? "";
      const message = body.message ?? body.Message ?? body.Text ?? "";
      const id = Date.now();

      console.log(
        `[mock-sms] 📱 ارسال شبیه‌سازی‌شده → گیرنده: ${recipient} | متن: ${String(message).slice(0, 120)}…`
      );

      // پاسخ به سبک IPPanel edge (فراز اس‌ام‌اس)
      return Response.json({
        data: { message_outbox_ids: [id] },
        meta: { status: true, message: "انجام شد", message_parameters: [], message_code: "200-1" },
      });
    }

    return Response.json({ error: "مسیر یافت نشد" }, { status: 404 });
  },
});

console.log(`🟢 سرویس پیامک آزمایشی روی پورت ${PORT} روشن شد (POST /send)`);
export default server;
