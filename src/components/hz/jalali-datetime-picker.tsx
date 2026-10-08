"use client";

// انتخابگر تاریخ و ساعت شمسی (جلالی) — تقویم کامل فارسی با محدودیت آینده
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  toJalali,
  jalaliToDate,
  jalaliMonthLength,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  formatJalaliDateTime,
  iranianWeekday,
} from "@/lib/jalali";
import { toFaDigits, toEnDigits } from "@/lib/money";
import { CalendarDays, ChevronRight, ChevronLeft, Clock3, Trash2, Check } from "lucide-react";

interface JalaliDateTimePickerProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  allowFuture?: boolean;
}

export function JalaliDateTimePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ و ساعت",
  disabled,
  className,
  id,
  allowFuture = false,
  ...aria
}: JalaliDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const nowJ = toJalali(now);

  // نمای تقویم
  const [view, setView] = useState(() => {
    const base = value ?? now;
    return toJalali(base);
  });
  const [hour, setHour] = useState(() => (value ? value.getHours() : new Date().getHours()));
  const [minute, setMinute] = useState(() => (value ? value.getMinutes() : new Date().getMinutes()));

  // هنگام گشودن پاپ‌اور، نمای تقویم و ساعت را با مقدار فعلی هم‌گام می‌کنیم (در رویداد، نه افکت)
  function handleOpenChange(next: boolean) {
    if (next) {
      const base = value ?? now;
      setView(toJalali(base));
      // اگر مقداری انتخاب نشده، ساعت فعلی سامانه پیش‌فرض می‌شود (نه ۱۲:۰۰)
      setHour(value ? value.getHours() : now.getHours());
      setMinute(value ? value.getMinutes() : now.getMinutes());
    }
    setOpen(next);
  }

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  function maxAllowedDay(): number | null {
    if (allowFuture) return null;
    if (view.jy === nowJ.jy && view.jm === nowJ.jm) return nowJ.jd;
    return null;
  }

  function monthIsFuture(): boolean {
    if (view.jy > nowJ.jy) return true;
    if (view.jy === nowJ.jy && view.jm > nowJ.jm) return true;
    return false;
  }

  function goMonth(delta: number) {
    setView((v) => {
      let jy = v.jy;
      let jm = v.jm + delta;
      if (jm > 12) {
        jm = 1;
        jy++;
      }
      if (jm < 1) {
        jm = 12;
        jy--;
      }
      return { jy, jm, jd: 1 };
    });
  }

  function isFutureDay(jd: number): boolean {
    if (allowFuture) return false;
    if (view.jy > nowJ.jy) return true;
    if (view.jy < nowJ.jy) return false;
    if (view.jm > nowJ.jm) return true;
    if (view.jm < nowJ.jm) return false;
    return jd > nowJ.jd;
  }

  const days = useMemo(() => {
    const len = jalaliMonthLength(view.jy, view.jm);
    const cells: Array<{ jd: number; col: number; date: Date }> = [];
    for (let d = 1; d <= len; d++) {
      const date = jalaliToDate(view.jy, view.jm, d);
      const col = iranianWeekday(date);
      cells.push({ jd: d, col, date });
    }
    return cells;
  }, [view]);

  const selectedJ = value ? toJalali(value) : null;

  function pickDay(jd: number) {
    if (isFutureDay(jd)) return;
    const date = jalaliToDate(view.jy, view.jm, jd);
    date.setHours(hour, minute, 0, 0);
    onChange(date);
  }

  function confirm() {
    // بدون انتخاب روز: همین لحظه (با ساعت انتخاب‌شده کاربر) ثبت می‌شود
    const d = value ? new Date(value) : new Date();
    d.setHours(hour, minute, 0, 0);
    onChange(d);
    setOpen(false);
  }

  function setToday() {
    // «اکنون» = همین لحظه با تاریخ و ساعت واقعی سیستم
    const d = new Date();
    setHour(d.getHours());
    setMinute(d.getMinutes());
    setView(toJalali(d));
    onChange(d);
  }

  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 font-normal num",
            !value && "text-muted-foreground",
            className
          )}
          aria-label={(aria["aria-label"] as string) ?? "انتخاب تاریخ و ساعت"}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary shrink-0" />
            {value ? (
              <span className="num">{formatJalaliDateTime(value)}</span>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          {value && <Clock3 className="size-3.5 text-muted-foreground shrink-0" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50" align="start">
        <div className="p-3" dir="rtl">
          {/* نوار ناوبری ماه */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => goMonth(-1)} aria-label="ماه قبل">
              <ChevronRight className="size-4" />
            </Button>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <button
                type="button"
                className="rounded px-2 py-1 hover:bg-accent transition-colors"
                onClick={() => setView((v) => ({ ...v, jy: v.jy - 1 }))}
                aria-label="سال قبل"
              >
                <ChevronRight className="size-3.5 inline" />
              </button>
              <span className="num min-w-24 text-center">
                {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
              </span>
              <button
                type="button"
                className="rounded px-2 py-1 hover:bg-accent transition-colors"
                onClick={() => setView((v) => ({ ...v, jy: v.jy + 1 }))}
                aria-label="سال بعد"
              >
                <ChevronLeft className="size-3.5 inline" />
              </button>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => goMonth(1)} aria-label="ماه بعد">
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* سرستون روزهای هفته */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {JALALI_WEEKDAYS.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "text-center text-[11px] font-semibold py-1",
                  i === 6 ? "text-destructive/80" : "text-muted-foreground"
                )}
              >
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* شبکه روزها */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: days[0]?.col ?? 0 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map(({ jd, col, date }) => {
              const isSelected =
                selectedJ && selectedJ.jy === view.jy && selectedJ.jm === view.jm && selectedJ.jd === jd;
              const isToday =
                nowJ.jy === view.jy && nowJ.jm === view.jm && nowJ.jd === jd;
              const future = isFutureDay(jd);
              return (
                <button
                  key={jd}
                  type="button"
                  disabled={future}
                  onClick={() => pickDay(jd)}
                  className={cn(
                    "num relative size-9 rounded-lg text-sm transition-all font-medium",
                    "hover:bg-accent hover:text-accent-foreground",
                    future && "opacity-25 cursor-not-allowed hover:bg-transparent",
                    isToday && !isSelected && "ring-1 ring-primary/60 text-primary",
                    isSelected &&
                      "bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary"
                  )}
                  aria-label={`روز ${toFaDigits(jd)}`}
                  aria-pressed={!!isSelected}
                >
                  {toFaDigits(jd)}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 right-1/2 translate-x-1/2 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ساعت */}
          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Math.min(23, Math.max(0, parseInt(toEnDigits(e.target.value) || "0", 10))))}
              className="num w-14 h-9 text-center rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="ساعت"
              dir="ltr"
            />
            <span className="font-bold">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(toEnDigits(e.target.value) || "0", 10))))}
              className="num w-14 h-9 text-center rounded-md border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="دقیقه"
              dir="ltr"
            />
            <span className="text-xs text-muted-foreground num">({toFaDigits(timeStr)})</span>
          </div>

          {/* دکمه‌ها */}
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="flex-1 h-9" onClick={setToday}>
              اکنون
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-destructive hover:text-destructive"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              aria-label="پاک کردن"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button type="button" size="sm" className="flex-1 h-9" onClick={confirm}>
              <Check className="size-4 ml-1" />
              تأیید
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
