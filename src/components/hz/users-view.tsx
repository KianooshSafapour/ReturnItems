"use client";

// مدیریت کاربران و نقش‌ها — فهرست، افزودن، ویرایش، تغییر نقش، فعال/غیرفعال‌سازی و بازنشانی گذرواژه
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  UserRound, UserPlus, KeyRound, UserCheck, UserX, MoreHorizontal, Loader2,
  RefreshCw, Eye, EyeOff, ShieldCheck, Users, Phone, Pencil, BadgeCheck,
  ScanLine, Wallet, SlidersHorizontal, type LucideIcon,
} from "lucide-react";
import { toFaDigits, toEnDigits } from "@/lib/money";
import { formatJalaliDateTime } from "@/lib/jalali";
import { digitsOnly } from "@/lib/validators";
import { ROLE_LABELS, isManagerRole, type Role, type SessionUser, type UserRow } from "./types";
import { AvatarBadge } from "./avatar-badge";

interface FormErrors {
  fullName?: string;
  username?: string;
  phone?: string;
  password?: string;
}

/** نشان نقش کاربر — مدیر ارشد / مدیر کل / مدیر فروشگاه / صندوقدار */
function RoleBadge({ role }: { role: Role }) {
  if (role === "admin")
    return (
      <Badge className="gap-1 border border-primary/30 bg-primary/10 text-primary">
        <ShieldCheck className="size-3" />
        {ROLE_LABELS.admin}
      </Badge>
    );
  if (role === "gm")
    return (
      <Badge className="gap-1 border border-chart-5/50 bg-chart-5/15 text-chart-3">
        <BadgeCheck className="size-3" />
        {ROLE_LABELS.gm}
      </Badge>
    );
  if (role === "owner")
    return (
      <Badge className="gap-1 border border-chart-2/30 bg-chart-2/15 text-chart-2">
        <ShieldCheck className="size-3" />
        {ROLE_LABELS.owner}
      </Badge>
    );
  return <Badge variant="secondary">{ROLE_LABELS.cashier}</Badge>;
}

/** نشان‌های فشرده مجوزهای عملیاتی — فقط مجوزهای فعال نمایش داده می‌شوند */
function PermissionBadges({ row }: { row: UserRow }) {
  const active = (Object.keys(PERM_META) as Array<keyof Perms>).filter(
    (key) => row[key] === true
  );
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {active.map((key) => {
        const Icon = PERM_META[key].icon;
        return (
          <Badge
            key={key}
            variant="secondary"
            title={PERM_META[key].hint}
            className="h-5 gap-1 px-1.5 text-[10px] font-medium text-muted-foreground"
          >
            <Icon className="size-2.5" />
            {PERM_META[key].short}
          </Badge>
        );
      })}
    </div>
  );
}

/** راهنمای کوتاه هر نقش برای پنجره‌ها */
const ROLE_HINTS: Record<Role, string> = {
  cashier: "ثبت مرجوعی جدید و مشاهده تاریخچه خود — بدون دسترسی مدیریتی",
  gm: "مدیر کل فروشگاه — تأیید مرجوعی‌های بدون پرداخت (تبادلی)، داشبورد، آرشیو و بانک کالا",
  owner: "عملیات مدیریتی: داشبورد، انتقال وجه به مشتری، آرشیو، بانک کالا و کاربران",
  admin: "دسترسی کامل به همه بخش‌های سامانه (نقش توسعه‌دهنده)",
};

/** مجوزهای عملیاتی — ساختار مشترک سه‌گانه */
interface Perms {
  canActAsCashier: boolean;
  canApproveReturns: boolean;
  canRecordPayment: boolean;
}

/** مجوزهای پیش‌فرض هر نقش — همگام با defaultPermissionsForRole سمت سرور */
const ROLE_PERM_DEFAULTS: Record<Role, Perms> = {
  cashier: { canActAsCashier: true, canApproveReturns: false, canRecordPayment: false },
  gm: { canActAsCashier: false, canApproveReturns: true, canRecordPayment: false },
  owner: { canActAsCashier: false, canApproveReturns: true, canRecordPayment: true },
  admin: { canActAsCashier: true, canApproveReturns: true, canRecordPayment: true },
};

