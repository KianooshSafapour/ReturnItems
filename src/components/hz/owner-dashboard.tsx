"use client";

// داشبورد مدیریت — نمای کلی برای آقای نوروزی: کارت‌های آماری، نمودار روند ۱۴ روز اخیر،
// پرمرجوع‌ترین کالاها، عملکرد صندوقدارها و آخرین مرجوعی‌های ثبت‌شده

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  CloudOff,
  History,
  Hourglass,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import { IlluminatedDivider, PistachioMotif } from "./ornaments";
import { formatCompactToman, formatMoney, formatNumber, formatToman, toFaDigits } from "@/lib/money";
import { JALALI_MONTHS, formatJalaliDateTime, toJalali } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { statusMetaFor } from "./types";
import type { SessionUser, StatsDTO } from "./types";

interface OwnerDashboardProps {
  user: SessionUser;
  onChanged?: () => void;
  /** ناوبری از کارت‌های داشبورد به صفحه مرتبط (در انتظار پرداخت / آرشیو / کاربران / بانک کالا) */
  onNavigate?: (tab: string) => void;
}

/** نقطه سری زمانی برای نمودار روند (مبلغ به هزار تومان) */
interface SeriesPoint {
  date: string;
  count: number;
  amount: number;
  label: string;
  amountK: number;
}

/** نقطه نمودار کالاها */
interface TopPoint {
  name: string;
  quantity: number;
  amount: number;
}

