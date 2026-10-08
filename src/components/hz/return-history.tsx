"use client";

// فهرست مرجوعی‌ها + پنجره جزئیات + فرم تأیید مدیر کل + فرم ثبت پرداخت — سازگار با مدل تسویه (تبادل/کسری/بدهی)
// گردش کار دو مرحله‌ای: ثبت (pending) → تأیید مدیر کل (approved) → ثبت پرداخت توسط مجوز «ثبت پرداخت» (paid)
// مرجوعی وجه‌دار: پس از تأیید، پیامک «آماده پرداخت» به آقای نوروزی ارسال می‌شود؛ تبادلی: تأیید = بایگانی نهایی.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search, FileText, ChevronLeft, ChevronRight, Loader2, Landmark,
  Wallet, CalendarClock, UserRound, Phone, CreditCard, Hash, Package,
  Hourglass, CheckCircle2, Download, ReceiptText, Database as DatabaseIcon,
  Repeat2, Info, TriangleAlert, Barcode, MessageSquareText, CalendarDays, X, FileDown,
  MessageCircle, Send, TriangleAlert as SmsAlert, BadgeCheck,
} from "lucide-react";
import { MoneyDisplay } from "./money-input";
import { JalaliDateTimePicker } from "./jalali-datetime-picker";
import { IlluminatedDivider, PistachioMotif } from "./ornaments";
import { formatMoney, formatCardNumber, formatQuantity, toFaDigits, toEnDigits, moneyWords } from "@/lib/money";
import { cn } from "@/lib/utils";
import { renderSmsTemplate, smsSegments, normalizeIranMobile } from "@/lib/sms";
import {
  formatJalaliDateTime, formatJalaliFull, toJalali, jalaliToDate,
  jalaliMonthLength, JALALI_MONTHS,
} from "@/lib/jalali";
import { BANKS, digitsOnly, detectBankName, isValidCardNumber } from "@/lib/validators";
import {
  SETTLEMENT_META, isManagerRole, statusMetaFor, canApproveReturns, canRecordPayment,
} from "./types";
import { ReceiptDialog } from "./receipt-dialog";
import type {
  ReturnDetailDTO, ReturnListRow, SessionUser, SettlementType,
  SmsTemplateDTO, SmsConfigDTO,
} from "./types";

interface HistoryProps {
  user: SessionUser;
  /** active = در جریان (در انتظار تأیید مدیر کل + در انتظار پرداخت) */
  statusFilter?: "pending" | "paid" | "approved" | "active" | "all";
  /** فقط مرجوعی‌های ثبت‌شده توسط خود کاربر (زبانه «تاریخچه من» مدیران) */
  mine?: boolean;
  onChanged?: () => void;
  compact?: boolean;
  title?: string;
}

interface MonthOption {
  key: string; // "jy-jm" مثل "1405-7"
  jy: number;
  jm: number;
  label: string; // «مهر ۱۴۰۵»
}

