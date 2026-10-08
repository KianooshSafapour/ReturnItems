"use client";

// رسید چاپی مرجوعی — دو قالب: برگه A4 و نوار حرارتی ۸۰ میلی‌متری — هر دو با بارکدهای واقعی قابل اسکن (JsBarcode)
// چاپ از طریق window.print() با استایل اختصاصی @media print در globals.css
// قالب حرارتی: @page 80mm از طریق تگ <style> داینامیک (وقتی انتخاب شده باشد)
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2,
  Printer,
  X,
  Leaf,
  CheckCircle2,
  Hourglass,
  FileDown,
  FileText,
  Receipt,
  Scissors,
  Cable,
  Zap,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { BrandEmblem } from "./ornaments";
import { formatMoney, formatCardNumber, formatQuantity, moneyWords, toFaDigits } from "@/lib/money";
import { formatJalaliFull, formatJalaliDate } from "@/lib/jalali";
import { isValidEan13 } from "@/lib/barcode";
import { BIXOLON_SDK_DOWNLOAD_URL, probeBixolon, printReceiptBitmap } from "@/lib/bixolon-print";
import type { BixolonSettings } from "@/lib/bixolon-print";
import { SETTLEMENT_META, DEFAULT_SETTINGS } from "./types";
import type { ReturnDetailDTO, StoreSettings } from "./types";

/* ---------- بارکد SVG (EAN-13 استاندارد یا CODE128 برای سایر مقادیر) ---------- */
function BarcodeSvg({
  value,
  height = 30,
  width = 1.6,
  fontSize = 12,
  className = "",
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    const isEan13 = /^\d{13}$/.test(value) && isValidEan13(value);
    try {
      JsBarcode(ref.current, value, {
        format: isEan13 ? "EAN13" : "CODE128",
        height,
        width,
        fontSize,
        margin: 2,
        lineColor: "#111111",
        background: "transparent",
        displayValue: true,
        font: "monospace",
        fontOptions: "bold",
        textAlign: "center",
        textPosition: "bottom",
        textMargin: 1,
      });
    } catch {
      // مقدار نامعتبر برای بارکد → نمایش متن خام
      if (ref.current) ref.current.innerHTML = "";
    }
  }, [value, height, width, fontSize]);

  return <svg ref={ref} className={className} aria-label={`بارکد ${value}`} />;
}

