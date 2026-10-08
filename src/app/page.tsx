"use client";

// هایپر زیتون — پوسته اصلی برنامه
// ورود → فضای کار صندوقدار (ثبت مرجوعی) / مدیر (داشبورد، پرداخت، آرشیو، بانک کالا، کاربران، فعالیت، مدیریت سامانه)
// برندینگ سربرگ/پابرگ از تنظیمات سامانه خوانده می‌شود (مرکز مدیریت سامانه)
// توسعه: کیانوش صفاپور (Kianoosh Safapour) — نسخه v0.5.0 کدنام «بهار»
import { useCallback, useEffect, useState } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2, RotateCcw, Hourglass, Archive, LayoutDashboard,
  ScanLine, History, Database, Users, Activity as ActivityIcon, Leaf, ShieldCheck, UserRound,
} from "lucide-react";

import { LoginView } from "@/components/hz/login-view";
import { ReturnForm } from "@/components/hz/return-form";
import { ReturnHistory, ExportReturnsButton } from "@/components/hz/return-history";
import { OwnerDashboard } from "@/components/hz/owner-dashboard";
import { NotificationBell } from "@/components/hz/notification-bell";
import { ProductsView } from "@/components/hz/products-view";
import { UsersView } from "@/components/hz/users-view";
import { CustomersView } from "@/components/hz/customers-view";
import { ActivityView } from "@/components/hz/activity-view";
import { ProfileMenu } from "@/components/hz/profile-menu";
import { AdminCenter } from "@/components/hz/admin-center";
import { BrandEmblem } from "@/components/hz/ornaments";
import { ThemeToggle } from "@/components/hz/theme-toggle";
import {
  DEFAULT_SETTINGS,
  ROLE_LABELS,
  canSubmitReturns,
  isManagerRole,
  lastNameInitial,
  type SessionUser,
  type StoreSettings,
} from "@/components/hz/types";

const APP_VERSION = "v0.6.0";
const APP_CODENAME = "مهر";

/** ارتفاع لمسی استاندارد ۴۴ پیکسل برای تب‌ها در موبایل (۹ پیکسل دسکتاپ) */
const TAB_TOUCH =
  "gap-1.5 min-h-11 px-3 md:min-h-0 md:px-2 transition-[color,background-color,box-shadow] duration-200 hover:text-foreground data-[state=inactive]:hover:bg-accent/70";

/** پوسته جهت برای همه اجزای رادیکس — راست‌به‌چپ در کل سامانه */
export default function Home() {
  return (
    <DirectionProvider dir="rtl">
      <HomeInner />
    </DirectionProvider>
  );
}

