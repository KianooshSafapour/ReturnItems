// اعمال مجوزهای عملیاتی + حساب صندوقدارهای جدید — بدون حذف هیچ داده‌ای (idempotent)
// اجرا: bun scripts/apply-users.ts
// صندوقدارها (به‌گفته آقای نوروزی): خانم لطفی (مدیر کل)، خانم درویشی، خانم محمدی پور،
// خانم شریفی، خانم غلامحسینی، خانم عرب‌نژاد، خانم یادگاری، خانم ایران‌نژاد، خانم رضایی، خانم سعدی
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient({ log: ["warn", "error"] });

interface UserSpec {
  username: string;
  password?: string;
  fullName: string;
  role: "admin" | "gm" | "owner" | "cashier";
  title?: string;
  canActAsCashier: boolean;
  canApproveReturns: boolean;
  canRecordPayment: boolean;
}

// همه صندوقدارها + حساب‌های مدیریتی موجود — upsert توسط نام کاربری
const USERS: UserSpec[] = [
  {
    username: "kianoosh",
    password: "@@HZ6677",
    fullName: "کیانوش صفاپور",
    role: "admin",
    title: "مدیر ارشد سامانه",
    canActAsCashier: true,
    canApproveReturns: true,
    canRecordPayment: true,
  },
  {
    username: "norouzi",
    password: "123456",
    fullName: "جواد نوروزی بهجت",
    role: "owner",
    title: "مدیر فروشگاه (مالک)",
    canActAsCashier: false,
    canApproveReturns: true,
    canRecordPayment: true,
  },
  {
    // خانم حدیث لطفی — مدیر کل که خودش هم صندوقداری می‌کند
    username: "lotfi",
    password: "123456",
    fullName: "حدیث لطفی",
    role: "gm",
    title: "مدیر کل + صندوقدار",
    canActAsCashier: true,
    canApproveReturns: true,
    canRecordPayment: false,
  },
  {
    username: "mohammadi",
    password: "123456",
    fullName: "آزاده محمدی پور",
    role: "cashier",
    title: "صندوقدار ارشد",
    canActAsCashier: true,
    canApproveReturns: false,
    canRecordPayment: false,
  },
  // ---- صندوقدارهای جدید (گذرواژه پیش‌فرض ۱۲۳۴۵۶ — قابل تغییر) ----
  { username: "darvishi", password: "123456", fullName: "فاطمه درویشی", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "sharifi", password: "123456", fullName: "فاطمه شریفی", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "gholamhosseini", password: "123456", fullName: "مهتاب غلامحسینی", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "arabnezhad", password: "123456", fullName: "مائده عرب نژاد", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "yadegari", password: "123456", fullName: "مهلا یادگاری", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "irannezhad", password: "123456", fullName: "عاطفه ایران نژاد", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "rezaie", password: "123456", fullName: "فاطمه رضایی", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  { username: "saadi", password: "123456", fullName: "فائزه سعدی", role: "cashier", canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
];

async function main() {
  console.log("👤 اعمال حساب‌ها و مجوزهای عملیاتی (بدون حذف داده)…");

  let created = 0;
  let updated = 0;
  for (const u of USERS) {
    const existing = await db.user.findUnique({ where: { username: u.username } });
    const perms = {
      canActAsCashier: u.canActAsCashier,
      canApproveReturns: u.canApproveReturns,
      canRecordPayment: u.canRecordPayment,
    };
    if (!existing) {
      await db.user.create({
        data: {
          username: u.username,
          passwordHash: hashPassword(u.password ?? "123456"),
          fullName: u.fullName,
          role: u.role,
          ...perms,
        },
      });
      created++;
      console.log(`  + ${u.username} («${u.fullName}») ساخته شد${u.title ? ` — ${u.title}` : ""}`);
    } else {
      // مشخصات/مجوزها را به‌روز می‌کنیم اما گذرواژه را دست نمی‌زنیم (اگر کاربر عوض کرده)
      await db.user.update({
        where: { id: existing.id },
        data: {
          fullName: u.fullName,
          role: u.role,
          isActive: true,
          ...perms,
        },
      });
      updated++;
      console.log(`  ↔ ${u.username} به‌روز شد${u.title ? ` — ${u.title}` : ""}`);
    }
  }

  // ---- دفترچه مشتریان: ساخت رکورد مشتری از مرجوعی‌های موجود (لایه دوم پیامک) ----
  const phones = await db.returnRequest.findMany({
    select: { customerPhone: true, customerName: true },
    distinct: ["customerPhone"],
  });
  let customersCreated = 0;
  for (const p of phones) {
    const exists = await db.customer.findUnique({ where: { phone: p.customerPhone } });
    if (!exists) {
      await db.customer.create({
        data: { phone: p.customerPhone, name: p.customerName },
      });
      customersCreated++;
    } else if (exists.name !== p.customerName) {
      await db.customer.update({
        where: { phone: p.customerPhone },
        data: { name: p.customerName },
      });
    }
  }

  await db.activityLog.create({
    data: {
      action: "permissions_apply",
      detail: `اعمال مجوزهای عملیاتی و ${created} حساب صندوقدار جدید — کلیدهای لایه دوگانه پیامک فعال شد`,
    },
  });

  console.log(`\n✅ ${created} حساب جدید، ${updated} حساب به‌روز، ${customersCreated} رکورد مشتری ساخته شد.`);
  console.log("   صندوقدارها با مجوز ثبت مرجوعی: " + USERS.filter((u) => u.canActAsCashier).length + " نفر");
  console.log("   ثبت پرداخت (فرم پرداخت): آقای نوروزی + کیانوش — خانم لطفی پیش‌فرض ندارد");
}

main()
  .catch((e) => {
    console.error("خطا:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
