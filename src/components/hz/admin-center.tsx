"use client";

// مرکز مدیریت سامانه — ویژه مدیر ارشد سامانه (کیانوش صفاپور) و مدیر فروشگاه (آقای نوروزی)
// چهار زبانه: نمای کلی / تنظیمات فروشگاه / مدیریت بانک کالا / کاربران و نقش‌ها
// توسعه: کیانوش صفاپور (Kianoosh Safapour)

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, type Variants } from "framer-motion";
import {
  Activity as ActivityIcon,
  Barcode as BarcodeIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudOff,
  Database,
  DatabaseBackup,
  HandCoins,
  HardDrive,
  Info,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { formatMoney, formatToman, toEnDigits, toFaDigits } from "@/lib/money";
import { formatJalaliFull } from "@/lib/jalali";
import { digitsOnly } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { MoneyDisplay, MoneyInput } from "./money-input";
import { IlluminatedDivider } from "./ornaments";
import { SmsCenter } from "./sms-center";
import { UsersView } from "./users-view";
import {
  SETTLEMENT_META,
  type AdminOverviewDTO,
  type ProductDTO,
  type SessionUser,
  type SettlementType,
  type StoreSettings,
} from "./types";

const PAGE_SIZE = 20;

/** قالب‌بندی حجم پایگاه داده با رقم فارسی — «۲٫۰ مگابایت» */
function formatDbSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes >= 1048576) return `${toFaDigits((bytes / 1048576).toFixed(1).replace(".", "٫"))} مگابایت`;
  if (bytes >= 1024) return `${toFaDigits(Math.round(bytes / 1024))} کیلوبایت`;
  return `${toFaDigits(Math.round(bytes))} بایت`;
}

/* ---------- انیمیشن‌های کارت‌های آماری (هم‌ریخت با داشبورد مدیریت) ---------- */

const statGridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

/** رنگ قاب تراش نوع تسویه */
const SETTLEMENT_CHIP: Record<SettlementType, string> = {
  full: "border-primary/25 bg-primary/5",
  exchange: "border-chart-1/25 bg-chart-1/5",
  partial: "border-chart-3/30 bg-chart-3/5",
  debt: "border-destructive/30 bg-destructive/5",
};

/** رنگ شمارنده نوع تسویه */
const SETTLEMENT_COUNT: Record<SettlementType, string> = {
  full: "text-primary",
  exchange: "text-chart-1",
  partial: "text-chart-3",
  debt: "text-destructive",
};

/* ==========================================================================
   مرکز مدیریت سامانه — ریشه چهارزبانه
   ========================================================================== */