/** برچسب و راهنمای هر مجوز عملیاتی — short برای نشان فشرده ردیف */
const PERM_META: Record<
  keyof Perms,
  { label: string; short: string; hint: string; icon: LucideIcon }
> = {
  canActAsCashier: {
    label: "ثبت مرجوعی (صندوقداری)",
    short: "صندوقداری",
    hint: "می‌تواند مثل صندوقدار مرجوعی ثبت کند",
    icon: ScanLine,
  },
  canApproveReturns: {
    label: "تأیید مرجوعی",
    short: "تأیید مرجوعی",
    hint: "تأیید و بایگانی مرجوعی‌ها (نقش مدیر کل)",
    icon: ShieldCheck,
  },
  canRecordPayment: {
    label: "ثبت پرداخت و انتقال وجه",
    short: "ثبت پرداخت",
    hint: "فرم پرداخت فقط برای آقای نوروزی و منتخبان — خانم لطفی پیش‌فرض ندارد",
    icon: Wallet,
  },
};

/** نمای مدیریت کاربران — فقط برای مدیر رندر می‌شود */
export function UsersView({ user, onChanged }: { user: SessionUser; onChanged?: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users ?? []);
      } else {
        toast.error(data.error || "خطا در دریافت فهرست کاربران");
      }
    } catch {
      toast.error("خطا در دریافت فهرست کاربران");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (row: UserRow, next: boolean) => {
    // حساب‌های مدیریتی (مدیر ارشد / مدیر فروشگاه) از این مسیر غیرفعال نمی‌شوند
    if (isManagerRole(row.role)) return;
    setTogglingId(row.id);
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          next ? `حساب «${row.fullName}» فعال شد` : `حساب «${row.fullName}» غیرفعال شد`
        );
        load();
        onChanged?.();
      } else {
        toast.error(data.error || "خطا در تغییر وضعیت حساب");
      }
    } catch {
      toast.error("خطا در تغییر وضعیت حساب");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* سربرگ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h3 className="font-extrabold text-lg">کاربران و سطح دسترسی</h3>
          {users.length > 0 && (
            <Badge variant="outline" className="num">
              {toFaDigits(users.length)} حساب
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            به‌روزرسانی
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            افزودن کاربر
          </Button>
        </div>
      </div>

      {/* جدول کاربران */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
                <TableRow className="text-muted-foreground text-xs hover:bg-transparent">
                  <TableHead className="text-start font-semibold px-4 py-3">نام کامل</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">نام کاربری</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">نقش</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">شماره تماس</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">مرجوعی‌ها</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">پرداخت‌ها</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">وضعیت</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">تاریخ ایجاد</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-14">
                      <div className="text-center text-muted-foreground">
                        <UserRound className="size-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold text-sm">کاربری یافت نشد</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className={`border-b last:border-0 transition-colors hover:bg-accent/40 ${
                        row.isActive ? "" : "opacity-60"
                      }`}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <AvatarBadge fullName={row.fullName} avatar={row.avatar} size="md" />
                          <div className="min-w-0">
                            <p className="font-semibold whitespace-nowrap">{row.fullName}</p>
                            {row.id === user.id && (
                              <Badge variant="outline" className="text-[10px] mt-0.5">
                                شما
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="num text-xs text-muted-foreground" dir="ltr">
                          {row.username}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <RoleBadge role={row.role} />
                        <PermissionBadges row={row} />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {row.phone ? (
                          <span className="num text-xs" dir="ltr">
                            {toFaDigits(toEnDigits(row.phone))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs flex items-center gap-1">
                            <Phone className="size-3" />
                            ثبت نشده
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 num">{toFaDigits(row.returnCount)}</TableCell>
                      <TableCell className="px-4 py-3 num">{toFaDigits(row.paymentCount)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.isActive}
                            disabled={isManagerRole(row.role) || togglingId === row.id}
                            onCheckedChange={(v) => toggleActive(row, v)}
                            aria-label={`وضعیت حساب ${row.fullName}`}
                          />
                          <span
                            className={`text-xs font-medium whitespace-nowrap ${
                              row.isActive ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {row.isActive ? "فعال" : "غیرفعال"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 num text-xs text-muted-foreground whitespace-nowrap">
                        {formatJalaliDateTime(new Date(row.createdAt))}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isManagerRole(row.role) && (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <ShieldCheck className="size-3" />
                              حساب مدیریتی
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label="عملیات کاربر">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-44">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                {row.fullName}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setEditTarget(row)} className="gap-2 cursor-pointer">
                                <Pencil className="size-4" />
                                ویرایش اطلاعات
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResetTarget(row)} className="gap-2 cursor-pointer">
                                <KeyRound className="size-4" />
                                بازنشانی گذرواژه
                              </DropdownMenuItem>
                              {row.role === "cashier" && (
                                <DropdownMenuItem
                                  onClick={() => toggleActive(row, !row.isActive)}
                                  className="gap-2 cursor-pointer"
                                  disabled={togglingId === row.id}
                                >
                                  {row.isActive ? (
                                    <>
                                      <UserX className="size-4" />
                                      غیرفعال‌سازی حساب
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="size-4" />
                                      فعال‌سازی حساب
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </div>

      {/* پنجره افزودن کاربر */}
      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          load();
          onChanged?.();
        }}
      />

      {/* پنجره بازنشانی گذرواژه */}
      <ResetPasswordDialog
        target={resetTarget}
        onOpenChange={(o) => {
          if (!o) setResetTarget(null);
        }}
        onDone={onChanged}
      />

      {/* پنجره ویرایش کاربر */}
      <EditUserDialog
        target={editTarget}
        user={user}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        onSaved={() => {
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}

// ---------------- پنجره افزودن کاربر ----------------

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // مجوزهای عملیاتی — پیش‌فرض نقش؛ با تغییر نقش بازمحاسبه می‌شود مگر دست‌خوردگی مدیر
  const [perms, setPerms] = useState<Perms>({ ...ROLE_PERM_DEFAULTS.cashier });
  const [permTouched, setPermTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName("");
      setUsername("");
      setPhone("");
      setPassword("");
      setRole("cashier");
      setShowPass(false);
      setErrors({});
      setPerms({ ...ROLE_PERM_DEFAULTS.cashier });
      setPermTouched(false);
    }
  }, [open]);

  /** تغییر نقش — پیش‌فرض‌های مجوز فقط وقتی هیچ چک‌باکسی دستی تغییر نکرده باشد بازمحاسبه می‌شود */
  const handleRoleChange = (v: string) => {
    const nextRole = v as Role;
    setRole(nextRole);
    if (!permTouched) setPerms({ ...ROLE_PERM_DEFAULTS[nextRole] });
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (fullName.trim().length < 3) e.fullName = "نام کامل حداقل ۳ نویسه باشد";
    if (!/^[a-z0-9_.-]{3,30}$/.test(username.trim().toLowerCase()))
      e.username = "نام کاربری باید ۳ تا ۳۰ نویسه لاتین کوچک، عدد، نقطه، خط تیره یا زیرخط باشد";
    const ph = digitsOnly(toEnDigits(phone));
    if (ph && !/^09\d{9}$/.test(ph)) e.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
    if (password.length < 6) e.password = "گذرواژه حداقل ۶ نویسه باشد";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          phone: digitsOnly(toEnDigits(phone)).trim(),
          password,
          role,
          canActAsCashier: perms.canActAsCashier,
          canApproveReturns: perms.canApproveReturns,
          canRecordPayment: perms.canRecordPayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`حساب ${ROLE_LABELS[role]} «${fullName.trim()}» ایجاد شد`);
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(data.error || "خطا در ایجاد حساب کاربری");
      }
    } catch {
      toast.error("خطا در ایجاد حساب کاربری");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent dir="rtl" className="w-[calc(100vw-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            افزودن کاربر جدید
          </DialogTitle>
          <DialogDescription>
            حساب تازه با نقش انتخابی ساخته می‌شود؛ نقش هر کاربر بعدها نیز قابل تغییر است.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>نقش کاربر</Label>
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger className="h-11 w-full" id="new-user-role" aria-label="نقش کاربر">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">صندوقدار</SelectItem>
                <SelectItem value="gm">مدیر کل (تأیید مرجوعی بدون پرداخت)</SelectItem>
                <SelectItem value="owner">مدیر فروشگاه</SelectItem>
                <SelectItem value="admin">مدیر ارشد سامانه</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-5 text-muted-foreground">{ROLE_HINTS[role]}</p>
          </div>

          {/* مجوزهای عملیاتی — پیش‌فرض بر اساس نقش، قابل بازنویسی */}
          <div className="space-y-2.5 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="size-4 text-primary" />
                مجوزهای عملیاتی
              </p>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {permTouched ? "تنظیم دستی" : "پیش‌فرض نقش"}
              </Badge>
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              مقدار پیش‌فرض بر اساس نقش انتخابی تنظیم می‌شود؛ اگر خودتان تغییری بدهید، با تغییر نقش دیگر بازمحاسبه نمی‌شود.
            </p>
            <div className="grid gap-2">
              {(Object.keys(PERM_META) as Array<keyof Perms>).map((key) => {
                const meta = PERM_META[key];
                const Icon = meta.icon;
                return (
                  <label
                    key={key}
                    className="flex items-start gap-2.5 min-h-11 rounded-lg border bg-background/60 px-3 py-2.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={perms[key]}
                      onCheckedChange={(v) => {
                        setPermTouched(true);
                        setPerms((p) => ({ ...p, [key]: v === true }));
                      }}
                      className="mt-0.5"
                      aria-label={meta.label}
                    />
                    <span className="space-y-0.5 min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        {meta.label}
                      </span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">
                        {meta.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashier-fullname">نام کامل</Label>
            <Input
              id="cashier-fullname"
              placeholder="مثلاً: فاطمه رضایی"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashier-username">نام کاربری</Label>
            <Input
              id="cashier-username"
              placeholder="مثلاً: fateme.rezaei"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11"
              dir="ltr"
              autoComplete="off"
            />
            {errors.username ? (
              <p className="text-xs text-destructive">{errors.username}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                فقط حروف لاتین کوچک، عدد و نویسه‌های . _ -
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashier-phone">
              شماره تماس <span className="text-muted-foreground font-normal">(اختیاری)</span>
            </Label>
            <Input
              id="cashier-phone"
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
              dir="ltr"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashier-password">گذرواژه</Label>
            <div className="relative">
              <Input
                id="cashier-password"
                type={showPass ? "text" : "password"}
                placeholder="حداقل ۶ نویسه"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pe-11"
                dir="ltr"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPass ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            ایجاد حساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- پنجره بازنشانی گذرواژه ----------------

function ResetPasswordDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: UserRow | null;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPassword("");
    setShowPass(false);
  }, [target]);

  const submit = async () => {
    if (!target || submitting) return;
    if (password.length < 6) {
      toast.error("گذرواژه حداقل ۶ نویسه باشد");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`گذرواژه «${target.fullName}» بازنشانی شد`);
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(data.error || "خطا در بازنشانی گذرواژه");
      }
    } catch {
      toast.error("خطا در بازنشانی گذرواژه");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent dir="rtl" className="w-[calc(100vw-1.5rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            بازنشانی گذرواژه
          </DialogTitle>
          <DialogDescription>
            گذرواژه جدید برای حساب «{target?.fullName}» (
            <span className="num" dir="ltr">
              {target?.username}
            </span>
            ) تعیین کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reset-password">گذرواژه جدید</Label>
          <div className="relative">
            <Input
              id="reset-password"
              type={showPass ? "text" : "password"}
              placeholder="حداقل ۶ نویسه"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-11 pe-11"
              dir="ltr"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPass ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-5">
            پس از بازنشانی، صندوقدار باید در ورود بعدی از گذرواژه جدید استفاده کند.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            بازنشانی گذرواژه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- پنجره ویرایش کاربر ----------------

function EditUserDialog({
  target,
  user,
  onOpenChange,
  onSaved,
}: {
  target: UserRow | null;
  user: SessionUser;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [showPass, setShowPass] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // مجوزهای عملیاتی — پیش‌نویس سوییچ‌ها + آخرین مقدار ذخیره‌شده (برای بازگردانی هنگام خطا)
  const [perms, setPerms] = useState<Perms>({ ...ROLE_PERM_DEFAULTS.cashier });
  const [savedPerms, setSavedPerms] = useState<Perms>({ ...ROLE_PERM_DEFAULTS.cashier });
  const [permSaving, setPermSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setFullName(target.fullName);
      setUsername(target.username);
      setPhone(target.phone ?? "");
      setPassword("");
      setRole(target.role);
      setShowPass(false);
      setIsActive(target.isActive);
      const next: Perms = {
        canActAsCashier: target.canActAsCashier === true,
        canApproveReturns: target.canApproveReturns === true,
        canRecordPayment: target.canRecordPayment === true,
      };
      setPerms(next);
      setSavedPerms(next);
      setPermSaving(false);
      setErrors({});
    }
  }, [target]);

  /** تغییر فوری مجوز — هر سه مقدار همیشه با هم ارسال می‌شوند؛ خطا → بازگردانی سوییچ */
  const togglePerm = async (key: keyof Perms, next: boolean) => {
    if (!target || permSaving) return;
    const draft: Perms = { ...perms, [key]: next };
    setPerms(draft);
    setPermSaving(true);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedPerms(draft);
        toast.success(`مجوزهای «${target.fullName}» به‌روزرسانی شد`);
        onSaved(); // نوسازی فهرست کاربران بدون بستن پنجره
      } else {
        setPerms(savedPerms);
        toast.error(data.error || "خطا در تغییر مجوزهای کاربر");
      }
    } catch {
      setPerms(savedPerms);
      toast.error("خطا در تغییر مجوزهای کاربر");
    } finally {
      setPermSaving(false);
    }
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (fullName.trim().length < 3) e.fullName = "نام کامل حداقل ۳ نویسه باشد";
    if (!/^[a-z0-9_.-]{3,30}$/.test(username.trim().toLowerCase()))
      e.username = "نام کاربری باید ۳ تا ۳۰ نویسه لاتین کوچک، عدد، نقطه، خط تیره یا زیرخط باشد";
    const ph = digitsOnly(toEnDigits(phone));
    if (ph && !/^09\d{9}$/.test(ph)) e.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
    if (password && password.length < 6) e.password = "گذرواژه جدید حداقل ۶ نویسه باشد";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!target || submitting) return;
    if (!validate()) return;

    // تنها فیلدهای تغییر‌یافته ارسال می‌شود
    const fullNameT = fullName.trim();
    const usernameT = username.trim().toLowerCase();
    const phoneT = digitsOnly(toEnDigits(phone));
    const payload: Record<string, string | boolean> = {};
    if (fullNameT !== target.fullName) payload.fullName = fullNameT;
    if (usernameT !== target.username) payload.username = usernameT;
    if (phoneT !== (target.phone ?? "")) payload.phone = phoneT; // رشته خالی = پاک‌کردن
    if (password) payload.password = password;
    if (role !== target.role) payload.role = role;
    if (!isManagerRole(target.role) && target.id !== user.id && isActive !== target.isActive)
      payload.isActive = isActive;

    if (Object.keys(payload).length === 0) {
      toast.info("تغییری برای ذخیره وجود ندارد");
      return;
    }

    const roleChanged = payload.role !== undefined;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          roleChanged
            ? `کاربر به‌روزرسانی شد — نقش جدید: ${ROLE_LABELS[role]}`
            : "کاربر به‌روزرسانی شد"
        );
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(data.error || "خطا در به‌روزرسانی کاربر");
      }
    } catch {
      toast.error("خطا در به‌روزرسانی کاربر");
    } finally {
      setSubmitting(false);
    }
  };

  const isManagerRow = !!target && isManagerRole(target.role);
  const isOwnRow = !!target && target.id === user.id;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        dir="rtl"
        className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            ویرایش کاربر
          </DialogTitle>
          <DialogDescription>
            ویرایش مشخصات و نقش حساب «{target?.fullName}» — تنها فیلدهای تغییر‌یافته ذخیره می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>نقش کاربر</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              disabled={isOwnRow}
            >
              <SelectTrigger className="h-11 w-full" id="edit-user-role" aria-label="نقش کاربر">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">صندوقدار</SelectItem>
                <SelectItem value="gm">مدیر کل (تأیید مرجوعی بدون پرداخت)</SelectItem>
                <SelectItem value="owner">مدیر فروشگاه</SelectItem>
                <SelectItem value="admin">مدیر ارشد سامانه</SelectItem>
              </SelectContent>
            </Select>
            {isOwnRow ? (
              <p className="text-[11px] leading-5 text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3 shrink-0" />
                نقش حساب خودتان قابل تغییر نیست.
              </p>
            ) : (
              <p className="text-[11px] leading-5 text-muted-foreground">{ROLE_HINTS[role]}</p>
            )}
            {isManagerRow && !isOwnRow && (
              <p className="text-[11px] leading-5 text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3 shrink-0" />
                تغییر نقش حساب‌های مدیریتی با محدودیت امنیتی انجام می‌شود.
              </p>
            )}
          </div>

          {/* مجوزهای عملیاتی — ذخیره فوری در لحظه تغییر (مستقل از دکمه «ذخیره تغییرات») */}
          <div className="space-y-2.5 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="size-4 text-primary" />
                مجوزهای عملیاتی
              </p>
              {permSaving ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  در حال ذخیره…
                </span>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  ذخیره فوری
                </Badge>
              )}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              هر تغییر بلافاصله ذخیره می‌شود؛ با تغییر و ذخیره نقش، مجوزها به پیش‌فرض نقش جدید بازمی‌گردند.
            </p>
            <div className="grid gap-2">
              {(Object.keys(PERM_META) as Array<keyof Perms>).map((key) => {
                const meta = PERM_META[key];
                const Icon = meta.icon;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2.5 min-h-11"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <Label
                        htmlFor={`edit-perm-${key}`}
                        className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                      >
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        {meta.label}
                      </Label>
                      <p className="text-[11px] leading-4 text-muted-foreground">{meta.hint}</p>
                    </div>
                    <Switch
                      id={`edit-perm-${key}`}
                      checked={perms[key]}
                      disabled={permSaving}
                      onCheckedChange={(v) => togglePerm(key, v)}
                      aria-label={meta.label}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fullname">نام کامل</Label>
            <Input
              id="edit-fullname"
              placeholder="مثلاً: زهرا محمدی"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-username">نام کاربری</Label>
            <Input
              id="edit-username"
              placeholder="مثلاً: zahra.mohammadi"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11"
              dir="ltr"
              autoComplete="off"
            />
            {errors.username ? (
              <p className="text-xs text-destructive">{errors.username}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                فقط حروف لاتین کوچک، عدد و نویسه‌های . _ -
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">
              شماره تماس <span className="text-muted-foreground font-normal">(اختیاری)</span>
            </Label>
            <Input
              id="edit-phone"
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
              dir="ltr"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">
              گذرواژه جدید <span className="text-muted-foreground font-normal">(اختیاری)</span>
            </Label>
            <div className="relative">
              <Input
                id="edit-password"
                type={showPass ? "text" : "password"}
                placeholder="برای حفظ گذرواژه فعلی خالی بگذارید"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pe-11"
                dir="ltr"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPass ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Switch
                id="edit-active"
                checked={isActive}
                disabled={isManagerRow || isOwnRow}
                onCheckedChange={setIsActive}
                aria-label="وضعیت حساب"
              />
              <Label htmlFor="edit-active" className="cursor-pointer text-sm">
                وضعیت حساب
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
          {isManagerRow && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              وضعیت حساب‌های مدیریتی (مدیر ارشد / مدیر فروشگاه) از این‌جا تغییر نمی‌کند.
            </p>
          )}
          {isOwnRow && !isManagerRow && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              وضعیت حساب خودتان قابل تغییر نیست.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
