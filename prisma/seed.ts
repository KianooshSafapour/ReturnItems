// بازسازی پایگاه داده — نسخه نهایی
// حذف کامل داده‌های نمونه و راه‌اندازی مجدد با:
//   ۱. چهار حساب واقعی: مدیر ارشد (کیانوش صفاپور) / مدیر کل (حدیث لطفی) / مدیر فروشگاه (جواد نوروزی بهجت) / صندوقدار (آزاده محمدی پور)
//   ۲. بانک کالا فقط از فایل inventory.xlsx (خروجی رسمی هلو APEX — بارکد = كد كالا)
//   ۳. چهار قالب پیامک پیش‌فرض (مرجوعی/اختلاف قیمت/خطای کارت‌خوان/سایر)
// اجرا: bun run prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { hashPassword } from "../src/lib/password";
import { parseProductWorkbook } from "../src/lib/holoo";

const db = new PrismaClient({ log: ["warn", "error"] });

const XLSX_PATH = "/home/z/my-project/upload/inventory.xlsx";

async function main() {
  console.log("🔄 شروع بازسازی پایگاه داده هایپر زیتون…");

  // ---- ۱) پاک‌سازی کامل داده‌های قبلی (نمونه/آزمایشی) ----
  console.log("① پاک‌سازی کامل داده‌های قدیمی…");
  await db.smsLog.deleteMany();
  await db.payment.deleteMany();
  await db.returnItem.deleteMany();
  await db.returnRequest.deleteMany();
  await db.activityLog.deleteMany();
  await db.product.deleteMany();
  await db.user.deleteMany();
  await db.smsTemplate.deleteMany();

  // ---- ۲) چهار حساب واقعی ----
  console.log("② ایجاد چهار حساب اصلی…");
  const kianoosh = await db.user.create({
    data: {
      username: "kianoosh",
      passwordHash: hashPassword("@@HZ6677"),
      fullName: "کیانوش صفاپور",
      role: "admin",
    },
  });
  const lotfi = await db.user.create({
    data: {
      username: "lotfi",
      passwordHash: hashPassword("123456"),
      fullName: "حدیث لطفی",
      role: "gm",
    },
  });
  const norouzi = await db.user.create({
    data: {
      username: "norouzi",
      passwordHash: hashPassword("123456"),
      fullName: "جواد نوروزی بهجت",
      role: "owner",
    },
  });
  const mohammadi = await db.user.create({
    data: {
      username: "mohammadi",
      passwordHash: hashPassword("123456"),
      fullName: "آزاده محمدی پور",
      role: "cashier",
    },
  });
  console.log(
    `   ✓ مدیر ارشد: kianoosh (@@HZ6677) — ${kianoosh.fullName}`,
    `\n   ✓ مدیر کل: lotfi (123456) — ${lotfi.fullName}`,
    `\n   ✓ مدیر فروشگاه: norouzi (123456) — ${norouzi.fullName}`,
    `\n   ✓ صندوقدار: mohammadi (123456) — ${mohammadi.fullName}`
  );

  // ---- ۳) بانک کالا از فایل هلو ----
  console.log("③ ورود بانک کالا از فایل هلو APEX…");
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`فایل هلو یافت نشد: ${XLSX_PATH}`);
  }
  const buf = fs.readFileSync(XLSX_PATH);
  const parsed = parseProductWorkbook(buf);
  console.log(
    `   فایل: ${path.basename(XLSX_PATH)} — ${parsed.totalRows} سطر، ${parsed.products.length} کالای معتبر`
  );

  let created = 0;
  const seen = new Set<string>();
  const creates: Array<{
    code: string | null;
    barcode: string | null;
    name: string;
    unit: string;
    price: number;
    stock: number | null;
    category: string | null;
  }> = [];

  for (const p of parsed.products) {
    const key = p.barcode ?? p.code ?? `name:${p.name}`;
    if (seen.has(key)) continue; // تکراری داخل فایل
    seen.add(key);
    creates.push({
      code: p.code,
      barcode: p.barcode,
      name: p.name,
      unit: p.unit,
      price: p.price,
      stock: p.stock,
      category: p.category,
    });
  }

  for (let i = 0; i < creates.length; i += 500) {
    const chunk = creates.slice(i, i + 500);
    await db.$transaction(chunk.map((d) => db.product.create({ data: d })));
    created += chunk.length;
    console.log(`   ✓ ${created}/${creates.length}`);
  }

  // ---- ۴) قالب‌های پیامک پیش‌فرض ----
  console.log("④ ثبت چهار قالب پیامک پیش‌فرض…");
  const templates = [
    {
      title: "مرجوعی کالا",
      body: "{{مشتری}} عزیز، وجه مرجوعی کالای شما به مبلغ {{مبلغ_تومان}} تومان با شماره پیگیری {{شماره_پیگیری}} پرداخت شد.\nاز اعتماد شما سپاسگزاریم — {{فروشگاه}}",
      sortOrder: 1,
    },
    {
      title: "اختلاف قیمت",
      body: "{{مشتری}} عزیز، اختلاف قیمت فاکتور خرید شما نسبت به قیمت درج‌شده روی کالا، مبلغ {{مبلغ_تومان}} تومان با پیگیری {{شماره_پیگیری}} به حساب شما بازگردانده شد.\n{{فروشگاه}}",
      sortOrder: 2,
    },
    {
      title: "خطای کارت‌خوان صندوقدار",
      body: "{{مشتری}} عزیز، مبلغ {{مبلغ_تومان}} تومان بابت خطای رخ‌داده هنگام کارت‌خوان، با شماره پیگیری {{شماره_پیگیری}} به حساب شما برگشت داده شد.\n{{فروشگاه}}",
      sortOrder: 3,
    },
    {
      title: "سایر موارد",
      body: "{{مشتری}} عزیز، مبلغ {{مبلغ_تومان}} تومان با شماره پیگیری {{شماره_پیگیری}} به حساب شما واریز شد.\n{{فروشگاه}}",
      sortOrder: 4,
    },
  ];
  for (const t of templates) {
    await db.smsTemplate.create({ data: t });
  }
  console.log(`   ✓ ${templates.length} قالب پیامک ثبت شد`);

  // ---- ۵) تنظیمات فروشگاه (برندینگ حفظ می‌شود؛ نام مدیر اصلاح شد) ----
  console.log("⑤ به‌روزرسانی تنظیمات…");
  await db.setting.upsert({
    where: { key: "managerName" },
    create: { key: "managerName", value: "جواد نوروزی بهجت" },
    update: { value: "جواد نوروزی بهجت" },
  });
  await db.setting.upsert({
    where: { key: "storeName" },
    create: { key: "storeName", value: "هایپر زیتون" },
    update: {},
  });

  // ---- ۶) ثبت فعالیت راه‌اندازی ----
  await db.activityLog.create({
    data: {
      userId: kianoosh.id,
      action: "db_reset",
      detail: `بازسازی رسمی پایگاه داده: ۳ حساب کاربری، ${created} کالا از فایل هلو (inventory.xlsx) و ۴ قالب پیامک`,
    },
  });

  console.log("\n✅ بازسازی پایگاه داده کامل شد:");
  console.log(`   کاربران: ۴ | کالاها: ${created} | قالب پیامک: ۴`);
  console.log(
    "   حساب‌ها → kianoosh/@@HZ6677 · lotfi/123456 (مدیر کل) · norouzi/123456 · mohammadi/123456"
  );
}

main()
  .catch((e) => {
    console.error("❌ خطا در بازسازی:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
