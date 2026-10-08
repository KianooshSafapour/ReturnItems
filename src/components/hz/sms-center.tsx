"use client";

// مرکز پیامک — اتصال پنل، مدیریت قالب‌های پیام و تاریخچه ارسال
// ویژه مدیران سامانه (آقای نوروزی و کیانوش صفاپور)
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Banknote, CheckCircle2, ClipboardList, Info, ListChecks, Loader2, MessageCircle, Pencil,
  Plus, RefreshCw, RotateCcw, Send, Smartphone, Trash2, TriangleAlert, ExternalLink,
  UserCheck, Zap,
} from "lucide-react";
import { formatMoney, toFaDigits } from "@/lib/money";
import { formatJalaliDateTime } from "@/lib/jalali";
import {
  DEFAULT_CUSTOMER_SUBMIT_TEMPLATE, DEFAULT_OWNER_NOTIFY_TEMPLATE, SMS_PLACEHOLDERS,
  renderSmsTemplate, smsSegments,
} from "@/lib/sms";
import { cn } from "@/lib/utils";
import { IlluminatedDivider } from "./ornaments";
import type { SessionUser, SmsConfigDTO, SmsTemplateDTO, SmsLogRow } from "./types";

/* ==========================================================================
   مرکز پیامک — ریشه
   ========================================================================== */

export function SmsCenter({ user }: { user: SessionUser }) {
  return (
    <section aria-label="مرکز پیامک" className="space-y-5">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <MessageCircle className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-chart-2">اطلاع‌رسانی خودکار مشتریان</p>
            <h3 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-2xl">مرکز پیامک</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
              اتصال پنل پیامکی، کلیدهای پیامک‌های خودکار، قالب‌های پیام و تاریخچه ارسال به مشتریان
            </p>
          </div>
        </div>
        <IlluminatedDivider />
      </motion.header>

      <SmsConnectionCard />
      <SmsAutoMessagesCard />
      <SmsTemplatesCard user={user} />
      <SmsLogsCard />
    </section>
  );
}

/* ==========================================================================
   کارت ۱ — اتصال پنل پیامک
   ========================================================================== */

interface ProviderOption {
  id: string;
  label: string;
  needs: string[];
  hint: string;
  docs: string | null;
}

function SmsConnectionCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<SmsConfigDTO | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // فیلدهای فرم (محرمانه‌ها فقط هنگام تایپ پر می‌شوند)
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sender, setSender] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customMethod, setCustomMethod] = useState("POST");
  const [customHeaders, setCustomHeaders] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sms-config", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as SmsConfigDTO;
        setConfig(d);
        setEnabled(d.enabled);
        setProvider(d.provider ?? "");
        setSender(d.sender ?? "");
        setUsername(d.username ?? "");
        setCustomUrl(d.customUrl ?? "");
        setCustomMethod(d.customMethod || "POST");
        setCustomHeaders(d.customHeaders ?? "");
        setCustomBody(d.customBody ?? "");
        if (Array.isArray(d.providers)) setProviders(d.providers);
      }
    } catch {
      toast.error("خطا در دریافت تنظیمات پیامک");
    } finally {
      setLoading(false);
    }
  }, []);

  // بارگذاری اولیه پیکربندی — با پرچم لغو
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/sms-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sms-config"))))
      .then((d: SmsConfigDTO) => {
        if (cancelled) return;
        setConfig(d);
        setEnabled(d.enabled);
        setProvider(d.provider ?? "");
        setSender(d.sender ?? "");
        setUsername(d.username ?? "");
        setCustomUrl(d.customUrl ?? "");
        setCustomMethod(d.customMethod || "POST");
        setCustomHeaders(d.customHeaders ?? "");
        setCustomBody(d.customBody ?? "");
        if (Array.isArray(d.providers)) setProviders(d.providers);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = providers.find((p) => p.id === provider) ?? null;
  const needsApiKey = selected?.needs.includes("apiKey");
  const needsUsername = selected?.needs.includes("username");
  const needsPassword = selected?.needs.includes("password");
  const needsSender = selected?.needs.includes("sender");
  const isCustom = provider === "custom";

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: enabled ? "1" : "",
        provider,
        sender,
      };
      // محرمانه‌ها: خالی = پاک‌نشده (تنها اگر کاربر چیزی تایپ کند ارسال می‌شود)
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      if (username.trim() || config?.username) payload.username = username.trim();
      if (password.trim()) payload.password = password.trim();
      if (isCustom) {
        payload.customUrl = customUrl;
        payload.customMethod = customMethod;
        payload.customHeaders = customHeaders;
        payload.customBody = customBody;
      }
      const res = await fetch("/api/admin/sms-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.ready ? "تنظیمات پنل پیامک ذخیره شد — پنل آماده ارسال است ✅" : "تنظیمات ذخیره شد (هنوز ناقص است)");
        setConfig(d as SmsConfigDTO);
        setApiKey("");
        setPassword("");
      } else {
        toast.error(d.error || "خطا در ذخیره تنظیمات");
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (testing) return;
    const phone = testPhone.trim();
    if (!/^09\d{9}$/.test(phone.replace(/\D/g, ""))) {
      toast.error("شماره موبایل آزمایشی معتبر وارد کنید (مثل ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json();
      if (res.ok && d.sent) {
        toast.success("پیامک آزمایشی ارسال شد ✅", {
          description: d.messageId ? `شناسه پیام در پنل: ${d.messageId}` : undefined,
        });
      } else {
        toast.error(d.error || "ارسال پیامک آزمایشی ناموفق بود", {
          description: d.responseSummary ? String(d.responseSummary).slice(0, 160) : undefined,
          duration: 9000,
        });
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="pattern-girih border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <Smartphone className="size-5 text-primary" />
          اتصال پنل پیامک
          {config?.ready ? (
            <Badge className="gap-1 border border-primary/30 bg-primary/10 text-primary">
              <CheckCircle2 className="size-3" />
              آماده ارسال
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <TriangleAlert className="size-3" />
              {config?.enabled ? "ناقص" : "غیرفعال"}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 mr-auto"
            onClick={load}
            aria-label="بازخوانی"
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardTitle>
        <CardDescription className="leading-6">
          پس از پیکربندی، با هر ثبت پرداخت مرجوعی، پیام تأیید به‌صورت خودکار برای مشتری ارسال
          می‌شود. پنل‌های پشتیبانی‌شده: فراز اس‌ام‌اس (IPPanel)، ملی پیامک، پیامیتو، پیام رسان،
          بهین پیامک، اس‌ام‌اس آی‌آر، وب‌وان اس‌ام‌اس و هر پنل دیگری (حالت سفارشی).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* فعال/غیرفعال */}
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">ارسال پیامک به مشتریان</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              فعال‌سازی ارسال خودکار پیام تأیید پرداخت
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="فعال‌سازی پنل پیامک" />
        </div>

        {/* انتخاب پنل */}
        <div className="space-y-2">
          <Label>پنل پیامکی</Label>
          <Select value={provider || "__none"} onValueChange={(v) => setProvider(v === "__none" ? "" : v)}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="انتخاب پنل پیامک…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— انتخاب نشده —</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <p className="text-[11px] text-muted-foreground leading-6 rounded-lg bg-muted/50 border border-dashed px-3 py-2 flex items-start gap-1.5">
              <Info className="size-3.5 shrink-0 mt-1 text-primary" />
              <span>
                {selected.hint}
                {selected.docs && (
                  <>
                    {" "}
                    <a
                      href={selected.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
                      dir="ltr"
                    >
                      مستندات <ExternalLink className="size-3" />
                    </a>
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        {provider && !isCustom && (
          <div className="grid gap-4 sm:grid-cols-2">
            {needsApiKey && (
              <div className="space-y-2">
                <Label htmlFor="sms-apikey">کلید API پنل</Label>
                <Input
                  id="sms-apikey"
                  className="ltr-value h-11"
                  type="password"
                  autoComplete="off"
                  placeholder={config?.hasApiKey ? `تنظیم شده ✓ (${config.apiKeyMasked}) — برای تغییر وارد کنید` : "مثال: ROlxxxxxim-xxxx="}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}
            {needsUsername && (
              <div className="space-y-2">
                <Label htmlFor="sms-username">نام کاربری وب‌سرویس</Label>
                <Input
                  id="sms-username"
                  className="ltr-value h-11"
                  autoComplete="off"
                  placeholder={config?.username || "نام کاربری پنل"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}
            {needsPassword && (
              <div className="space-y-2">
                <Label htmlFor="sms-password">گذرواژه وب‌سرویس</Label>
                <Input
                  id="sms-password"
                  className="ltr-value h-11"
                  type="password"
                  autoComplete="new-password"
                  placeholder={config?.hasPassword ? `تنظیم شده ✓ (${config.passwordMasked}) — برای تغییر وارد کنید` : "گذرواژه پنل"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {needsSender && (
              <div className="space-y-2">
                <Label htmlFor="sms-sender">شماره خط ارسال</Label>
                <Input
                  id="sms-sender"
                  className="num h-11"
                  inputMode="numeric"
                  placeholder={provider === "faraz" ? "مثال: +۹۸۳۰۰۰۵۰۵" : "مثال: ۳۰۰۰۴۰۴۰ یا ۵۰۰۰…"}
                  value={sender}
                  onChange={(e) => setSender(e.target.value.trim())}
                />
              </div>
            )}
          </div>
        )}

        {/* پنل سفارشی */}
        {isCustom && (
          <div className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Info className="size-4" />
              پنل سفارشی — درخواست HTTP دلخواه با جای‌نگهدارها
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sms-custom-url">آدرس درخواست (URL)</Label>
                <Input
                  id="sms-custom-url"
                  dir="ltr"
                  className="text-left h-11"
                  placeholder="https://panel.example.com/api/send?to={{phone}}&text={{message}}"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>متد</Label>
                <Select value={customMethod} onValueChange={setCustomMethod}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-custom-headers">هدرها (JSON — اختیاری)</Label>
              <Textarea
                id="sms-custom-headers"
                dir="ltr"
                rows={3}
                className="text-left text-xs font-mono"
                placeholder={`{"Authorization": "کلید شما", "Content-Type": "application/json"}`}
                value={customHeaders}
                onChange={(e) => setCustomHeaders(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-custom-body">بدنه درخواست (JSON — برای POST)</Label>
              <Textarea
                id="sms-custom-body"
                dir="ltr"
                rows={4}
                className="text-left text-xs font-mono"
                placeholder={`{"sender": "{{sender}}", "receptor": "{{phone}}", "message": "{{message}}"}`}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground leading-5">
                جای‌نگهدارها: <span dir="ltr" className="num">{"{{phone}}"}</span> (۰۹…)،
                <span dir="ltr" className="num"> {"{{phone_e164}}"}</span> (+۹۸…)،
                <span dir="ltr" className="num"> {"{{message}}"}</span> (متن کدگذاری‌شده برای URL / خام در JSON)،
                <span dir="ltr" className="num"> {"{{sender}}"}</span>
              </p>
            </div>
          </div>
        )}

        {config && !config.ready && config.enabled && config.missing.length > 0 && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <TriangleAlert className="size-4 shrink-0" />
            برای فعال‌شدن ارسال، این موارد را کامل کنید: {config.missing.join("، ")}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={save} disabled={saving} className="gap-1.5 flex-1 h-11">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            ذخیره تنظیمات پنل
          </Button>
        </div>

        {/* ارسال آزمایشی */}
        {config?.ready && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-bold text-primary flex items-center gap-1.5">
              <Send className="size-4" />
              پیامک آزمایشی
            </p>
            <p className="text-xs text-muted-foreground leading-6">
              پیش از استفاده واقعی، با شماره موبایل خودتان ارسال را بیازمایید.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                dir="ltr"
                inputMode="numeric"
                className="num text-left h-11 flex-1"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                aria-label="شماره موبایل آزمایشی"
              />
              <Button variant="outline" onClick={sendTest} disabled={testing} className="gap-1.5 h-11">
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                ارسال آزمایشی
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ==========================================================================
   کارت ۲ — پیامک‌های خودکار سامانه (لایه ۱ — کلید سراسری هر نوع پیام)
   لایه ۲: خاموش/روشن‌کردن جداگانه هر مشتری در دفترچه مشتریان
   ========================================================================== */

/** جای‌نگهدارهای قالب «ثبت مرجوعی ← اطلاع به مشتری» */
const CUSTOMER_SUBMIT_TOKENS = [
  "{{مشتری}}",
  "{{فروشگاه}}",
  "{{شماره_پیگیری}}",
  "{{مبلغ_تومان}}",
  "{{تاریخ}}",
  "{{ساعت}}",
  "{{اقلام}}",
];

/** جای‌نگهدارهای قالب «تأیید مرجوعی ← اطلاع به آقای نوروزی» */
const OWNER_NOTIFY_TOKENS = [
  "{{فروشگاه}}",
  "{{شماره_پیگیری}}",
  "{{مشتری}}",
  "{{مبلغ_تومان}}",
  "{{تأییدکننده}}",
  "{{تاریخ}}",
  "{{ساعت}}",
  "{{اقلام}}",
];

/** ویرایشگر قالب پیامک خودکار — متن + چیپ جای‌نگهدار + پیش‌نمایش + بازگردانی پیش‌فرض */
function AutoTemplateEditor({
  id,
  value,
  onChange,
  tokens,
  onRestoreDefault,
  preview,
  note,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  tokens: string[];
  onRestoreDefault: () => void;
  preview: string;
  note?: string;
}) {
  const seg = smsSegments(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label htmlFor={id} className="text-xs font-bold">
          متن پیام
        </Label>
        <div className="flex items-center gap-2">
          <span className="num text-[10px] text-muted-foreground">
            {toFaDigits(seg.chars)} نویسه — {toFaDigits(seg.parts)} پیامک
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-7 px-2 text-[11px]"
            onClick={onRestoreDefault}
          >
            <RotateCcw className="size-3" />
            بازگردانی پیش‌فرض
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        dir="rtl"
        rows={4}
        className="text-sm leading-7 resize-y"
        value={value}
        maxLength={612}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((t) => (
          <button
            key={t}
            type="button"
            className="num rounded-md border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/15"
            dir="ltr"
            onClick={() => onChange(value ? `${value} ${t}` : t)}
            title={SMS_PLACEHOLDERS.find((p) => p.token === t)?.label ?? ""}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-muted-foreground">پیش‌نمایش با داده نمونه:</p>
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3 text-xs leading-6 whitespace-pre-wrap">
          {preview}
        </div>
      </div>
      {note && (
        <p className="text-[10px] leading-5 text-muted-foreground flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5 text-primary" />
          {note}
        </p>
      )}
    </div>
  );
}

function SmsAutoMessagesCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SmsConfigDTO | null>(null);

  const [customerSubmitEnabled, setCustomerSubmitEnabled] = useState(true);
  const [customerSubmitTemplate, setCustomerSubmitTemplate] = useState(
    DEFAULT_CUSTOMER_SUBMIT_TEMPLATE
  );
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [ownerNotifyEnabled, setOwnerNotifyEnabled] = useState(true);
  const [ownerNotifyTemplate, setOwnerNotifyTemplate] = useState(DEFAULT_OWNER_NOTIFY_TEMPLATE);
  const [includeItems, setIncludeItems] = useState(false);

  // اعمال پیکربندی دریافت‌شده روی فرم (با پیش‌فرض امن)
  const applyConfig = useCallback((d: SmsConfigDTO) => {
    setConfig(d);
    setCustomerSubmitEnabled(d.auto?.customerSubmitEnabled ?? true);
    setCustomerSubmitTemplate(d.auto?.customerSubmitTemplate || DEFAULT_CUSTOMER_SUBMIT_TEMPLATE);
    setPaymentEnabled(d.auto?.paymentEnabled ?? true);
    setOwnerNotifyEnabled(d.auto?.ownerNotifyEnabled ?? true);
    setOwnerNotifyTemplate(d.auto?.ownerNotifyTemplate || DEFAULT_OWNER_NOTIFY_TEMPLATE);
    setIncludeItems(d.auto?.includeItems ?? false);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sms-config", { cache: "no-store" });
      if (res.ok) applyConfig((await res.json()) as SmsConfigDTO);
    } catch {
      toast.error("خطا در دریافت تنظیمات پیامک‌های خودکار");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  // پیش‌فرض‌های سامانه برای دکمه «بازگردانی پیش‌فرض»
  const defaultCustomerSubmit =
    config?.auto?.defaults?.customerSubmitTemplate || DEFAULT_CUSTOMER_SUBMIT_TEMPLATE;
  const defaultOwnerNotify =
    config?.auto?.defaults?.ownerNotifyTemplate || DEFAULT_OWNER_NOTIFY_TEMPLATE;

  // پیش‌نمایش با داده نمونه — {{اقلام}} فقط وقتی «درج اقلام» روشن است پر می‌شود
  // (هم‌ریخت با منطق ارسال بک‌اند: بدون جای‌نگهدار، فهرست به انتهای پیام افزوده می‌شود)
  const sampleItems = "شیر پرچرب ×۲، ماست ×۱";
  const sampleVars = {
    customerName: "مریم احمدی",
    amountRial: 1_250_000,
    trackingCode: "HZ-14050712-01",
    storeName: "هایپر زیتون",
    approverName: "حدیث لطفی",
  };
  const previewOf = (template: string) => {
    let text = renderSmsTemplate(template, {
      ...sampleVars,
      itemsList: includeItems ? sampleItems : undefined,
    });
    if (includeItems && sampleItems && !text.includes(sampleItems)) {
      text = `${text}\nاقلام: ${sampleItems}`;
    }
    return text;
  };
  const customerSubmitPreview = previewOf(customerSubmitTemplate);
  const ownerNotifyPreview = previewOf(ownerNotifyTemplate);
  const itemsNote =
    !includeItems &&
    (customerSubmitTemplate.includes("{{اقلام}}") || ownerNotifyTemplate.includes("{{اقلام}}"))
      ? "جای‌نگهدار {{اقلام}} فقط زمانی پر می‌شود که کلید «درج فهرست اقلام مرجوعی در پیامک‌ها» روشن باشد."
      : undefined;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sms-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // بولی‌ها به‌صورت JSON ارسال می‌شوند — کلید paymentSmsEnabled همان auto.paymentEnabled است
        body: JSON.stringify({
          customerSubmitEnabled,
          customerSubmitTemplate,
          paymentSmsEnabled: paymentEnabled,
          ownerNotifyEnabled,
          ownerNotifyTemplate,
          includeItems,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        applyConfig(d as SmsConfigDTO);
        toast.success("تنظیمات پیامک‌های خودکار ذخیره شد ✅");
      } else {
        toast.error(d.error || "ذخیره تنظیمات پیامک‌های خودکار ناموفق بود");
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="sms-auto" className="pattern-girih border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <Zap className="size-5 text-primary" />
          پیامک‌های خودکار سامانه
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            لایه ۱ — کلیدهای سراسری
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 mr-auto"
            onClick={load}
            aria-label="بازخوانی"
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardTitle>
        <CardDescription className="leading-6">
          سه کلید اصلی ارسال خودکار: اطلاع به مشتری هنگام ثبت مرجوعی، پیامک تأیید پرداخت و
          اطلاع «آماده پرداخت» به آقای نوروزی پس از تأیید مدیر کل.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* لایه دوگانه — کلید سراسری اینجا + خاموش‌کردن هر مشتری در دفترچه مشتریان */}
        <Alert>
          <Info className="size-4" />
          <AlertTitle>لایه دوگانه پیامک‌ها</AlertTitle>
          <AlertDescription>
            هر نوع پیامک با کلید سراسری همین‌جا خاموش/روشن می‌شود و هر مشتری هم جداگانه در
            «دفترچه مشتریان» قابل خاموش‌کردن است.
          </AlertDescription>
        </Alert>

        {config && !config.ready && (
          <p className="text-[11px] leading-6 text-muted-foreground rounded-lg bg-muted/50 border border-dashed px-3 py-2.5">
            تا زمان تکمیل کارت «اتصال پنل پیامک» هیچ پیامکی ارسال نمی‌شود
            {config.missing.length > 0 && <> ({config.missing.join("، ")})</>} — کلیدها ذخیره
            می‌شوند و پس از آماده‌شدن پنل اجرا خواهند شد.
          </p>
        )}

        {/* کارت a — ثبت مرجوعی ← اطلاع به مشتری */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label
                htmlFor="auto-customer-submit"
                className="cursor-pointer text-sm font-bold flex items-center gap-1.5 flex-wrap"
              >
                <ClipboardList className="size-4 text-primary" />
                ثبت مرجوعی <span aria-hidden="true">←</span> اطلاع به مشتری
              </Label>
              <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                بلافاصله پس از ثبت مرجوعی توسط صندوقدار به مشتری ارسال می‌شود — «مرجوعی شما ثبت
                شد، وجه تا اسرع وقت به کارت شما منتقل می‌شود».
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Switch
                id="auto-customer-submit"
                checked={customerSubmitEnabled}
                onCheckedChange={setCustomerSubmitEnabled}
                aria-label="کلید پیامک ثبت مرجوعی به مشتری"
              />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  customerSubmitEnabled ? "text-primary" : "text-muted-foreground"
                )}
              >
                {customerSubmitEnabled ? "روشن" : "خاموش"}
              </span>
            </div>
          </div>
          <AutoTemplateEditor
            id="auto-customer-submit-template"
            value={customerSubmitTemplate}
            onChange={setCustomerSubmitTemplate}
            tokens={CUSTOMER_SUBMIT_TOKENS}
            onRestoreDefault={() => setCustomerSubmitTemplate(defaultCustomerSubmit)}
            preview={customerSubmitPreview}
            note={itemsNote}
          />
        </div>

        {/* کارت b — تأیید پرداخت ← اطلاع به مشتری */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label
                htmlFor="auto-payment"
                className="cursor-pointer text-sm font-bold flex items-center gap-1.5 flex-wrap"
              >
                <Banknote className="size-4 text-primary" />
                تأیید پرداخت <span aria-hidden="true">←</span> اطلاع به مشتری
              </Label>
              <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                کلید اصلی پیامک تأیید پرداخت — متن پیام هنگام ثبت پرداخت از قالب‌های پایین
                انتخاب می‌شود. خاموش‌بودن = فرم پرداخت پیامکی ارسال نمی‌کند.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Switch
                id="auto-payment"
                checked={paymentEnabled}
                onCheckedChange={setPaymentEnabled}
                aria-label="کلید اصلی پیامک تأیید پرداخت"
              />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  paymentEnabled ? "text-primary" : "text-muted-foreground"
                )}
              >
                {paymentEnabled ? "روشن" : "خاموش"}
              </span>
            </div>
          </div>
        </div>

        {/* کارت c — تأیید مرجوعی ← اطلاع به آقای نوروزی (آماده پرداخت) */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label
                htmlFor="auto-owner-notify"
                className="cursor-pointer text-sm font-bold flex items-center gap-1.5 flex-wrap"
              >
                <UserCheck className="size-4 text-primary" />
                تأیید مرجوعی <span aria-hidden="true">←</span> اطلاع به آقای نوروزی (آماده پرداخت)
              </Label>
              <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                پس از تأیید مرجوعی وجه‌دار توسط مدیر کل، برای ثبت‌کنندگان پرداخت (آقای نوروزی)
                ارسال می‌شود — تأییدکننده می‌تواند هنگام تأیید ارسال را خاموش کند.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Switch
                id="auto-owner-notify"
                checked={ownerNotifyEnabled}
                onCheckedChange={setOwnerNotifyEnabled}
                aria-label="کلید پیامک آماده پرداخت به آقای نوروزی"
              />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  ownerNotifyEnabled ? "text-primary" : "text-muted-foreground"
                )}
              >
                {ownerNotifyEnabled ? "روشن" : "خاموش"}
              </span>
            </div>
          </div>
          <AutoTemplateEditor
            id="auto-owner-notify-template"
            value={ownerNotifyTemplate}
            onChange={setOwnerNotifyTemplate}
            tokens={OWNER_NOTIFY_TOKENS}
            onRestoreDefault={() => setOwnerNotifyTemplate(defaultOwnerNotify)}
            preview={ownerNotifyPreview}
            note={itemsNote}
          />
        </div>

        {/* کلید سراسری — درج فهرست اقلام مرجوعی در همه پیامک‌ها */}
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label
                htmlFor="auto-include-items"
                className="cursor-pointer text-sm font-bold flex items-center gap-1.5 flex-wrap"
              >
                <ListChecks className="size-4 text-primary" />
                درج فهرست اقلام مرجوعی در پیامک‌ها
              </Label>
              <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                با فعال‌سازی، فهرست کالاهای مرجوعی (مثل: شیر پرچرب ×۲، ماست ×۱) در همه پیامک‌ها
                درج می‌شود — با جای‌نگهدار{" "}
                <span className="num font-semibold text-primary" dir="ltr">
                  {"{{اقلام}}"}
                </span>{" "}
                در قالب یا خودکار در انتهای پیام.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Switch
                id="auto-include-items"
                checked={includeItems}
                onCheckedChange={setIncludeItems}
                aria-label="درج فهرست اقلام مرجوعی در پیامک‌ها"
              />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  includeItems ? "text-primary" : "text-muted-foreground"
                )}
              >
                {includeItems ? "روشن" : "خاموش"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button onClick={save} disabled={saving} className="gap-1.5 font-semibold">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            ذخیره تنظیمات پیامک‌های خودکار
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ==========================================================================
   کارت ۳ — قالب‌های پیام (انواع اطلاع‌رسانی)
   ========================================================================== */

function SmsTemplatesCard({ user }: { user: SessionUser }) {
  const [templates, setTemplates] = useState<SmsTemplateDTO[] | null>(null);
  const [editing, setEditing] = useState<SmsTemplateDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // بارگذاری قالب‌ها — الگوی promise-chain با پرچم لغو (هم‌ریخت با بقیه سامانه)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms/templates", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("templates"))))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.templates)) setTemplates(d.templates);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const reload = () => setRefreshTick((t) => t + 1);

  async function remove(t: SmsTemplateDTO) {
    if (!confirm(`نوع پیام «${t.title}» حذف شود؟ (تاریخچه ارسال‌های قبلی حفظ می‌شود)`)) return;
    try {
      const res = await fetch(`/api/sms/templates/${t.id}`, { method: "DELETE" });
      const d = await res.json();
      if (res.ok) {
        toast.success(`نوع پیام «${t.title}» حذف شد`);
        reload();
      } else {
        toast.error(d.error || "حذف ناموفق بود");
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <MessageCircle className="size-5 text-primary" />
          قالب‌های پیام (انواع اطلاع‌رسانی)
          {templates && (
            <Badge variant="outline" className="num text-[10px]">
              {toFaDigits(templates.length)} نوع
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 mr-auto h-9"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" />
            نوع جدید
          </Button>
        </CardTitle>
        <CardDescription className="leading-6">
          انواع پیش‌فرض: مرجوعی کالا، اختلاف قیمت فاکتور با قیمت روی کالا، خطای کارت‌خوان صندوقدار
          و سایر موارد — {user.fullName} می‌تواند انواع دلخواه دیگری هم تعریف کند. هنگام ثبت
          پرداخت، نوع پیام انتخاب و متن آن (در صورت تمایل) ویرایش می‌شود.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!templates ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            هنوز قالبی تعریف نشده است — «نوع جدید» را بزنید
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((t, i) => {
              const seg = smsSegments(t.body);
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className={cn(
                    "rounded-xl border p-4 space-y-2.5",
                    t.isActive ? "bg-card" : "bg-muted/40 opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <MessageCircle className="size-4 text-primary" />
                      {t.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="num text-[10px]">
                        {toFaDigits(seg.chars)} نویسه · {toFaDigits(seg.parts)} پیامک
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(t)}
                        aria-label={`ویرایش ${t.title}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => remove(t)}
                        aria-label={`حذف ${t.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground whitespace-pre-wrap break-words min-h-11">
                    {t.body}
                  </p>
                  {!t.isActive && (
                    <Badge variant="secondary" className="text-[10px]">غیرفعال</Badge>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* پنجره افزودن/ویرایش قالب */}
      <SmsTemplateDialog
        open={creating || !!editing}
        target={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reload();
        }}
      />
    </Card>
  );
}

/** پنجره افزودن/ویرایش قالب پیام */
function SmsTemplateDialog({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean;
  target: SmsTemplateDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(target?.title ?? "");
      setBody(target?.body ?? "");
      setIsActive(target?.isActive ?? true);
      setError(null);
    }
  }, [open, target]);

  const seg = smsSegments(body);

  async function save() {
    if (saving) return;
    const t = title.trim();
    const b = body.trim();
    if (t.length < 2) {
      setError("نام نوع پیام حداقل ۲ نویسه باشد");
      return;
    }
    if ([...b].length < 5) {
      setError("متن پیام حداقل ۵ نویسه باشد");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        target ? `/api/sms/templates/${target.id}` : "/api/sms/templates",
        {
          method: target ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, body: b, isActive }),
        }
      );
      const d = await res.json();
      if (res.ok) {
        toast.success(target ? "قالب پیام ویرایش شد" : "نوع پیام جدید تعریف شد");
        onSaved();
      } else {
        setError(d.error || "خطا در ذخیره قالب");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent dir="rtl" className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-primary" />
            {target ? `ویرایش قالب «${target.title}»` : "تعریف نوع پیام جدید"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? "متن و نام نوع پیام را ویرایش کنید."
              : "نوع پیام جدیدی برای اطلاع‌رسانی به مشتریان تعریف کنید (مثلاً «کالای معیوب» یا «بازپرداخت اقساط»)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-title">نام نوع پیام</Label>
            <Input
              id="tpl-title"
              className="h-11"
              placeholder="مثلاً: مرجوعی کالا"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="tpl-body">متن پیام</Label>
              {body && (
                <span className="num text-[10px] text-muted-foreground">
                  {toFaDigits(seg.chars)} نویسه — {toFaDigits(seg.parts)} پیامک
                </span>
              )}
            </div>
            <Textarea
              id="tpl-body"
              dir="rtl"
              rows={5}
              className="text-sm leading-7"
              placeholder="{{مشتری}} عزیز، … "
              value={body}
              maxLength={612}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="rounded-lg bg-muted/50 border border-dashed px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground">جای‌نگهدارهای قابل استفاده:</p>
              <div className="flex flex-wrap gap-1.5">
                {SMS_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    title={p.label}
                    onClick={() => setBody((b) => (b ? b + " " : "") + p.token)}
                    className="num text-[10px] rounded-md border bg-card px-2 py-1 hover:bg-accent transition-colors"
                    dir="ltr"
                  >
                    {p.token}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground leading-5">
                با کلیک روی هر جای‌نگهدار به متن افزوده می‌شود؛ هنگام ارسال با داده واقعی مشتری
                جای‌گزین می‌گردد.
              </p>
            </div>
          </div>

          {target && (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-sm font-semibold">قالب فعال باشد؟</p>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="فعال‌بودن قالب" />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            انصراف
          </Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {target ? "ذخیره تغییرات" : "ایجاد قالب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==========================================================================
   کارت ۴ — تاریخچه ارسال
   ========================================================================== */

function SmsLogsCard() {
  const [logs, setLogs] = useState<SmsLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // بارگذاری تاریخچه — الگوی promise-chain با پرچم لغو
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms/logs?limit=50", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("logs"))))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.logs)) setLogs(d.logs);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const reload = () => {
    setLoading(true);
    setRefreshTick((t) => t + 1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <Send className="size-5 text-primary" />
          تاریخچه ارسال پیامک
          {logs && (
            <Badge variant="outline" className="num text-[10px]">
              {toFaDigits(logs.length)} ارسال اخیر
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 mr-auto"
            onClick={reload}
            aria-label="بازخوانی تاریخچه"
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardTitle>
        <CardDescription className="leading-6">
          آخرین پیامک‌های ارسال‌شده به مشتریان — وضعیت ارسال، پنل و متن هر پیام
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !logs ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            هنوز پیامکی ارسال نشده است — پس از اولین ثبت پرداخت با پیامک، اینجا نمایش داده می‌شود
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1 custom-scroll" dir="rtl">
            {logs.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "rounded-xl border p-3.5 space-y-2",
                  l.status === "sent" ? "border-primary/20 bg-primary/[0.03]" : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <span className="flex items-center gap-1.5 flex-wrap">
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
                    {l.amount != null && l.amount > 0 && (
                      <span className="num text-muted-foreground">{formatMoney(l.amount)} ریال</span>
                    )}
                  </span>
                  <span className="num text-muted-foreground flex items-center gap-1.5" dir="ltr">
                    {toFaDigits(l.phone)}
                  </span>
                </div>
                <p className="text-xs leading-6 text-muted-foreground whitespace-pre-wrap break-words">
                  {l.message}
                </p>
                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-muted-foreground">
                  <span className="num">{formatJalaliDateTime(new Date(l.createdAt))}</span>
                  <span className="flex items-center gap-2 flex-wrap">
                    {l.customerName && <span>{l.customerName}</span>}
                    {l.requestCode && <span className="num" dir="ltr">{l.requestCode}</span>}
                    {l.provider && <span>پنل: {l.provider}</span>}
                  </span>
                </div>
                {l.error && (
                  <p className="text-[10px] text-destructive break-words">خطا: {l.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
