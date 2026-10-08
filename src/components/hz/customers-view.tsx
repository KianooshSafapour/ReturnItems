"use client";

// دفترچه مشتریان — نمای مدیریتی: تجمیع مرجوعی‌ها بر اساس شماره موبایل
// تشخیص مشتریان پرمرجوع، اعتبار نزد فروشگاه و بدهی‌ها
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  UserRound, Search, Users, Landmark, AlertTriangle, Wallet,
  Hourglass, Loader2, ChevronRight, ChevronRightIcon, ChevronLeftIcon, RefreshCw,
  MessageSquareText,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatJalaliDate } from "@/lib/jalali";
import type { CustomerRow } from "./types";
import { CustomerHistoryDialog } from "./customer-history-dialog";
import { PistachioMotif } from "./ornaments";

type SortKey = "recent" | "count" | "credit" | "debt";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "آخرین مرجوعی",
  count: "تعداد مرجوعی",
  credit: "اعتبار نزد فروشگاه",
  debt: "بدهی مشتری",
};

interface DirectoryResponse {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalCustomers: number;
    withCredit: number;
    withDebt: number;
    creditTotal: number;
    debtTotal: number;
  };
}

export function CustomersView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [detailPhone, setDetailPhone] = useState<string | null>(null);
  /** شماره‌ای که سوییچ پیامک آن در حال ذخیره است */
  const [smsSavingPhone, setSmsSavingPhone] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("بارگذاری دفترچه مشتریان ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, [page, q, sort]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // ریست صفحه هنگام تغییر جستجو/مرتب‌سازی
  useEffect(() => {
    setPage(1);
  }, [q, sort]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const summary = data?.summary;
  const rows = useMemo(() => data?.customers ?? [], [data]);

  /** خاموش/روشن‌کردن پیامک‌های خودکار یک مشتری — لایه دوم پیامک دوگانه */
  const toggleSms = async (row: CustomerRow, next: boolean) => {
    if (smsSavingPhone) return;
    setSmsSavingPhone(row.phone);
    try {
      const res = await fetch(`/api/customers/${row.phone}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsEnabled: next }),
      });
      const payload = await res.json();
      if (res.ok) {
        toast.success(`پیامک‌های مشتری «${row.name}» ${next ? "روشن" : "خاموش"} شد`);
        // به‌روزرسانی همان ردیف در وضعیت محلی
        setData((prev) =>
          prev
            ? {
                ...prev,
                customers: prev.customers.map((c) =>
                  c.phone === row.phone ? { ...c, smsEnabled: next } : c
                ),
              }
            : prev
        );
      } else {
        toast.error(payload.error || "خطا در تغییر تنظیم پیامک مشتری");
      }
    } catch {
      toast.error("خطا در تغییر تنظیم پیامک مشتری");
    } finally {
      setSmsSavingPhone(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* سربرگ بخش */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <UserRound className="size-5 text-primary" />
            دفترچه مشتریان
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            سابقه مرجوعی، اعتبار و بدهی مشتریان — تجمیع بر اساس شماره موبایل
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => load()}
          disabled={loading}
          className="font-semibold h-11"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          به‌روزرسانی
        </Button>
      </div>

      {/* راهنمای لایه دوگانه پیامک */}
      <Alert className="items-center border-primary/25 bg-primary/5">
        <MessageSquareText className="size-4 text-primary" />
        <AlertDescription className="text-xs leading-6">
          <span className="font-bold text-foreground">لایه دوگانه پیامک: </span>
          هر نوع پیامک در مرکز پیامک دارای کلید سراسری است و هر مشتری را می‌توانید اینجا جداگانه خاموش/روشن کنید.
        </AlertDescription>
      </Alert>

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" /> مشتریان ثبت‌شده
          </p>
          <p className="num font-extrabold text-2xl mt-2">
            {loading && !summary ? "…" : (summary?.totalCustomers ?? 0).toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">متمایز بر اساس موبایل</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Landmark className="size-3.5 text-chart-1" /> اعتبار نزد فروشگاه
          </p>
          <p className="num font-extrabold text-2xl mt-2 text-chart-1">
            {loading && !summary ? "…" : formatMoney(summary?.creditTotal ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {loading ? "…" : `${(summary?.withCredit ?? 0).toLocaleString("fa-IR")} مشتری دارای اعتبار`} — ریال
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-destructive" /> بدهی مشتریان
          </p>
          <p className="num font-extrabold text-2xl mt-2 text-destructive">
            {loading && !summary ? "…" : formatMoney(summary?.debtTotal ?? 0)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {loading ? "…" : `${(summary?.withDebt ?? 0).toLocaleString("fa-IR")} مشتری بدهکار`} — ریال
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-3.5 text-primary" /> راهنما
          </p>
          <p className="text-[11px] leading-5 text-muted-foreground mt-2">
            روی هر مشتری بزنید تا سابقه کامل مرجوعی‌هایش را ببینید
          </p>
        </div>
      </div>

      {/* جستجو و مرتب‌سازی */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نام یا شماره موبایل مشتری…"
            className="h-11 ps-10 font-medium"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-11! w-full sm:w-56 font-medium">
            <SelectValue placeholder="مرتب‌سازی" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* جدول مشتریان */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-start font-semibold px-4 py-3">مشتری</TableHead>
                <TableHead className="text-start font-semibold px-4 py-3">مرجوعی‌ها</TableHead>
                <TableHead className="text-start font-semibold px-4 py-3">ارزش اقلام</TableHead>
                <TableHead className="text-start font-semibold px-4 py-3">اعتبار / بدهی</TableHead>
                <TableHead className="text-start font-semibold px-4 py-3">پیامک</TableHead>
                <TableHead className="text-start font-semibold px-4 py-3 hidden md:table-cell">آخرین مراجعه</TableHead>
                <TableHead className="w-10 px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14">
                    <div className="text-center text-muted-foreground">
                      <PistachioMotif size={52} className="mx-auto mb-3 opacity-60" />
                      <p className="text-sm font-semibold">
                        {q.trim() ? "مشتری‌ای با این نام یا شماره یافت نشد" : "هنوز مشتری‌ای ثبت نشده است"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c, i) => (
                  <motion.tr
                    key={c.phone}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => setDetailPhone(c.phone)}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 border border-primary/25 font-extrabold text-primary text-sm">
                          {c.name.trim().charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-40">{c.name}</p>
                          <p className="num text-[11px] text-muted-foreground" dir="ltr">{c.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="num font-bold">{c.returnCount.toLocaleString("fa-IR")}</span>
                        {c.pendingCount > 0 && (
                          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400 font-semibold h-6 px-2">
                            <Hourglass className="size-3" />
                            {c.pendingCount.toLocaleString("fa-IR")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <p className="num font-bold">{formatMoney(c.itemsTotal)}</p>
                      <p className="text-[10px] text-muted-foreground">ریال</p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.creditTotal > 0 && (
                          <Badge className="gap-1 bg-chart-1/15 text-chart-1 border-chart-1/40 font-semibold h-6 px-2">
                            <Landmark className="size-3" />
                            اعتبار {formatMoney(c.creditTotal)}
                          </Badge>
                        )}
                        {c.debtTotal > 0 && (
                          <Badge className="gap-1 bg-destructive/15 text-destructive border-destructive/40 font-semibold h-6 px-2">
                            <AlertTriangle className="size-3" />
                            بدهی {formatMoney(c.debtTotal)}
                          </Badge>
                        )}
                        {c.creditTotal === 0 && c.debtTotal === 0 && (
                          <span className="text-[11px] text-muted-foreground">تسویه کامل</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {/* سوییچ پیامک مشتری — کلیک داخل این خانه سابقه را باز نمی‌کند */}
                      <div
                        role="presentation"
                        className="flex size-11 items-center justify-center"
                        title={
                          c.smsEnabled === false
                            ? `پیامک‌های «${c.name}» خاموش است — برای روشن‌کردن بزنید`
                            : `پیامک‌های «${c.name}» روشن است — برای خاموش‌کردن بزنید`
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={c.smsEnabled !== false}
                          disabled={smsSavingPhone === c.phone}
                          onCheckedChange={(v) => toggleSms(c, v)}
                          aria-label={`پیامک‌های خودکار مشتری ${c.name}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 hidden md:table-cell">
                      <p className="num text-xs text-muted-foreground">{formatJalaliDate(new Date(c.lastAt))}</p>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* صفحه‌بندی */}
        {data && data.total > pageSize && (
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
            <p className="num text-xs text-muted-foreground">
              صفحه {(data.page).toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")} — {data.total.toLocaleString("fa-IR")} مشتری
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon" className="size-9"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="صفحه قبل"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button
                variant="outline" size="icon" className="size-9"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="صفحه بعد"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* گفت‌وگوی سابقه مشتری */}
      <CustomerHistoryDialog
        open={detailPhone !== null}
        onOpenChange={(o) => !o && setDetailPhone(null)}
        phone={detailPhone ?? ""}
      />
    </div>
  );
}
