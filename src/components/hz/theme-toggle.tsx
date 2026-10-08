"use client";

// سوییچ تم روشن/تیره — انتخاب کاربر در حافظه مرورگر ذخیره می‌شود (next-themes)
// تم روشن: کرم کویر + سبز پسته — تم تیره: شب کویری + زعفران
import { useTheme } from "next-themes";
import { Moon, SunMedium } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  // تا پیش از نصب در کلاینت resolvedTheme تعریف‌نشده است — جای‌نگهدار هم‌اندازه رندر می‌شود
  // (جلوگیری از ناهماهنگی هیدراسیون بدون setState در افکت)
  if (resolvedTheme === undefined) {
    return (
      <span
        aria-hidden="true"
        className={`block h-9 w-[4.5rem] rounded-xl border bg-card ${className}`}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "تم تیره فعال — تغییر به تم روشن" : "تم روشن فعال — تغییر به تم تیره"}
      title={isDark ? "تغییر به تم روشن (روز کویری)" : "تغییر به تم تیره (شب کویری)"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`group flex h-9 items-center gap-0.5 rounded-xl border bg-card px-1 transition-colors hover:border-primary/40 ${className}`}
    >
      {/* ماه — تیره (در RTL سمت راست) */}
      <span
        className={`flex size-7 items-center justify-center rounded-lg transition-all duration-300 ${
          isDark
            ? "bg-secondary text-secondary-foreground shadow-sm"
            : "text-muted-foreground group-hover:text-foreground"
        }`}
        aria-hidden="true"
      >
        <Moon className="size-4" />
      </span>
      {/* خورشید — روشن (در RTL سمت چپ) */}
      <span
        className={`flex size-7 items-center justify-center rounded-lg transition-all duration-300 ${
          isDark
            ? "text-muted-foreground group-hover:text-foreground"
            : "bg-chart-2/90 text-neutral-900 shadow-sm"
        }`}
        aria-hidden="true"
      >
        <SunMedium className="size-4" />
      </span>
      <span className="sr-only">{isDark ? "تیره" : "روشن"}</span>
    </button>
  );
}