/* ---------- ردیف اطلاعات ---------- */
function Field({ label, value, ltr = false, strong = false }: { label: string; value: string; ltr?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 py-0.5">
      <span className="text-[10px] text-neutral-500 shrink-0">{label}:</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-[11px] leading-5 ${strong ? "font-bold" : "font-medium"} text-neutral-900 ${ltr ? "text-left" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ---------- ردیف فشرده رسید حرارتی ---------- */
function TRow({ label, value, num = false }: { label: string; value: string; num?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[1px]">
      <span className="text-[9px] text-neutral-600 shrink-0">{label}</span>
      <span className={`text-[10px] font-semibold text-neutral-900 text-left min-w-0 ${num ? "num" : ""}`}>{value}</span>
    </div>
  );
}

/* ---------- رسید حرارتی ۸۰ میلی‌متری (چاپگر کارت‌خوان صندوق) ---------- */
function ThermalReceipt({
  detail,
  settlement,
  words,
  settings,
  paid,
  paperRef,
}: {
  detail: ReturnDetailDTO;
  settlement: { T: number; E: number; X: number; debt: number; credit: number } | null;
  words: { rial: string; toman: string };
  settings: StoreSettings;
  paid: boolean;
  paperRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="thermal-shell mx-auto w-[302px]">
      {/* لبه‌های دندانه‌دار کاغذ — فقط در پیش‌نمایش صفحه */}
      <div className="thermal-edge-t no-print" aria-hidden="true" />
      <div ref={paperRef} className="receipt-print-area thermal-paper bg-white text-neutral-900 px-4 py-4 shadow-xl select-none">
        {/* سربرگ فروشگاه */}
        <div className="text-center">
          <div className="flex justify-center">
            <BrandEmblem size={44} />
          </div>
          <h2 className="mt-1.5 text-[15px] font-extrabold leading-6">{settings.storeName}</h2>
          <p className="text-[9px] text-neutral-600 leading-4">{settings.storeCity}</p>
          {settings.storePhone && (
            <p className="text-[9px] text-neutral-600 leading-4 num" dir="ltr">
              {settings.storePhone}
            </p>
          )}
        </div>

        <div className="my-2.5 border-t border-dashed border-neutral-400" />

        {/* عنوان و وضعیت */}
        <div className="text-center space-y-1">
          <p className="text-[11px] font-extrabold">رسید ثبت مرجوعی کالا</p>
          {paid ? (
            <span className="inline-flex items-center gap-1 border border-neutral-900 px-2 py-0.5 rounded text-[8px] font-bold">
              <CheckCircle2 className="size-2.5" />
              تسویه‌شده (پرداخت/بایگانی)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 border-2 border-neutral-900 px-2 py-0.5 rounded text-[8px] font-extrabold">
              <Hourglass className="size-2.5" />
              در انتظار انتقال وجه
            </span>
          )}
        </div>

        <div className="my-2.5 border-t border-dashed border-neutral-400" />

        {/* شماره پیگیری + بارکد */}
        <div className="text-center">
          <p className="text-[8px] text-neutral-600">شماره پیگیری مرجوعی</p>
          <p className="num text-[12px] font-extrabold tracking-wide" dir="ltr">
            {detail.code}
          </p>
          <div className="mt-1 flex justify-center">
            <BarcodeSvg value={detail.code} height={26} width={1.0} fontSize={9} />
          </div>
        </div>

        <div className="my-2.5 border-t border-dashed border-neutral-400" />

        {/* اطلاعات مشتری و ثبت */}
        <div className="space-y-0.5">
          <TRow label="مشتری" value={detail.customerName} />
          <TRow label="موبایل" value={detail.customerPhone} num />
          <TRow label="زمان خرید" value={formatJalaliDate(new Date(detail.purchaseAt))} num />
          <TRow label="صندوقدار" value={detail.cashier.fullName} />
          <TRow label="زمان ثبت" value={formatJalaliFull(new Date(detail.submittedAt))} num />
          <TRow label="دلیل" value={detail.reason} />
        </div>

        <div className="my-2.5 border-t border-dashed border-neutral-400" />

        {/* اقلام + بارکد هر قلم */}
        <p className="text-[10px] font-extrabold mb-1.5">
          اقلام مرجوعی ({detail.items.length} قلم)
        </p>
        <div className="space-y-1.5">
          {detail.items.map((it, i) => (
            <div key={it.id} className="border-b border-dotted border-neutral-300 pb-1.5 last:border-b-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold leading-4 flex-1 min-w-0">
                  <span className="num">{toFaDigits(i + 1)}.</span> {it.name}
                </p>
                <p className="text-[9px] num shrink-0" dir="ltr">
                  ×{formatQuantity(it.quantity)}
                </p>
              </div>
              {it.barcode && (
                <div className="flex justify-center my-1">
                  <BarcodeSvg value={it.barcode} height={16} width={1.0} fontSize={8} />
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[9px] num text-neutral-600">{formatMoney(it.unitPrice)} ریال</span>
                <span className="text-[10px] num font-extrabold">{formatMoney(it.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-2.5 border-t border-dashed border-neutral-400" />

        {/* تسویه */}
        <div className="space-y-0.5">
          <TRow label="جمع اقلام" value={`${formatMoney(detail.totalAmount)} ریال`} num />
          {settlement && settlement.E > 0 && (
            <TRow label="کالای جایگزین (−)" value={`${formatMoney(settlement.E)} ریال`} num />
          )}
          {settlement && settlement.debt > 0 && (
            <TRow label="بدهی مشتری" value={`${formatMoney(settlement.debt)} ریال`} num />
          )}
          {settlement && settlement.credit > 0 && (
            <TRow label="اعتبار مشتری" value={`${formatMoney(settlement.credit)} ریال`} num />
          )}
          {detail.transferNote && (
            <p className="text-[8px] leading-4 text-neutral-700 pt-1 text-justify">
              <span className="font-bold">دلیل اختلاف: </span>
              {detail.transferNote}
            </p>
          )}
        </div>

        {/* مبلغ نهایی — قاب دوبل کلاسیک */}
        <div className="mt-2 border-y-2 border-double border-neutral-900 py-1.5 text-center">
          <p className="text-[8px] font-bold text-neutral-600">{paid ? "مبلغ انتقالی نهایی" : "مبلغ قابل انتقال"}</p>
          <p className="num text-[14px] font-extrabold leading-6">
            {formatMoney(detail.transferAmount)} <span className="text-[8px] font-bold">ریال</span>
          </p>
          <p className="text-[7px] text-neutral-600 leading-3.5 mt-0.5">{words.toman}</p>
        </div>

        {/* اطلاعات بازگشت وجه */}
        {paid && detail.payment ? (
          <div className="mt-2 space-y-0.5">
            <p className="text-[9px] font-extrabold mb-0.5">بازگشت وجه</p>
            <TRow label="بانک مبدأ" value={detail.payment.bankName} />
            {detail.payment.referenceNumber && (
              <TRow label="پیگیری" value={detail.payment.referenceNumber} num />
            )}
            {detail.payment.cardNumber && (
              <TRow label="کارت مبدأ" value={formatCardNumber(detail.payment.cardNumber)} num />
            )}
            <TRow label="زمان انتقال" value={formatJalaliFull(new Date(detail.payment.transferredAt))} num />
            <TRow label="ثبت‌کننده" value={detail.payment.recordedBy.fullName} />
          </div>
        ) : (
          <p className="mt-2 text-[8px] leading-4 text-neutral-700 text-justify">
            وجه این مرجوعی هنوز منتقل نشده است — پس از تأیید مدیریت ({settings.managerName}) به کارت بانکی مشتری
            واریز می‌شود.
          </p>
        )}

        {/* امضا */}
        <div className="mt-3 pt-2 border-t border-dashed border-neutral-400">
          <div className="flex items-end justify-center gap-1.5">
            <span className="text-[8px] text-neutral-600">امضای مشتری:</span>
            <span className="border-b border-dotted border-neutral-500 w-28 inline-block" style={{ height: 14 }} />
          </div>
        </div>

        {/* پابرگ */}
        <div className="mt-3 pt-2 border-t border-neutral-300 text-center space-y-0.5">
          <p className="text-[9px] font-semibold leading-4">{settings.receiptFooter}</p>
          <p className="text-[7px] text-neutral-500 leading-3.5 flex items-center justify-center gap-1 flex-wrap">
            <Leaf className="size-2 inline" aria-hidden="true" />
            توسعه‌دهنده سامانه: {settings.developerCredit}
            <span className="mx-0.5">—</span>
            <span className="num">چاپ: {formatJalaliFull(new Date())}</span>
          </p>
        </div>

        {/* نشان برش */}
        <div className="mt-2 border-t border-dashed border-neutral-400 pt-1 text-center">
          <span className="text-[7px] text-neutral-500 inline-flex items-center gap-1">
            <Scissors className="size-2.5" aria-hidden="true" />
            - - - - - - - - - - - - - -
          </span>
        </div>
      </div>
      <div className="thermal-edge-b no-print" aria-hidden="true" />
    </div>
  );
}

/* ---------- رندر رسید حرارتی روی Canvas (چاپ مستقیم Bixolon SRP-330II) ----------
 * همان محتوای پیش‌نمایش «حرارتی ۸۰mm» اما بدون DOM — متن مشکی روی زمینهٔ سفید.
 * عرض منطقی ۵۱۰ نقطه (کاغذ ۸۰mm) با مقیاس ×۲ برای وضوح؛ widthDots ارسالی به چاپگر = ۵۱۰.
 * ارتفاع بوم با اندازه‌گیری متن به‌اندازهٔ محتوا رشد می‌کند. */
function renderThermalCanvas(
  detail: ReturnDetailDTO,
  settlement: { T: number; E: number; X: number; debt: number; credit: number } | null,
  words: { rial: string; toman: string },
  settings: StoreSettings,
  paid: boolean
): HTMLCanvasElement | null {
  const W = 510; // عرض منطقی بر حسب نقطهٔ چاپگر
  const M = 16; // حاشیهٔ کناری
  const SCALE = 2; // مقیاس وضوح (بوم ۱۰۲۰ پیکسل → ۵۱۰ نقطه)
  const CX = W / 2;
  const MAX_W = W - M * 2;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;

  const fontOf = (size: number, weight = 400) =>
    `${weight >= 700 ? "bold " : weight >= 600 ? "600 " : weight >= 500 ? "500 " : ""}${size}px Vazirmatn, Tahoma, sans-serif`;

  /** شکستن متن بلند به چند سطر هم‌عرض (نام کالا/دلیل/پابرگ) */
  const wrap = (text: string, size: number, weight: number, maxWidth: number): string[] => {
    measure.font = fontOf(size, weight);
    const parts = String(text ?? "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const part of parts) {
      const next = line ? `${line} ${part}` : part;
      if (!line || measure.measureText(next).width <= maxWidth) line = next;
      else {
        lines.push(line);
        line = part;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  };

  type Op =
    | { kind: "text"; text: string; x: number; y: number; size: number; weight: number; color: string; align: "center" | "right" | "left" }
    | { kind: "rule"; y: number; dash: boolean; color: string; width: number };

  const ops: Op[] = [];
  let y = 18; // مکان‌نمای عمودی (بالای سطر جاری)

  const center = (text: string, size: number, weight = 400, color = "#18181b", gap = 0) => {
    ops.push({ kind: "text", text, x: CX, y: y + size, size, weight, color, align: "center" });
    y += Math.round(size * 1.6) + gap;
  };
  const right = (text: string, size: number, weight = 400, color = "#18181b", gap = 0) => {
    ops.push({ kind: "text", text, x: W - M, y: y + size, size, weight, color, align: "right" });
    y += Math.round(size * 1.6) + gap;
  };
  /** سطر دوطرفه: برچسب سمت راست، مقدار سمت چپ (آینهٔ TRow پیش‌نمایش حرارتی) */
  const row = (label: string, value: string, strongValue = false) => {
    ops.push({ kind: "text", text: label, x: W - M, y: y + 9, size: 9, weight: 500, color: "#52525b", align: "right" });
    ops.push({ kind: "text", text: value, x: M, y: y + 9, size: 10, weight: strongValue ? 700 : 600, color: "#18181b", align: "left" });
    y += 15;
  };
  const rule = (dash = true, color = "#a1a1aa", width = 1, advance = 10) => {
    ops.push({ kind: "rule", y: y + 4, dash, color, width });
    y += advance;
  };

  /* سربرگ فروشگاه */
  center(settings.storeName, 21, 800);
  center(settings.storeCity, 10, 500, "#52525b");
  if (settings.storePhone) center(settings.storePhone, 10, 500, "#52525b");
  rule();

  /* عنوان و وضعیت */
  center("رسید ثبت مرجوعی کالا", 13, 700);
  center(paid ? "تسویه‌شده (پرداخت/بایگانی)" : "در انتظار انتقال وجه", 10, 700);
  rule();

  /* شماره پیگیری */
  center("شماره پیگیری مرجوعی", 9, 500, "#52525b");
  center(detail.code, 16, 800);
  rule();

  /* اطلاعات مشتری و ثبت */
  row("مشتری", detail.customerName);
  row("موبایل", detail.customerPhone);
  row("زمان خرید", formatJalaliDate(new Date(detail.purchaseAt)));
  row("صندوقدار", detail.cashier.fullName);
  row("زمان ثبت", formatJalaliFull(new Date(detail.submittedAt)));
  for (const line of wrap(detail.reason, 9, 500, MAX_W)) right(line, 9, 500, "#52525b");
  rule();

  /* اقلام مرجوعی */
  right(`اقلام مرجوعی (${toFaDigits(detail.items.length)} قلم)`, 11, 700, undefined, 4);
  detail.items.forEach((it, i) => {
    // نام کالا (راست) + تعداد (چپ) — نام بلند می‌شکند و تعداد در سطر آخر می‌نشیند
    const qtyText = `×${formatQuantity(it.quantity)}`;
    measure.font = fontOf(9, 500);
    const qtyW = Math.ceil(measure.measureText(qtyText).width) + 10;
    const nameLines = wrap(it.name, 10, 700, MAX_W - qtyW);
    nameLines.forEach((line, li) => {
      ops.push({ kind: "text", text: line, x: W - M, y: y + 9, size: 10, weight: 700, color: "#18181b", align: "right" });
      if (li === nameLines.length - 1) {
        ops.push({ kind: "text", text: qtyText, x: M, y: y + 9, size: 9, weight: 500, color: "#52525b", align: "left" });
      }
      y += 14;
    });
    // قیمت واحد (راست) + مبلغ قلم (چپ)
    ops.push({ kind: "text", text: `${formatMoney(it.unitPrice)} ریال`, x: W - M, y: y + 9, size: 9, weight: 500, color: "#71717a", align: "right" });
    ops.push({ kind: "text", text: formatMoney(it.lineTotal), x: M, y: y + 9, size: 10, weight: 700, color: "#18181b", align: "left" });
    y += 15;
    if (i < detail.items.length - 1) rule(true, "#d4d4d8", 1, 8); // جداکنندهٔ نقطه‌چین بین اقلام
  });
  rule();

  /* تسویه */
  row("جمع اقلام", `${formatMoney(detail.totalAmount)} ریال`, true);
  if (settlement && settlement.E > 0) row("کالای جایگزین (−)", `${formatMoney(settlement.E)} ریال`);
  if (settlement && settlement.debt > 0) row("بدهی مشتری", `${formatMoney(settlement.debt)} ریال`);
  if (settlement && settlement.credit > 0) row("اعتبار مشتری", `${formatMoney(settlement.credit)} ریال`);
  if (detail.transferNote) {
    for (const line of wrap(`دلیل اختلاف: ${detail.transferNote}`, 8, 500, MAX_W)) right(line, 8, 500, "#52525b");
  }

  /* مبلغ نهایی — قاب خط ممتد دوبل کلاسیک */
  y += 4;
  rule(false, "#18181b", 1.5, 5);
  rule(false, "#18181b", 1.5, 6);
  center(paid ? "مبلغ انتقالی نهایی" : "مبلغ قابل انتقال", 8.5, 700, "#52525b", 1);
  center(`${formatMoney(detail.transferAmount)} ریال`, 15, 800);
  for (const line of wrap(words.toman, 7.5, 500, MAX_W)) center(line, 7.5, 500, "#71717a");
  rule(false, "#18181b", 1.5, 5);
  rule(false, "#18181b", 1.5, 6);

  /* اطلاعات بازگشت وجه */
  y += 2;
  if (paid && detail.payment) {
    right("بازگشت وجه", 9.5, 700, undefined, 2);
    row("بانک مبدأ", detail.payment.bankName);
    if (detail.payment.referenceNumber) row("پیگیری", detail.payment.referenceNumber);
    if (detail.payment.cardNumber) row("کارت مبدأ", formatCardNumber(detail.payment.cardNumber));
    row("زمان انتقال", formatJalaliFull(new Date(detail.payment.transferredAt)));
    row("ثبت‌کننده", detail.payment.recordedBy.fullName);
  } else {
    const note = `وجه این مرجوعی هنوز منتقل نشده است — پس از تأیید مدیریت (${settings.managerName}) به کارت بانکی مشتری واریز می‌شود.`;
    for (const line of wrap(note, 8, 500, MAX_W)) right(line, 8, 500, "#52525b");
  }

  rule();

  /* امضا + پابرگ */
  center("امضای مشتری: ..............................", 8, 500, "#71717a", 2);
  for (const line of wrap(settings.receiptFooter, 9, 600, MAX_W)) center(line, 9, 600, "#18181b");
  center(`توسعه‌دهنده سامانه: ${settings.developerCredit}`, 7.5, 500, "#71717a");
  center(`چاپ: ${formatJalaliFull(new Date())}`, 7.5, 500, "#71717a");
  y += 14; // حاشیهٔ پایانی

  /* ساخت بوم نهایی و رسم عملیات‌ها */
  const height = Math.max(220, Math.ceil(y));
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff"; // زمینهٔ سفید — چاپگر حرارتی فقط مشکی چاپ می‌کند
  ctx.fillRect(0, 0, W, height);
  ctx.direction = "rtl"; // راست‌به‌چپ برای متن فارسی
  ctx.textBaseline = "alphabetic";
  for (const op of ops) {
    if (op.kind === "text") {
      ctx.font = fontOf(op.size, op.weight);
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else {
      ctx.save();
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      if (op.dash) ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(M, op.y);
      ctx.lineTo(W - M, op.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  return canvas;
}

/* ---------- دیالوگ رسید ---------- */
export function ReceiptDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  detail: ReturnDetailDTO | null;
}) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  // قالب چاپ: برگه A4 یا نوار حرارتی ۸۰ میلی‌متری — انتخاب آخرین بار ذخیره می‌شود
  const [format, setFormat] = useState<"a4" | "thermal">(() => {
    if (typeof window === "undefined") return "a4";
    try {
      return window.localStorage.getItem("hz:receipt-format") === "thermal" ? "thermal" : "a4";
    } catch {
      return "a4";
    }
  });

  function chooseFormat(f: "a4" | "thermal") {
    setFormat(f);
    try {
      window.localStorage.setItem("hz:receipt-format", f);
    } catch {
      /* حافظه در دسترس نیست */
    }
  }

  // ---- چاپ مستقیم Bixolon SRP-330II (بدون پنجرهٔ چاپ مرورگر) ----
  // تنظیمات سرویس Web Print SDK روی رایانهٔ صندوق — در localStorage ماندگار است
  const [bixolonName, setBixolonName] = useState(() => {
    if (typeof window === "undefined") return "Printer1";
    try {
      return window.localStorage.getItem("hz_bixolon_name") || "Printer1";
    } catch {
      return "Printer1";
    }
  });
  const [bixolonPort, setBixolonPort] = useState(() => {
    if (typeof window === "undefined") return "18080";
    try {
      const p = window.localStorage.getItem("hz_bixolon_port");
      return p && /^\d{2,5}$/.test(p) ? p : "18080";
    } catch {
      return "18080";
    }
  });
  // ماشین وضعیت: idle → probing → printing → success | error
  const [bixolonPhase, setBixolonPhase] = useState<"idle" | "probing" | "printing" | "success" | "error">("idle");
  const [bixolonMessage, setBixolonMessage] = useState<string | null>(null);

  // تنظیمات فروشگاه برای سربرگ/پابرگ رسید
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d === "object") setSettings({ ...DEFAULT_SETTINGS, ...d });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const paid = detail?.status === "paid" || detail?.status === "approved";
  const settlement =
    detail && (detail.transferAmount !== detail.totalAmount || detail.exchangeValue > 0)
      ? {
          T: detail.totalAmount,
          E: detail.exchangeValue,
          X: detail.transferAmount,
          debt: detail.exchangeValue > detail.totalAmount ? detail.exchangeValue - detail.totalAmount : 0,
          credit:
            detail.transferAmount + detail.exchangeValue < detail.totalAmount
              ? detail.totalAmount - detail.exchangeValue - detail.transferAmount
              : 0,
        }
      : null;

  // ---- اندازهٔ صفحهٔ چاپ حرارتی: به‌اندازهٔ محتوای واقعی (نه ارتفاع ثابت) ----
  // قبلاً @page 80mm×۳۲۷mm بود → کاغذ حرارتی صفحهٔ ثابت ۳۲۷ میلی‌متری چاپ می‌کرد و
  // تا پایان رول کاغذ سفید هدر می‌داد. حالا ارتفاع از محتوای رندرشده اندازه‌گیری می‌شود:
  // چاپ از بالای رسید شروع و دقیقاً جایی که محتوا تمام می‌شود قطع می‌شود.
  const thermalStyleRef = useRef<HTMLStyleElement>(null);
  const thermalPaperRef = useRef<HTMLDivElement>(null);

  function syncThermalPageSize() {
    if (format !== "thermal") return;
    const paper = thermalPaperRef.current;
    const styleEl = thermalStyleRef.current;
    if (!paper || !styleEl) return;
    // تبدیل پیکسل CSS به میلی‌متر (۹۶ پیکسل = ۱ اینچ = ۲۵٫۴ میلی‌متر)
    const px = Math.ceil(paper.getBoundingClientRect().height);
    const mm = Math.max(30, Math.round((px * 25.4) / 96 + 3)); // حداقل ۳۰mm + بافر ۳mm برای گرد شدن
    styleEl.textContent = `@media print { @page { size: 80mm ${mm}mm; margin: 0; } }`;
  }

  // همگام‌سازی پس از رندر (باز شدن دیالوگ / تغییر قالب / بارکدها)
  useEffect(() => {
    if (!open || format !== "thermal") return;
    const t1 = requestAnimationFrame(() => requestAnimationFrame(syncThermalPageSize));
    const t2 = window.setTimeout(syncThermalPageSize, 350); // پس از رندر نهایی بارکدها
    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
    };
  }, [open, format, detail?.id]);

  function handlePrint() {
    // قبل از چاپ، اندازهٔ صفحه دوباره همگام می‌شود — چاپ حرارتی دقیقاً به‌اندازهٔ محتواست
    syncThermalPageSize();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  if (!detail) return null;
  const words = moneyWords(detail.transferAmount);

  // ارسال رسید به چاپگر حرارتی Bixolon — مستقیم به سرویس محلی، بدون دیالوگ مرورگر
  async function handleBixolonPrint() {
    if (!detail) return;
    const name = bixolonName.trim() || "Printer1";
    const portNumber = Number.parseInt(bixolonPort, 10);
    const conf: BixolonSettings = {
      logicalName: name,
      port: Number.isFinite(portNumber) && portNumber > 0 ? portNumber : 18080,
    };
    try {
      window.localStorage.setItem("hz_bixolon_name", name);
      window.localStorage.setItem("hz_bixolon_port", String(conf.port));
    } catch {
      /* حافظه در دسترس نیست */
    }

    setBixolonPhase("probing");
    setBixolonMessage(null);
    const probe = await probeBixolon(conf);
    if (!probe.ok) {
      setBixolonPhase("error");
      setBixolonMessage(probe.error ?? "خطای نامشخص در بررسی سرویس چاپ");
      return;
    }

    setBixolonPhase("printing");
    // رندر همان محتوای رسید حرارتی روی بوم خارج از صفحه و ارسال به چاپگر
    const canvas = renderThermalCanvas(detail, settlement, words, settings, paid);
    if (!canvas) {
      setBixolonPhase("error");
      setBixolonMessage("ساخت تصویر رسید ناموفق بود");
      return;
    }
    const result = await printReceiptBitmap(canvas, conf);
    if (result.ok) {
      setBixolonPhase("success");
      setBixolonMessage(null);
    } else {
      setBixolonPhase("error");
      setBixolonMessage(result.error ?? "خطای نامشخص در چاپ");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // با بستن دیالوگ، وضعیت چاپ مستقیم به حالت اولیه برمی‌گردد
        if (!o) {
          setBixolonPhase("idle");
          setBixolonMessage(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="receipt-dialog-content w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden p-0 gap-0 bg-neutral-100 dark:bg-neutral-200">
        <DialogTitle className="sr-only">رسید مرجوعی {detail.code}</DialogTitle>
        <DialogDescription className="sr-only">
          پیش‌نمایش برگه چاپی مرجوعی {detail.code} — قابل چاپ با بارکدهای قابل اسکن
        </DialogDescription>

        {/* قالب حرارتی: اندازهٔ صفحه چاپ به‌اندازهٔ محتوای واقعی رسید — پس از رندر اندازه‌گیری می‌شود
            (شروع از بالای رسید و قطع خودکار جایی که محتوا تمام می‌شود — بدون کاغذ سفید اضافه) */}
        {format === "thermal" && (
          <style ref={thermalStyleRef}>{"@media print { @page { size: 80mm 120mm; margin: 0; } }"}</style>
        )}

        {/* نوار ابزار (چاپ نمی‌شود) */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 bg-neutral-800 text-white border-b border-neutral-700">
          <Printer className="size-4 text-chart-2 shrink-0" />
          <p className="text-xs font-bold flex-1 min-w-0">
            {format === "a4"
              ? "پیش‌نمایش رسید — برگه A4 با بارکدهای قابل اسکن"
              : "پیش‌نمایش رسید — نوار حرارتی ۸۰ میلی‌متری"}
          </p>
          {/* انتخاب قالب چاپ */}
          <div
            className="flex rounded-lg bg-neutral-900/70 p-0.5 border border-neutral-700"
            role="group"
            aria-label="انتخاب قالب چاپ"
          >
            <button
              type="button"
              onClick={() => chooseFormat("a4")}
              aria-pressed={format === "a4"}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors h-9 ${
                format === "a4" ? "bg-chart-2 text-neutral-900" : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileText className="size-3.5" />
              برگه A4
            </button>
            <button
              type="button"
              onClick={() => chooseFormat("thermal")}
              aria-pressed={format === "thermal"}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors h-9 ${
                format === "thermal" ? "bg-chart-2 text-neutral-900" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Receipt className="size-3.5" />
              حرارتی ۸۰mm
            </button>
          </div>
          <Button size="sm" className="h-9 gap-1.5 font-bold active:scale-95 transition-transform" onClick={handlePrint}>
            <Printer className="size-4" />
            چاپ رسید
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
            بستن
          </Button>
        </div>

        {/* ---------- برگه رسید (ناحیه چاپ) ---------- */}
        <div className="receipt-paper-wrap p-3 sm:p-5">
          {format === "a4" ? (
          <div className="receipt-print-area mx-auto bg-white text-neutral-900 shadow-xl rounded-sm border border-neutral-200 max-w-[190mm] px-6 sm:px-10 py-8 select-none">
            {/* سربرگ */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <BrandEmblem size={52} className="shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold leading-7 text-neutral-900 truncate">{settings.storeName}</h2>
                  <p className="text-[10px] text-neutral-600 leading-4">{settings.storeCity}</p>
                  {settings.storePhone && (
                    <p className="text-[10px] text-neutral-600 leading-4 num" dir="ltr">
                      {settings.storePhone}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-[10px] text-neutral-500 tracking-wide">شماره پیگیری مرجوعی</p>
                <p className="text-lg font-extrabold text-neutral-900 num tracking-wide" dir="ltr">
                  {detail.code}
                </p>
                <div className="mt-1 flex justify-center">
                  <BarcodeSvg value={detail.code} height={34} width={1.5} fontSize={11} />
                </div>
              </div>
            </div>

            {/* عنوان و وضعیت */}
            <div className="flex items-center justify-between gap-3 py-3 border-b border-dashed border-neutral-300">
              <h3 className="text-base font-extrabold text-neutral-900">رسید ثبت مرجوعی کالا</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                {paid ? (
                  <span className="inline-flex items-center gap-1 border border-neutral-900 px-2 py-0.5 rounded">
                    <CheckCircle2 className="size-3" />
                    تسویه‌شده (پرداخت/بایگانی)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 border-2 border-neutral-900 px-2 py-0.5 rounded">
                    <Hourglass className="size-3" />
                    در انتظار انتقال وجه
                  </span>
                )}
              </div>
            </div>

            {/* اطلاعات مشتری و ثبت */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 py-3 border-b border-dashed border-neutral-300">
              <div>
                <p className="text-[11px] font-extrabold border-b border-neutral-300 pb-1 mb-1.5">مشخصات مشتری</p>
                <Field label="نام و نام خانوادگی" value={detail.customerName} strong />
                <Field label="موبایل" value={detail.customerPhone} ltr />
                <Field label="کارت بانکی" value={formatCardNumber(detail.customerCardNumber)} ltr />
                <Field label="زمان خرید" value={formatJalaliDate(new Date(detail.purchaseAt))} />
              </div>
              <div>
                <p className="text-[11px] font-extrabold border-b border-neutral-300 pb-1 mb-1.5">اطلاعات ثبت</p>
                <Field label="صندوقدار ثبت‌کننده" value={detail.cashier.fullName} strong />
                <Field label="زمان ثبت" value={formatJalaliFull(new Date(detail.submittedAt))} />
                <Field label="دلیل مرجوعی" value={detail.reason} />
                {detail.note && <Field label="توضیحات" value={detail.note} />}
              </div>
            </div>

            {/* اقلام + بارکد */}
            <div className="py-3">
              <p className="text-[11px] font-extrabold border-b border-neutral-300 pb-1 mb-2">
                اقلام مرجوعی ({detail.items.length} قلم)
              </p>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700">
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-7 font-bold">#</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 font-bold text-right">نام کالا</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-20 font-bold">کد</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-36 font-bold">بارکد</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-10 font-bold">تعداد</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-24 font-bold">قیمت واحد (ریال)</th>
                    <th className="border border-neutral-300 px-1.5 py-1.5 w-24 font-bold">مبلغ کل (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it, i) => (
                    <tr key={it.id} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                      <td className="border border-neutral-300 px-1.5 py-2 text-center num">{i + 1}</td>
                      <td className="border border-neutral-300 px-1.5 py-2 font-semibold leading-4">{it.name}</td>
                      <td className="border border-neutral-300 px-1.5 py-2 text-center num" dir="ltr">
                        {it.code || "—"}
                      </td>
                      <td className="border border-neutral-300 px-1.5 py-1.5">
                        <div className="flex items-center justify-center min-h-8">
                          {it.barcode ? (
                            <BarcodeSvg value={it.barcode} height={22} width={1.1} fontSize={9} />
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-neutral-300 px-1.5 py-2 text-center num font-bold">{formatQuantity(it.quantity)}</td>
                      <td className="border border-neutral-300 px-1.5 py-2 text-center num">{formatMoney(it.unitPrice)}</td>
                      <td className="border border-neutral-300 px-1.5 py-2 text-center num font-bold">{formatMoney(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* تسویه با مشتری */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
              <div className="space-y-2.5">
                {settlement ? (
                  <div className="border border-neutral-400 rounded p-3">
                    <p className="text-[11px] font-extrabold border-b border-neutral-300 pb-1 mb-1.5 flex items-center justify-between">
                      <span>تسویه با مشتری ({SETTLEMENT_META[detail.settlementType]?.label ?? detail.settlementType})</span>
                    </p>
                    <Field label="جمع کل اقلام" value={`${formatMoney(settlement.T)} ریال`} />
                    {settlement.E > 0 && (
                      <Field label="ارزش کالای جایگزین (−)" value={`${formatMoney(settlement.E)} ریال`} />
                    )}
                    <Field label="مبلغ قابل انتقال به حساب مشتری" value={`${formatMoney(settlement.X)} ریال`} strong />
                    {settlement.debt > 0 && (
                      <Field label="بدهی مشتری به فروشگاه" value={`${formatMoney(settlement.debt)} ریال`} strong />
                    )}
                    {settlement.credit > 0 && (
                      <Field label="اعتبار باقی‌مانده مشتری" value={`${formatMoney(settlement.credit)} ریال`} />
                    )}
                    {detail.transferNote && (
                      <p className="mt-2 pt-2 border-t border-dashed border-neutral-300 text-[10px] leading-5">
                        <span className="font-bold">دلیل اختلاف: </span>
                        {detail.transferNote}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="border border-neutral-300 rounded p-3">
                    <Field label="تسویه" value="انتقال کامل وجه به حساب مشتری" />
                  </div>
                )}

                {/* اطلاعات پرداخت */}
                <div className="border border-neutral-400 rounded p-3">
                  <p className="text-[11px] font-extrabold border-b border-neutral-300 pb-1 mb-1.5">اطلاعات بازگشت وجه</p>
                  {paid && detail.payment ? (
                    <>
                      <Field label="وضعیت" value="تسویه و بایگانی شد" strong />
                      <Field label="بانک" value={detail.payment.bankName} />
                      {detail.payment.referenceNumber && (
                        <Field label="شماره پیگیری انتقال" value={detail.payment.referenceNumber} ltr />
                      )}
                      {detail.payment.accountNumber && (
                        <Field label="شماره حساب مبدأ" value={detail.payment.accountNumber} ltr />
                      )}
                      {detail.payment.cardNumber && (
                        <Field label="کارت مبدأ" value={formatCardNumber(detail.payment.cardNumber)} ltr />
                      )}
                      <Field label="زمان انتقال/تسویه" value={formatJalaliFull(new Date(detail.payment.transferredAt))} />
                      <Field label="ثبت‌کننده" value={detail.payment.recordedBy.fullName} />
                    </>
                  ) : (
                    <p className="text-[10px] leading-5 text-neutral-700">
                      وجه این مرجوعی هنوز منتقل نشده است — پس از تأیید مدیریت ({settings.managerName})، مبلغ
                      قابل انتقال به کارت بانکی مشتری واریز می‌شود.
                    </p>
                  )}
                </div>
              </div>

              {/* مبلغ نهایی */}
              <div className="sm:w-56 border-2 border-neutral-900 rounded p-4 text-center">
                <p className="text-[10px] font-bold text-neutral-600 mb-1">
                  {paid ? "مبلغ انتقالی نهایی" : "مبلغ قابل انتقال"}
                </p>
                <p className="text-xl font-extrabold num text-neutral-900 leading-8">
                  {formatMoney(detail.transferAmount)}
                </p>
                <p className="text-[10px] text-neutral-600 num mb-1">ریال</p>
                <p className="text-[9px] text-neutral-500 leading-4 border-t border-dashed border-neutral-300 pt-1.5">
                  {words.rial}
                  <br />
                  {words.toman}
                </p>
              </div>
            </div>

            {/* امضاها */}
            <div className="grid grid-cols-3 gap-6 mt-8 pt-2">
              {["امضای مشتری", "امضای صندوقدار", `تأیید ${settings.managerName}`].map((s) => (
                <div key={s} className="text-center">
                  <div className="border-t border-dotted border-neutral-500 pt-1.5 mx-3" style={{ height: 34 }} />
                  <p className="text-[9px] text-neutral-600">{s}</p>
                </div>
              ))}
            </div>

            {/* پابرگ */}
            <div className="mt-6 pt-3 border-t border-neutral-300 text-center space-y-1">
              <p className="text-[10px] font-semibold text-neutral-800 leading-5">{settings.receiptFooter}</p>
              <p className="text-[8px] text-neutral-500 leading-4 flex items-center justify-center gap-1 flex-wrap">
                <Leaf className="size-2.5 inline" aria-hidden="true" />
                توسعه‌دهنده سامانه: {settings.developerCredit}
                <span className="mx-1">—</span>
                <span className="num">چاپ: {formatJalaliFull(new Date())}</span>
              </p>
            </div>
          </div>
          ) : (
            <ThermalReceipt detail={detail} settlement={settlement} words={words} settings={settings} paid={paid} paperRef={thermalPaperRef} />
          )}
        </div>

        {/* ---------- چاپ مستقیم چاپگر حرارتی Bixolon SRP-330II (بدون پنجرهٔ چاپ مرورگر) ---------- */}
        <div className="no-print px-3 pb-5 sm:px-5">
          <div className="mx-auto max-w-[190mm] rounded-xl border border-neutral-300 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100">
                <Cable className="size-5 text-neutral-700" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-neutral-900">چاپ مستقیم چاپگر حرارتی (Bixolon SRP-330II)</p>
                <p className="mt-0.5 text-[11px] leading-5 text-neutral-600">
                  ارسال بی‌واسطهٔ رسید به سرویس «Web Print SDK» روی همین رایانه — بدون باز شدن پنجرهٔ چاپ مرورگر
                </p>
              </div>
            </div>

            {/* تنظیمات اتصال */}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="hz-bixolon-name" className="text-[11px] font-bold text-neutral-700">
                  نام منطقی چاپگر
                </Label>
                <Input
                  id="hz-bixolon-name"
                  value={bixolonName}
                  onChange={(e) => setBixolonName(e.target.value)}
                  placeholder="Printer1"
                  autoComplete="off"
                  dir="ltr"
                  className="h-9 border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hz-bixolon-port" className="text-[11px] font-bold text-neutral-700">
                  پورت سرویس
                </Label>
                <Input
                  id="hz-bixolon-port"
                  value={bixolonPort}
                  onChange={(e) => setBixolonPort(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="18080"
                  autoComplete="off"
                  dir="ltr"
                  className="h-9 border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400"
                />
              </div>
            </div>

            {/* دکمهٔ چاپ + وضعیت */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-start">
              <Button
                size="sm"
                className="h-10 shrink-0 gap-1.5 font-bold active:scale-95 transition-transform"
                onClick={handleBixolonPrint}
                disabled={bixolonPhase === "probing" || bixolonPhase === "printing"}
              >
                {bixolonPhase === "probing" || bixolonPhase === "printing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}
                {bixolonPhase === "probing"
                  ? "در حال بررسی سرویس…"
                  : bixolonPhase === "printing"
                    ? "در حال ارسال به چاپگر…"
                    : "چاپ مستقیم (بدون پنجره مرورگر)"}
              </Button>
              {bixolonPhase === "success" && (
                <p className="flex items-center gap-1.5 text-xs font-bold leading-5 text-emerald-700" role="status">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  رسید به چاپگر ارسال شد و بریده شد
                </p>
              )}
              {bixolonPhase === "error" && (
                <p className="flex min-w-0 items-start gap-1.5 text-[11px] leading-5 text-red-700" role="alert">
                  <TriangleAlert className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-bold">{bixolonMessage}.</span> برای رفع: برنامهٔ BIXOLON Web Print SDK را از صفحهٔ
                    دانلود چاپگر SRP-330II نصب کنید، چاپگر را با همین «نام منطقی» در آن ثبت کنید و برنامه در پس‌زمینه در حال
                    اجرا بماند. اگر مرورگر اجازهٔ اتصال نداد، از دکمهٔ «چاپ رسید» (چاپ مرورگر) در نوار بالایی استفاده کنید.
                  </span>
                </p>
              )}
            </div>

            {/* راهنمای نصب */}
            <Collapsible className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-3.5 py-2.5 text-start text-[11px] font-bold text-neutral-700 transition-colors hover:bg-neutral-100">
                <CircleHelp className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                راهنمای نصب سرویس چاپ مستقیم (۵ گام)
                <ChevronDown
                  className="ms-auto size-3.5 shrink-0 text-neutral-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3.5 pb-3.5">
                <ol className="space-y-1.5">
                  {[
                    "از صفحهٔ دانلود رسمی Bixolon (پیوند پایین)، بستهٔ «Web Print SDK» مدل SRP-330II را دانلود و روی همین رایانهٔ صندوق نصب کنید.",
                    "برنامهٔ Bixolon Web Printer را اجرا کنید — باید در System Tray (پس‌زمینه) در حال اجرا بماند.",
                    "در برنامهٔ سرویس، چاپگر SRP-330II را با یک «نام منطقی» ثبت کنید (پیش‌فرض SDK: Printer1) و همان نام را در فیلد بالا وارد کنید.",
                    "پورت پیش‌فرض سرویس ۱۸۰۸۰ است — اگر هنگام نصب تغییر داده‌اید، همان عدد را در فیلد پورت وارد کنید.",
                    "یک بار «چاپ مستقیم» را امتحان کنید؛ اگر مرورگر اجازهٔ اتصال به شبکهٔ محلی نداد، از «چاپ رسید» (چاپ مرورگر) در نوار بالایی استفاده کنید.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-5 text-neutral-700">
                      <span className="num shrink-0 font-bold text-neutral-400">{toFaDigits(i + 1)}.</span>
                      <span className="min-w-0">{step}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href={BIXOLON_SDK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  صفحهٔ دانلود Bixolon SRP-330II (Web Print SDK)
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** دکمه شناور «چاپ رسید» برای استفاده در دیالوگ جزئیات — با وضعیت بارگذاری */
export function PrintReceiptButton({
  onClick,
  loading = false,
  className = "",
}: {
  onClick: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Button variant="outline" size="sm" className={`gap-1.5 h-9 ${className}`} onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin text-primary" /> : <FileDown className="size-4 text-primary" />}
      چاپ رسید
    </Button>
  );
}
