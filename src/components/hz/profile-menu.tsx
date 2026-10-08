"use client";

// منوی «حساب من» — آواتار شخصی (کارتونی/عکس/حرف نام‌خانوادگی)، ویرایش پروفایل، تغییر گذرواژه و خروج
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  UserCog, LogOut, Eye, EyeOff, Loader2, Lock, ShieldCheck, UserRound, KeyRound,
  Camera, ImagePlus, Type, Trash2, Palette, Brush, Dices, RotateCcw,
} from "lucide-react";
import { toEnDigits } from "@/lib/money";
import { digitsOnly } from "@/lib/validators";
import { ROLE_LABELS, type Role, type SessionUser } from "./types";
import {
  AvatarBadge, AVATAR_COLORS, parseAvatar,
} from "./avatar-badge";
import {
  DEFAULT_VECTOR_CONFIG, VectorAvatar, randomVectorConfig,
  VECTOR_BG_COLORS, VECTOR_BROW_STYLES, VECTOR_CLOTH_COLORS, VECTOR_CLOTHING_STYLES,
  VECTOR_EYE_STYLES, VECTOR_FACIAL_HAIR_STYLES, VECTOR_GLASSES_STYLES,
  VECTOR_HAIR_COLORS, VECTOR_HAIR_STYLES, VECTOR_MOUTH_STYLES, VECTOR_SKIN_TONES,
  type VectorAvatarConfig,
} from "./vector-avatar";
import { cn } from "@/lib/utils";

interface PasswordErrors {
  current?: string;
  next?: string;
  repeat?: string;
}

type AvatarMode = "vector" | "photo" | "initials";

/** دسته‌های سازنده آواتار کارتونی */
const AVATAR_CREATOR_CATEGORIES = [
  { id: "skin", label: "پوست" },
  { id: "hair", label: "مو" },
  { id: "hairColor", label: "رنگ مو" },
  { id: "brows", label: "ابرو" },
  { id: "eyes", label: "چشم" },
  { id: "mouth", label: "لبخند" },
  { id: "glasses", label: "عینک" },
  { id: "facialHair", label: "ریش و سبیل" },
  { id: "clothing", label: "لباس" },
  { id: "clothColor", label: "رنگ لباس" },
  { id: "bg", label: "پس‌زمینه" },
] as const;

type CreatorCategory = (typeof AVATAR_CREATOR_CATEGORIES)[number]["id"];

/** دکمه گزینه سازنده آواتار (سبک‌ها) */
function CreatorOptionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border hover:bg-accent"
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

