"use client";

// زنگ اعلان مدیر — دو دسته اقدام‌پذیر بر اساس مجوز کاربر:
// · در انتظار تأیید مدیر کل (مرجوعی‌های pending) — فقط برای دارندگان مجوز تأیید
// · در انتظار انتقال وجه (تأییدشده وجه‌دار) — فقط برای دارندگان مجوز ثبت پرداخت
// نظرسنجی هر ۳۰ ثانیه (و هنگام فوکوس شدن پنجره) از /api/notifications

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, Eye, UserRound, BadgeCheck, Wallet } from "lucide-react";
import { formatMoney, toFaDigits } from "@/lib/money";
import { formatJalaliDateTime } from "@/lib/jalali";
import {
  canApproveReturns,
  canRecordPayment,
  isManagerRole,
  statusMetaFor,
  type NotificationDTO,
  type SessionUser,
} from "./types";

const POLL_INTERVAL_MS = 30_000;

/** ردیف آخرین مرجوعی — طبق قرارداد /api/notifications دارای status و settlementType است */
type LatestItem = NotificationDTO["latest"][number] & {
  status?: string;
  settlementType?: string;
};

interface NotificationBellProps {
  user: SessionUser;
  onOpenPending?: () => void;
}

export function NotificationBell({ user, onOpenPending }: NotificationBellProps) {
  const [data, setData] = useState<NotificationDTO | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as NotificationDTO;
      setData(payload);
    } catch {
      // اعلان بحرانی نیست؛ خطای شبکه بی‌صدا نادیده گرفته می‌شود
    }
  }, []);

  useEffect(() => {
    if (!isManagerRole(user.role)) return;
    // بارگذاری اولیه پس از نصب (در فراخوانی async — نه setState همگام در بدنه افکت)
    const initial = setTimeout(load, 0);
    const timer = setInterval(load, POLL_INTERVAL_MS);
    const handleFocus = () => load();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user.role, load]);

  // فقط برای مدیران — بعد از فراخوانی همه هوک‌ها
  if (!isManagerRole(user.role)) return null;

  // مجوزهای کاربر جاری — از پراپ کاربر (کمکی‌های types) و در نبود آن از پرچم‌های سرور
  const approveAllowed =
    user.canApproveReturns !== undefined
      ? canApproveReturns(user)
      : (data?.canApproveReturns ?? false);
  const payAllowed =
    user.canRecordPayment !== undefined
      ? canRecordPayment(user)
      : (data?.canRecordPayment ?? false);

  const pendingTotal = data?.pendingTotalAmount ?? 0;
  const awaitingApproval = data?.awaitingApprovalCount ?? 0;
  const awaitingPayment = data?.awaitingPaymentCount ?? 0;
  // مجموع در انتظارِ همین کاربر — مبنای نشان زنگ و بخش‌های مرتبط
  const myTotal = (approveAllowed ? awaitingApproval : 0) + (payAllowed ? awaitingPayment : 0);

  return (
    <DropdownMenu
      dir="rtl"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-11 rounded-full"
          aria-label={
            myTotal > 0
              ? `${toFaDigits(myTotal)} مرجوعی در انتظار — انتقال وجه یا تأیید مدیر کل`
              : "اعلان‌های مرجوعی"
          }
        >
          <motion.span
            className="flex"
            animate={myTotal > 0 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={
              myTotal > 0
                ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          >
            <Bell className="size-5" />
          </motion.span>
          {myTotal > 0 && (
            <Badge className="absolute -end-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full border-transparent bg-destructive px-1 text-[11px] font-extrabold text-white">
              {toFaDigits(myTotal > 99 ? "۹۹+" : myTotal)}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="dark w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        {/* سربرگ: دو دستهٔ در انتظار — انتقال وجه و تأیید مدیر کل */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-l from-chart-2/15 via-transparent to-transparent px-4 py-3">
          <div aria-hidden="true" className="pattern-tile absolute inset-0 opacity-40" />
          <div className="relative flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <Bell className="size-4 text-chart-2" />
              اعلان‌های مرجوعی
            </p>
            {myTotal > 0 && (
              <Badge className="num border-chart-2/30 bg-chart-2/15 text-chart-2">
                {toFaDigits(myTotal)} مورد
              </Badge>
            )}
          </div>
          <div className="relative mt-2 space-y-1.5">
            {payAllowed && awaitingPayment > 0 ? (
              <p className="text-xs leading-6 text-muted-foreground">
                <Wallet className="size-3 inline text-chart-2" /> در انتظار انتقال وجه ({toFaDigits(awaitingPayment)}):{" "}
                <span className="num font-extrabold text-chart-2">{formatMoney(pendingTotal)}</span> ریال
                <span className="num block">({formatMoney(Math.floor(pendingTotal / 10))} تومان)</span>
              </p>
            ) : null}
            {approveAllowed && awaitingApproval > 0 && (
              <p className="text-xs leading-6 text-muted-foreground">
                <BadgeCheck className="size-3 inline text-chart-5" /> در انتظار تأیید مدیر کل ({toFaDigits(awaitingApproval)})
              </p>
            )}
            {myTotal === 0 && data !== null && (
              <p className="text-xs text-muted-foreground">در حال حاضر اقدامی در انتظار شما نیست</p>
            )}
            {data === null && (
              <p className="text-xs text-muted-foreground">در حال دریافت اعلان‌ها…</p>
            )}
          </div>
        </div>

        {/* فهرست آخرین مرجوعی‌های در انتظار — با نشان وضعیت هر مورد */}
        {data === null ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : data.latest.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <p className="text-sm font-bold">در انتظار اقدامی نیست</p>
            <p className="text-xs leading-5 text-muted-foreground">همه مرجوعی‌ها تسویه شده‌اند</p>
          </div>
        ) : (
          <div className="max-h-72 divide-y divide-border/40 overflow-y-auto">
            {data.latest.map((raw) => {
              const r = raw as LatestItem;
              // نشان وضعیت با تفکیک نوع تسویه — approved وجه‌دار = در انتظار انتقال وجه
              const meta = statusMetaFor(r.status ?? "pending", r.transferAmount);
              return (
                <DropdownMenuItem
                  key={r.id}
                  onSelect={() => onOpenPending?.()}
                  className="flex flex-col items-start gap-1 py-3"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span dir="ltr" className="num text-[11px] font-bold text-primary">
                      {r.code}
                    </span>
                    <span className="num text-sm font-extrabold">
                      {formatMoney(r.totalAmount)}
                      <span className="mr-1 text-[10px] font-medium text-muted-foreground">ریال</span>
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
                      <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r.customerName}</span>
                    </span>
                    <span className="num shrink-0 text-[10px] text-muted-foreground">
                      {formatJalaliDateTime(new Date(r.submittedAt))}
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      title={meta.label}
                      className={`h-5 px-1.5 text-[10px] font-semibold ${meta.className}`}
                    >
                      {meta.short}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      ثبت‌شده توسط {r.cashierName}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {/* پانوشت */}
        <div className="border-t border-border/60 p-2.5">
          <DropdownMenuItem
            onSelect={() => onOpenPending?.()}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 text-sm font-bold text-primary focus:bg-primary/20 focus:text-primary"
          >
            <Eye className="size-4" />
            مشاهده همه
          </DropdownMenuItem>
          {data && (
            <p className="num mt-2 text-center text-[10px] text-muted-foreground">
              آخرین بررسی: {formatJalaliDateTime(new Date(data.serverTime))}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