/** مرکز مدیریت سامانه — فقط برای نقش‌های مدیریتی (مدیر ارشد / مدیر فروشگاه) رندر می‌شود */
export function AdminCenter({ user, onChanged }: { user: SessionUser; onChanged?: () => void }) {
  const [tab, setTab] = useState("overview");

  return (
    <section aria-label="مرکز مدیریت سامانه" className="space-y-5">
      {/* سربرگ اختصاصی */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="glow-pistachio flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-chart-2">ویژه آقای نوروزی و کیانوش صفاپور</p>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl">
              مرکز مدیریت سامانه
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
              نمای کلی، تنظیمات فروشگاه، بانک کالا و کاربران — همه‌جا در یک مرکز
            </p>
          </div>
        </div>
        <IlluminatedDivider />
      </motion.header>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="h-auto w-full sm:w-fit p-1.5 flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="h-9 px-4 text-sm gap-1.5">
            <LayoutDashboard className="size-4" />
            نمای کلی
          </TabsTrigger>
          <TabsTrigger value="settings" className="h-9 px-4 text-sm gap-1.5">
            <Settings className="size-4" />
            تنظیمات فروشگاه
          </TabsTrigger>
          <TabsTrigger value="sms" className="h-9 px-4 text-sm gap-1.5">
            <MessageCircle className="size-4" />
            پیامک
          </TabsTrigger>
          <TabsTrigger value="bank" className="h-9 px-4 text-sm gap-1.5">
            <Database className="size-4" />
            مدیریت بانک کالا
          </TabsTrigger>
          <TabsTrigger value="users" className="h-9 px-4 text-sm gap-1.5">
            <Users className="size-4" />
            کاربران و نقش‌ها
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="sms">
          <SmsCenter user={user} />
        </TabsContent>
        <TabsContent value="bank">
          <ProductBankAdminTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersRolesTab user={user} onChanged={onChanged} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/* ==========================================================================
   زبانه ۱ — نمای کلی سامانه
   ========================================================================== */

function OverviewTab() {
  const [data, setData] = useState<AdminOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  async function handleBackup() {
    if (backingUp) return;
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error || "پشتیبان‌گیری ناموفق بود");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hyper-zeytoon-backup-${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("پشتیبان پایگاه داده دانلود شد", {
        description: "فایل SQLite — در جای امن نگه دارید و به‌صورت دوره‌ای تکرار کنید",
      });
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setBackingUp(false);
    }
  }
  const dataRef = useRef<AdminOverviewDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const payload = (await res.json()) as AdminOverviewDTO | { error: string };
      if (!res.ok || "error" in payload) {
        const message = "error" in payload ? payload.error : "خطا در دریافت نمای کلی سامانه";
        if (dataRef.current) toast.error("به‌روزرسانی نمای کلی ناموفق بود");
        else setError(message);
        return;
      }
      dataRef.current = payload;
      setData(payload);
      setError(null);
    } catch {
      if (dataRef.current) toast.error("ارتباط با سرور برقرار نشد");
      else setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* اسکلتون بارگذاری اولیه */
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="در حال دریافت نمای کلی سامانه">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-14" />
                  </div>
                </div>
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* خطا (بدون داده) */
  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10">
              <CloudOff className="size-8 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <p className="font-extrabold">دریافت نمای کلی سامانه ناموفق بود</p>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => load()} className="font-semibold">
              <RefreshCw className="size-4" />
              تلاش دوباره
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!data) return null;

  const statCards = [
    {
      key: "users",
      title: "کاربران",
      icon: Users,
      iconClass: "border-primary/30 bg-primary/10 text-primary",
      count: data.users.total,
      unit: "حساب",
      sub: `${toFaDigits(data.users.active)} فعال · ${toFaDigits(data.users.managers)} مدیر · ${toFaDigits(data.users.cashiers)} صندوقدار`,
    },
    {
      key: "products",
      title: "کالاها",
      icon: Database,
      iconClass: "border-chart-4/30 bg-chart-4/10 text-chart-4",
      count: data.products.total,
      unit: "کالا",
      sub: `${toFaDigits(data.products.withBarcode)} با بارکد · ${toFaDigits(data.products.categories)} دسته`,
    },
    {
      key: "returns",
      title: "مرجوعی‌ها",
      icon: RotateCcw,
      iconClass: "border-chart-2/30 bg-chart-2/10 text-chart-2",
      count: data.returns.total,
      unit: "مورد",
      sub: `${toFaDigits(data.returns.pending)} در انتظار پرداخت · ${toFaDigits(data.returns.paid)} تسویه‌شده`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* دکمه به‌روزرسانی */}
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="h-9 font-semibold gap-1.5"
          aria-label="به‌روزرسانی نمای کلی سامانه"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {loading ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
        </Button>
      </div>

      {/* کارت‌های آماری */}
      <motion.div
        variants={statGridVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {statCards.map((s) => (
          <motion.div key={s.key} variants={statCardVariants} className="h-full">
            <Card className="group relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              <div
                aria-hidden="true"
                className="pattern-girih pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <CardContent className="relative flex h-full flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                      s.iconClass
                    )}
                  >
                    <s.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-muted-foreground">{s.title}</p>
                    <p className="num text-2xl font-extrabold leading-tight">
                      {toFaDigits(s.count)}
                      <span className="mr-1.5 text-xs font-medium text-muted-foreground">{s.unit}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-auto border-t border-dashed pt-3">
                  <p className="num text-[11px] leading-5 text-muted-foreground">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* پرداخت‌ها — شمارش + جمع مبلغ انتقالی */}
        <motion.div variants={statCardVariants} className="h-full">
          <Card className="group relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
            <div
              aria-hidden="true"
              className="pattern-girih pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <CardContent className="relative flex h-full flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-chart-3/30 bg-chart-3/10 text-chart-3">
                  <Wallet className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted-foreground">پرداخت‌ها</p>
                  <p className="num text-2xl font-extrabold leading-tight">
                    {toFaDigits(data.payments.count)}
                    <span className="mr-1.5 text-xs font-medium text-muted-foreground">پرداخت</span>
                  </p>
                </div>
              </div>
              <div className="mt-auto border-t border-dashed pt-3">
                <MoneyDisplay amount={data.payments.totalAmount} size="sm" showWords={false} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* تسویه‌ها + سلامت سامانه */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="grid gap-4 md:grid-cols-2"
      >
        {/* تفکیک تسویه‌ها */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              تسویه‌ها با مشتریان
            </CardTitle>
            <CardDescription>تفکیک انواع تسویه در کل مرجوعی‌های ثبت‌شده</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(Object.keys(SETTLEMENT_META) as SettlementType[]).map((t) => (
                <div
                  key={t}
                  className={cn("rounded-xl border px-2.5 py-3 text-center", SETTLEMENT_CHIP[t])}
                  title={SETTLEMENT_META[t].hint}
                >
                  <p className={cn("num text-xl font-extrabold leading-tight", SETTLEMENT_COUNT[t])}>
                    {toFaDigits(data.settlement[t])}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    {SETTLEMENT_META[t].label}
                  </p>
                </div>
              ))}
            </div>

            {data.settlement.debtTotal > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <TriangleAlert className="size-4 text-destructive" />
                  بدهی مشتریان
                </span>
                <MoneyDisplay amount={data.settlement.debtTotal} size="sm" showWords={false} />
              </div>
            )}
            {data.settlement.customerCreditTotal > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-chart-2/30 bg-chart-2/5 px-4 py-3">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <HandCoins className="size-4 text-chart-2" />
                  اعتبار باقی‌مانده مشتریان
                </span>
                <MoneyDisplay amount={data.settlement.customerCreditTotal} size="sm" showWords={false} />
              </div>
            )}
            {data.settlement.debtTotal === 0 && data.settlement.customerCreditTotal === 0 && (
              <p className="text-xs leading-6 text-muted-foreground">
                بدهی یا اعتبار باقی‌مانده‌ای برای مشتریان ثبت نشده است.
              </p>
            )}
          </CardContent>
        </Card>

        {/* سلامت سامانه */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4 text-primary" />
              سلامت سامانه
            </CardTitle>
            <CardDescription>وضعیت لحظه‌ای فعالیت‌ها و پایگاه داده</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/60">
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ActivityIcon className="size-3.5 text-primary/70" />
                  کنش امروز
                </dt>
                <dd className="num text-sm font-extrabold">
                  {toFaDigits(data.activityToday)} رویداد
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <HardDrive className="size-3.5 text-primary/70" />
                  حجم پایگاه داده
                </dt>
                <dd className="num text-sm font-extrabold">{formatDbSize(data.dbSizeBytes)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock3 className="size-3.5 text-primary/70" />
                  زمان سرور
                </dt>
                <dd className="num text-xs font-bold leading-5 text-end">
                  {formatJalaliFull(new Date(data.serverTime))}
                </dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t border-border/60">
              <Button
                variant="outline"
                className="w-full h-11 gap-2 font-bold"
                onClick={handleBackup}
                disabled={backingUp}
              >
                {backingUp ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <DatabaseBackup className="size-4 text-primary" />
                )}
                {backingUp ? "در حال تهیه پشتیبان…" : "پشتیبان‌گیری از پایگاه داده"}
              </Button>
              <p className="text-[11px] text-muted-foreground leading-5 mt-2 text-center">
                اسنپ‌شات کامل SQLite شامل کالاها، مرجوعی‌ها، کاربران و تنظیمات
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   زبانه ۲ — تنظیمات فروشگاه (برندینگ سربرگ/پابرگ کل سامانه)
   ========================================================================== */

const SETTINGS_FIELDS: Array<{
  key: keyof StoreSettings;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { key: "storeName", label: "نام فروشگاه", placeholder: "مثلاً: هایپر زیتون" },
  { key: "storeCity", label: "شهر / نشانی", placeholder: "مثلاً: رفسنجان، کرمان" },
  { key: "managerName", label: "نام مدیر", placeholder: "مثلاً: آقای نوروزی" },
  { key: "developerCredit", label: "اعتبار توسعه‌دهنده", placeholder: "مثلاً: کیانوش صفاپور (Kianoosh Safapour)" },
];

function SettingsTab({ onChanged }: { onChanged?: () => void }) {
  const [saved, setSaved] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<StoreSettings>({
    storeName: "هایپر زیتون",
    storeCity: "رفسنجان، کرمان",
    storePhone: "",
    managerName: "آقای نوروزی",
    receiptFooter: "از خرید شما سپاسگزاریم — کالای مرجوعی تا ۷ روز پذیرفته می‌شود",
    developerCredit: "کیانوش صفاپور (Kianoosh Safapour)",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const payload = (await res.json()) as StoreSettings | { error: string };
      if (!res.ok || "error" in payload) {
        setError("error" in payload ? payload.error : "خطا در دریافت تنظیمات سامانه");
        return;
      }
      setSaved(payload);
      setForm(payload);
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: keyof StoreSettings, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty =
    saved !== null &&
    (Object.keys(form) as Array<keyof StoreSettings>).some(
      (k) => form[k].trim() !== (saved[k] ?? "").trim()
    );

  const reset = () => {
    if (!saved) return;
    setForm(saved);
  };

  const save = async () => {
    if (!saved || saving) return;
    const payload: Partial<StoreSettings> = {};
    (Object.keys(form) as Array<keyof StoreSettings>).forEach((k) => {
      const v = form[k].trim();
      if (v !== (saved[k] ?? "").trim()) payload[k] = v;
    });
    if (Object.keys(payload).length === 0) {
      toast.info("تغییری برای ذخیره وجود ندارد");
      return;
    }
    if (payload.storeName !== undefined && payload.storeName.length < 2) {
      toast.error("نام فروشگاه حداقل ۲ نویسه باشد");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as StoreSettings | { error: string };
      if (res.ok && !("error" in data)) {
        setSaved(data);
        setForm(data);
        toast.success("تنظیمات سامانه ذخیره شد");
        onChanged?.();
      } else {
        toast.error("error" in data ? data.error : "خطا در ذخیره تنظیمات");
      }
    } catch {
      toast.error("خطا در ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  };

  /* اسکلتون بارگذاری اولیه */
  if (loading && !saved) {
    return (
      <Card aria-busy="true" aria-label="در حال دریافت تنظیمات سامانه">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  /* خطا (بدون داده) */
  if (error && !saved) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10">
            <CloudOff className="size-8 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <p className="font-extrabold">دریافت تنظیمات سامانه ناموفق بود</p>
            <p className="text-sm leading-6 text-muted-foreground">{error}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => load()} className="font-semibold">
            <RefreshCw className="size-4" />
            تلاش دوباره
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* سربرگ زبانه */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-extrabold text-lg">
            <Settings className="size-5 text-primary" />
            تنظیمات فروشگاه
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-primary/70" />
            این تنظیمات در سربرگ و پابرگ کل سامانه اعمال می‌شود
          </p>
        </div>
        {dirty && (
          <Badge className="gap-1 border border-chart-4/40 bg-chart-4/10 text-chart-4">
            <TriangleAlert className="size-3" />
            غیرذخیره
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">مشخصات فروشگاه و سامانه</CardTitle>
          <CardDescription className="leading-6">
            نام و نشانی فروشگاه، تلفن، نام مدیر، متن پایین رسید و اعتبار توسعه‌دهنده — این مقادیر
            در سربرگ، پابرگ و برگه‌های سامانه استفاده می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SETTINGS_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`set-${f.key}`}>{f.label}</Label>
                <Input
                  id={`set-${f.key}`}
                  className="h-11"
                  maxLength={200}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              </div>
            ))}

            {/* تلفن فروشگاه — راست‌به‌چپ با قالب عددی */}
            <div className="space-y-2">
              <Label htmlFor="set-storePhone">تلفن فروشگاه</Label>
              <Input
                id="set-storePhone"
                className="h-11 num"
                inputMode="numeric"
                maxLength={20}
                placeholder="۰۳۴۱۲۳۴۵۶۷۸"
                value={form.storePhone}
                onChange={(e) => setField("storePhone", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">اختیاری — در سربرگ اسناد و رسیدها نمایش داده می‌شود</p>
            </div>
          </div>

          {/* متن پایین رسید */}
          <div className="space-y-2">
            <Label htmlFor="set-receiptFooter">متن پایین رسید</Label>
            <Textarea
              id="set-receiptFooter"
              rows={3}
              maxLength={300}
              placeholder="مثلاً: از خرید شما سپاسگزاریم — کالای مرجوعی تا ۷ روز پذیرفته می‌شود"
              value={form.receiptFooter}
              onChange={(e) => setField("receiptFooter", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              این متن در پایین رسید مرجوعی و برگه‌های چاپی درج می‌شود
            </p>
          </div>

          {/* عملیات */}
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4">
            <Button onClick={save} disabled={saving || !dirty} className="gap-1.5 font-semibold">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              ذخیره تنظیمات
            </Button>
            <Button variant="outline" onClick={reset} disabled={saving || !dirty} className="gap-1.5">
              <RotateCcw className="size-4" />
              بازنشانی
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ==========================================================================
   زبانه ۳ — مدیریت بانک کالا (افزودن/ویرایش کالا)
   ========================================================================== */

function ProductBankAdminTab() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: "list",
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (q.trim()) params.set("q", q.trim());
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.products ?? []);
        setTotal(data.total ?? 0);
        setCategories(data.categories ?? []);
      } else {
        toast.error(data.error || "خطا در دریافت بانک کالا");
      }
    } catch {
      toast.error("خطا در دریافت بانک کالا");
    } finally {
      setLoading(false);
    }
  }, [q, category, page]);

  // جستجو با تأخیر (debounce)
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // اگر پس از فیلتر شماره صفحه از مجموع بیشتر شد، به آخرین صفحه برمی‌گردیم
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProductDTO) => {
    setEditTarget(p);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* سربرگ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="flex items-center gap-2 font-extrabold text-lg">
            <Database className="size-5 text-primary" />
            مدیریت بانک کالا
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-chart-4" />
            تغییرات روی اسکن بارکد صندوقدارها اثر می‌گذارد
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5 font-semibold" onClick={openCreate}>
          <Plus className="size-4" />
          افزودن کالا
        </Button>
      </div>

      {/* فیلترها */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="جستجو در نام کالا، بارکد یا کد کالا…"
            className="ps-10 h-11"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-48">
            <SelectValue placeholder="همه دسته‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11 gap-1.5" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          به‌روزرسانی
        </Button>
      </div>

      {/* جدول بانک کالا */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
                <TableRow className="text-muted-foreground text-xs hover:bg-transparent">
                  <TableHead className="text-start font-semibold px-3 py-3 w-14">#</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">نام کالا</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">بارکد</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">کد کالا</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">دسته</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">قیمت فروش (ریال)</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">موجودی</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">وضعیت</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-14">
                      <div className="text-center text-muted-foreground">
                        <PackageSearch className="size-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold text-sm">کالایی یافت نشد</p>
                        <p className="text-xs mt-1 opacity-80">
                          نتیجه‌ای برای جستجوی شما نیست؛ می‌توانید کالای جدیدی افزود.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.25) }}
                      className="border-b last:border-0 hover:bg-accent/40 transition-colors"
                    >
                      <TableCell className="px-3 py-3 num text-xs text-muted-foreground">
                        {toFaDigits((page - 1) * PAGE_SIZE + i + 1)}
                      </TableCell>
                      <TableCell className="px-4 py-3 max-w-[280px]">
                        <p className="font-semibold truncate" title={p.name}>
                          {p.name}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.barcode ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="num text-xs text-muted-foreground" dir="ltr">
                              {toFaDigits(p.barcode)}
                            </span>
                            {(p.extraBarcodes?.length ?? 0) > 0 && (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="num gap-0.5 border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-bold text-primary"
                                    >
                                      <BarcodeIcon className="size-2.5" />+
                                      {toFaDigits(p.extraBarcodes!.length)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p className="font-bold mb-1">بارکدهای دیگر این کالا:</p>
                                    <p className="num" dir="ltr">
                                      {p.extraBarcodes!.map(toFaDigits).join(" · ")}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.code ? (
                          <span className="num text-xs" dir="ltr">
                            {toFaDigits(p.code)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.category ? (
                          <Badge variant="secondary" className="font-medium">
                            {p.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`num font-bold cursor-default border-b border-dotted border-primary/40 ${
                                  p.price > 0 ? "" : "text-muted-foreground"
                                }`}
                              >
                                {formatMoney(p.price)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="num text-xs">
                              معادل تومانی: {formatToman(p.price)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="px-4 py-3 num whitespace-nowrap">
                        {p.stock !== null ? (
                          <span
                            className={
                              p.stock > 0 ? "font-semibold" : "text-destructive font-semibold"
                            }
                          >
                            {toFaDigits(p.stock)}{" "}
                            <span className="text-xs text-muted-foreground font-normal">{p.unit}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">نامشخص</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className="gap-1 border border-primary/25 bg-primary/10 text-primary">
                          <CheckCircle2 className="size-3" />
                          فعال
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(p)}
                          aria-label={`ویرایش کالای ${p.name}`}
                          title={`ویرایش کالای ${p.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>

        {/* شمارش و صفحه‌بندی (راست‌به‌چپ: «قبلی» سمت راست) */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t bg-muted/30">
            <p className="num text-xs text-muted-foreground">
              نمایش {toFaDigits(from)} تا {toFaDigits(to)} از {toFaDigits(total)} کالا
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="صفحه قبل"
                >
                  <ChevronRight className="size-4" />
                  قبلی
                </Button>
                <span className="num text-sm font-bold px-2">
                  {toFaDigits(page)} / {toFaDigits(pages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="صفحه بعد"
                >
                  بعدی
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* پنجره افزودن/ویرایش کالا */}
      <EditProductDialog
        open={dialogOpen}
        target={editTarget}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditTarget(null);
        }}
        onSaved={() => load()}
      />
    </div>
  );
}

/* ---------------- پنجره افزودن/ویرایش کالا ---------------- */

interface ProductFormErrors {
  name?: string;
  barcode?: string;
  price?: string;
  stock?: string;
}

function EditProductDialog({
  open,
  target,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  target: ProductDTO | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const editMode = !!target;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  // کد = بارکد (منطق هلو) — مقدار واحد در هر دو فیلد نگه داشته می‌شود
  function setHolooCode(v: string) {
    // نرمال‌سازی ارقام فارسی/عربی به لاتین — کد کالا هلو همیشه ارقام لاتین ذخیره می‌شود
    const normalized = toEnDigits(v).replace(/[^\d]/g, "").slice(0, 40);
    setCode(normalized);
    setBarcode(normalized);
  }
  const [unit, setUnit] = useState("عدد");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState("");
  const [isActive, setIsActive] = useState(true);
  // بارکدهای جایگزین (هلو: کالایی که چند «كد كالا» دارد)
  const [extraBarcodes, setExtraBarcodes] = useState<string[]>([]);
  const [newBarcode, setNewBarcode] = useState("");
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // افزودن بارکد جایگزین — اعتبارسنجی درجا: حداقل ۴ رقم، تکراری نباشد، با کد اصلی یکی نباشد
  function addExtraBarcode() {
    const b = toEnDigits(newBarcode).replace(/[^\d]/g, "");
    if (b.length < 4) {
      toast.error("بارکد جایگزین باید حداقل ۴ رقم باشد");
      return;
    }
    const main = toEnDigits(code).replace(/[^\d]/g, "") || toEnDigits(barcode).replace(/[^\d]/g, "");
    if (b === main) {
      toast.error("این همان کد/بارکد اصلی کالا است — بارکد دیگری وارد کنید");
      return;
    }
    if (extraBarcodes.includes(b)) {
      toast.error("این بارکد قبلاً اضافه شده است");
      return;
    }
    setExtraBarcodes((list) => [...list, b]);
    setNewBarcode("");
  }

  // بازنشانی فرم هنگام گشودن پنجره (ایجاد یا ویرایش)
  useEffect(() => {
    if (open) {
      setName(target?.name ?? "");
      // هلو: کد = بارکد — مقدار هدف را در هر دو فیلد می‌گذاریم
      const holooCode = target?.code ?? target?.barcode ?? "";
      setCode(holooCode);
      setBarcode(holooCode);
      setUnit(target?.unit ?? "عدد");
      setCategory(target?.category ?? "");
      setPrice(target?.price ?? 0);
      setStock(
        target?.stock !== null && target?.stock !== undefined ? String(target.stock) : ""
      );
      setExtraBarcodes(target?.extraBarcodes ? [...target.extraBarcodes] : []);
      setNewBarcode("");
      setIsActive(true); // فهرست فقط کالاهای فعال را نشان می‌دهد
      setErrors({});
      setApiError(null);
    }
  }, [open, target]);

  const validate = (): boolean => {
    const e: ProductFormErrors = {};
    if (name.trim().length < 2) e.name = "نام کالا حداقل ۲ نویسه باشد";
    const bc = digitsOnly(toEnDigits(barcode));
    if (bc && bc.length < 4) e.barcode = "بارکد باید حداقل ۴ رقم باشد";
    if (price < 0 || price > 500_000_000) e.price = "قیمت فروش باید ۰ تا ۵۰۰ میلیون ریال باشد";
    const st = stock.trim();
    if (st && (!/^\d+$/.test(toEnDigits(st)) || Number(toEnDigits(st)) < 0))
      e.stock = "موجودی باید عدد نامنفی باشد";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (submitting || (editMode && !target)) return;
    if (!validate()) return;

    setApiError(null);
    const nameT = name.trim();
    const codeT = code.trim();
    const barcodeT = digitsOnly(toEnDigits(barcode));
    const unitT = unit.trim() || "عدد";
    const categoryT = category.trim();
    const stockNum = stock.trim() === "" ? null : Math.floor(Number(toEnDigits(stock.trim())));

    setSubmitting(true);
    try {
      if (editMode && target) {
        // ویرایش — تنها فیلدهای تغییر‌یافته ارسال می‌شود
        const payload: Record<string, string | number | boolean | null | string[]> = {};
        if (nameT !== target.name) payload.name = nameT;
        if (codeT !== (target.code ?? "")) payload.code = codeT;
        if (barcodeT !== (target.barcode ?? "")) payload.barcode = barcodeT;
        if (unitT !== target.unit) payload.unit = unitT;
        if (categoryT !== (target.category ?? "")) payload.category = categoryT;
        if (price !== target.price) payload.price = price;
        if (stockNum !== target.stock) payload.stock = stockNum;
        if (!isActive) payload.isActive = false; // فهرست فعال‌ها فقط اجازه غیرفعال‌سازی می‌دهد
        // بارکدهای جایگزین — مقایسه مجموعه (ترتیب مهم نیست)
        const currentExtras = [...(target.extraBarcodes ?? [])].sort().join("|");
        const nextExtras = [...extraBarcodes].sort().join("|");
        if (currentExtras !== nextExtras) payload.extraBarcodes = extraBarcodes;

        if (Object.keys(payload).length === 0) {
          toast.info("تغییری برای ذخیره وجود ندارد");
          return;
        }

        const res = await fetch(`/api/products/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          const deactivated = payload.isActive === false;
          toast.success(
            deactivated
              ? `کالای «${nameT}» غیرفعال شد و از فهرست پاک می‌شود`
              : `کالای «${nameT}» به‌روزرسانی شد${
                  Array.isArray(data.changed) && data.changed.length > 0
                    ? ` (${data.changed.join("، ")})`
                    : ""
                }`
          );
          onOpenChange(false);
          onSaved();
        } else {
          setApiError(data.error || "خطا در به‌روزرسانی کالا");
          toast.error(data.error || "خطا در به‌روزرسانی کالا");
        }
      } else {
        // ایجاد کالای جدید
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameT,
            unit: unitT,
            code: codeT,
            barcode: barcodeT,
            category: categoryT,
            price,
            stock: stockNum,
          }),
        });
        const data = await res.json();
        if (res.ok || res.status === 201) {
          toast.success(`کالای «${nameT}» به بانک کالا افزوده شد`);
          onOpenChange(false);
          onSaved();
        } else {
          setApiError(data.error || "خطا در ایجاد کالا");
          toast.error(data.error || "خطا در ایجاد کالا");
        }
      }
    } catch {
      setApiError(null);
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        dir="rtl"
        className="w-[calc(100vw-1.5rem)] sm:max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editMode ? (
              <>
                <Pencil className="size-5 text-primary" />
                ویرایش کالا
              </>
            ) : (
              <>
                <Plus className="size-5 text-primary" />
                افزودن کالا
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? `ویرایش مشخصات «${target?.name}» — تنها فیلدهای تغییر‌یافته ذخیره می‌شوند.`
              : "کالای جدید به بانک کالا افزوده می‌شود و بلافاصله در اسکن بارکد صندوقدارها قابل استفاده است."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prod-name">نام کالا</Label>
            <Input
              id="prod-name"
              className="h-11"
              maxLength={200}
              placeholder="مثلاً: روغن سرخ‌کردنی ۱ لیتری"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prod-code">
                کد کالا / بارکد <span className="text-muted-foreground font-normal">(هلو — اختیاری)</span>
              </Label>
              <Input
                id="prod-code"
                className="h-11 num"
                maxLength={40}
                placeholder="مثلاً: ۶۲۶۱۲۳۴۵۶۷۸۹۰ یا ۱۲۳۴۵"
                value={code || barcode}
                onChange={(e) => setHolooCode(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                در هلو کد کالا همان بارکد است — یک مقدار وارد کنید؛ اسکن صندوقدارها هم بر اساس همین مقدار
                کار می‌کند.
              </p>
            </div>
          </div>

          {/* بارکدهای جایگزین — هلو: یک کالا می‌تواند چند «كد كالا» داشته باشد */}
          {editMode && (
            <div className="space-y-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3.5">
              <div className="flex items-center gap-1.5">
                <BarcodeIcon className="size-3.5 text-primary" />
                <Label className="text-xs font-bold text-primary">
                  بارکدهای دیگر این کالا (كد كالا‌های بعدی هلو)
                </Label>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                گزارش موجودی هلو فقط بارکد نخستِ هر کالا را در فایل اکسل می‌آورد — اگر این کالا در هلو
                بارکدهای دیگری هم دارد، آنها را اینجا اضافه کنید تا صندوقدارها با اسکن هر یک از آنها
                کالا شناسایی شود.
              </p>
              {extraBarcodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraBarcodes.map((b) => (
                    <span
                      key={b}
                      className="num inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-background px-2 py-1 text-xs font-semibold"
                      dir="ltr"
                    >
                      {toFaDigits(b)}
                      <button
                        type="button"
                        className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        onClick={() => setExtraBarcodes((list) => list.filter((x) => x !== b))}
                        aria-label={`حذف بارکد ${b}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  className="num h-10 flex-1"
                  inputMode="numeric"
                  placeholder="بارکد دیگر — مثلاً ۶۲۶۱۲۳۴۵۶۷۸۹۰"
                  value={toFaDigits(newBarcode)}
                  onChange={(e) =>
                    setNewBarcode(toEnDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 20))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExtraBarcode();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1 shrink-0"
                  onClick={addExtraBarcode}
                  disabled={!newBarcode}
                >
                  <Plus className="size-4" />
                  افزودن
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prod-unit">واحد شمارش</Label>
              <Input
                id="prod-unit"
                className="h-11"
                maxLength={40}
                placeholder="مثلاً: عدد"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-category">
                دسته <span className="text-muted-foreground font-normal">(اختیاری)</span>
              </Label>
              <Input
                id="prod-category"
                className="h-11"
                maxLength={100}
                placeholder="مثلاً: خشکبار"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-price">قیمت فروش (ریال)</Label>
            <MoneyInput id="prod-price" value={price} onChange={setPrice} compact />
            {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-stock">
              موجودی <span className="text-muted-foreground font-normal">(اختیاری)</span>
            </Label>
            <Input
              id="prod-stock"
              className="h-11 num"
              dir="ltr"
              inputMode="numeric"
              placeholder="خالی = نامشخص"
              value={stock}
              onChange={(e) =>
                setStock(toEnDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 9))
              }
            />
            {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
          </div>

          {editMode && (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  aria-label="وضعیت کالا"
                />
                <Label htmlFor="prod-active" className="cursor-pointer text-sm">
                  وضعیت کالا
                </Label>
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isActive ? "فعال" : "غیرفعال"}
              </span>
            </div>
          )}
          {editMode && (
            <p className="text-[11px] leading-5 text-muted-foreground -mt-1">
              کالای غیرفعال در جستجو و اسکن بارکد صندوقدارها دیده نمی‌شود.
            </p>
          )}

          {apiError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
              {apiError}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {editMode ? "ذخیره تغییرات" : "افزودن کالا"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==========================================================================
   زبانه ۴ — کاربران و نقش‌ها (بازاستفاده از نمای مدیریت کاربران)
   ========================================================================== */

function UsersRolesTab({ user, onChanged }: { user: SessionUser; onChanged?: () => void }) {
  return (
    <div className="space-y-4">
      {/* معرفی نقش‌ها */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            نقش‌ها و سطوح دسترسی
          </CardTitle>
          <CardDescription className="leading-6">
            مدیر ارشد سامانه (کیانوش صفاپور) — دسترسی کامل؛ مدیر فروشگاه (آقای نوروزی) — عملیات
            مدیریتی؛ صندوقدار — ثبت مرجوعی
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border bg-primary/5 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <ShieldCheck className="size-3.5 text-primary" />
              مدیر ارشد سامانه
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              کیانوش صفاپور — دسترسی کامل به همه بخش‌ها و تنظیمات سامانه
            </p>
          </div>
          <div className="rounded-xl border bg-chart-2/5 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Store className="size-3.5 text-chart-2" />
              مدیر فروشگاه
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              آقای نوروزی — عملیات مدیریتی: داشبورد، پرداخت‌ها، بانک کالا و کاربران
            </p>
          </div>
          <div className="rounded-xl border bg-muted/30 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <UserRound className="size-3.5 text-muted-foreground" />
              صندوقدار
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              ثبت مرجوعی جدید و پیگیری تاریخچه خود
            </p>
          </div>
        </CardContent>
      </Card>

      {/* جدول کاربران + افزودن/ویرایش/نقش‌ها */}
      <UsersView user={user} onChanged={onChanged} />
    </div>
  );
}
