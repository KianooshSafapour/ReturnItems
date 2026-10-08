"use client";

// صفحه ورود — با هویت بصری رفسنجان (کویر، نخل، پسته، شمسه)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogIn, Loader2, User, Lock } from "lucide-react";
import { BrandEmblem, DesertScene, IlluminatedDivider } from "./ornaments";
import { ThemeToggle } from "./theme-toggle";
import type { SessionUser } from "./types";

interface LoginViewProps {
  onLogin: (user: SessionUser) => void;
}

const FEATURES = [
  { icon: "🥜", title: "ثبت سریع مرجوعی", desc: "با اسکن بارکد یا دوربین گوشی" },
  { icon: "🏦", title: "پرداخت امن", desc: "تأیید و انتقال وجه توسط مدیریت" },
  { icon: "📋", title: "آرشیو کامل", desc: "تاریخچه شفاف هر صندوقدار" },
  { icon: "📊", title: "خروجی هلو APEX", desc: "سازگار با نرم‌افزار حسابداری" },
];

export function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!username.trim() || !password) {
      toast.error("نام کاربری و گذرواژه را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ورود ناموفق بود");
        return;
      }
      toast.success(`خوش آمدید، ${data.user.fullName} 🌿`);
      onLogin(data.user);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden pattern-girih">
      {/* سوییچ تم روشن/تیره — گوشه بالا-چپ (در RTL) */}
      <div className="absolute top-4 end-4 z-20">
        <ThemeToggle />
      </div>
      <main className="flex-1 grid lg:grid-cols-2 items-stretch max-w-6xl w-full mx-auto gap-0">
        {/* فرم ورود */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-center p-6 sm:p-10 order-2 lg:order-1"
          aria-label="فرم ورود"
        >
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="rounded-3xl bg-card border border-primary/20 shadow-xl p-5 glow-pistachio mb-5 arch">
                <BrandEmblem size={64} />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                هایپر <span className="text-primary text-gold-glow">زیتون</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-6">
                سامانه ثبت و پیگیری مرجوعی کالا
                <br />
                <span className="num">رفسنجان، کرمان</span> — مدیریت: آقای نوروزی
              </p>
            </div>

            <IlluminatedDivider className="mb-8" />

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">
                  نام کاربری
                </Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="username"
                    dir="ltr"
                    className="text-left pl-3 pr-10 h-12"
                    placeholder="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  گذرواژه
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    className="text-left pl-3 pr-10 h-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-bold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    در حال ورود…
                  </>
                ) : (
                  <>
                    <LogIn className="size-5" />
                    ورود به سامانه
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-[11px] leading-6 text-muted-foreground/80 text-center">
              در صورت فراموشی گذرواژه، به مدیر سامانه (کیانوش صفاپور) مراجعه کنید.
            </p>
          </div>
        </motion.section>

        {/* پنل فرهنگی */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative order-1 lg:order-2 hidden lg:flex flex-col justify-center p-12"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/15 via-transparent to-chart-2/10 rounded-s-[3rem] border-e border-primary/15 pattern-tile" />
          <div className="absolute inset-x-0 bottom-0 h-48 opacity-80">
            <DesertScene className="w-full h-full" />
          </div>
          <div className="relative z-10 space-y-8">
            <div>
              <p className="text-chart-2 font-bold mb-3 tracking-wide">🌿 سرزمین پسته و نخل</p>
              <h2 className="text-4xl font-extrabold leading-[1.4]">
                هر مرجوعی،
                <br />
                <span className="text-primary">شفاف و قابل‌ردیابی</span>
              </h2>
              <p className="mt-4 text-muted-foreground leading-8 max-w-md">
                صندوقدار محترم، با این سامانه بازگشت کالاهای مشتریان را در چند ثانیه ثبت
                کنید تا مدیریت محترم، وجه آن را به کارت بانکی مشتری منتقل کند.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-primary/15 bg-card/70 backdrop-blur p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                >
                  <span className="text-2xl">{f.icon}</span>
                  <p className="font-bold text-sm mt-2">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-5">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 max-w-md leading-6 relative z-10">
              «نیازهای مشتری، رد پای ماست تا بهتر خدمت کنیم.» — از بازار سنتی رفسنجان
              تا هایپر زیتون
            </p>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
