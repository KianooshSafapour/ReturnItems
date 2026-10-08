// شبیه‌ساز Bixolon — نسخهٔ دوم با ثبت کامل dataURL برای بازرسی تصویر رسید
Bun.serve({
  port: 18080,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return new Response("not found", { status: 404, headers: cors });
    const body = await req.json().catch(() => null);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[1] !== "Printer1") return new Response(JSON.stringify({ error: "printer not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    if (parts[2] !== "checkStatus" && body?.functions) {
      const bm = body.functions.func0?.printBitmap;
      if (bm && typeof bm[0] === "string") await Bun.write("/tmp/receipt-bitmap.png.b64", bm[0]);
      await Bun.write("/tmp/receipt-job.json", JSON.stringify({ id: body.id, keys: Object.keys(body.functions), cut: body.functions.func1?.cutPaper }));
    }
    const id = Number(body?.RequestID ?? body?.id ?? 1);
    return new Response(JSON.stringify({ RequestID: id, ResponseID: id, Result: parts[2] === "checkStatus" ? "printed" : "progress" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
});
console.log("mock-bixolon2 on 18080");