function HomeInner() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("form");

  // برای نوسازی داشبورد پس از ثبت پرداخت و …
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // برندینگ سامانه از تنظیمات (نام فروشگاه، شهر، مدیر، اعتبار توسعه‌دهنده)
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.user) {
          setUser(d.user);
          setTab(isManagerRole(d.user.role) ? "dashboard" : "form");
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setBooting(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // خواندن تنظیمات برندینگ پس از ورود (و پس از هر تغییر از مرکز مدیریت — bumpRefresh)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings"))))
      .then((d: StoreSettings) => {
        if (!cancelled && d && typeof d.storeName === "string") setSettings(d);
      })
      .catch(() => {
        // خطا بحرانی نیست — مقادیر پیش‌فرض نمایش داده می‌شود
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshTick]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("با سلام، از حساب خود خارج شدید 🌿");
    } catch {
      toast.error("خروج ناموفق بود");
    }
    setUser(null);
    setSettings(null);
    setTab("form");
  }

  // ---- صفحه بارگذاری اولیه ----
  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 pattern-girih">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <BrandEmblem size={88} />
        </motion.div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-sm font-semibold">در حال آماده‌سازی سامانه…</p>
        </div>
      </div>
    );
  }

  // ---- صفحه ورود ----
  if (!user) {
    return (
      <LoginView
        onLogin={(u) => {
          setUser(u);
          setTab(isManagerRole(u.role) ? "dashboard" : "form");
        }}
      />
    );
  }

  const isManager = isManagerRole(user.role);
  // مدیرانی که خودشان هم صندوقداری می‌کنند (مثل خانم لطفی) — زبانه‌های فضای صندوقدار
  const managerIsCashier = isManager && canSubmitReturns(user);

  // برندینگ: نام فروشگاه با آخرین واژه به رنگ اصلی
  const branding: StoreSettings = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
  const storeNameWords = branding.storeName.trim().split(/\s+/);
  const storeNameLast = storeNameWords.pop() ?? "";
  const storeNameRest = storeNameWords.join(" ");

  return (
    <div className="min-h-screen flex flex-col pattern-girih">
      {/* سربرگ چسبان */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandEmblem size={38} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="font-extrabold text-base sm:text-lg leading-tight truncate">
                {storeNameRest.length > 0 ? (
                  <>
                    {storeNameRest} <span className="text-primary">{storeNameLast}</span>
                  </>
                ) : (
                  <span className="text-primary">{storeNameLast}</span>
                )}
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block leading-tight">
                سامانه مرجوعی کالا — {branding.storeCity}
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="hidden md:inline-flex shrink-0 border-primary/30 text-primary num"
            title={`نسخه ${APP_VERSION} — کدنام ${APP_CODENAME}`}
          >
            {APP_VERSION} · «{APP_CODENAME}»
          </Badge>

          <div className="flex-1" />

          {/* سوییچ تم روشن/تیره — انتخاب کاربر */}
          <ThemeToggle className="shrink-0" />

          {/* اعلان مدیران: مرجوعی‌های در انتظار پرداخت */}
          {isManager && (
            <NotificationBell
              user={user}
              onOpenPending={() => setTab("pending")}
            />
          )}

          {/* کاربر جاری */}
          <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-1.5">
            <div className="text-right hidden sm:block leading-tight">
              <p className="text-sm font-bold truncate max-w-32 md:max-w-40">
                {user.fullName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            <span
              className={`flex size-9 items-center justify-center rounded-full font-extrabold text-sm shrink-0 ${
                isManager
                  ? user.role === "gm"
                    ? "bg-chart-5/25 text-chart-3 border border-chart-5/50"
                    : "bg-chart-2/20 text-chart-2 border border-chart-2/40"
                  : "bg-primary/15 text-primary border border-primary/30"
              }`}
              aria-hidden="true"
            >
              {lastNameInitial(user.fullName)}
            </span>
          </div>

          {/* منوی حساب من: ویرایش مشخصات، تغییر گذرواژه و خروج */}
          <ProfileMenu
            user={user}
            onUserUpdated={(u) => setUser(u)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* بدنه اصلی */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={isManager ? "manager" : "cashier"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {isManager ? (
              /* ---------- فضای مدیران: آقای نوروزی و کیانوش صفاپور ---------- */
              <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <TabsList className="h-auto p-1.5 flex-wrap justify-start gap-1">
                  <TabsTrigger value="dashboard" className={TAB_TOUCH}>
                    <LayoutDashboard className="size-4" />
                    داشبورد
                  </TabsTrigger>
                  <TabsTrigger value="pending" className={TAB_TOUCH}>
                    <Hourglass className="size-4" />
                    در انتظار پرداخت
                  </TabsTrigger>
                  <TabsTrigger value="archive" className={TAB_TOUCH}>
                    <Archive className="size-4" />
                    آرشیو مرجوعی‌ها
                  </TabsTrigger>
                  <TabsTrigger value="customers" className={TAB_TOUCH}>
                    <UserRound className="size-4" />
                    دفترچه مشتریان
                  </TabsTrigger>
                  <TabsTrigger value="products" className={TAB_TOUCH}>
                    <Database className="size-4" />
                    بانک کالا
                  </TabsTrigger>
                  <TabsTrigger value="users" className={TAB_TOUCH}>
                    <Users className="size-4" />
                    کاربران
                  </TabsTrigger>
                  <TabsTrigger value="activity" className={TAB_TOUCH}>
                    <ActivityIcon className="size-4" />
                    فعالیت‌ها
                  </TabsTrigger>
                  <TabsTrigger value="admin" className={TAB_TOUCH}>
                    <ShieldCheck className="size-4" />
                    مدیریت سامانه
                  </TabsTrigger>
                  {managerIsCashier && (
                    <>
                      <TabsTrigger value="form" className={TAB_TOUCH}>
                        <ScanLine className="size-4" />
                        ثبت مرجوعی جدید
                      </TabsTrigger>
                      <TabsTrigger value="myhistory" className={TAB_TOUCH}>
                        <History className="size-4" />
                        تاریخچه من
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>

                <TabsContent value="dashboard" className="mt-2">
                  <OwnerDashboard
                    key={`dash-${refreshTick}`}
                    user={user}
                    onNavigate={(t) => setTab(t)}
                  />
                </TabsContent>

                <TabsContent value="pending" className="mt-2">
                  <ReturnHistory
                    key={`pend-${tab}-${refreshTick}`}
                    user={user}
                    statusFilter="active"
                    onChanged={bumpRefresh}
                    title="مرجوعی‌های در جریان — در انتظار تأیید مدیر کل یا انتقال وجه"
                  />
                </TabsContent>

                <TabsContent value="archive" className="mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-extrabold text-lg flex items-center gap-2">
                        <Archive className="size-5 text-primary" />
                        آرشیو کامل مرجوعی‌ها
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        همه درخواست‌های ثبت‌شده و پرداخت‌شده — خروجی سازگار با هلو APEX
                      </p>
                    </div>
                    <ExportReturnsButton />
                  </div>
                  <ReturnHistory
                    key={`arch-${tab}-${refreshTick}`}
                    user={user}
                    statusFilter="all"
                    onChanged={bumpRefresh}
                  />
                </TabsContent>

                <TabsContent value="customers" className="mt-2">
                  <CustomersView />
                </TabsContent>

                <TabsContent value="products" className="mt-2">
                  <ProductsView user={user} />
                </TabsContent>

                <TabsContent value="users" className="mt-2">
                  <UsersView user={user} onChanged={bumpRefresh} />
                </TabsContent>

                <TabsContent value="activity" className="mt-2">
                  <ActivityView user={user} />
                </TabsContent>

                <TabsContent value="admin" className="mt-2">
                  <AdminCenter user={user} onChanged={bumpRefresh} />
                </TabsContent>

                {managerIsCashier && (
                  <>
                    <TabsContent value="form" className="mt-2">
                      <ReturnForm user={user} />
                    </TabsContent>
                    <TabsContent value="myhistory" className="mt-2">
                      <ReturnHistory
                        key={`my-${tab}-${refreshTick}`}
                        user={user}
                        statusFilter="all"
                        mine
                        onChanged={bumpRefresh}
                        title="تاریخچه مرجوعی‌های ثبت‌شده توسط شما"
                      />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            ) : (
              /* ---------- فضای صندوقدار ---------- */
              <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <TabsList className="h-auto p-1.5 flex-wrap justify-start gap-1">
                  <TabsTrigger value="form" className={TAB_TOUCH}>
                    <ScanLine className="size-4" />
                    ثبت مرجوعی جدید
                  </TabsTrigger>
                  <TabsTrigger value="history" className={TAB_TOUCH}>
                    <History className="size-4" />
                    تاریخچه من
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="mt-2">
                  <ReturnForm user={user} />
                </TabsContent>

                <TabsContent value="history" className="mt-2">
                  <ReturnHistory
                    key={`my-${tab}-${refreshTick}`}
                    user={user}
                    statusFilter="all"
                    onChanged={bumpRefresh}
                    title="تاریخچه مرجوعی‌های ثبت‌شده توسط شما"
                  />
                </TabsContent>
              </Tabs>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* پابرگ چسبان پایین */}
      <footer className="mt-auto border-t bg-card/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-right">
          <p className="text-xs text-muted-foreground leading-6">
            <span className="text-primary font-bold">🍃 {branding.storeName}</span> — {branding.storeCity}
            <span className="mx-2 opacity-40">|</span>
            مدیریت: {branding.managerName}
          </p>
          <p className="text-xs text-muted-foreground leading-6 flex items-center gap-1.5 flex-wrap justify-center">
            <Leaf className="size-3.5 text-primary/70" aria-hidden="true" />
            طراحی و توسعه:
            <span className="font-bold text-foreground">
              {branding.developerCredit || "کیانوش صفاپور"}
            </span>
            <span className="mx-1 opacity-40">—</span>
            <span className="num text-primary/80" title={`کدنام ${APP_CODENAME}`}>
              {APP_VERSION} «{APP_CODENAME}»
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
