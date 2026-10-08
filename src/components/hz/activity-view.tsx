"use client";

// تاریخچه فعالیت سامانه — خط زمانی عمودی با آیکون اختصاصی هر کنش
import { type LucideIcon, LogIn, LogOut, RotateCcw, Landmark, Upload, UserPlus, UserCheck, UserX, KeyRound, UserCog, ShieldCheck, Settings, DatabaseBackup, Package, PackagePlus, Activity as ActivityIcon, History, RefreshCw, Loader2, UserRound, FileSpreadsheet, BadgeCheck, Barcode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { toFaDigits } from "@/lib/money";
import { formatJalaliDateTime } from "@/lib/jalali";
import { isManagerRole, type ActivityRow, type SessionUser } from "./types";

interface ActionMeta {
  label: string;
  icon: LucideIcon;
  /** رنگ دایره آیکون (پس‌زمینه/متن) */
  chip: string;
  /** رنگ نشان برچسب کنش */
  badge: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  login: {
    label: "ورود به سامانه",
    icon: LogIn,
    chip: "bg-primary/15 text-primary border-primary/30",
    badge: "bg-primary/15 text-primary border-primary/30",
  },
  logout: {
    label: "خروج از سامانه",
    icon: LogOut,
    chip: "bg-muted text-muted-foreground border-border",
    badge: "bg-muted text-muted-foreground border-border",
  },
  return_submit: {
    label: "ثبت مرجوعی",
    icon: RotateCcw,
    chip: "bg-chart-2/15 text-chart-2 border-chart-2/30",
    badge: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  return_approve: {
    label: "تأیید مرجوعی بدون پرداخت",
    icon: BadgeCheck,
    chip: "bg-chart-5/20 text-chart-3 border-chart-5/40",
    badge: "bg-chart-5/20 text-chart-3 border-chart-5/40",
  },
  barcode_alias_import: {
    label: "ورود کدهای چندگانه",
    icon: Barcode,
    chip: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    badge: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  },
  payment_record: {
    label: "ثبت پرداخت مرجوعی",
    icon: Landmark,
    chip: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    badge: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  },
  product_import: {
    label: "ورود بانک کالا",
    icon: Upload,
    chip: "bg-chart-5/20 text-chart-5 border-chart-5/40",
    badge: "bg-chart-5/20 text-chart-5 border-chart-5/40",
  },
  user_create: {
    label: "ایجاد حساب کاربری",
    icon: UserPlus,
    chip: "bg-primary/15 text-primary border-primary/30",
    badge: "bg-primary/15 text-primary border-primary/30",
  },
  user_activate: {
    label: "فعال‌سازی کاربر",
    icon: UserCheck,
    chip: "bg-chart-1/15 text-chart-1 border-chart-1/30",
    badge: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  },
  user_deactivate: {
    label: "غیرفعال‌سازی کاربر",
    icon: UserX,
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
  },
  user_reset_password: {
    label: "بازنشانی گذرواژه",
    icon: KeyRound,
    chip: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    badge: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  },
  user_update: {
    label: "ویرایش کاربر",
    icon: UserCog,
    chip: "bg-primary/15 text-primary border-primary/30",
    badge: "bg-primary/15 text-primary border-primary/30",
  },
  user_password_change: {
    label: "تغییر گذرواژه",
    icon: ShieldCheck,
    chip: "bg-chart-1/15 text-chart-1 border-chart-1/30",
    badge: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  },
  settings_update: {
    label: "تنظیمات سامانه",
    icon: Settings,
    chip: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    badge: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  },
  db_backup: {
    label: "پشتیبان‌گیری پایگاه داده",
    icon: DatabaseBackup,
    chip: "bg-chart-1/15 text-chart-1 border-chart-1/30",
    badge: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  },
  product_create: {
    label: "ایجاد کالا",
    icon: PackagePlus,
    chip: "bg-primary/15 text-primary border-primary/30",
    badge: "bg-primary/15 text-primary border-primary/30",
  },
  product_update: {
    label: "ویرایش کالا",
    icon: Package,
    chip: "bg-chart-2/15 text-chart-2 border-chart-2/30",
    badge: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  user_role_change: {
    label: "تغییر نقش کاربر",
    icon: ShieldCheck,
    chip: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    badge: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  },
  activity_export: {
    label: "خروجی اکسل فعالیت‌ها",
    icon: FileSpreadsheet,
    chip: "bg-chart-5/15 text-chart-5 border-chart-5/30",
    badge: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  },
};

const DEFAULT_META: ActionMeta = {
  label: "رویداد",
  icon: ActivityIcon,
  chip: "bg-muted text-muted-foreground border-border",
  badge: "bg-muted text-muted-foreground border-border",
};

/** نمای تاریخچه فعالیت — صندوقدار فقط فعالیت‌های خود را می‌بیند (فیلتر سمت سرور) */
export function ActivityView({ user }: { user: SessionUser }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const isManager = isManagerRole(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activity?limit=100");
      const data = await res.json();
      if (res.ok) {
        setRows(data.activities ?? []);
      } else {
        toast.error(data.error || "خطا در دریافت تاریخچه فعالیت");
      }
    } catch {
      toast.error("خطا در دریافت تاریخچه فعالیت");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function exportXls() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/activity/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطا در تولید خروجی");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hyper-zeytoon-activity.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("خروجی اکسل فعالیت‌ها دانلود شد", {
        description: "پرونده برای باز شدن در اکسل/هلو آماده است",
      });
      // رویداد خروجی در فهرست ظاهر می‌شود
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تولید خروجی اکسل");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* سربرگ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h3 className="font-extrabold text-lg">آخرین فعالیت‌ها</h3>
          {rows.length > 0 && (
            <Badge variant="outline" className="num">
              {toFaDigits(rows.length)} رویداد
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={exportXls}
              disabled={exporting}
              title="خروجی اکسل کامل فعالیت‌ها (compatible هلو)"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              خروجی اکسل
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            به‌روزرسانی
          </Button>
        </div>
      </div>

      {user.role === "cashier" && (
        <p className="text-xs text-muted-foreground -mt-1">
          تنها فعالیت‌های حساب شما ({user.fullName}) در این بخش نمایش داده می‌شود.
        </p>
      )}

      {/* خط زمانی */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative border-s-2 border-border ps-7 pe-1 pb-7 last:pb-2">
                  <Skeleton className="absolute start-[-18px] top-0 size-9 rounded-full" />
                  <div className="space-y-2 pt-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3.5 w-full max-w-md" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ActivityIcon className="size-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-sm">هنوز فعالیتی ثبت نشده است</p>
              <p className="text-xs mt-1 opacity-80">
                با ورود، ثبت مرجوعی یا پرداخت، رویدادها اینجا نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <ol>
              {rows.map((a, i) => {
                const meta = ACTION_META[a.action] ?? DEFAULT_META;
                const Icon = meta.icon;
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.25 }}
                    className="relative border-s-2 border-border ps-7 pe-1 pb-6 last:pb-1"
                  >
                    {/* آیکون روی خط زمان */}
                    <span
                      className={`absolute start-[-18px] top-0 flex size-9 items-center justify-center rounded-full border-2 bg-card shadow-sm ${meta.chip}`}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-bold text-sm">
                        {a.user?.fullName ?? "کاربر حذف‌شده"}
                      </p>
                      {a.user?.role === "admin" ? (
                        <Badge className="bg-chart-2/15 text-chart-2 border-chart-2/30 gap-1">
                          مدیر ارشد سامانه
                        </Badge>
                      ) : a.user?.role === "owner" ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                          مدیر فروشگاه
                        </Badge>
                      ) : a.user ? (
                        <Badge variant="secondary">صندوقدار</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <UserRound className="size-3" />
                          نامشخص
                        </Badge>
                      )}
                      <Badge variant="outline" className={`${meta.badge} border`}>
                        {meta.label}
                      </Badge>
                    </div>

                    {a.detail && (
                      <p className="text-sm text-muted-foreground leading-6 mt-1.5">{a.detail}</p>
                    )}

                    <p className="num text-xs text-muted-foreground mt-2">
                      {formatJalaliDateTime(new Date(a.createdAt))}
                    </p>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