/** برچسب ماه شمسی: «مهر ۱۴۰۵» */
function jalaliMonthLabel(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1] ?? ""} ${toFaDigits(jy)}`;
}

/** n ماه اخیر جلالی، از ماه جاری به عقب */
function lastJalaliMonths(n: number): MonthOption[] {
  const now = toJalali(new Date());
  const opts: MonthOption[] = [];
  let jy = now.jy;
  let jm = now.jm;
  for (let i = 0; i < n; i += 1) {
    opts.push({ key: `${jy}-${jm}`, jy, jm, label: jalaliMonthLabel(jy, jm) });
    jm -= 1;
    if (jm === 0) {
      jm = 12;
      jy -= 1;
    }
  }
  return opts;
}

export function ReturnHistory({ user, statusFilter = "all", mine, onChanged, compact, title }: HistoryProps) {
  const [status, setStatus] = useState<string>(statusFilter);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReturnListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const pageSize = compact ? 8 : 20;

  // ---- فیلتر ماه شمسی + میان‌بُر بازه زمانی ----
  const [monthKey, setMonthKey] = useState<string>("all"); // "all" | "jy-jm"
  const [quickRange, setQuickRange] = useState<"all" | "7" | "30">("all");

  const baseMonths = useMemo(() => lastJalaliMonths(12), []);
  // گزینه‌های ماه = ۱۲ ماه اخیر ∪ ماه‌های موجود در داده‌های واکشی‌شده (مثل آرشیو قدیمی‌تر)
  const monthOptions = useMemo<MonthOption[]>(() => {
    const map = new Map<string, MonthOption>();
    for (const m of baseMonths) map.set(m.key, m);
    for (const r of rows) {
      const d = new Date(r.submittedAt);
      if (isNaN(d.getTime())) continue;
      const j = toJalali(d);
      const key = `${j.jy}-${j.jm}`;
      if (!map.has(key))
        map.set(key, { key, jy: j.jy, jm: j.jm, label: jalaliMonthLabel(j.jy, j.jm) });
    }
    return Array.from(map.values()).sort((a, b) => b.jy - a.jy || b.jm - a.jm);
  }, [baseMonths, rows]);

  // تبدیل فیلتر فعال به from/to برای API — ماه: کل ماه شمسی؛ میان‌بُر: N×۲۴ ساعت اخیر
  const rangeParams = useMemo<{ from: string; to: string } | null>(() => {
    if (monthKey !== "all") {
      const [jys, jms] = monthKey.split("-");
      const jy = parseInt(jys, 10);
      const jm = parseInt(jms, 10);
      if (!jy || !jm || jm < 1 || jm > 12) return null;
      const from = jalaliToDate(jy, jm, 1);
      const to = jalaliToDate(jy, jm, jalaliMonthLength(jy, jm));
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (quickRange === "7" || quickRange === "30") {
      const to = new Date();
      const from = new Date(to.getTime() - parseInt(quickRange, 10) * 24 * 3600 * 1000);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    return null;
  }, [monthKey, quickRange]);

  const activeFilterLabel = (() => {
    if (monthKey !== "all") {
      const [jys, jms] = monthKey.split("-");
      const jy = parseInt(jys, 10);
      const jm = parseInt(jms, 10);
      if (jy && jm >= 1 && jm <= 12) return jalaliMonthLabel(jy, jm);
      return "فیلتر ماه";
    }
    if (quickRange === "7") return "۷ روز اخیر";
    if (quickRange === "30") return "۳۰ روز اخیر";
    return null;
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // status: all | active (pending+approved) | pending | approved | paid
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (mine) params.set("mine", "1"); // فقط مرجوعی‌های ثبت‌شده توسط خود کاربر
      if (q.trim()) params.set("q", q.trim());
      if (rangeParams) {
        params.set("from", rangeParams.from);
        params.set("to", rangeParams.to);
      }
      const res = await fetch(`/api/returns?${params}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.returns ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      toast.error("خطا در دریافت فهرست مرجوعی‌ها");
    } finally {
      setLoading(false);
    }
  }, [status, q, page, pageSize, rangeParams, mine]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // انتخاب ماه — میان‌بُر روزها را خاموش می‌کند (هر دو هم‌زمان فعال نمی‌شوند)
  function selectMonth(v: string) {
    setMonthKey(v);
    if (v !== "all") setQuickRange("all");
    setPage(1);
  }

  function selectQuickRange(v: "all" | "7" | "30") {
    setQuickRange(v);
    if (v !== "all") setMonthKey("all");
    setPage(1);
  }

  function clearDateFilter() {
    setMonthKey("all");
    setQuickRange("all");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h2 className="font-extrabold text-lg">{title}</h2>
        </div>
      )}

      {/* فیلترها */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="جستجو: شماره پیگیری، نام مشتری، موبایل یا نام کالا…"
              className="pr-10 h-11"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11! w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">در جریان (تأیید/پرداخت)</SelectItem>
              <SelectItem value="pending">در انتظار تأیید مدیر کل</SelectItem>
              <SelectItem value="approved">تأییدشده (بدون پرداخت)</SelectItem>
              <SelectItem value="paid">پرداخت‌شده</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* فیلتر ماه شمسی + میان‌بُرهای بازه زمانی */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={monthKey} onValueChange={selectMonth}>
            <SelectTrigger className="h-11! w-full sm:w-44" aria-label="فیلتر ماه (تقویم شمسی)">
              <CalendarDays className="size-4 text-muted-foreground" />
              <SelectValue placeholder="همه ماه‌ها" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">همه ماه‌ها</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="بازه زمانی سریع">
            {(
              [
                { v: "7", label: "۷ روز اخیر" },
                { v: "30", label: "۳۰ روز اخیر" },
                { v: "all", label: "همه" },
              ] as const
            ).map(({ v, label }) => (
              <Button
                key={v}
                type="button"
                variant={quickRange === v ? "default" : "outline"}
                className="h-11 px-4 font-semibold"
                aria-pressed={quickRange === v}
                onClick={() => selectQuickRange(v)}
              >
                {label}
              </Button>
            ))}
          </div>

          {activeFilterLabel && (
            <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 gap-1.5 h-9 px-3">
              <CalendarDays className="size-3.5" />
              <span className="font-bold">{activeFilterLabel}</span>
              <button
                type="button"
                onClick={clearDateFilter}
                aria-label="حذف فیلتر زمانی"
                className="inline-flex items-center justify-center size-7 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* جدول */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
                <tr className="text-muted-foreground text-xs">
                  <th className="text-start font-semibold px-4 py-3">شماره پیگیری</th>
                  <th className="text-start font-semibold px-4 py-3">مشتری</th>
                  <th className="text-start font-semibold px-4 py-3">مبلغ قابل انتقال</th>
                  <th className="text-start font-semibold px-4 py-3">اقلام</th>
                  {isManagerRole(user.role) && (
                    <th className="text-start font-semibold px-4 py-3">صندوقدار</th>
                  )}
                  <th className="text-start font-semibold px-4 py-3">زمان ثبت</th>
                  <th className="text-start font-semibold px-4 py-3">وضعیت</th>
                  <th className="text-start font-semibold px-4 py-3">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <div className="text-center text-muted-foreground">
                        <PistachioMotif size={52} className="mx-auto mb-3 opacity-60" />
                        <p className="text-sm">مرجوعی‌ای یافت نشد</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
                      onClick={() => setDetailId(r.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="num font-bold text-primary" dir="ltr">
                          {r.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.customerName}</p>
                        <p className="num text-xs text-muted-foreground" dir="ltr">
                          {toFaDigits(r.customerPhone)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {/* مبلغ قابل انتقال = مبلغ تسویه (اقلام − کالای جایگزین) */}
                        <div className="space-y-1 min-w-0">
                          <p className="num font-bold">{formatMoney(r.transferAmount)}</p>
                          <p className="num text-[10px] text-muted-foreground">
                            {formatMoney(Math.floor(r.transferAmount / 10))} تومان
                          </p>
                          {r.transferAmount !== r.totalAmount && (
                            <>
                              <p className="num text-[10px] text-muted-foreground">
                                جمع اقلام: {formatMoney(r.totalAmount)} ریال
                              </p>
                              {r.settlementType !== "full" && (
                                <SettlementBadge type={r.settlementType} />
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 num">{toFaDigits(r.itemCount)} قلم</td>
                      {isManagerRole(user.role) && (
                        <td className="px-4 py-3 text-muted-foreground">{r.cashierName}</td>
                      )}
                      <td className="px-4 py-3 num text-xs text-muted-foreground whitespace-nowrap">
                        {formatJalaliDateTime(new Date(r.submittedAt))}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          // نشان وضعیت با تفکیک نوع — approved وجه‌دار = در انتظار پرداخت
                          const meta = statusMetaFor(r.status, r.transferAmount ?? r.totalAmount);
                          return (
                            <Badge className={cn("gap-1", meta.className)} title={meta.label}>
                              {r.status === "pending" ? (
                                <Hourglass className="size-3" />
                              ) : r.status === "approved" ? (
                                (r.transferAmount ?? r.totalAmount) > 0 ? (
                                  <Wallet className="size-3" />
                                ) : (
                                  <BadgeCheck className="size-3" />
                                )
                              ) : (
                                <CheckCircle2 className="size-3" />
                              )}
                              {meta.short}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-8">
                          <ReceiptText className="size-4 ml-1" />
                          مشاهده
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* صفحه‌بندی */}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="num text-xs text-muted-foreground">
              نمایش {toFaDigits((page - 1) * pageSize + 1)} تا{" "}
              {toFaDigits(Math.min(page * pageSize, total))} از {toFaDigits(total)} مورد
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="صفحه قبل"
              >
                <ChevronRight className="size-4" />
              </Button>
              <span className="num text-sm font-bold px-2">
                {toFaDigits(page)} / {toFaDigits(pages)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="صفحه بعد"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* پنجره جزئیات */}
      <ReturnDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
        user={user}
        onPaid={() => {
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}

// ---------- پنجره جزئیات مرجوعی ----------
export function ReturnDetailDialog({
  id,
  onClose,
  user,
  onPaid,
}: {
  id: string | null;
  onClose: () => void;
  user: SessionUser;
  onPaid?: () => void;
}) {
  // الگوی استخراج حالت: بارگذاری از مقایسهٔ شناسهٔ درخواستی با دادهٔ واکشی‌شده به‌دست می‌آید
  const [fetched, setFetched] = useState<{ id: string; data: ReturnDetailDTO | null } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [holooGuideOpen, setHolooGuideOpen] = useState(false);
  const [holooLoading, setHolooLoading] = useState(false);
  const current = fetched && fetched.id === id ? fetched : null;
  const loading = !!id && !current;
  const detail = current?.data ?? null;
  // مبلغ قابل انتقال — تعیین‌کننده نمایش وضعیت و فرم‌های عملیاتی
  const transferAmt = detail ? detail.transferAmount ?? detail.totalAmount : 0;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/returns/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.id) setFetched({ id, data: d });
        else {
          setFetched({ id, data: null });
          toast.error(d.error || "خطا در دریافت جزئیات");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetched({ id, data: null });
          toast.error("خطا در دریافت جزئیات");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // پاک‌سازی جزئیات هنگام بستن پنجره (در رویداد، نه افکت)
  function handleClose() {
    setFetched(null);
    onClose();
  }

  // دانلود فایل .xls برگشت از فروش — قابل ورود مستقیم به هلو APEX
  async function downloadHolooExport() {
    if (!detail || holooLoading) return;
    setHolooLoading(true);
    try {
      const res = await fetch(`/api/returns/${detail.id}/holoo-export`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "خروجی هلو در دسترس نیست");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hz-return-${detail.code.replace(/[^A-Za-z0-9-]/g, "")}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("فایل برگشت از فروش هلو دانلود شد", {
        description: "در هلو: فرم برگشت از فروش ← راست‌کلیک ← اکسل ← ورود اطلاعات از فایل اکسل",
      });
    } catch {
      toast.error("دانلود خروجی ناموفق بود");
    } finally {
      setHolooLoading(false);
    }
  }

  return (
    <>
    <Dialog open={!!id} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] sm:max-w-4xl md:max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0"
        dir="rtl"
      >
        {loading || !detail ? (
          <div className="p-10 flex flex-col items-center gap-4">
            <DialogHeader className="sr-only">
              <DialogTitle>جزئیات مرجوعی</DialogTitle>
              <DialogDescription>در حال دریافت جزئیات از سرور</DialogDescription>
            </DialogHeader>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال دریافت جزئیات…</p>
          </div>
        ) : (
          <div>
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span className="num text-primary" dir="ltr">
                  {detail.code}
                </span>
                {(() => {
                  // نشان وضعیت سربرگ — label کامل به‌عنوان title، متن کوتاه به‌عنوان نمایش
                  const meta = statusMetaFor(detail.status, transferAmt);
                  return (
                    <Badge className={cn("gap-1", meta.className)} title={meta.label}>
                      {detail.status === "pending" ? (
                        <Hourglass className="size-3" />
                      ) : detail.status === "approved" ? (
                        transferAmt > 0 ? <Wallet className="size-3" /> : <BadgeCheck className="size-3" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      {meta.short}
                    </Badge>
                  );
                })()}
              </DialogTitle>
              <DialogDescription className="sr-only">
                جزئیات کامل مرجوعی، اقلام و اطلاعات پرداخت — دکمه چاپ رسید در سربرگ
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-2 flex justify-end gap-2 flex-wrap">
              {isManagerRole(user.role) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={downloadHolooExport}
                  disabled={holooLoading}
                >
                  {holooLoading ? <Loader2 className="size-4 animate-spin" /> : <DatabaseIcon className="size-4 text-chart-3" />}
                  خروجی هلو (برگشت از فروش)
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-9 text-muted-foreground"
                onClick={() => setHolooGuideOpen(true)}
              >
                <Info className="size-4" />
                راهنمای ورود به هلو
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => setReceiptOpen(true)}
              >
                <FileDown className="size-4 text-primary" />
                چاپ رسید مرجوعی
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* اطلاعات مشتری */}
              <section className="grid sm:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={<UserRound className="size-4" />} label="مشتری" value={detail.customerName} />
                <InfoRow
                  icon={<Phone className="size-4" />}
                  label="موبایل"
                  value={toFaDigits(detail.customerPhone)}
                  ltr
                />
                <InfoRow
                  icon={<CreditCard className="size-4" />}
                  label="کارت بانکی مشتری"
                  value={formatCardNumber(detail.customerCardNumber)}
                  ltr
                />
                <InfoRow
                  icon={<CalendarClock className="size-4" />}
                  label="زمان خرید"
                  value={formatJalaliFull(new Date(detail.purchaseAt))}
                />
                <InfoRow icon={<UserRound className="size-4" />} label="صندوقدار" value={detail.cashier.fullName} />
                <InfoRow
                  icon={<CalendarClock className="size-4" />}
                  label="زمان ثبت"
                  value={formatJalaliFull(new Date(detail.submittedAt))}
                />
              </section>

              {/* دلیل */}
              <section className="rounded-xl bg-muted/50 border p-4">
                <p className="text-xs text-muted-foreground mb-1.5">دلیل مرجوعی</p>
                <p className="font-semibold leading-7">{detail.reason}</p>
                {detail.note && (
                  <p className="text-sm text-muted-foreground leading-7 mt-2 border-t pt-2">
                    توضیحات: {detail.note}
                  </p>
                )}
              </section>

              {/* اقلام */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="size-4 text-primary" />
                  <h4 className="font-bold text-sm">اقلام مرجوعی</h4>
                  <Badge variant="outline" className="num">
                    {toFaDigits(detail.items.length)} قلم
                  </Badge>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead className="bg-muted/70 border-b text-xs text-muted-foreground">
                        <tr>
                          <th className="text-start px-3 py-2.5 font-semibold">نام کالا</th>
                          <th className="text-start px-3 py-2.5 font-semibold">بارکد</th>
                          <th className="text-start px-3 py-2.5 font-semibold">تعداد</th>
                          <th className="text-start px-3 py-2.5 font-semibold">قیمت واحد</th>
                          <th className="text-start px-3 py-2.5 font-semibold">مبلغ کل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((it) => (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="px-3 py-2.5 font-semibold">
                              {it.name}
                              {it.code && (
                                <span className="block num text-[10px] text-muted-foreground">
                                  کد هلو: {toFaDigits(it.code)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground" dir="ltr">
                              {it.barcode ? (
                                <span className="num inline-flex items-center gap-1.5">
                                  <Barcode className="size-3.5 shrink-0 opacity-70" />
                                  {toFaDigits(it.barcode)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2.5 num">{formatQuantity(it.quantity)}</td>
                            <td className="px-3 py-2.5 num">{formatMoney(it.unitPrice)}</td>
                            <td className="px-3 py-2.5 num font-bold text-primary">
                              {formatMoney(it.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-primary/5 border-t">
                        <tr>
                          <td colSpan={4} className="px-3 py-3 font-bold">
                            جمع کل اقلام:
                          </td>
                          <td className="px-3 py-3">
                            <MoneyDisplay amount={detail.totalAmount} size="sm" showWords={false} />
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                {/* تفکیک تسویه — تبادل/کسری/بدهی (و در حالت ساده، حروف‌خوانی جمع کل) */}
                {detail.transferAmount === detail.totalAmount && detail.exchangeValue === 0 ? (
                  <div className="mt-2 rounded-lg border border-dashed border-primary/25 bg-primary/5 px-4 py-2.5 space-y-1">
                    <p className="num text-[11px] text-muted-foreground">{moneyWordsRial(detail.totalAmount)}</p>
                    <p className="num text-[11px] text-muted-foreground">{moneyWordsToman(detail.totalAmount)}</p>
                  </div>
                ) : (
                  <SettlementBreakdown detail={detail} />
                )}
              </section>

              {/* تأیید مدیر کل — وجه‌دار: در انتظار پرداخت؛ تبادلی: بایگانی نهایی */}
              {detail.status === "approved" && (
                <section className="rounded-xl border border-chart-5/50 bg-chart-5/10 p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <BadgeCheck className="size-4 text-chart-3" />
                    <h4 className="font-bold text-sm">
                      {transferAmt > 0 ? "تأیید مدیر کل — در انتظار پرداخت" : "تأیید و بایگانی بدون پرداخت"}
                    </h4>
                    {transferAmt > 0 ? (
                      <Badge className="gap-1 border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20">
                        <Wallet className="size-3" />
                        در انتظار پرداخت
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 border-chart-3/40 bg-chart-3/10 text-chart-3 hover:bg-chart-3/20">
                        <Repeat2 className="size-3" />
                        تسویه بدون انتقال وجه
                      </Badge>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <InfoRow
                      icon={<UserRound className="size-4" />}
                      label="تأییدکننده (مدیر کل)"
                      value={detail.approvedBy?.fullName ?? "—"}
                    />
                    <InfoRow
                      icon={<CalendarClock className="size-4" />}
                      label="زمان تأیید"
                      value={detail.approvedAt ? formatJalaliFull(new Date(detail.approvedAt)) : "—"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-6 mt-3 border-t border-chart-5/30 pt-2.5">
                    {transferAmt > 0
                      ? "این مرجوعی توسط مدیر کل تأیید شده و در انتظار ثبت پرداخت است — ثبت انتقال وجه به کارت مشتری توسط کاربر دارای مجوز «ثبت پرداخت» (آقای نوروزی) انجام می‌شود."
                      : "این مرجوعی بدون انتقال وجه به کارت بانکی مشتری تسویه شده است (مشتری به‌جای وجه، کالای جایگزین برداشته است) — نیازی به پیامک اطلاع‌رسانی به مدیر فروشگاه نداشت."}
                  </p>
                </section>
              )}

              {/* پرداخت */}
              {detail.status === "paid" && detail.payment ? (
                <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Wallet className="size-4 text-primary" />
                    <h4 className="font-bold text-sm">اطلاعات بازگشت وجه</h4>
                    {detail.payment.amount === 0 && (
                      <Badge
                        variant="secondary"
                        className="gap-1 border-chart-3/40 bg-chart-3/10 text-chart-3 hover:bg-chart-3/20"
                      >
                        <Repeat2 className="size-3" />
                        تسویه بدون انتقال وجه
                      </Badge>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    {detail.payment.amount > 0 ? (
                      <>
                        <InfoRow icon={<Landmark className="size-4" />} label="بانک مبدأ" value={detail.payment.bankName} />
                        <InfoRow
                          icon={<Wallet className="size-4" />}
                          label="مبلغ انتقالی"
                          value={`${formatMoney(detail.payment.amount)} ریال`}
                        />
                      </>
                    ) : null}
                    <InfoRow
                      icon={<CalendarClock className="size-4" />}
                      label={detail.payment.amount === 0 ? "زمان تسویه" : "زمان انتقال"}
                      value={formatJalaliFull(new Date(detail.payment.transferredAt))}
                    />
                    {detail.payment.accountNumber && (
                      <InfoRow
                        icon={<Hash className="size-4" />}
                        label="شماره حساب مبدأ"
                        value={toFaDigits(detail.payment.accountNumber)}
                        ltr
                      />
                    )}
                    {detail.payment.cardNumber && (
                      <InfoRow
                        icon={<CreditCard className="size-4" />}
                        label="کارت مبدأ"
                        value={formatCardNumber(detail.payment.cardNumber)}
                        ltr
                      />
                    )}
                    {detail.payment.referenceNumber && (
                      <InfoRow
                        icon={<Hash className="size-4" />}
                        label="شماره پیگیری"
                        value={toFaDigits(detail.payment.referenceNumber)}
                        ltr
                      />
                    )}
                    <InfoRow
                      icon={<UserRound className="size-4" />}
                      label="ثبت‌کننده پرداخت"
                      value={detail.payment.recordedBy.fullName}
                    />
                  </div>
                </section>
              ) : detail.status === "approved" && transferAmt > 0 ? (
                canRecordPayment(user) ? (
                  <PaymentForm
                    detail={detail}
                    onPaid={(code, noTransfer, sms) => {
                      if (sms?.status === "sent") {
                        toast.success(`پرداخت مرجوعی ${code} ثبت شد و پیامک به مشتری ارسال شد ✅📱`);
                      } else if (sms?.status === "failed") {
                        toast.warning(`پرداخت مرجوعی ${code} ثبت و بایگانی شد ✅`, {
                          description: `ارسال پیامک ناموفق بود: ${sms.error ?? "خطای نامشخص پنل"}`,
                          duration: 8000,
                        });
                      } else {
                        toast.success(`پرداخت مرجوعی ${code} ثبت و بایگانی شد ✅`);
                      }
                      onClose();
                      onPaid?.();
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-3">
                    <Info className="size-5 shrink-0" />
                    ثبت پرداخت تنها برای کاربران دارای مجوز «ثبت پرداخت» (آقای نوروزی و منتخبان) فعال است.
                  </div>
                )
              ) : detail.status === "pending" && canApproveReturns(user) ? (
                <ApproveForm
                  detail={detail}
                  onApproved={(code, res) => {
                    if (res?.awaitingPayment) {
                      if (res.ownerNotified) {
                        toast.success(
                          `مرجوعی ${code} تأیید شد و در انتظار پرداخت است — پیامک آماده پرداخت به آقای نوروزی ارسال شد ✅📱`
                        );
                      } else {
                        toast.success(`مرجوعی ${code} تأیید شد و در انتظار پرداخت است ✅`, {
                          description:
                            "پیامک آماده پرداخت ارسال نشد (گزینه ارسال خاموش بود) — آقای نوروزی از طریق زنگ اعلان سامانه و زبانه «در جریان» مطلع می‌شود.",
                          duration: 8000,
                        });
                      }
                    } else {
                      toast.success(`مرجوعی ${code} توسط شما تأیید و بایگانی شد ✅`);
                    }
                    onClose();
                    onPaid?.();
                  }}
                />
              ) : detail.status === "pending" && canRecordPayment(user) && transferAmt > 0 ? (
                <div className="rounded-xl border border-dashed border-chart-2/40 bg-chart-2/5 p-4 text-sm text-muted-foreground flex items-center gap-3">
                  <Hourglass className="size-5 text-chart-2 shrink-0" />
                  این مرجوعی هنوز توسط مدیر کل تأیید نشده است — پس از تأیید، فرم پرداخت فعال می‌شود.
                </div>
              ) : detail.status === "pending" ? (
                <div className="rounded-xl border border-dashed border-chart-2/40 bg-chart-2/5 p-4 text-sm text-muted-foreground flex items-center gap-3">
                  <Hourglass className="size-5 text-chart-2 shrink-0" />
                  {transferAmt > 0
                    ? "در انتظار تأیید مدیر کل (خانم لطفی) — پس از تأیید، پرداخت توسط آقای نوروزی ثبت می‌شود"
                    : "در انتظار تأیید مدیر کل (خانم لطفی) — این مرجوعی بدون انتقال وجه است و پس از تأیید بایگانی می‌شود"}
                </div>
              ) : null}

              {/* پیامک‌های ارسال‌شده به مشتری */}
              {detail.smsLogs?.length > 0 && (
                <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MessageCircle className="size-4 text-primary" />
                    <h4 className="font-bold text-sm">پیامک‌های ارسال‌شده به مشتری</h4>
                    <Badge variant="outline" className="num text-[10px]">
                      {toFaDigits(detail.smsLogs.length)} پیام
                    </Badge>
                  </div>
                  <div className="space-y-2.5">
                    {detail.smsLogs.map((l) => (
                      <div
                        key={l.id}
                        className={cn(
                          "rounded-lg border bg-card px-3.5 py-3 space-y-1.5",
                          l.status === "sent"
                            ? "border-primary/20"
                            : "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          <span className="flex items-center gap-1.5">
                            {l.status === "sent" ? (
                              <Badge className="gap-1 border border-primary/30 bg-primary/10 text-primary text-[10px]">
                                <CheckCircle2 className="size-3" />
                                ارسال شد
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <TriangleAlert className="size-3" />
                                ناموفق
                              </Badge>
                            )}
                            {l.templateTitle && (
                              <Badge variant="secondary" className="text-[10px]">{l.templateTitle}</Badge>
                            )}
                          </span>
                          <span className="num text-muted-foreground flex items-center gap-1.5">
                            <Phone className="size-3" />
                            <span dir="ltr">{toFaDigits(l.phone)}</span>
                            <span>·</span>
                            {formatJalaliDateTime(new Date(l.createdAt))}
                          </span>
                        </div>
                        <p className="text-xs leading-6 whitespace-pre-wrap break-words">{l.message}</p>
                        {l.status !== "sent" && l.provider && (
                          <p className="text-[10px] text-destructive">پنل: {l.provider}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} detail={detail} />
    <HolooImportGuide open={holooGuideOpen} onOpenChange={setHolooGuideOpen} />
    </>
  );
}

// ---------- راهنمای ورود برگشت از فروش به هلو APEX (بر اساس مستندات رسمی هلو) ----------
export function HolooImportGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const steps: Array<{ title: string; body: string }> = [
    {
      title: "۱. صدور سند برگشت از فروش در هلو",
      body: "منوی «عملیات مرتبط به کالا ← فاکتور – عمده فروشی ← برگشت از فروش» را باز کنید. طرف حساب (مشتری) و تاریخ را همان‌جا انتخاب کنید — تاریخ به‌صورت خودکار تاریخ جلالی امروز است.",
    },
    {
      title: "۲. ورود اقلام از فایل اکسل",
      body: "داخل فرم فاکتور بازشده راست‌کلیک کنید ← «اکسل» ← «ورود اطلاعات از فایل اکسل». در پنجره «ورود لیستی کالاها از فایل اکسل»، آیکن انتخاب فایل را بزنید و فایل hz-return-….xls دانلودشده را انتخاب کنید.",
    },
    {
      title: "۳. تطبیق ستون‌ها",
      body: "نام شیت را تایپ/انتخاب کنید (مثل HZ-14030512001)، سپس با دکمه «عنوان متناظر» هر ستون را به فیلد فرم وصل کنید: «نام کالا» ← نام کالا، «متراژ/تعداد» ← تعداد، «فی» ← فی. تأیید بزنید.",
    },
    {
      title: "۴. افزودن به فاکتور",
      body: "در پنجره انتخاب کالاها، «افزودن همه» را بزنید و تأیید کنید — سطرهای اقلام در فاکتور می‌نشینند. سند را ذخیره کنید؛ موجودی انبار هلو به‌صورت خودکار زیاد می‌شود.",
    },
  ];
  const notes = [
    "نام کالاها در فایل دقیقاً همان نام بانک کالای هلو است — چون از خروجی هلو وارد سامانه شده‌اند.",
    "مقادیر وزنی (مثل ۰٫۵ کیلو سوسیس) با ممیز اعشاری در ستون «متراژ/تعداد» می‌آیند.",
    "فایل حتماً باید Excel 97-2003 (.xls) باشد و نام فایل و نام شیت آن انگلیسی باشد — این فایل هر دو رعایت شده است.",
    "هنگام ورود، فایل اکسل نباید در ویندوز باز باشد و روی آن کامپیوتر باید Excel نصب باشد.",
    "گزینه «ورود اطلاعات از اکسل» در کدهای پیشرفته/جامع هلو فعال است؛ در کدهای ساده/متوسط باید کیت اکسل تهیه شود.",
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseIcon className="size-5 text-chart-3" />
            راهنمای ورود برگشت از فروش به هلو APEX
          </DialogTitle>
          <DialogDescription>
            فایل خروجی سامانه (.xls با ستون‌های «نام کالا / متراژ-تعداد / فی») طبق مستندات رسمی هلو ساخته می‌شود
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-4">
              <p className="font-bold text-sm mb-1.5 text-primary">{s.title}</p>
              <p className="text-xs leading-6 text-muted-foreground">{s.body}</p>
            </div>
          ))}
          <div className="rounded-xl border border-chart-3/30 bg-chart-3/5 p-4">
            <p className="font-bold text-xs mb-2 flex items-center gap-1.5">
              <Info className="size-3.5 text-chart-3" />
              نکته‌های مهم
            </p>
            <ul className="text-[11px] leading-6 text-muted-foreground space-y-1 list-disc ps-4">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon,
  label,
  value,
  ltr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 min-w-0">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`font-bold truncate ${ltr ? "num" : ""}`} dir={ltr ? "ltr" : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ---------- نشان نوع تسویه (تبادل/کسری/بدهی) ----------
function SettlementBadge({ type, className }: { type: SettlementType; className?: string }) {
  const meta = SETTLEMENT_META[type];
  const icon =
    type === "debt" ? (
      <TriangleAlert className="size-3" />
    ) : type === "exchange" ? (
      <Repeat2 className="size-3" />
    ) : type === "partial" ? (
      <Info className="size-3" />
    ) : (
      <Wallet className="size-3" />
    );
  return (
    <Badge
      variant={
        type === "debt" ? "destructive" : type === "full" ? "default" : type === "exchange" ? "secondary" : "outline"
      }
      className={cn(
        "gap-1",
        type === "exchange" && "border-chart-3/40 bg-chart-3/10 text-chart-3 hover:bg-chart-3/20",
        type === "partial" && "border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20",
        className,
      )}
      title={meta.hint}
    >
      {icon}
      {meta.label}
    </Badge>
  );
}

// ---------- تفکیک تسویه در جزئیات (اقلام / جایگزین / انتقال / بدهی / اعتبار) ----------
function SettlementBreakdown({ detail }: { detail: ReturnDetailDTO }) {
  const debt = detail.exchangeValue - detail.totalAmount; // بدهی مشتری وقتی جایگزین > جمع اقلام
  const credit = detail.totalAmount - detail.exchangeValue - detail.transferAmount; // اعتبار باقی‌مانده
  return (
    <div className="mt-2 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-muted/50 border-b">
        <Wallet className="size-4 text-primary shrink-0" />
        <h4 className="font-bold text-sm">تسویه با مشتری</h4>
        <SettlementBadge type={detail.settlementType} className="mr-auto" />
      </div>
      <div className="p-4 space-y-2.5">
        {/* جمع کل اقلام */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">جمع کل اقلام مرجوعی</span>
          <span className="num font-bold">{formatMoney(detail.totalAmount)} ریال</span>
        </div>
        {/* ارزش کالای جایگزین */}
        {detail.exchangeValue > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Repeat2 className="size-3.5 text-chart-3" />
              ارزش کالای جایگزین
            </span>
            <span className="num font-bold text-chart-3">− {formatMoney(detail.exchangeValue)} ریال</span>
          </div>
        )}
        {/* بدهی مشتری */}
        {debt > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
            <span className="text-xs font-bold text-destructive flex items-center gap-1">
              <TriangleAlert className="size-3.5" />
              بدهی مشتری به فروشگاه
            </span>
            <span className="num font-extrabold text-destructive text-sm">{formatMoney(debt)} ریال</span>
          </div>
        )}
        {/* اعتبار باقی‌مانده */}
        {credit > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-chart-4/30 bg-chart-4/5 px-3.5 py-2.5">
            <span className="text-xs font-bold text-chart-4 flex items-center gap-1">
              <Info className="size-3.5" />
              اعتبار باقی‌مانده مشتری
            </span>
            <span className="num font-extrabold text-chart-4 text-sm">{formatMoney(credit)} ریال</span>
          </div>
        )}
        {/* مبلغ قابل انتقال — باکس اصلی */}
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <Wallet className="size-3.5" />
              مبلغ قابل انتقال به حساب مشتری
            </span>
            <span className="num font-extrabold text-primary text-sm">{formatMoney(detail.transferAmount)} ریال</span>
          </div>
          {detail.transferAmount > 0 && (
            <>
              <p className="num text-[11px] text-muted-foreground">{moneyWordsRial(detail.transferAmount)}</p>
              <p className="num text-[11px] text-muted-foreground">{moneyWordsToman(detail.transferAmount)}</p>
            </>
          )}
        </div>
        {/* دلیل اختلاف تسویه */}
        {detail.transferNote && (
          <div className="rounded-lg border border-primary/20 border-r-2 border-r-primary/50 bg-muted/40 px-3.5 py-2.5 flex items-start gap-2.5">
            <MessageSquareText className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">دلیل اختلاف تسویه</p>
              <p className="text-sm font-semibold leading-6 break-words">{detail.transferNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- فرم پرداخت مدیر ----------
function moneyWordsRial(n: number) {
  return moneyWords(n).rial;
}
function moneyWordsToman(n: number) {
  return moneyWords(n).toman;
}
// ---------- فرم تأیید مرجوعی (مدیر کل / مدیر ارشد / مالک — مجوز «تأیید مرجوعی») ----------
// دو مسیر:
//  · وجه‌دار → «تأیید برای پرداخت»: مرجوعی به وضعیت در انتظار پرداخت می‌رود + پیامک «آماده پرداخت»
//    به ثبت‌کنندگان پرداخت (آقای نوروزی) — با سوییچ قابل خاموش‌کردن برای همین تأیید.
//  · تبادلی (بدون وجه) → «تأیید و بایگانی» نهایی — بدون پیامک.
export function ApproveForm({
  detail,
  onApproved,
}: {
  detail: ReturnDetailDTO;
  onApproved: (code: string, res?: { awaitingPayment?: boolean; ownerNotified?: boolean }) => void;
}) {
  const transferAmt = detail.transferAmount ?? detail.totalAmount;
  const isTransfer = transferAmt > 0;
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [notifySms, setNotifySms] = useState(true); // پیش‌فرض: پیامک آماده پرداخت روشن است

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/returns/${detail.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // وجه‌دار: تصمیم سوییچ پیامک — تبادلی: بدون پیامک (همیشه false)
        body: JSON.stringify(isTransfer ? { notifySms } : { notifySms: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409/403 با راهنمای فارسی سرور — عیناً نمایش داده می‌شود
        toast.error(data.error || "تأیید مرجوعی ناموفق بود");
        return;
      }
      onApproved(data.code, {
        awaitingPayment: !!data.awaitingPayment,
        ownerNotified: !!data.ownerNotified,
      });
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-chart-5/60 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <BadgeCheck className="size-4 text-chart-3" />
        <h4 className="font-bold text-sm">
          {isTransfer ? "تأیید برای پرداخت (ویژه مدیر کل)" : "تأیید مرجوعی بدون پرداخت (ویژه مدیر کل)"}
        </h4>
        <SettlementBadge type={detail.settlementType} className="mr-auto" />
      </div>
      <IlluminatedDivider />

      {isTransfer ? (
        <div className="rounded-lg bg-chart-4/10 border border-chart-4/40 p-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <Wallet className="size-3.5 text-chart-4" />
            <p className="text-xs font-bold text-chart-4">
              مبلغ قابل انتقال به حساب مشتری: {formatMoney(transferAmt)} ریال
            </p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            پس از تأیید شما، این مرجوعی به وضعیت «در انتظار پرداخت» می‌رود و پیامک «آماده پرداخت»
            برای آقای نوروزی ارسال می‌شود تا انتقال وجه را ثبت کند.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 cursor-pointer">
            <span className="text-xs font-semibold flex items-center gap-1.5 min-w-0">
              <MessageCircle className="size-3.5 text-primary shrink-0" />
              ارسال پیامک آماده پرداخت به آقای نوروزی
            </span>
            <Switch
              checked={notifySms}
              onCheckedChange={setNotifySms}
              aria-label="ارسال پیامک آماده پرداخت به آقای نوروزی"
            />
          </label>
          {!notifySms && (
            <p className="text-[11px] text-muted-foreground leading-6">
              پیامک ارسال نمی‌شود — آقای نوروزی از طریق زنگ اعلان سامانه و زبانه «در جریان» مطلع می‌شود.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-chart-5/10 border border-chart-5/40 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Repeat2 className="size-3.5 text-chart-3" />
            <p className="text-xs font-bold text-chart-3">
              تسویه بدون انتقال وجه — ارزش کالای جایگزین: {formatMoney(detail.exchangeValue || detail.totalAmount)} ریال
            </p>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            مشتری به‌جای بازگشت وجه، کالای جایگزین از فروشگاه برداشته است. با تأیید شما این مرجوعی
            بایگانی می‌شود — بدون انتقال بانکی و بدون پیامک به مدیر فروشگاه.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">یادداشت تأیید (اختیاری)</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isTransfer
              ? "مثلاً: مدارک و کارت بانکی بررسی شد — آماده پرداخت — خانم لطفی"
              : "مثلاً: کالای جایگزین حضوری تحویل شد — خانم لطفی"
          }
          rows={2}
          maxLength={300}
          dir="rtl"
        />
      </div>

      <Button
        onClick={submit}
        disabled={submitting}
        className="w-full h-12 text-base font-bold gap-2"
      >
        {submitting ? <Loader2 className="size-5 animate-spin" /> : <BadgeCheck className="size-5" />}
        {isTransfer ? "تأیید و ارسال برای پرداخت" : "تأیید و بایگانی مرجوعی"}
      </Button>
    </section>
  );
}

export function PaymentForm({
  detail,
  onPaid,
}: {
  detail: ReturnDetailDTO;
  onPaid: (code: string, noTransfer?: boolean, sms?: { status: string; error?: string }) => void;
}) {
  // این فرم فقط برای مرجوعی‌های تأییدشدهٔ دارای انتقال وجه رندر می‌شود
  // (status=approved و transferAmount > 0) و تنها برای کاربران دارای مجوز «ثبت پرداخت».
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transferredAt, setTransferredAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- پیامک اطلاع‌رسانی به مشتری ----
  const [templates, setTemplates] = useState<SmsTemplateDTO[]>([]);
  const [smsConfig, setSmsConfig] = useState<SmsConfigDTO | null>(null);
  const [smsSend, setSmsSend] = useState(true); // پیش‌فرض: فعال (اگر پنل آماده باشد)
  const [smsTemplateId, setSmsTemplateId] = useState<string>("");
  const [smsText, setSmsText] = useState("");
  const [smsTextDirty, setSmsTextDirty] = useState(false); // مدیر متن را دستی ویرایش کرده است
  const [storeName, setStoreName] = useState("هایپر زیتون");

  const customerPhone = normalizeIranMobile(detail.customerPhone);
  // لایه دوم پیامک: پیامک‌های خودکار این مشتری در دفترچه مشتریان خاموش شده است
  const customerSmsOff = detail.customerSmsEnabled === false;

  // بارگذاری قالب‌ها و وضعیت پنل پیامک + نام فروشگاه
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms/templates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("templates"))))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.templates)) setTemplates(d.templates);
      })
      .catch(() => {});
    fetch("/api/admin/sms-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sms-config"))))
      .then((d) => {
        if (!cancelled && d && typeof d.ready === "boolean") {
          setSmsConfig(d as SmsConfigDTO);
          // مشتری با پیامک خاموش → سوییچ ارسال هرگز روشن نمی‌شود
          setSmsSend(!!d.ready && !customerSmsOff);
        }
      })
      .catch(() => {});
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings"))))
      .then((d) => {
        if (!cancelled && d?.storeName) setStoreName(d.storeName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTemplates = templates.filter((t) => t.isActive);

  // اعتبارسنجی کارت مبدأ (الگوریتم لان) + تشخیص بانک — همان تجربه فرم صندوقدار
  const cardOk = isValidCardNumber(cardNumber);
  const srcBankName = detectBankName(cardNumber);

  // متن آماده قالب انتخاب‌شده با داده واقعی این مرجوعی
  // ⚠ شماره پیگیری در پیامک = کد رهگیری بانکی که مدیر در فرم وارد می‌کند
  //   (اگر خالی بود، شماره سند مرجوعی HZ-… جایگزین می‌شود)
  function renderedTemplateBody(body: string): string {
    return renderSmsTemplate(body, {
      customerName: detail.customerName,
      amountRial: detail.transferAmount,
      trackingCode: referenceNumber.trim() || detail.code,
      bankName: bankName || srcBankName || undefined,
      storeName,
    });
  }

  function handleTemplateChange(id: string) {
    setSmsTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSmsText(renderedTemplateBody(t.body));
      setSmsTextDirty(false);
    }
  }

  // با تغییر کد رهگیری یا بانک، پیامک خودکار به‌روز می‌شود مگر آنکه مدیر متن را دستی ویرایش کرده باشد
  useEffect(() => {
    if (!smsTemplateId || smsTextDirty) return;
    const t = templates.find((x) => x.id === smsTemplateId);
    if (t) setSmsText(renderedTemplateBody(t.body));
  }, [referenceNumber, bankName, smsTemplateId, smsTextDirty, templates]);

  async function submit() {
    if (submitting) return;
    if (!transferredAt) {
      toast.error("زمان انتقال وجه را انتخاب کنید");
      return;
    }
    if (!bankName) {
      toast.error("بانک مبدأ را انتخاب کنید");
      return;
    }
    if (!accountNumber && !digitsOnly(cardNumber) && !referenceNumber) {
      toast.error("حداقل شماره حساب، کارت یا کد رهگیری را وارد کنید");
      return;
    }
    if (cardNumber && !cardOk) {
      toast.error(
        "شماره کارت مبدأ معتبر نیست — ۱۶ رقم با الگوریتم لان (ممکن است رقم‌ها اشتباه باشد)"
      );
      return;
    }
    setSubmitting(true);
    try {
      // بارگذاری پیامک — فقط وقتی فعال و متن دارد (و پیامک این مشتری روشن است)
      const smsPayload =
        smsSend && !customerSmsOff && smsText.trim() && smsConfig?.ready
          ? {
              enabled: true,
              templateId: smsTemplateId || null,
              text: smsText.trim(),
            }
          : { enabled: false };
      const res = await fetch(`/api/returns/${detail.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName,
          accountNumber: accountNumber.trim() || null,
          cardNumber: digitsOnly(cardNumber) || null,
          referenceNumber: referenceNumber.trim() || null,
          transferredAt: transferredAt.toISOString(),
          sms: smsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ثبت پرداخت ناموفق بود");
        return;
      }
      onPaid(data.code, false, data.sms);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  }

  const amountDiffers = detail.transferAmount !== detail.totalAmount || detail.exchangeValue > 0;

  return (
    <section className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Wallet className="size-4 text-primary" />
        <h4 className="font-bold text-sm">ثبت پرداخت و انتقال وجه (مجوز «ثبت پرداخت»)</h4>
        <SettlementBadge type={detail.settlementType} className="mr-auto" />
      </div>
      <IlluminatedDivider />
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Wallet className="size-3.5 text-primary" />
          <p className="text-xs font-bold text-primary">مبلغ قابل انتقال به حساب مشتری</p>
        </div>
        <MoneyDisplay amount={detail.transferAmount} size="md" showWords={detail.transferAmount > 0} />
        {amountDiffers && (
          <div className="pt-2 border-t border-primary/15 space-y-1 text-[11px]">
            <p className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-muted-foreground">جمع اقلام مرجوعی</span>
              <span className="num font-semibold">{formatMoney(detail.totalAmount)} ریال</span>
            </p>
            {detail.exchangeValue > 0 && (
              <p className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Repeat2 className="size-3 text-chart-3" />
                  ارزش کالای جایگزین
                </span>
                <span className="num font-semibold text-chart-3">− {formatMoney(detail.exchangeValue)} ریال</span>
              </p>
            )}
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1">
              <Landmark className="size-3.5 text-primary" />
              بانک مبدأ (انتقال وجه)
            </label>
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="انتخاب بانک…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">زمان انتقال وجه</label>
            <JalaliDateTimePicker value={transferredAt} onChange={setTransferredAt} placeholder="انتخاب زمان انتقال" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">شماره حساب مبدأ</label>
            <Input
              className="num h-10"
              placeholder="اختیاری — مثال: ۰۱۰۱۲۳۴۵۶۷۸۹۰"
              value={accountNumber ? toFaDigits(accountNumber) : ""}
              onChange={(e) => setAccountNumber(toEnDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 26))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">شماره کارت مبدأ</label>
            <Input
              inputMode="numeric"
              className={`num tracking-wider h-10 ${
                cardNumber && !cardOk ? "border-destructive/60 focus-visible:ring-destructive/30" : ""
              }`}
              placeholder="اختیاری — ۱۶ رقم"
              value={cardNumber ? formatCardNumber(cardNumber) : ""}
              onChange={(e) => setCardNumber(digitsOnly(e.target.value).slice(0, 16))}
              aria-invalid={!!cardNumber && !cardOk}
            />
            {cardNumber && (
              <div className="flex items-center gap-2 flex-wrap min-h-5">
                {srcBankName && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Landmark className="size-3" />
                    {srcBankName}
                  </Badge>
                )}
                <span
                  className={`text-[11px] ${
                    cardOk ? "text-primary font-medium" : "text-destructive"
                  }`}
                >
                  {cardOk
                    ? "✓ شماره کارت معتبر است"
                    : `(${toFaDigits(cardNumber.length)} از ۱۶ رقم) شماره کارت معتبر نیست`}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold flex items-center gap-1">
              <Hash className="size-3.5 text-primary" />
              کد رهگیری انتقال بانکی
              <span className="text-[10px] font-normal text-muted-foreground">
                (شماره ارجاع بانک — در پیامک مشتری همین کد می‌آید)
              </span>
            </label>
            <Input
              className="ltr-value num h-10 tracking-wide"
              placeholder="شماره رهگیری تراکنش از درخواست بانک یا اپلیکیشن"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value.replace(/[\u200f\u200e]/g, "").trimStart().slice(0, 40))}
            />
            <p className="text-[10px] leading-5 text-muted-foreground">
              اگر بانک کد رهگیری نداد، شماره سند مرجوعی ({detail.code}) به‌صورت خودکار در پیامک قرار می‌گیرد.
            </p>
          </div>
      </div>

      {/* ---- اطلاع‌رسانی پیامکی به مشتری ---- */}
      <section className="rounded-xl border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            <h5 className="font-bold text-sm">پیامک اطلاع‌رسانی به مشتری</h5>
          </div>
          {smsConfig ? (
            <div className="flex items-center gap-2">
              {smsConfig.ready ? (
                <Badge className="gap-1 border border-primary/30 bg-primary/10 text-primary text-[10px]">
                  <Send className="size-3" />
                  پنل فعال
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                  <SmsAlert className="size-3" />
                  پنل ناقص
                </Badge>
              )}
              <Switch
                checked={smsSend && !!smsConfig.ready && !customerSmsOff}
                disabled={!smsConfig.ready || !customerPhone || customerSmsOff}
                onCheckedChange={(v) => {
                  if (!customerSmsOff) setSmsSend(v);
                }}
                aria-label="ارسال پیامک به مشتری"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              بررسی وضعیت پنل…
            </div>
          )}
        </div>

        {!customerPhone && (
          <p className="text-[11px] text-destructive flex items-center gap-1.5">
            <SmsAlert className="size-3.5 shrink-0" />
            شماره موبایل مشتری نامعتبر است — پیامک ارسال نمی‌شود
          </p>
        )}

        {customerSmsOff && (
          <p className="text-[11px] leading-6 text-chart-4 flex items-start gap-1.5 rounded-lg border border-chart-4/40 bg-chart-4/10 px-3 py-2.5">
            <SmsAlert className="size-3.5 shrink-0 mt-0.5" />
            پیامک‌های این مشتری در دفترچه مشتریان خاموش شده است — پیامک ارسال نمی‌شود
          </p>
        )}

        {smsConfig && !smsConfig.ready && (
          <p className="text-[11px] text-muted-foreground leading-6 rounded-lg bg-muted/50 border border-dashed px-3 py-2.5">
            پنل پیامک تنظیم نشده یا ناقص است
            {smsConfig.missing.length > 0 && <> ({smsConfig.missing.join("، ")})</>} — برای فعال‌سازی
            از «مرکز مدیریت سامانه ← زبانه پیامک» پنل را پیکربندی کنید.
          </p>
        )}

        {smsConfig?.ready && customerPhone && smsSend && !customerSmsOff && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" />
                گیرنده:
                <span className="num font-bold text-foreground" dir="ltr">
                  {toFaDigits(customerPhone)}
                </span>
              </span>
              <span className="num">{detail.customerName}</span>
            </div>

            {activeTemplates.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">نوع پیام (قالب آماده)</label>
                <Select value={smsTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="انتخاب نوع پیامک…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-5">
                  انواع پیش‌فرض: مرجوعی کالا، اختلاف قیمت، خطای کارت‌خوان، سایر موارد — مدیران
                  می‌توانند از «مرکز مدیریت ← پیامک» نوع جدید تعریف کنند.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center justify-between gap-2">
                <span>متن پیام (قابل ویرایش)</span>
                {(() => {
                  const seg = smsSegments(smsText);
                  return smsText ? (
                    <span className="num text-[10px] font-normal text-muted-foreground">
                      {toFaDigits(seg.chars)} نویسه — {toFaDigits(seg.parts)} پیامک
                    </span>
                  ) : null;
                })()}
              </label>
              <Textarea
                dir="rtl"
                rows={4}
                className="text-sm leading-7 resize-y"
                placeholder={
                  activeTemplates.length > 0
                    ? "ابتدا نوع پیام را انتخاب کنید، سپس در صورت تمایل متن را ویرایش کنید…"
                    : "متن پیام را بنویسید…"
                }
                value={smsText}
                maxLength={612}
                onChange={(e) => {
                  setSmsText(e.target.value);
                  setSmsTextDirty(true);
                }}
              />
            </div>
          </div>
        )}
      </section>

      <Button className="w-full h-12 font-bold" onClick={submit} disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> در حال ثبت…
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" />
            {smsSend && !customerSmsOff && smsConfig?.ready && customerPhone && smsText.trim()
              ? "ثبت پرداخت، بایگانی و ارسال پیامک"
              : "ثبت پرداخت و بایگانی مرجوعی"}
          </>
        )}
      </Button>
    </section>
  );
}

/** دکمه‌های خروجی اکسل آرشیو (مدیر) — گزارش کامل + خروجی ورود به هلو (برگشت از فروش) */
export function ExportReturnsButton() {
  const [loading, setLoading] = useState(false);
  const [holooLoading, setHolooLoading] = useState(false);

  async function download(url: string, fileName: string): Promise<boolean> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "خروجی اکسل در دسترس نیست");
        return false;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objUrl);
      return true;
    } catch {
      toast.error("دانلود خروجی ناموفق بود");
      return false;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="h-11 font-semibold"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          if (await download("/api/returns/export", "hyper-zeytoon-returns.xlsx")) {
            toast.success("فایل اکسل آرشیو مرجوعی‌ها دانلود شد");
          }
          setLoading(false);
        }}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        گزارش کامل آرشیو
      </Button>
      <Button
        variant="outline"
        className="h-11 font-semibold gap-1.5"
        disabled={holooLoading}
        onClick={async () => {
          setHolooLoading(true);
          const ok = await download("/api/returns/holoo-export?days=all", "hz-returns-all.xls");
          if (ok) {
            toast.success("فایل برگشت از فروش هلو (همه مرجوعی‌های نهایی‌شده) دانلود شد", {
              description: "هر مرجوعی یک شیت — در هلو، داخل فرم برگشت از فروش: راست‌کلیک ← اکسل ← ورود اطلاعات از فایل اکسل",
            });
          }
          setHolooLoading(false);
        }}
      >
        {holooLoading ? <Loader2 className="size-4 animate-spin" /> : <DatabaseIcon className="size-4 text-chart-3" />}
        خروجی هلو (.xls)
      </Button>
    </div>
  );
}