/** نشان نقش کاربر جاری — مدیر ارشد / مدیر فروشگاه / صندوقدار */
function RoleBadge({ role }: { role: Role }) {
  if (role === "admin")
    return (
      <Badge className="gap-1 border border-primary/30 bg-primary/10 text-primary">
        <ShieldCheck className="size-3" />
        {ROLE_LABELS.admin}
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

/** کوچک‌سازی تصویر سمت کلاینت (۲۵۶×۲۵۶ JPEG) و تبدیل به dataURL */
function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("فایل انتخاب‌شده تصویر نیست"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("حجم تصویر نباید بیشتر از ۱۵ مگابایت باشد"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("تصویر قابل خواندن نیست"));
      img.onload = () => {
        const SIDE = 256;
        const canvas = document.createElement("canvas");
        // برش مربعی از مرکز تصویر
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = SIDE;
        canvas.height = SIDE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("پردازش تصویر ناموفق بود"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIDE, SIDE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** منوی حساب کاربری سربرگ — آواتار شخصی + تنظیمات شخصی و خروج */
export function ProfileMenu({
  user,
  onUserUpdated,
  onLogout,
}: {
  user: SessionUser;
  onUserUpdated?: (u: SessionUser) => void;
  onLogout?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // ---- مشخصات ----
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState("");
  const [initialPhone, setInitialPhone] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // ---- آواتار ----
  const fileRef = useRef<HTMLInputElement>(null);
  const savedAvatar = parseAvatar(user.avatar);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    savedAvatar?.type === "vector" ? "vector" : savedAvatar?.type === "photo" ? "photo" : "initials"
  );
  const [avatarColor, setAvatarColor] = useState(savedAvatar?.color ?? AVATAR_COLORS[0]);
  const [avatarPhoto, setAvatarPhoto] = useState(savedAvatar?.photo ?? "");
  // آواتار کارتونی دوبعدی — پیکربندی زنده
  const [vectorConfig, setVectorConfig] = useState<VectorAvatarConfig>(
    savedAvatar?.type === "vector" && savedAvatar.config
      ? savedAvatar.config
      : DEFAULT_VECTOR_CONFIG
  );
  const [creatorCategory, setCreatorCategory] = useState<CreatorCategory>("skin");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // ---- تغییر گذرواژه ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [passErrors, setPassErrors] = useState<PasswordErrors>({});
  const [changingPassword, setChangingPassword] = useState(false);

  // بازکردن پنجره حساب من — بازنشانی فرم‌ها و دریافت مشخصات فعلی
  const openAccountDialog = () => {
    setFullName(user.fullName);
    setPhone("");
    setInitialPhone(null);
    setProfileErrors({});
    const av = parseAvatar(user.avatar);
    setAvatarMode(
      av?.type === "vector" ? "vector" : av?.type === "photo" ? "photo" : "initials"
    );
    setAvatarColor(av?.color ?? AVATAR_COLORS[0]);
    setAvatarPhoto(av?.photo ?? "");
    setVectorConfig(
      av?.type === "vector" && av.config ? av.config : DEFAULT_VECTOR_CONFIG
    );
    setCreatorCategory("skin");
    setCurrentPassword("");
    setNewPassword("");
    setRepeatPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowRepeat(false);
    setPassErrors({});
    setDialogOpen(true);

    fetch("/api/auth/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) {
          setPhone(d.user.phone ?? "");
          setInitialPhone(d.user.phone ?? "");
        }
      })
      .catch(() => setInitialPhone(""));
  };

  // ---- ذخیره مشخصات شخصی ----
  const saveProfile = async () => {
    if (savingProfile) return;
    const name = fullName.trim();
    const ph = digitsOnly(toEnDigits(phone));

    const e: { fullName?: string; phone?: string } = {};
    if (name.length < 3) e.fullName = "نام کامل حداقل ۳ نویسه باشد";
    if (ph && !/^09\d{9}$/.test(ph)) e.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
    setProfileErrors(e);
    if (Object.keys(e).length > 0) return;

    // تنها فیلدهای تغییر‌یافته ارسال می‌شود
    const payload: Record<string, string> = {};
    if (name !== user.fullName) payload.fullName = name;
    // تا پیش از دریافت شماره فعلی، تغییر شماره ارسال نمی‌شود
    if (initialPhone !== null && ph !== initialPhone) payload.phone = ph;

    if (Object.keys(payload).length === 0) {
      toast.info("تغییری برای ذخیره وجود ندارد");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("مشخصات شما به‌روزرسانی شد");
        setInitialPhone(ph);
        onUserUpdated?.({
          id: data.user.id,
          username: data.user.username,
          fullName: data.user.fullName,
          role: data.user.role,
          phone: data.user.phone ?? null,
          avatar: data.user.avatar ?? null,
        });
      } else {
        toast.error(data.error || "خطا در ذخیره مشخصات");
      }
    } catch {
      toast.error("خطا در ذخیره مشخصات");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- انتخاب عکس شخصی و کوچک‌سازی ----
  async function handlePhotoPick(f: File | null) {
    if (!f) return;
    setProcessingPhoto(true);
    try {
      const dataUrl = await resizeImageFile(f);
      setAvatarPhoto(dataUrl);
      setAvatarMode("photo");
      toast.success("تصویر آماده ذخیره‌سازی است — «ذخیره آواتار» را بزنید");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "پردازش تصویر ناموفق بود");
    } finally {
      setProcessingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ---- ذخیره آواتار ----
  async function saveAvatar() {
    if (savingAvatar) return;
    const avatarJson =
      avatarMode === "vector"
        ? JSON.stringify({ type: "vector", config: vectorConfig })
        : avatarMode === "photo"
          ? avatarPhoto
            ? JSON.stringify({ type: "photo", photo: avatarPhoto })
            : null
          : JSON.stringify({ type: "initials", color: avatarColor });

    setSavingAvatar(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: avatarJson }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("آواتار شما به‌روزرسانی شد");
        onUserUpdated?.({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          avatar: data.user.avatar ?? null,
        });
      } else {
        toast.error(data.error || "خطا در ذخیره آواتار");
      }
    } catch {
      toast.error("خطا در ذخیره آواتار");
    } finally {
      setSavingAvatar(false);
    }
  }

  // ---- تغییر گذرواژه ----
  const changePassword = async () => {
    if (changingPassword) return;
    const e: PasswordErrors = {};
    if (!currentPassword) e.current = "گذرواژه فعلی را وارد کنید";
    if (newPassword.length < 6) e.next = "گذرواژه جدید حداقل ۶ نویسه باشد";
    if (newPassword !== repeatPassword) e.repeat = "تکرار گذرواژه جدید مطابقت ندارد";
    setPassErrors(e);
    if (Object.keys(e).length > 0) return;

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("گذرواژه با موفقیت تغییر کرد");
        setCurrentPassword("");
        setNewPassword("");
        setRepeatPassword("");
        setShowCurrent(false);
        setShowNew(false);
        setShowRepeat(false);
        setPassErrors({});
      } else {
        toast.error(data.error || "خطا در تغییر گذرواژه");
      }
    } catch {
      toast.error("خطا در تغییر گذرواژه");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="size-11 sm:size-9 shrink-0 rounded-full p-0 hover:bg-accent"
            aria-label="حساب کاربری من"
            title="حساب کاربری من"
          >
            <AvatarBadge fullName={user.fullName} avatar={user.avatar} size="md" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {/* سربرگ: مشخصات کاربر جاری */}
          <DropdownMenuLabel className="font-normal p-0">
            <div className="flex items-center gap-3 px-2 py-2">
              <AvatarBadge fullName={user.fullName} avatar={user.avatar} size="md" />
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="text-sm font-bold truncate max-w-40">{user.fullName}</p>
                <p className="num text-[11px] text-muted-foreground truncate max-w-40" dir="ltr">
                  {user.username}
                </p>
              </div>
            </div>
            <div className="px-2 pb-2">
              <RoleBadge role={user.role} />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openAccountDialog} className="gap-2 cursor-pointer">
            <UserCog className="size-4" />
            حساب من و امنیت
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onLogout?.()} variant="destructive" className="gap-2 cursor-pointer">
            <LogOut className="size-4" />
            خروج از حساب
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* پنجره حساب کاربری من */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          dir="rtl"
          className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              حساب کاربری من
            </DialogTitle>
            <DialogDescription>
              آواتار شخصی، مشخصات و امنیت حساب شما.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* ---- بخش آواتار ---- */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Palette className="size-4" />
                آواتار من
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4 space-y-4">
                {/* انتخاب حالت */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "vector", label: "آواتار کارتونی", icon: Brush },
                      { id: "photo", label: "عکس شخصی", icon: ImagePlus },
                      { id: "initials", label: "حرف نام‌خانوادگی", icon: Type },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAvatarMode(m.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors",
                        avatarMode === m.id
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border hover:bg-accent"
                      )}
                      aria-pressed={avatarMode === m.id}
                    >
                      <m.icon className="size-4" />
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* ---------- سازنده آواتار کارتونی ---------- */}
                {avatarMode === "vector" && (
                  <div className="space-y-4">
                    {/* پیش‌نمایش بزرگ + ابزارها */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border bg-background p-4">
                      <VectorAvatar config={vectorConfig} size="xxl" />
                      <div className="flex-1 w-full space-y-2.5">
                        <p className="text-xs leading-6 text-muted-foreground">
                          آواتار دوبعدی خودتان را بسازید — پوست، مو، چشم، لبخند، عینک و لباس را
                          انتخاب کنید. سبک فلت و سبک، بدون سنگین‌کردن سامانه.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => setVectorConfig(randomVectorConfig())}
                          >
                            <Dices className="size-3.5" />
                            یک آواتار تصادفی بساز
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => setVectorConfig(DEFAULT_VECTOR_CONFIG)}
                          >
                            <RotateCcw className="size-3.5" />
                            بازنشانی
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* دسته‌ها */}
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="دسته‌های آواتار">
                      {AVATAR_CREATOR_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="tab"
                          aria-selected={creatorCategory === c.id}
                          onClick={() => setCreatorCategory(c.id)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                            creatorCategory === c.id
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border hover:bg-accent"
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {/* گزینه‌های دسته فعال */}
                    <div className="rounded-xl border bg-background p-3 min-h-24">
                      {/* رنگ‌ها */}
                      {(creatorCategory === "skin" ||
                        creatorCategory === "hairColor" ||
                        creatorCategory === "clothColor" ||
                        creatorCategory === "bg") && (
                        <div className="flex flex-wrap gap-2.5">
                          {(
                            {
                              skin: VECTOR_SKIN_TONES,
                              hairColor: VECTOR_HAIR_COLORS,
                              clothColor: VECTOR_CLOTH_COLORS,
                              bg: VECTOR_BG_COLORS,
                            }[creatorCategory] as Array<{ value: string; label: string }>
                          ).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setVectorConfig((c) => ({ ...c, [creatorCategory]: opt.value }))
                              }
                              className={cn(
                                "size-10 rounded-full border-2 transition-transform hover:scale-110",
                                (vectorConfig as unknown as Record<string, string>)[
                                  creatorCategory
                                ] === opt.value
                                  ? "border-foreground shadow-md scale-110"
                                  : "border-transparent"
                              )}
                              style={{ backgroundColor: opt.value }}
                              aria-label={opt.label}
                              aria-pressed={
                                (vectorConfig as unknown as Record<string, string>)[
                                  creatorCategory
                                ] === opt.value
                              }
                              title={opt.label}
                            />
                          ))}
                        </div>
                      )}

                      {/* سبک‌ها */}
                      {creatorCategory === "hair" && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {VECTOR_HAIR_STYLES.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setVectorConfig((c) => ({ ...c, hair: opt.value }))
                              }
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors",
                                vectorConfig.hair === opt.value
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border hover:bg-accent"
                              )}
                              aria-pressed={vectorConfig.hair === opt.value}
                            >
                              <VectorAvatar
                                config={{
                                  ...vectorConfig,
                                  hair: opt.value,
                                  eyes: "closed",
                                  mouth: "smile",
                                }}
                                size="sm"
                                className="!size-9 !rounded-lg"
                              />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {creatorCategory === "eyes" && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {VECTOR_EYE_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.eyes === opt.value}
                              onClick={() => setVectorConfig((c) => ({ ...c, eyes: opt.value }))}
                            />
                          ))}
                        </div>
                      )}
                      {creatorCategory === "brows" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {VECTOR_BROW_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.brows === opt.value}
                              onClick={() => setVectorConfig((c) => ({ ...c, brows: opt.value }))}
                            />
                          ))}
                        </div>
                      )}
                      {creatorCategory === "mouth" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {VECTOR_MOUTH_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.mouth === opt.value}
                              onClick={() => setVectorConfig((c) => ({ ...c, mouth: opt.value }))}
                            />
                          ))}
                        </div>
                      )}
                      {creatorCategory === "glasses" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {VECTOR_GLASSES_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.glasses === opt.value}
                              onClick={() => setVectorConfig((c) => ({ ...c, glasses: opt.value }))}
                            />
                          ))}
                        </div>
                      )}
                      {creatorCategory === "facialHair" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {VECTOR_FACIAL_HAIR_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.facialHair === opt.value}
                              onClick={() =>
                                setVectorConfig((c) => ({ ...c, facialHair: opt.value }))
                              }
                            />
                          ))}
                        </div>
                      )}
                      {creatorCategory === "clothing" && (
                        <div className="grid grid-cols-3 gap-2">
                          {VECTOR_CLOTHING_STYLES.map((opt) => (
                            <CreatorOptionButton
                              key={opt.value}
                              label={opt.label}
                              active={vectorConfig.clothing === opt.value}
                              onClick={() =>
                                setVectorConfig((c) => ({ ...c, clothing: opt.value }))
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-5">
                      پیش‌نمایش لحظه‌ای است؛ برای اعمال در سربرگ سامانه، «ذخیره آواتار» را بزنید.
                    </p>
                  </div>
                )}

                {/* پالت رنگ — برای حرف نام‌خانوادگی */}
                {avatarMode === "initials" && (
                  <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-4">
                    <AvatarBadge
                      fullName={fullName || user.fullName}
                      avatar={JSON.stringify({ type: "initials", color: avatarColor })}
                      size="xl"
                    />
                    <p className="text-[11px] leading-5 text-muted-foreground text-center">
                      حرف اول نام‌خانوادگی شما با رنگ انتخابی در سربرگ سامانه نمایش داده می‌شود.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAvatarColor(c)}
                          className={cn(
                            "size-8 rounded-full border-2 transition-transform hover:scale-110",
                            avatarColor === c ? "border-foreground shadow-md" : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`رنگ ${c}`}
                          aria-pressed={avatarColor === c}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* بارگذاری عکس شخصی */}
                {avatarMode === "photo" && (
                  <div className="space-y-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoPick(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5 flex-1"
                        onClick={() => fileRef.current?.click()}
                        disabled={processingPhoto}
                      >
                        {processingPhoto ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Camera className="size-4" />
                        )}
                        {avatarPhoto ? "تغییر تصویر" : "انتخاب تصویر از دستگاه"}
                      </Button>
                      {avatarPhoto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setAvatarPhoto("")}
                          aria-label="حذف تصویر"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-5">
                      تصویر به‌صورت خودکار مربعی (۲۵۶×۲۵۶) برش و فشرده می‌شود و فقط در حساب شما ذخیره
                      می‌گردد.
                    </p>
                  </div>
                )}

                <Button
                  onClick={saveAvatar}
                  disabled={savingAvatar || (avatarMode === "photo" && !avatarPhoto)}
                  className="gap-1.5 w-full sm:w-auto"
                >
                  {savingAvatar && <Loader2 className="size-4 animate-spin" />}
                  ذخیره آواتار
                </Button>
              </div>
            </section>

            <Separator />

            {/* ---- بخش مشخصات ---- */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <UserRound className="size-4" />
                مشخصات
              </div>

              {/* نام کاربری — فقط‌خواندنی */}
              <div className="space-y-2">
                <Label>نام کاربری</Label>
                <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 h-11">
                  <span className="num text-sm font-semibold truncate" dir="ltr">
                    {user.username}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    <Lock className="size-3" />
                    نام کاربری قابل تغییر نیست
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-fullname">نام کامل</Label>
                <Input
                  id="profile-fullname"
                  placeholder="نام و نام خانوادگی"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11"
                />
                {profileErrors.fullName && (
                  <p className="text-xs text-destructive">{profileErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">
                  شماره تماس <span className="text-muted-foreground font-normal">(اختیاری)</span>
                </Label>
                <Input
                  id="profile-phone"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11"
                />
                {profileErrors.phone && (
                  <p className="text-xs text-destructive">{profileErrors.phone}</p>
                )}
                {initialPhone === null && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    در حال دریافت شماره تماس فعلی…
                  </p>
                )}
              </div>

              <Button onClick={saveProfile} disabled={savingProfile} className="gap-1.5 w-full sm:w-auto">
                {savingProfile && <Loader2 className="size-4 animate-spin" />}
                ذخیره مشخصات
              </Button>
            </section>

            <Separator />

            {/* ---- بخش تغییر گذرواژه ---- */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <KeyRound className="size-4" />
                تغییر گذرواژه
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass-current">گذرواژه فعلی</Label>
                <div className="relative">
                  <Input
                    id="pass-current"
                    type={showCurrent ? "text" : "password"}
                    placeholder="گذرواژه فعلی خود را وارد کنید"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 pe-11 ltr-value"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((s) => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCurrent ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passErrors.current && (
                  <p className="text-xs text-destructive">{passErrors.current}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass-new">گذرواژه جدید</Label>
                <div className="relative">
                  <Input
                    id="pass-new"
                    type={showNew ? "text" : "password"}
                    placeholder="حداقل ۶ نویسه"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 pe-11 ltr-value"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNew ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passErrors.next && <p className="text-xs text-destructive">{passErrors.next}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass-repeat">تکرار گذرواژه جدید</Label>
                <div className="relative">
                  <Input
                    id="pass-repeat"
                    type={showRepeat ? "text" : "password"}
                    placeholder="تکرار گذرواژه جدید"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && changePassword()}
                    className="h-11 pe-11 ltr-value"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRepeat((s) => !s)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showRepeat ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                  >
                    {showRepeat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {passErrors.repeat && (
                  <p className="text-xs text-destructive">{passErrors.repeat}</p>
                )}
              </div>

              <Button
                onClick={changePassword}
                disabled={changingPassword}
                variant="outline"
                className="gap-1.5 w-full sm:w-auto"
              >
                {changingPassword && <Loader2 className="size-4 animate-spin" />}
                تغییر گذرواژه
              </Button>
            </section>

            <Separator />

            {/* ---- اطلاعات حساب ---- */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary/70" />
                سطح دسترسی:
              </span>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
