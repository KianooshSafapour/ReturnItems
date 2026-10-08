"use client";

// ورودی مبلغ: قالب‌بندی سه‌رقمی از راست + حروف‌خوانی در دو سطر (ریال/تومان)
import { forwardRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney, moneyWords, numberToPersianWords, toEnDigits } from "@/lib/money";

interface MoneyInputProps {
  value: number;
  onChange: (v: number) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  compact?: boolean; // بدون سطرهای حروف‌خوانی
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

const MAX_AMOUNT = 500_000_000;

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    { value, onChange, onEnter, placeholder = "مبلغ (ریال)", className, compact, disabled, id, ...aria },
    ref
  ) {
    const display = value > 0 ? formatMoney(value) : "";
    const words = useMemo(() => (value > 0 ? moneyWords(value) : null), [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = toEnDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 12);
      const n = parseInt(digits || "0", 10);
      onChange(Math.min(n, MAX_AMOUNT));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        e.preventDefault();
        onEnter?.();
      }
    }

    return (
      <div className={cn("w-full", className)}>
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            inputMode="numeric"
            className={cn(
              "num text-right font-semibold tracking-wide pl-12 pr-4 h-11",
              value > 0 && "text-primary"
            )}
            placeholder={placeholder}
            value={display}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={(aria["aria-label"] as string) ?? "مبلغ به ریال"}
          />
          {/* واحد «ریال» — سمت چپ (پسوند فارسی: عدد از راست، واحد در ادامه از سمت چپ) */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            ریال
          </span>
        </div>
        {words && !compact && (
          <div
            className="mt-1.5 rounded-lg border border-dashed border-primary/25 bg-primary/5 px-3 py-1.5 space-y-1"
            role="status"
            aria-label="مبلغ به حروف"
          >
            <p className="text-[11px] leading-5 text-muted-foreground flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                ریال
              </span>
              <span className="num">{words.rial}</span>
            </p>
            <p className="text-[11px] leading-5 text-muted-foreground flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-chart-2/20 px-1.5 py-0.5 text-[10px] font-bold text-chart-2 dark:text-chart-2">
                تومان
              </span>
              <span className="num">{words.toman}</span>
            </p>
          </div>
        )}
      </div>
    );
  }
);

/** نمایش فقط‌خوانی مبلغ با حروف‌خوانی */
export function MoneyDisplay({
  amount,
  size = "md",
  showWords = true,
  className,
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  showWords?: boolean;
  className?: string;
}) {
  const words = useMemo(() => (amount > 0 ? moneyWords(amount) : null), [amount]);
  return (
    <div className={cn("space-y-1", className)}>
      <p
        className={cn(
          "num font-extrabold text-primary leading-tight",
          size === "sm" && "text-sm",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl"
        )}
      >
        {formatMoney(amount)}
        <span className="text-xs font-medium text-muted-foreground mr-1.5">ریال</span>
      </p>
      {showWords && words && (
        <div className="text-[11px] leading-5 text-muted-foreground space-y-0.5">
          <p className="num">{words.rial}</p>
          <p className="num opacity-90">{words.toman}</p>
        </div>
      )}
    </div>
  );
}

/** حروف‌خوانی خام عدد — برای نمایش‌های سفارشی */
export function WordsOnly({ amount }: { amount: number }) {
  return <span className="num">{numberToPersianWords(amount)}</span>;
}
