"use client";

// گفت‌وگوی سابقه مشتری — مشترک بین دفترچه مشتریان (مدیر) و فرم ثبت مرجوعی (صندوقدار)
// سابقه کامل مرجوعی‌های یک مشتری را بر اساس شماره موبایل نشان می‌دهد
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserRound, Phone, History, Hourglass, CheckCircle2, Wallet,
  Landmark, AlertTriangle, ReceiptText, ShoppingBag, BadgeCheck,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatJalaliDateTime } from "@/lib/jalali";
import {
  SETTLEMENT_META, type CustomerDetailDTO, type SettlementType,
} from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** شماره موبایل مشتری */
  phone: string;
}

export function SettlementBadge({ type }: { type: SettlementType }) {
  const styles: Record<SettlementType, string> = {
    full: "bg-primary/15 text-primary border-primary/30",
    exchange: "bg-chart-1/15 text-chart-1 border-chart-1/40",
    partial: "bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400",
    debt: "bg-destructive/15 text-destructive border-destructive/40",
  };
  return (
    <Badge variant="outline" className={`${styles[type]} gap-1 font-semibold`}>
      {SETTLEMENT_META[type].label}
    </Badge>
  );
}

export function CustomerHistoryDialog({ open, onOpenChange, phone }: Props) {
  // الگوی حالت استخراج‌شده: بارگذاری وقتی phone درخواستی با دادهٔ واکشی‌شده فرق دارد
  const [fetched, setFetched] = useState<{ phone: string; data: CustomerDetailDTO | null } | null>(null);
  const current = fetched && fetched.phone === phone ? fetched : null;
  const loading = open && !!phone && !current;
  const detail = current?.data ?? null;

  useEffect(() => {
    if (!open || !phone) return;
    let cancelled = false;
    fetch(`/api/customers/${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d: CustomerDetailDTO) => {
        if (!cancelled) setFetched({ phone, data: d?.found ? d : null });
      })
      .catch(() => {
        if (!cancelled) setFetched({ phone, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, phone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="flex items-center gap-2 text-right">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 border border-primary/25 text-primary">
              <UserRound className="size-4.5" />
            </span>
            سابقه مشتری
          </DialogTitle>
          <DialogDescription className="text-right">
            مرجوعی‌های ثبت‌شده برای این شماره موبایل در هایپر زیتون
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !detail || !detail.found ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
              <Phone className="size-6 text-primary" />
            </div>
            <p className="font-bold">سابقه‌ای برای این شماره یافت نشد</p>
            <p className="text-xs text-muted-foreground num" dir="ltr">{phone}</p>
            <p className="text-xs text-muted-foreground">
              این اولین مرجوعی این مشتری در سامانه است 🌿
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* کارت شناسنامه مشتری */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30 font-extrabold text-primary text-lg">
                    {detail.name.trim().charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{detail.name}</p>
                    <p className="num text-xs text-muted-foreground" dir="ltr">{detail.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="gap-1.5 bg-primary/15 text-primary border-primary/30 font-bold">
                    <History className="size-3.5" />
                    {detail.returnCount.toLocaleString("fa-IR")} مرجوعی
                  </Badge>
                  {detail.pendingCount > 0 && (
                    <Badge className="gap-1.5 bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400 font-bold">
                      <Hourglass className="size-3.5" />
                      {detail.pendingCount.toLocaleString("fa-IR")} در انتظار
                    </Badge>
                  )}
                </div>
              </div>

              {/* آمار مالی */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border bg-card p-2.5 text-center">
                  <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <ShoppingBag className="size-3" /> ارزش اقلام
                  </p>
                  <p className="num font-extrabold text-sm mt-1">{formatMoney(detail.itemsTotal)}</p>
                  <p className="text-[9px] text-muted-foreground">ریال</p>
                </div>
                <div className="rounded-lg border bg-card p-2.5 text-center">
                  <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <Wallet className="size-3" /> وجه منتقل‌شده
                  </p>
                  <p className="num font-extrabold text-sm mt-1">{formatMoney(detail.transferredTotal ?? 0)}</p>
                  <p className="text-[9px] text-muted-foreground">ریال</p>
                </div>
                <div className={`rounded-lg border p-2.5 text-center ${detail.creditTotal > 0 ? "bg-chart-1/10 border-chart-1/40" : "bg-card"}`}>
                  <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <Landmark className="size-3" /> اعتبار نزد فروشگاه
                  </p>
                  <p className="num font-extrabold text-sm mt-1">{formatMoney(detail.creditTotal)}</p>
                  <p className="text-[9px] text-muted-foreground">ریال</p>
                </div>
                <div className={`rounded-lg border p-2.5 text-center ${detail.debtTotal > 0 ? "bg-destructive/10 border-destructive/40" : "bg-card"}`}>
                  <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="size-3" /> بدهی مشتری
                  </p>
                  <p className="num font-extrabold text-sm mt-1">{formatMoney(detail.debtTotal)}</p>
                  <p className="text-[9px] text-muted-foreground">ریال</p>
                </div>
              </div>

              {detail.lastAt && (
                <p className="text-[11px] text-muted-foreground">
                  اولین مرجوعی: <span className="num font-semibold">{formatJalaliDateTime(new Date(detail.firstAt ?? detail.lastAt))}</span>
                  <span className="mx-1.5 opacity-40">|</span>
                  آخرین مرجوعی: <span className="num font-semibold">{formatJalaliDateTime(new Date(detail.lastAt))}</span>
                </p>
              )}
            </div>

            {/* فهرست مرجوعی‌ها */}
            <div>
              <p className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <ReceiptText className="size-4 text-primary" />
                فهرست مرجوعی‌ها
              </p>
              {detail.returns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">مرجوعی‌ای ثبت نشده است</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto pl-1">
                  {detail.returns.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border bg-card px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-accent/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="num text-xs font-bold text-primary" dir="ltr">{r.code}</span>
                          {r.status === "paid" ? (
                            <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/40 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="size-3" /> پرداخت شد
                            </Badge>
                          ) : r.status === "approved" ? (
                            <Badge className="gap-1 bg-teal-500/15 text-teal-700 border-teal-500/40 dark:text-teal-400 font-semibold">
                              <BadgeCheck className="size-3" /> تأیید مدیر کل
                            </Badge>
                          ) : (
                            <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400 font-semibold">
                              <Hourglass className="size-3" /> در انتظار
                            </Badge>
                          )}
                          <SettlementBadge type={r.settlementType} />
                        </div>
                        <p className="text-[11px] text-muted-foreground num">
                          {formatJalaliDateTime(new Date(r.submittedAt))} — ثبت توسط {r.cashierName} — {r.itemCount.toLocaleString("fa-IR")} قلم
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="num text-sm font-extrabold">{formatMoney(r.transferAmount)}</p>
                        <p className="text-[10px] text-muted-foreground">ریال قابل انتقال</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