/** برچسب کوتاه شمسی محور افقی: «۱۲ مهر» */
function shortJalali(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((p) => parseInt(p, 10));
  const j = toJalali(new Date(y || 2025, (m || 1) - 1, d || 1));
  return `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
}

/** کوتاه‌سازی نام کالا برای برچسب محور عمودی */
function truncateName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/* ---------- راهنماهای فارسی نمودارها ---------- */

function AreaTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: SeriesPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border/70 bg-popover/95 px-3.5 py-2.5 shadow-xl backdrop-blur-sm"
    >
      <p className="num text-[11px] font-bold text-chart-2">{p.label}</p>
      <p className="num mt-1 text-sm font-extrabold">
        {formatMoney(p.amount)}
        <span className="mr-1.5 text-[10px] font-medium text-muted-foreground">ریال</span>
      </p>
      <p className="num mt-0.5 text-[11px] text-muted-foreground">
        {toFaDigits(p.count)} مرجوعی در این روز
      </p>
    </div>
  );
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: TopPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="max-w-56 rounded-xl border border-border/70 bg-popover/95 px-3.5 py-2.5 shadow-xl backdrop-blur-sm"
    >
      <p className="text-xs font-bold leading-5">{p.name}</p>
      <p className="num mt-1 text-sm font-extrabold">
        {toFaDigits(p.quantity)}
        <span className="mr-1.5 text-[10px] font-medium text-muted-foreground">تعداد</span>
      </p>
      <p className="num mt-0.5 text-[11px] text-muted-foreground">
        {formatMoney(p.amount)}
        <span className="mr-1">ریال</span>
      </p>
    </div>
  );
}

/* ---------- کارت‌های آماری ---------- */

interface StatCardDef {
  key: string;
  title: string;
  icon: LucideIcon;
  iconClass: string;
  /** عدد قهرمان کارت — تعداد مورد (رقم درشت بزرگ) */
  count: number;
  /** مبلغ ریالی — به‌صورت فشردهٔ تومانی زیر عدد قهرمان (مقدار دقیق در title) */
  amountRial: number | null;
  /** سطر ریز زیر مبلغ (مثل «این ماه: …») */
  subtext?: string;
  note?: string;
  /** زبانه مقصد با کلیک روی کارت */
  nav?: string;
  navLabel?: string;
}

const statGridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function OwnerDashboard({ user, onChanged, onNavigate }: OwnerDashboardProps) {
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const statsRef = useRef<StatsDTO | null>(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const data = (await res.json()) as StatsDTO | { error: string };
      if (!res.ok || "error" in data) {
        const message = "error" in data ? data.error : "خطا در دریافت آمار";
        if (statsRef.current) toast.error("به‌روزرسانی آمار ناموفق بود");
        else setError(message);
        return;
      }
      statsRef.current = data;
      setStats(data);
      setUpdatedAt(new Date());
      setError(null);
      onChangedRef.current?.();
    } catch {
      if (statsRef.current) toast.error("ارتباط با سرور برقرار نشد");
      else setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seriesData = useMemo<SeriesPoint[]>(
    () =>
      (stats?.series ?? []).map((s) => ({
        ...s,
        label: shortJalali(s.date),
        amountK: Math.round(s.amount / 10000),
      })),
    [stats]
  );

  const topProducts = useMemo<TopPoint[]>(
    () => (stats?.topProducts ?? []).map((p) => ({ name: p.name, quantity: p.quantity, amount: p.amount })),
    [stats]
  );

  const sortedCashiers = useMemo(
    () => (stats?.cashiers ?? []).slice().sort((a, b) => b.returnCount - a.returnCount),
    [stats]
  );

  // کارت‌های آماری — ۴ کارت جدید بر مبنای گردش کار سه‌مرحله‌ای + کارت هشدار موجودی در پایین صفحه
  // (تعداد = عدد قهرمان؛ مبلغ = سطر فشردهٔ تومانی — دیگر رشتهٔ ارقام بلند کارت را اشغال نمی‌کند)
  const statCards: StatCardDef[] = stats
    ? [
        {
          key: "pending-approval",
          title: "در انتظار تأیید مدیر کل",
          icon: Hourglass,
          iconClass: "border-chart-2/30 bg-chart-2/10 text-chart-2",
          count: stats.pendingCount,
          amountRial: stats.pendingTotalAmount,
          note: "وجه‌دار و تبادلی — اقدام خانم لطفی",
          nav: "pending",
          navLabel: "دیدن در انتظارها",
        },
        {
          key: "awaiting-payment",
          title: "در انتظار انتقال وجه",
          icon: Wallet,
          iconClass: "border-chart-4/30 bg-chart-4/10 text-chart-4",
          count: stats.awaitingPaymentCount,
          amountRial: stats.awaitingPaymentTotalAmount,
          note: "تأییدشدهٔ وجه‌دار — انتقال به کارت بانکی مشتری",
          nav: "pending",
          navLabel: "دیدن در انتظارها",
        },
        {
          key: "approved-archived",
          title: "تأیید و بایگانی (تبادلی)",
          icon: BadgeCheck,
          iconClass: "border-chart-5/40 bg-chart-5/15 text-chart-3",
          count: stats.approvedArchivedCount,
          amountRial: stats.approvedArchivedTotalAmount,
          note: "مرجوعی تبادلی — نهایی، بدون انتقال وجه",
          nav: "archive",
          navLabel: "دیدن آرشیو",
        },
        {
          key: "paid",
          title: "پرداخت‌شده",
          icon: CheckCircle2,
          iconClass: "border-primary/30 bg-primary/10 text-primary",
          count: stats.paidCount,
          amountRial: stats.paidTotalAmount,
          subtext: `این ماه: ${toFaDigits(stats.paidCountMonth)} مورد — ${formatCompactToman(stats.paidTotalAmountMonth)}`,
          nav: "archive",
          navLabel: "دیدن آرشیو",
        },
      ]
    : [];

  /* ---------- اسکلتون بارگذاری اولیه ---------- */
  if (loading && !stats) {
    return (
      <section aria-label="داشبورد مدیریت" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="min-w-0">
              <CardContent className="space-y-3.5 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3.5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="داشبورد مدیریت" className="space-y-6">
      {/* سربرگ */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="glow-pistachio flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <LayoutDashboard className="size-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-chart-2">خوش آمدید، {user.fullName}</p>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl">
                داشبورد مدیریت
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
                نمای کلی مرجوعی‌های هایپر زیتون، رفسنجان — زیر نظر مدیریت محترم آقای نوروزی
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
              className="h-9 font-semibold"
              aria-label="به‌روزرسانی آمار داشبورد"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              {refreshing ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
            </Button>
            {updatedAt && (
              <p className="num flex items-center justify-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                <Clock3 className="size-3" />
                آخرین به‌روزرسانی: {formatJalaliDateTime(updatedAt)}
              </p>
            )}
          </div>
        </div>
        <IlluminatedDivider />
      </motion.header>

      {/* خطا (بدون داده) */}
      {error && !stats ? (
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
                <p className="font-extrabold">دریافت آمار داشبورد ناموفق بود</p>
                <p className="text-sm leading-6 text-muted-foreground">{error}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => load()} className="font-semibold">
                <RefreshCw className="size-4" />
                تلاش دوباره
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : stats ? (
        <>
          {/* کارت‌های آماری — ۴ کارت: تأیید مدیر کل / انتقال وجه / بایگانی تبادلی / پرداخت‌شده
              عدد قهرمان = تعداد (رقم درشت)؛ مبلغ = سطر فشردهٔ تومانی با مقدار دقیق روی هاور */}
          <motion.div
            variants={statGridVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {statCards.map((s) => {
              const clickable = !!s.nav && !!onNavigate;
              return (
                <motion.div key={s.key} variants={statCardVariants} className="h-full min-w-0">
                  <Card
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={clickable ? `رفتن به ${s.navLabel ?? s.nav}` : undefined}
                    onClick={clickable ? () => onNavigate?.(s.nav as string) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onNavigate?.(s.nav as string);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "group relative h-full min-w-0 overflow-hidden text-start transition-all duration-300",
                      clickable &&
                        "cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className="pattern-girih pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    />
                    <CardContent className="relative flex h-full min-w-0 flex-col gap-3 p-4 pb-7 sm:p-5 sm:pb-7">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                            s.iconClass
                          )}
                        >
                          <s.icon className="size-5" />
                        </div>
                        <p className="min-w-0 truncate text-xs font-semibold leading-5 text-muted-foreground" title={s.title}>
                          {s.title}
                        </p>
                      </div>

                      {/* عدد قهرمان — تعداد مورد (رقم درشت بزرگ) */}
                      <p className="num text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                        {toFaDigits(s.count)}
                        <span className="mr-2 text-[11px] font-medium text-muted-foreground">مورد</span>
                      </p>

                      {/* مبلغ فشردهٔ تومانی — مقدار دقیق در title (هاور) */}
                      <div className="mt-auto min-w-0 space-y-1 border-t border-dashed pt-2.5">
                        {s.amountRial !== null ? (
                          <p
                            className="num truncate text-[11px] font-semibold leading-5 text-muted-foreground"
                            title={formatToman(s.amountRial)}
                          >
                            {formatCompactToman(s.amountRial)}
                          </p>
                        ) : (
                          <p
                            className="truncate text-[11px] leading-5 text-muted-foreground"
                            title={s.note ?? undefined}
                          >
                            {s.note}
                          </p>
                        )}
                        {s.subtext && (
                          <p
                            className="num truncate text-[10px] leading-4 text-muted-foreground/80"
                            title={formatToman(stats.paidTotalAmountMonth)}
                          >
                            {s.subtext}
                          </p>
                        )}
                      </div>
                      {clickable && (
                        <span className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-0.5 text-[10px] font-bold text-primary opacity-70 transition-all duration-300 group-hover:opacity-100 group-hover:-translate-x-0.5">
                          {s.navLabel ?? "مشاهده"}
                          <ChevronLeft className="size-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* نمودارها */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="grid gap-4 lg:grid-cols-2"
          >
            {/* روند ۱۴ روز اخیر */}
            <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-primary" />
                  روند مبلغ مرجوعی‌ها — ۱۴ روز اخیر
                </CardTitle>
                <CardDescription>مقیاس محور عمودی: هزار تومان</CardDescription>
              </CardHeader>
              <CardContent>
                <div dir="ltr" className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={seriesData} margin={{ top: 8, right: 0, bottom: 4, left: 8 }}>
                      <defs>
                        <linearGradient id="hz-owner-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      {/* راست‌به‌چپ: قدیمی‌ترین روز در راست، جدیدترین در چپ */}
                      <XAxis
                        dataKey="label"
                        reversed
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        orientation="right"
                        width={52}
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickFormatter={(v: number) => formatNumber(v)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<AreaTooltip />}
                        cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amountK"
                        name="مبلغ (هزار تومان)"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        fill="url(#hz-owner-area)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          stroke: "var(--background)",
                          fill: "var(--chart-1)",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* پرمرجوع‌ترین کالاها */}
            <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4 text-primary" />
                  پرمرجوع‌ترین کالاها
                </CardTitle>
                <CardDescription>بر اساس مجموع تعداد مرجوع‌شده از هر کالا</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                    <PistachioMotif size={64} className="opacity-60" />
                    <p className="text-sm text-muted-foreground">هنوز کالایی مرجوع نشده است</p>
                  </div>
                ) : (
                  <div dir="ltr" className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProducts}
                        layout="vertical"
                        margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
                      >
                        <XAxis
                          type="number"
                          reversed
                          hide
                          domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.25) || 1]}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          orientation="right"
                          width={172}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickFormatter={(v: string) => truncateName(v)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} />
                        <Bar
                          dataKey="quantity"
                          name="تعداد"
                          fill="var(--chart-2)"
                          radius={[6, 0, 0, 6]}
                          maxBarSize={26}
                        >
                          <LabelList
                            dataKey="quantity"
                            position="left"
                            formatter={(v: unknown) => toFaDigits(Number(v))}
                            fill="var(--foreground)"
                            fontSize={11}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* عملکرد صندوقدارها + مرجوعی‌های اخیر + هشدار موجودی */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-primary" />
                  عملکرد صندوقدارها
                  <Badge variant="secondary" className="num mr-auto text-[10px]">
                    {toFaDigits(sortedCashiers.filter((c) => c.isActive).length)} فعال از{" "}
                    {toFaDigits(sortedCashiers.length)}
                  </Badge>
                  {onNavigate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                      onClick={() => onNavigate("users")}
                    >
                      مدیریت کاربران
                      <ChevronLeft className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  همه کاربران دارای مجوز صندوقداری (نقش صندوقدار یا مجوز صندوقداری) — مرتب بر اساس تعداد ثبت (نزولی)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedCashiers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <PistachioMotif size={56} className="opacity-60" />
                    <p className="text-sm text-muted-foreground">صندوقداری ثبت نشده است</p>
                  </div>
                ) : (
                  <ul className="max-h-80 space-y-2.5 overflow-y-auto pl-1">
                    {sortedCashiers.map((c, i) => {
                      const maxCount = sortedCashiers[0]?.returnCount || 1;
                      const pct = Math.min(100, Math.round((c.returnCount / maxCount) * 100));
                      const rank = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
                      return (
                        <motion.li
                          key={c.id}
                          initial={{ opacity: 0, x: 14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
                          className="group rounded-xl border bg-muted/30 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={cn(
                                  "num flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold",
                                  rank === "gold" &&
                                    "border-amber-400/50 bg-amber-400/15 text-amber-500 shadow-[0_0_12px] shadow-amber-400/20",
                                  rank === "silver" &&
                                    "border-slate-400/50 bg-slate-400/15 text-slate-400",
                                  rank === "bronze" &&
                                    "border-orange-700/40 bg-orange-700/10 text-orange-700 dark:text-orange-400",
                                  !rank && "bg-primary/10 text-primary"
                                )}
                              >
                                {toFaDigits(i + 1)}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                                  {c.fullName}
                                  {!c.isActive && (
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      (غیرفعال)
                                    </span>
                                  )}
                                </p>
                                <p className="num text-[11px] text-muted-foreground">
                                  {toFaDigits(c.returnCount)} مرجوعی ·{" "}
                                  {formatMoney(c.totalAmount)} ریال
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {c.isActive ? (
                                <Badge className="border-primary/30 bg-primary/15 text-primary">
                                  فعال
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-muted-foreground">
                                  غیرفعال
                                </Badge>
                              )}
                              {c.lastActivityAt && (
                                <span className="num text-[10px] text-muted-foreground">
                                  آخرین: {formatJalaliDateTime(new Date(c.lastActivityAt))}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* میله عملکرد نسبی */}
                          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, delay: 0.2 + i * 0.07, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full",
                                rank === "gold" && "bg-gradient-to-l from-amber-400 to-amber-500/70",
                                rank === "silver" && "bg-gradient-to-l from-slate-400 to-slate-500/70",
                                rank === "bronze" &&
                                  "bg-gradient-to-l from-orange-600 to-orange-700/70",
                                !rank && "bg-gradient-to-l from-primary to-primary/60"
                              )}
                            />
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4 text-primary" />
                  مرجوعی‌های اخیر
                  {onNavigate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-auto h-7 gap-1 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                      onClick={() => onNavigate("archive")}
                    >
                      مشاهده همه
                      <ChevronLeft className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>۵ مورد آخر ثبت‌شده در سامانه</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.recentReturns.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <PistachioMotif size={56} className="opacity-60" />
                    <p className="text-sm text-muted-foreground">هنوز مرجوعی‌ای ثبت نشده است</p>
                  </div>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto pl-1">
                    {stats.recentReturns.map((r, i) => {
                      // مبلغ انتقالی (با پشتیبان از جمع اقلام) — برای بج وضعیت تفکیکی
                      const transfer = (r as { transferAmount?: number }).transferAmount ?? r.totalAmount;
                      const meta = statusMetaFor(r.status, transfer);
                      const navTarget =
                        r.status === "paid" || (r.status === "approved" && transfer === 0) ? "archive" : "pending";
                      return (
                        <motion.li
                          key={r.id}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
                          role={onNavigate ? "button" : undefined}
                          tabIndex={onNavigate ? 0 : undefined}
                          aria-label={
                            onNavigate
                              ? `رفتن به ${navTarget === "pending" ? "مرجوعی‌های در جریان" : "آرشیو مرجوعی‌ها"} برای ${r.code} — ${meta.label}`
                              : undefined
                          }
                          onClick={onNavigate ? () => onNavigate(navTarget) : undefined}
                          onKeyDown={
                            onNavigate
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onNavigate(navTarget);
                                  }
                                }
                              : undefined
                          }
                          className="cursor-pointer rounded-xl border bg-muted/30 px-4 py-2.5 text-start transition-colors hover:border-primary/30 hover:bg-accent/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span dir="ltr" className="num text-xs font-bold text-primary">
                              {r.code}
                            </span>
                            <Badge className={cn("gap-1", meta.className)}>
                              {r.status === "pending" ? (
                                <Hourglass className="size-3" aria-hidden="true" />
                              ) : r.status === "approved" ? (
                                <BadgeCheck className="size-3" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="size-3" aria-hidden="true" />
                              )}
                              {meta.short}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{r.customerName}</p>
                            <p className="num whitespace-nowrap text-sm font-bold" title={`${formatToman(r.totalAmount)} (ارزش اقلام)`}>
                              {formatMoney(r.totalAmount)}
                              <span className="mr-1 text-[10px] font-medium text-muted-foreground">ریال</span>
                            </p>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span className="flex min-w-0 items-center gap-1">
                              <UserRound className="size-3 shrink-0" />
                              <span className="truncate">{r.cashierName}</span>
                            </span>
                            <span className="num whitespace-nowrap">
                              {formatJalaliDateTime(new Date(r.submittedAt))}
                            </span>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* هشدار موجودی بانک کالا (هلو) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TriangleAlert className="size-4 text-chart-2" />
                  هشدار موجودی بانک کالا
                  {stats.lowStock.total === 0 ? (
                    <Badge variant="outline" className="mr-auto text-[10px]">
                      بدون هشدار
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="num mr-auto text-[10px]">
                      {toFaDigits(stats.lowStock.total)} کالا
                    </Badge>
                  )}
                  {onNavigate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                      onClick={() => onNavigate("products")}
                    >
                      بانک کالا
                      <ChevronLeft className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  کالاهای دارای ۵ عدد یا کمتر موجودی — بر اساس آخرین بروزرسانی بانک کالا (هلو)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.lowStock.total === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <PistachioMotif size={56} className="opacity-60" />
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <PackageCheck className="size-4" />
                      همه کالاها موجودی کافی دارند
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {stats.lowStock.outOfStock > 0 && (
                        <span className="num rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive">
                          {toFaDigits(stats.lowStock.outOfStock)} کالای تمام‌شده
                        </span>
                      )}
                      <span className="num rounded-full border border-chart-2/30 bg-chart-2/10 px-3 py-1 text-[11px] font-bold text-chart-2">
                        {toFaDigits(stats.lowStock.total)} کالا با موجودی کم
                      </span>
                    </div>
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pl-1">
                      {stats.lowStock.products.map((p, i) => (
                        <motion.li
                          key={p.id}
                          initial={{ opacity: 0, x: 14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.05, ease: "easeOut" }}
                          className="group rounded-xl border bg-muted/30 px-3.5 py-2.5 transition-colors hover:border-chart-2/40 hover:bg-accent/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <p className="truncate text-sm font-semibold">{p.name}</p>
                              {p.code && (
                                <Badge variant="outline" className="num w-fit px-1.5 py-0 text-[10px]">
                                  کد: {toFaDigits(p.code)}
                                </Badge>
                              )}
                            </div>
                            {p.stock === 0 ? (
                              <Badge className="shrink-0 border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/20">
                                ناموجود
                              </Badge>
                            ) : (
                              <Badge className="num shrink-0 border-chart-2/40 bg-chart-2/15 text-chart-2 hover:bg-chart-2/20">
                                {toFaDigits(p.stock)} {p.unit}
                              </Badge>
                            )}
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="num mt-3 text-[10px] text-muted-foreground">
                  {stats.lowStock.bankUpdatedAt
                    ? `آخرین به‌روزرسانی بانک کالا: ${formatJalaliDateTime(
                        new Date(stats.lowStock.bankUpdatedAt)
                      )}`
                    : "بروزرسانی بانک کالا: نامشخص"}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : null}
    </section>
  );
}
