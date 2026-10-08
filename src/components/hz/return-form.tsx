"use client";

// فرم ثبت مرجوعی — قلب سامانه: اسکن بارکد، جستجوی کالا، اقلام، مبالغ با حروف‌خوانی
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ScanLine, Search, Plus, Minus, Trash2, UserRound, UserRoundSearch, Phone, CreditCard,
  ClipboardList, Loader2, Send, CheckCircle2, PackageSearch, Sparkles,
  MessageSquareText, History, RotateCcw, Landmark, Barcode, Wand2,
  ArrowLeftRight, Wallet, TriangleAlert, RefreshCw, Info, Repeat2, Printer, Camera, Save,
} from "lucide-react";
import { MoneyInput, MoneyDisplay } from "./money-input";
import { JalaliDateTimePicker } from "./jalali-datetime-picker";
import { IlluminatedDivider, PistachioMotif } from "./ornaments";
import { formatMoney, formatCardNumber, formatQuantity, toEnDigits, toFaDigits } from "@/lib/money";
import { RETURN_REASONS, detectBankName, digitsOnly, isValidCardNumber, isValidIranMobile } from "@/lib/validators";
import { generateInternalBarcode } from "@/lib/barcode";
import { formatJalaliFull, formatJalaliDateTime } from "@/lib/jalali";
import { SETTLEMENT_META, deriveSettlementType } from "./types";
import { ReceiptDialog } from "./receipt-dialog";
import { CameraScannerDialog } from "./camera-scanner-dialog";
import type { ProductDTO, ReturnItemDraft, SessionUser, SettlementType, ReturnDetailDTO, CustomerDetailDTO } from "./types";
import { CustomerHistoryDialog } from "./customer-history-dialog";

interface ReturnFormProps {
  user: SessionUser;
}

let keySeq = 1;

/* ---------- ورودی مقدار اعشاری — کالاهای وزنی (سوسیس/آجیل) و شمارشی ----------
   حالت متنی داخلی دارد تا هنگام تایپ ممیز («٫» یا «.») عدد وسط ویرایش نپرد؛
   فقط ارقام، ممیز و جداکننده فارسی پذیرفته می‌شود. گرد‌سازی تا ۳ رقم اعشار (دقت ترازو). */
function parseQuantityText(raw: string): number | null {
  const cleaned = toEnDigits(raw)
    .replace(/[٫,]/g, ".")
    .replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === "." ) return null;
  const parts = cleaned.split(".");
  const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(9999, Math.round(n * 1000) / 1000);
}

function QuantityInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  // الگوی «پیش‌نویس»: هنگام تایپ متن خام در state نگه داشته می‌شود؛ پس از blur نرمال می‌شود.
  // بدون افکت — متن نمایشی = پیش‌نویس در حال ویرایش یا مقدار قالب‌بندی‌شده
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatQuantity(value);

  return (
    <input
      aria-label="مقدار مرجوعی (عدد یا اعشار برای کالای وزنی)"
      inputMode="decimal"
      title="عدد صحیح یا اعشاری — مثلاً ۰٫۵ برای نیم کیلو"
      className="num w-16 h-9 text-center rounded-lg border bg-transparent font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
      value={text}
      onBlur={() => setDraft(null)} // پایان ویرایش — نمایش مقدار نرمال‌شده
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = parseQuantityText(raw);
        if (parsed !== null && parsed > 0) onChange(parsed);
        else if (raw.trim() === "" || raw === "۰") onChange(0.001); // موقتاً نزدیک صفر — ولیدیشن هنگام ثبت
      }}
    />
  );
}

/* ---------- پیش‌نویس خودکار — بازیابی فرم ناتمام پس از رفرش/بستن صفحه ---------- */
const DRAFT_MAX_AGE_MS = 14 * 24 * 3600 * 1000; // دورهٔ اعتبار پیش‌نویس

interface DraftItem {
  productId: string | null;
  name: string;
  barcode: string | null;
  code: string | null;
  quantity: number;
  unitPrice: number;
  fromDb: boolean;
  barcodeLocked: boolean;
}

interface ReturnDraft {
  v: 1;
  savedAt: string;
  customerName: string;
  customerPhone: string;
  customerCard: string;
  purchaseAt: string | null;
  reason: string;
  note: string;
  items: DraftItem[];
  exchangeValue: number;
  transferAmount: number;
  transferManual: boolean;
  transferNote: string;
}

/** کلید پیش‌نویس — جدا به‌ازای هر صندوقدار */
function draftKey(user: SessionUser): string {
  return `hz:return-draft:${user.username}`;
}

/** آیا پیش‌نویس محتوای معتبری دارد؟ (فرم کاملاً خالی ذخیره نمی‌شود) */
function draftHasContent(d: ReturnDraft | null): boolean {
  if (!d) return false;
  return (
    d.customerName.trim().length > 0 ||
    d.customerPhone.trim().length > 0 ||
    d.customerCard.trim().length > 0 ||
    d.reason.trim().length > 0 ||
    d.note.trim().length > 0 ||
    d.exchangeValue > 0 ||
    d.transferNote.trim().length > 0 ||
    d.items.length > 0
  );
}

/** خواندن پیش‌نویس از localStorage — با گارد SSR و اعتبارسنجی ساختار/سن */
function readDraft(key: string): ReturnDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as ReturnDraft | null;
    if (!d || d.v !== 1 || typeof d.savedAt !== "string" || !Array.isArray(d.items)) return null;
    const t = new Date(d.savedAt).getTime();
    if (isNaN(t) || Date.now() - t > DRAFT_MAX_AGE_MS) return null; // پیش‌نویس کهنه → نادیده گرفته می‌شود
    return d;
  } catch {
    return null;
  }
}

/** نوشتن پیش‌نویس — بی‌صدا رد می‌شود در حالت خصوص/پر بودن ظرفیت */
function writeDraft(key: string, d: ReturnDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* دسترسی به localStorage ممکن نیست — پیش‌نویس این بار ذخیره نمی‌شود */
  }
}

/** حذف پیش‌نویس */
function removeDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* نادیده گرفتن خطای حذف */
  }
}

export function ReturnForm({ user }: ReturnFormProps) {
  // خواندن یک‌بارهٔ پیش‌نویس در اولین رندر
  const draftRef = useRef<ReturnDraft | null | undefined>(undefined);
  if (draftRef.current === undefined) {
    draftRef.current = readDraft(draftKey(user));
  }

  // اطلاعات مشتری
  const [customerName, setCustomerName] = useState(() => draftRef.current?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(() => draftRef.current?.customerPhone ?? "");
  const [customerCard, setCustomerCard] = useState(() => draftRef.current?.customerCard ?? "");
  const [purchaseAt, setPurchaseAt] = useState<Date | null>(() => {
    const iso = draftRef.current?.purchaseAt;
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  });
  const [reason, setReason] = useState<string>(() => draftRef.current?.reason ?? "");
  const [note, setNote] = useState(() => draftRef.current?.note ?? "");

  // اقلام
  const [items, setItems] = useState<ReturnItemDraft[]>(() =>
    (draftRef.current?.items ?? []).map((d) => ({
      key: `k${keySeq++}`,
      productId: d.productId,
      name: d.name,
      barcode: d.barcode,
      code: d.code,
      // مقدار اعشاری مجاز — کالاهای وزنی (سوسیس/آجیل): ۰٫۲۵ تا ۹۹۹۹
      quantity: Math.min(9999, Math.max(0.001, Math.round((d.quantity || 1) * 1000) / 1000)),
      unitPrice: Math.max(0, d.unitPrice || 0),
      fromDb: !!d.fromDb,
      barcodeLocked: !!d.barcodeLocked,
    }))
  );
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductDTO[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // تسویه با مشتری: کالای جایگزین + مبلغ قابل انتقال + دلیل اختلاف
  const [exchangeValue, setExchangeValue] = useState(() => draftRef.current?.exchangeValue ?? 0);
  const [transferAmount, setTransferAmount] = useState(() => draftRef.current?.transferAmount ?? 0);
  // آیا صندوقدار مبلغ انتقال را دستی تغییر داده؟ (تا وقتی دستی است، بازمحاسبه خودکار غیرفعال می‌ماند)
  const [transferManual, setTransferManual] = useState<boolean>(() => draftRef.current?.transferManual ?? false);
  const [transferNote, setTransferNote] = useState(() => draftRef.current?.transferNote ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    code: string;
    total: number;
    transfer: number;
    exchange: number;
    settlementType: SettlementType;
    count: number;
    at: Date;
  } | null>(null);
  const [todayCount, setTodayCount] = useState(0);

  // رسید چاپی بلافاصله پس از ثبت
  const [receiptDetail, setReceiptDetail] = useState<ReturnDetailDTO | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // شناسایی مشتری بر اساس موبایل (سابقه مرجوعی‌ها سر میز)
  const [customerLookup, setCustomerLookup] = useState<CustomerDetailDTO | null>(null);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);

  // زمان آخرین ذخیرهٔ خودکار پیش‌نویس (نشانگر «ذخیرهٔ خودکار» در ستون خلاصه)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(() =>
    draftRef.current && draftHasContent(draftRef.current) ? new Date(draftRef.current.savedAt) : null
  );

  async function printReceiptNow() {
    if (!success?.id || receiptLoading) return;
    setReceiptLoading(true);
    try {
      const res = await fetch(`/api/returns/${success.id}`);
      const data = await res.json();
      if (!res.ok || !data?.id) {
        toast.error(data?.error || "دریافت اطلاعات رسید ناموفق بود");
        return;
      }
      setReceiptDetail(data as ReturnDetailDTO);
      setReceiptOpen(true);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setReceiptLoading(false);
    }
  }

  const barcodeRef = useRef<HTMLInputElement>(null);

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [items]);
  const totalCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // مشتقات تسویه
  const settlementType = deriveSettlementType(total, exchangeValue, transferAmount);
  const netAmount = total - exchangeValue; // مانده خالص حق مشتری پس از کسر جایگزین
  const customerDebt = exchangeValue > total ? exchangeValue - total : 0;
  const customerCredit =
    transferAmount + exchangeValue < total ? total - exchangeValue - transferAmount : 0;
  const noteRequired = settlementType === "partial" || settlementType === "debt";

  // همگام‌سازی مبلغ قابل انتقال — فقط تا وقتی صندوقدار دستی تغییرش نداده باشد
  useEffect(() => {
    if (!transferManual) setTransferAmount(Math.max(0, total - exchangeValue));
  }, [total, exchangeValue, transferManual]);

  const phoneOk = isValidIranMobile(customerPhone);
  const cardOk = isValidCardNumber(customerCard);
  const bankName = detectBankName(customerCard);

  // استعلام خودکار سابقه مشتری پس از معتبر شدن شماره موبایل (با تأخیر)
  useEffect(() => {
    if (!phoneOk) {
      setCustomerLookup(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerPhone)}`);
        const data: CustomerDetailDTO = await res.json();
        setCustomerLookup(data?.found ? data : null);
      } catch {
        setCustomerLookup(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [customerPhone, phoneOk]);

  // جستجوی زنده کالا (با تأخیر)
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen]);

  function addItem(p: ProductDTO | null, manual = false): boolean {
    let existing: ReturnItemDraft | undefined;
    if (p) {
      existing = items.find(
        (i) => (p.barcode && i.barcode === p.barcode) || (p.id && i.productId === p.id)
      );
      if (existing) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === existing!.key
              ? { ...i, quantity: Math.min(9999, Math.round((i.quantity + 1) * 1000) / 1000) }
              : i
          )
        );
        toast.info(`«${p.name}» از قبل در فهرست است — مقدار افزایش یافت`, {
          description: "مقدار فعلی: " + formatQuantity((existing.quantity || 0) + 1),
        });
        return true;
      }
      setItems((prev) => [
        {
          key: `k${keySeq++}`,
          productId: p.id,
          name: p.name,
          barcode: p.barcode,
          code: p.code,
          quantity: 1,
          unitPrice: p.price,
          fromDb: true,
          barcodeLocked: !!p.barcode,
        },
        ...prev,
      ]);
      return true;
    }
    if (manual) {
      setItems((prev) => [
        {
          key: `k${keySeq++}`,
          productId: null,
          name: "",
          // هر قلم دستی هم بارکد دارد — بارکد داخلی EAN-13 تولید می‌شود
          barcode: generateInternalBarcode(),
          code: null,
          quantity: 1,
          unitPrice: 0,
          fromDb: false,
          barcodeLocked: false,
        },
        ...prev,
      ]);
      return true;
    }
    return false;
  }

  async function handleBarcode(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = digitsOnly(barcodeInput);
    if (code.length < 4) {
      if (code.length > 0) toast.error("بارکد خیلی کوتاه است");
      return;
    }
    await lookupBarcode(code, true);
  }

  /** جستجوی بارکد در بانک کالا — مشترک بین اسکنر سیمی، ورود دستی و دوربین */
  async function lookupBarcode(code: string, focusAfter: boolean) {
    setScanning(true);
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
      const data = await res.json();
      const p: ProductDTO | undefined = data.products?.[0];
      if (p) {
        addItem(p);
        toast.success(`افزوده شد: ${p.name}`, {
          description: `قیمت: ${formatMoney(p.price)} ریال`,
        });
        setBarcodeInput("");
      } else {
        toast.error(`کالایی با بارکد ${toFaDigits(code)} در بانک کالا یافت نشد`, {
          description: "می‌توانید آن را به‌صورت دستی به فهرست اضافه کنید",
          duration: 5000,
        });
      }
    } catch {
      toast.error("خطا در جستجوی بارکد");
    } finally {
      setScanning(false);
      if (focusAfter) barcodeRef.current?.focus();
    }
  }

  /** خوانده‌شدن بارکد از دوربین — فرم باز می‌ماند تا چند قلم پشت‌سرهم اسکن شود */
  function handleCameraDetect(code: string) {
    const clean = digitsOnly(code);
    if (clean.length < 4) {
      toast.error("بارکد خوانده‌شده از دوربین معتبر نیست");
      return;
    }
    void lookupBarcode(clean, false);
  }

  function updateItem(key: string, patch: Partial<ReturnItemDraft>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function validate(): string | null {
    if (customerName.trim().length < 2) return "نام مشتری را کامل وارد کنید";
    if (!phoneOk) return "شماره موبایل مشتری معتبر نیست (۰۹xxxxxxxxx)";
    if (!cardOk) return "شماره کارت بانکی مشتری معتبر نیست";
    if (!purchaseAt) return "زمان خرید مشتری را انتخاب کنید";
    if (!reason) return "دلیل مرجوعی را انتخاب کنید";
    if (items.length === 0) return "حداقل یک کالا به فهرست اضافه کنید";
    for (const i of items) {
      if (!i.name.trim()) return "نام یکی از اقلام خالی است";
      if (!(i.quantity > 0))
        return `مقدار «${i.name}» باید بزرگ‌تر از صفر باشد — برای کالای وزنی می‌توانید عدد اعشاری (مثل ۰٫۵) وارد کنید`;
      if (i.unitPrice <= 0) return `قیمت «${i.name}» را وارد کنید`;
      if (!i.barcode || digitsOnly(i.barcode).length < 4)
        return `بارکد «${i.name}» خالی است — بارکد را وارد کنید یا دکمه تولید بارکد داخلی را بزنید`;
    }
    // منطق تسویه
    if (exchangeValue > total && transferAmount > 0)
      return "در حالت بدهی مشتری (جایگزین بیشتر از مرجوعی)، مبلغ قابل انتقال باید صفر باشد";
    if (exchangeValue <= total && transferAmount > total - exchangeValue)
      return "مبلغ قابل انتقال نمی‌تواند از «جمع اقلام منهای ارزش جایگزین» بیشتر باشد";
    if (noteRequired && transferNote.trim().length < 3)
      return "دلیل اختلاف مبلغ انتقالی با جمع اقلام را در توضیح تسویه بنویسید";
    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    const err = validate();
    if (err) {
      toast.error(err, { description: "لطفاً فرم را کامل کنید" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: digitsOnly(customerPhone),
          customerCardNumber: digitsOnly(customerCard),
          purchaseAt: purchaseAt?.toISOString(),
          reason: reason === "سایر" ? note.trim() || "سایر" : reason,
          note: note.trim() || null,
          exchangeValue,
          transferAmount,
          transferNote: transferNote.trim() || null,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name.trim(),
            barcode: digitsOnly(i.barcode ?? "") || null,
            code: i.code,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ثبت مرجوعی ناموفق بود");
        return;
      }
      setSuccess({
        id: data.id,
        code: data.code,
        total: data.totalAmount,
        transfer: data.transferAmount ?? data.totalAmount,
        exchange: data.exchangeValue ?? 0,
        settlementType: (data.settlementType ?? "full") as SettlementType,
        count: data.itemCount,
        at: new Date(data.submittedAt),
      });
      removeDraft(draftKey(user)); // ثبت نهایی شد — پیش‌نویس دیگر لازم نیست
      setTodayCount((c) => c + 1);
      toast.success(`مرجوعی ${data.code} با موفقیت ثبت شد 🌿`, {
        description:
          data.transferAmount && data.transferAmount > 0
            ? "به آقای نوروزی پیامک اطلاع‌رسانی شد تا وجه را به کارت مشتری منتقل کند"
            : "این مرجوعی بدون انتقال وجه است — در انتظار تأیید مدیر کل (خانم لطفی) در سامانه",
      });
    } catch {
      toast.error("ارتباط با سرور برقرار نشد");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCard("");
    setPurchaseAt(null);
    setReason("");
    setNote("");
    setItems([]);
    setBarcodeInput("");
    setExchangeValue(0);
    setTransferAmount(0);
    setTransferManual(false);
    setTransferNote("");
    setSuccess(null);
    removeDraft(draftKey(user));
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }

  /** دورریختن پیش‌نویس بازیابی‌شده و خالی‌کردن فرم برای شروع تازه */
  function discardDraft() {
    removeDraft(draftKey(user));
    setDraftSavedAt(null);
    resetForm();
    toast.info("پیش‌نویس دور ریخته شد", { description: "فرم برای ثبت مرجوعی جدید خالی شد" });
  }

  // میان‌بر: Ctrl+Enter برای ثبت سریع
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !success) {
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ذخیرهٔ خودکار پیش‌نویس (۷۰۰ میلی‌ثانیه پس از آخرین تغییر)
  useEffect(() => {
    if (success) return; // پس از ثبت موفق، پیش‌نویس دیگر معنا ندارد
    const t = setTimeout(() => {
      const key = draftKey(user);
      const draft: ReturnDraft = {
        v: 1,
        savedAt: new Date().toISOString(),
        customerName,
        customerPhone,
        customerCard,
        purchaseAt: purchaseAt?.toISOString() ?? null,
        reason,
        note,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          barcode: i.barcode,
          code: i.code,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          fromDb: i.fromDb,
          barcodeLocked: !!i.barcodeLocked,
        })),
        exchangeValue,
        transferAmount,
        transferManual,
        transferNote,
      };
      if (draftHasContent(draft)) {
        writeDraft(key, draft);
        setDraftSavedAt(new Date());
      } else {
        removeDraft(key);
        setDraftSavedAt(null);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [user, success, customerName, customerPhone, customerCard, purchaseAt, reason, note, items, exchangeValue, transferAmount, transferManual, transferNote]);

  // اعلام بازیابی پیش‌نویس پس از بارگذاری صفحه
  useEffect(() => {
    const d = draftRef.current;
    if (!d || !draftHasContent(d)) return;
    toast.success("پیش‌نویس ناتمام بازیابی شد", {
      description: `${toFaDigits(d.items.length)} قلم در فهرست — آخرین ذخیره: ${formatJalaliDateTime(new Date(d.savedAt))}`,
      duration: 8000,
      action: { label: "دورریختن", onClick: () => discardDraft() },
    });
  }, []);

  // ----- صفحه موفقیت -----
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto"
      >
        <div className="rounded-3xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
          <div className="arch pattern-tile bg-primary/10 px-8 pt-12 pb-8 text-center relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.15 }}
              className="mx-auto mb-4 size-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center"
            >
              <CheckCircle2 className="size-10 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-extrabold">مرجوعی ثبت شد</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {success.transfer > 0
                ? "درخواست برای انتقال وجه به آقای نوروزی ارسال شد (پیامک اطلاع‌رسانی)"
                : "بدون انتقال وجه — در انتظار تأیید مدیر کل (خانم لطفی)"}
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground mb-1">شماره پیگیری</p>
                <p className="num font-extrabold text-primary" dir="ltr">{success.code}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground mb-1">تعداد اقلام</p>
                <p className="num font-extrabold">{toFaDigits(success.count)}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs text-muted-foreground mb-1">زمان ثبت</p>
                <p className="text-sm font-bold leading-6">{formatJalaliFull(success.at)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <MoneyDisplay amount={success.transfer} size="lg" />
              {success.transfer !== success.total && (
                <div className="mt-3 pt-3 border-t border-primary/20 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1">
                    <ArrowLeftRight className="size-3" />
                    {SETTLEMENT_META[success.settlementType]?.label ?? success.settlementType}
                  </Badge>
                  <span className="text-muted-foreground num">
                    جمع اقلام: {formatMoney(success.total)} ریال
                    {success.exchange > 0 &&
                      ` — کالای جایگزین: ${formatMoney(success.exchange)} ریال`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1 font-bold" onClick={resetForm}>
                <RotateCcw className="size-5" />
                ثبت مرجوعی جدید
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 font-bold"
                onClick={printReceiptNow}
                disabled={receiptLoading}
              >
                {receiptLoading ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Printer className="size-5 text-primary" />
                )}
                چاپ رسید مرجوعی
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              امروز {toFaDigits(todayCount)} مرجوعی ثبت کرده‌اید — دست شما درد نکند 🌿
            </p>
          </div>
        </div>
        <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} detail={receiptDetail} />
      </motion.div>
    );
  }

  // ----- فرم اصلی -----
  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        {/* بخش ۱: اطلاعات مشتری */}
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden" aria-labelledby="sec-customer">
          <header className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/40">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-extrabold num">
              ۱
            </span>
            <h2 id="sec-customer" className="font-bold">
              اطلاعات مشتری
            </h2>
          </header>
          <div className="p-5 grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="cname" className="flex items-center gap-1.5">
                <UserRound className="size-3.5 text-primary" />
                نام و نام خانوادگی مشتری
              </Label>
              <Input
                id="cname"
                placeholder="مثال: مریم حسینی"
                className="h-11"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cphone" className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" />
                شماره موبایل مشتری
              </Label>
              <Input
                id="cphone"
                inputMode="numeric"
                placeholder="۰۹xxxxxxxxx"
                className={`num h-11 ${customerPhone && !phoneOk ? "border-destructive/60 focus-visible:ring-destructive/30" : ""}`}
                value={customerPhone ? toFaDigits(digitsOnly(customerPhone)) : ""}
                onChange={(e) => setCustomerPhone(digitsOnly(e.target.value).slice(0, 11))}
                aria-invalid={!!customerPhone && !phoneOk}
              />
              {customerPhone && (
                <p className={`text-[11px] ${phoneOk ? "text-primary" : "text-destructive"}`}>
                  {phoneOk ? "✓ شماره موبایل معتبر است" : "شماره باید ۱۱ رقم و با ۰۹ شروع شود"}
                </p>
              )}
              {/* شناسایی خودکار مشتری — سابقه مرجوعی‌های قبلی */}
              {customerLookup && (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold flex items-center gap-1.5 text-primary">
                      <UserRoundSearch className="size-4" />
                      مشتری شناسایی شد: {customerLookup.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCustomerHistoryOpen(true)}
                      className="text-[11px] font-bold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors h-8 px-1"
                    >
                      مشاهده سابقه کامل ←
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 num font-semibold">
                      {customerLookup.returnCount.toLocaleString("fa-IR")} مرجوعی سابقه
                    </span>
                    {customerLookup.pendingCount > 0 && (
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 num font-semibold">
                        {customerLookup.pendingCount.toLocaleString("fa-IR")} در انتظار پرداخت
                      </span>
                    )}
                    {customerLookup.creditTotal > 0 && (
                      <span className="rounded-full bg-chart-1/10 border border-chart-1/30 text-chart-1 px-2.5 py-1 num font-semibold">
                        اعتبار نزد فروشگاه: {formatMoney(customerLookup.creditTotal)} ریال
                      </span>
                    )}
                    {customerLookup.debtTotal > 0 && (
                      <span className="rounded-full bg-destructive/10 border border-destructive/30 text-destructive px-2.5 py-1 num font-semibold">
                        بدهی به فروشگاه: {formatMoney(customerLookup.debtTotal)} ریال
                      </span>
                    )}
                  </div>
                  {customerLookup.lastAt && (
                    <p className="text-[10px] text-muted-foreground num">
                      آخرین مرجوعی: {formatJalaliDateTime(new Date(customerLookup.lastAt))}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <History className="size-3.5 text-primary" />
                زمان خرید مشتری
              </Label>
              <JalaliDateTimePicker
                value={purchaseAt}
                onChange={setPurchaseAt}
                placeholder="انتخاب زمان خرید (تقویم شمسی)"
              />
              {purchaseAt && (
                <p className="text-[11px] text-muted-foreground num">{formatJalaliFull(purchaseAt)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccard" className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-primary" />
                شماره کارت بانکی مشتری
                <span className="text-[10px] text-muted-foreground font-normal">
                  (برای بازگشت وجه)
                </span>
              </Label>
              <Input
                id="ccard"
                inputMode="numeric"
                placeholder="۱۲۳۴-۵۶۷۸-۹۰۱۲-۳۴۵۶"
                className={`num tracking-wider h-11 ${customerCard && !cardOk ? "border-destructive/60 focus-visible:ring-destructive/30" : ""}`}
                value={customerCard ? formatCardNumber(customerCard) : ""}
                onChange={(e) => setCustomerCard(digitsOnly(e.target.value).slice(0, 16))}
                aria-invalid={!!customerCard && !cardOk}
              />
              {customerCard && (
                <div className="flex items-center gap-2 flex-wrap min-h-5">
                  {bankName && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Landmark className="size-3" />
                      {bankName}
                    </Badge>
                  )}
                  <span className={`text-[11px] ${cardOk ? "text-primary" : "text-destructive"}`}>
                    {cardOk
                      ? "✓ شماره کارت معتبر است"
                      : `(${toFaDigits(customerCard.length)} از ۱۶ رقم) شماره کارت معتبر نیست`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* بخش ۲: اقلام مرجوعی */}
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden" aria-labelledby="sec-items">
          <header className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/40">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-extrabold num">
              ۲
            </span>
            <h2 id="sec-items" className="font-bold">
              اقلام مرجوعی
            </h2>
            <Badge variant="outline" className="num mr-auto">
              {toFaDigits(items.length)} قلم
            </Badge>
          </header>
          <div className="p-5 space-y-5">
            {/* اسکن بارکد */}
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="barcode" className="flex items-center gap-1.5 mb-2 font-bold text-primary">
                  <ScanLine className="size-4" />
                  اسکن بارکد کالا
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (اسکنر را وصل کنید و بارکد را بگیرید)
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mb-2 h-11 sm:h-9 gap-1.5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="size-4" />
                  اسکن با دوربین
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="barcode"
                  ref={barcodeRef}
                  autoFocus
                  inputMode="numeric"
                  placeholder="بارکد را اسکن کنید یا تایپ کنید و Enter بزنید…"
                  className="num text-right text-lg font-bold tracking-widest h-14 pr-12 pl-20 border-primary/40 focus-visible:ring-primary/30 bg-background"
                  value={barcodeInput ? toFaDigits(barcodeInput) : ""}
                  onChange={(e) => setBarcodeInput(digitsOnly(e.target.value))}
                  onKeyDown={handleBarcode}
                  disabled={scanning}
                />
                <ScanLine
                  className={`absolute right-4 top-1/2 -translate-y-1/2 size-5 ${scanning ? "text-primary animate-pulse" : "text-muted-foreground"}`}
                />
                {barcodeInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8"
                    onClick={() => {
                      const ev = { key: "Enter", preventDefault: () => {} } as React.KeyboardEvent<HTMLInputElement>;
                      handleBarcode(ev);
                    }}
                  >
                    {scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    جستجو
                  </Button>
                )}
              </div>
            </div>

            {/* جستجوی نام کالا */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto sm:flex-1 h-12 justify-start text-muted-foreground font-normal"
                  >
                    <PackageSearch className="size-4 ml-2" />
                    {searchQuery ? searchQuery : "جستجوی سریع کالا از بانک کالا…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(28rem,90vw)] p-0 z-50" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="نام کالا را بنویسید (حداقل ۲ حرف)…"
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      {searchLoading && (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          در حال جستجو…
                        </div>
                      )}
                      {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <CommandEmpty>
                          کالایی یافت نشد — می‌توانید «افزودن دستی» را بزنید
                        </CommandEmpty>
                      )}
                      {searchResults.length > 0 && (
                        <CommandGroup heading="نتایج بانک کالا">
                          {searchResults.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                addItem(p);
                                setSearchOpen(false);
                                setSearchQuery("");
                                toast.success(`افزوده شد: ${p.name}`);
                              }}
                              className="gap-3 py-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground num flex gap-2 flex-wrap">
                                  {p.barcode && <span dir="ltr">بارکد: {toFaDigits(p.barcode)}</span>}
                                  {p.category && <span>{p.category}</span>}
                                </p>
                              </div>
                              <Badge variant="secondary" className="num shrink-0">
                                {formatMoney(p.price)} ریال
                              </Badge>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="secondary"
                className="h-12 font-semibold shrink-0"
                onClick={() => {
                  addItem(null, true);
                  toast.info("ردیف دستی اضافه شد — نام و قیمت را وارد کنید");
                }}
              >
                <Plus className="size-4" />
                افزودن دستی
              </Button>
            </div>

            {/* جدول اقلام */}
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {items.map((item, idx) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: -12, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`rounded-xl border p-4 ${item.fromDb ? "border-primary/25 bg-primary/5" : "border-dashed bg-muted/20"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="num flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary font-extrabold text-sm mt-1">
                        {toFaDigits(idx + 1)}
                      </span>
                      <div className="flex-1 grid gap-3 min-w-0">
                        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <Label className="text-[11px] text-muted-foreground">نام کالا</Label>
                            {item.fromDb ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold leading-6">{item.name}</p>
                                {item.code && (
                                  <Badge variant="outline" className="num text-[10px]">
                                    کد: {toFaDigits(item.code)}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Input
                                placeholder="نام کالا را بنویسید…"
                                className="h-10"
                                value={item.name}
                                onChange={(e) => updateItem(item.key, { name: e.target.value })}
                                maxLength={200}
                              />
                            )}
                            {/* بارکد — هر قلم مرجوعی بارکد دارد (بانک کالا، دستی یا تولید داخلی) */}
                            {item.barcodeLocked && item.barcode ? (
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <Badge variant="outline" className="num text-[10px] gap-1 border-primary/30 text-primary" dir="ltr">
                                  <Barcode className="size-3" />
                                  {toFaDigits(item.barcode)}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">از بانک کالا</span>
                              </div>
                            ) : (
                              <div className="space-y-1 pt-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    dir="ltr"
                                    inputMode="numeric"
                                    placeholder="بارکد کالا…"
                                    className="num text-left h-9 text-xs tracking-wider flex-1"
                                    value={item.barcode ? toFaDigits(item.barcode) : ""}
                                    onChange={(e) =>
                                      updateItem(item.key, {
                                        barcode: digitsOnly(e.target.value).slice(0, 14) || null,
                                      })
                                    }
                                    aria-label={`بارکد ${item.name || "کالا"}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 shrink-0 gap-1 text-[11px]"
                                    onClick={() => {
                                      const bc = generateInternalBarcode();
                                      updateItem(item.key, { barcode: bc });
                                      toast.success("بارکد داخلی EAN-13 تولید شد", {
                                        description: `شماره: ${toFaDigits(bc)} — قابل چاپ روی برگه مرجوعی`,
                                      });
                                    }}
                                  >
                                    <Wand2 className="size-3.5 text-primary" />
                                    تولید
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-4">
                                  {item.barcode && digitsOnly(item.barcode).length >= 4
                                    ? item.barcode.startsWith("2")
                                      ? "بارکد داخلی فروشگاه (پیش‌شماره ۲) — روی برگه مرجوعی چاپ می‌شود"
                                      : "بارکد ثبت‌شده برای این قلم"
                                    : "بارکد الزامی است — اگر کالا بارکد ندارد، دکمه «تولید» بارکد داخلی می‌سازد"}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                            {/* مقدار — عدد صحیح یا اعشاری (کالاهای وزنی) */}
                            <div className="flex items-center gap-1.5" role="group" aria-label="مقدار مرجوعی">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-9 rounded-lg"
                                onClick={() =>
                                  updateItem(item.key, {
                                    quantity: Math.max(
                                      0.1,
                                      Math.round((item.quantity - 1) * 1000) / 1000
                                    ),
                                  })
                                }
                                aria-label="کاهش مقدار"
                              >
                                <Minus className="size-4" />
                              </Button>
                              <QuantityInput
                                value={item.quantity}
                                onChange={(v) => updateItem(item.key, { quantity: v })}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-9 rounded-lg"
                                onClick={() =>
                                  updateItem(item.key, {
                                    quantity: Math.min(9999, Math.round((item.quantity + 1) * 1000) / 1000),
                                  })
                                }
                                aria-label="افزایش مقدار"
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 size-9"
                              onClick={() => removeItem(item.key)}
                              aria-label={`حذف ${item.name || "کالا"}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 items-start">
                          <div>
                            <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                              قیمت واحد
                            </Label>
                            <MoneyInput
                              value={item.unitPrice}
                              onChange={(v) => updateItem(item.key, { unitPrice: v })}
                              placeholder="قیمت واحد (ریال)"
                            />
                          </div>
                          <div className="sm:text-end">
                            <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                              مبلغ کل این ردیف
                            </Label>
                            <MoneyDisplay amount={item.quantity * item.unitPrice} showWords={false} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">
                  <PistachioMotif size={56} className="mx-auto mb-3 opacity-70" />
                  <p className="text-sm leading-7">
                    هنوز کالایی اضافه نشده است.
                    <br />
                    <span className="text-xs">
                      بارکد را اسکن کنید، از جستجوی کالا استفاده کنید یا ردیف دستی بسازید
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* بخش ۳: دلیل مرجوعی */}
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden" aria-labelledby="sec-reason">
          <header className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/40">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-extrabold num">
              ۳
            </span>
            <h2 id="sec-reason" className="font-bold">
              دلیل مرجوعی و توضیحات
            </h2>
          </header>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageSquareText className="size-3.5 text-primary" />
                دلیل بازگشت کالا
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-11!">
                  <SelectValue placeholder="دلیل مرجوعی را انتخاب کنید…" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                  <SelectItem value="سایر">سایر (در توضیحات بنویسید)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">توضیحات تکمیلی (اختیاری)</Label>
              <Textarea
                id="note"
                placeholder="هر نکته‌ای که آقای نوروزی باید بداند… مثلاً وضعیت بسته‌بندی یا شماره فاکتور"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground num">
                {toFaDigits(note.length)} / {toFaDigits(500)} نویسه
              </p>
            </div>
          </div>
        </section>

        {/* بخش ۴: تسویه با مشتری */}
        <section className="rounded-2xl border bg-card shadow-sm overflow-hidden" aria-labelledby="sec-settlement">
          <header className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/40 flex-wrap">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-extrabold num">
              ۴
            </span>
            <h2 id="sec-settlement" className="font-bold">
              تسویه با مشتری
            </h2>
            <Badge
              variant={settlementType === "debt" ? "destructive" : settlementType === "full" ? "default" : "secondary"}
              className="gap-1 mr-auto"
            >
              <ArrowLeftRight className="size-3" />
              {SETTLEMENT_META[settlementType].label}
            </Badge>
          </header>
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-6 bg-muted/40 rounded-lg px-3 py-2.5">
              اگر مشتری به‌جای وجه کامل، کالای جایگزین برداشته یا بیش از ارزش مرجوعی خرید کرده است،
              مبلغ قابل انتقال را اینجا مشخص کنید. مبلغ پیش‌فرض = جمع اقلام منهای ارزش جایگزین.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Repeat2 className="size-3.5 text-chart-3" />
                  ارزش کالا/خدمات جایگزین
                  <span className="text-[10px] font-normal text-muted-foreground">(اختیاری)</span>
                </Label>
                <MoneyInput
                  value={exchangeValue}
                  onChange={setExchangeValue}
                  placeholder="اگر مشتری کالای دیگری برداشته…"
                />
                <p className="text-[11px] text-muted-foreground leading-5">
                  ارزش خریدهای جدیدی که مشتری همراه مرجوعی برداشته است
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-primary" />
                  مبلغ قابل انتقال به حساب مشتری
                  <span className="text-[10px] font-normal text-primary">(الزامی)</span>
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <MoneyInput
                      value={transferAmount}
                      onChange={(v) => {
                        setTransferAmount(v);
                        setTransferManual(true);
                      }}
                      placeholder="مبلغ انتقالی (ریال)"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 gap-1 text-[11px]"
                    onClick={() => {
                      setTransferManual(false);
                      setTransferAmount(Math.max(0, total - exchangeValue));
                    }}
                    title="بازمحاسبه از جمع اقلام منهای جایگزین"
                  >
                    <RefreshCw className="size-3.5 text-primary" />
                    همگام
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-5 num">
                  سقف مجاز: {formatMoney(Math.max(0, netAmount))} ریال
                </p>
              </div>
            </div>

            {/* کارت‌های محاسباتی */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">جمع اقلام مرجوعی</p>
                <p className="num font-extrabold text-sm">{formatMoney(total)}</p>
                <p className="text-[10px] text-muted-foreground num">ریال</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">مانده خالص حق مشتری</p>
                <p className={`num font-extrabold text-sm ${netAmount < 0 ? "text-destructive" : ""}`}>
                  {formatMoney(Math.abs(netAmount))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {netAmount < 0 ? "بدهی مشتری (ریال)" : "ریال"}
                </p>
              </div>
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-center col-span-2 sm:col-span-1">
                <p className="text-[10px] text-muted-foreground mb-1">مبلغ قابل انتقال</p>
                <p className="num font-extrabold text-sm text-primary">{formatMoney(Math.max(0, transferAmount))}</p>
                <p className="text-[10px] text-muted-foreground num">ریال</p>
              </div>
            </div>

            {/* هشدارهای تسویه */}
            {customerDebt > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 flex items-start gap-2.5" role="alert">
                <TriangleAlert className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs leading-6">
                  <p className="font-bold text-destructive">بدهی مشتری به فروشگاه</p>
                  <p className="num text-destructive/90">
                    {formatMoney(customerDebt)} ریال ({formatMoney(Math.floor(customerDebt / 10))} تومان)
                  </p>
                  <p className="text-muted-foreground mt-1">
                    ارزش کالای جایگزین از جمع مرجوعی بیشتر است — مبلغ قابل انتقال باید صفر باشد و توضیح بدهی الزامی است.
                  </p>
                </div>
              </div>
            )}
            {customerCredit > 0 && (
              <div className="rounded-xl border border-chart-4/40 bg-chart-4/10 p-3.5 flex items-start gap-2.5" role="alert">
                <Info className="size-4 text-chart-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-6">
                  <p className="font-bold text-chart-4">کسری — اعتبار باقی‌مانده مشتری</p>
                  <p className="num text-chart-4/90">
                    {formatMoney(customerCredit)} ریال ({formatMoney(Math.floor(customerCredit / 10))} تومان)
                  </p>
                  <p className="text-muted-foreground mt-1">
                    این مبلغ یا به‌صورت اعتبار نزد فروشگاه می‌ماند یا با توافق تسویه می‌شود — دلیل آن را در توضیح تسویه بنویسید.
                  </p>
                </div>
              </div>
            )}
            {settlementType === "exchange" && customerDebt === 0 && (
              <div className="rounded-xl border border-chart-3/40 bg-chart-3/10 p-3.5 flex items-start gap-2.5">
                <Repeat2 className="size-4 text-chart-3 shrink-0 mt-0.5" />
                <p className="text-xs leading-6">
                  <span className="font-bold text-chart-3">تسویه با تبادل کالا</span>{" "}
                  {transferAmount > 0
                    ? "— کالای جایگزین + انتقال باقیمانده وجه"
                    : "— بدون انتقال وجه؛ تسویه کامل با کالای جایگزین"}
                </p>
              </div>
            )}

            {/* دلیل اختلاف — الزامی در حالت کسری/بدهی */}
            {noteRequired && (
              <div className="space-y-2">
                <Label htmlFor="tnote" className="flex items-center gap-1.5 text-destructive">
                  <TriangleAlert className="size-3.5" />
                  دلیل اختلاف مبلغ انتقالی (الزامی)
                </Label>
                <Textarea
                  id="tnote"
                  placeholder={
                    customerDebt > 0
                      ? "مثال: مشتری کالای جایگزین به ارزش بیشتری برداشت و توافق شد بدهی را بعداً بپردازد…"
                      : "مثال: مابه‌التفاوت با کالای جایگزین، اعتبار نزد فروشگاه، کسری بسته‌بندی و…"
                  }
                  rows={3}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  maxLength={500}
                  className={transferNote.trim().length > 0 ? "" : "border-destructive/40"}
                />
                <p className="text-[11px] text-muted-foreground num">
                  {toFaDigits(transferNote.length)} / {toFaDigits(500)} نویسه
                  {transferNote.trim().length < 3 && " — توضیح برای اطلاع آقای نوروزی الزامی است"}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ستون خلاصه — چسبان */}
      <aside className="lg:sticky lg:top-24 space-y-4" aria-label="خلاصه و ثبت">
        <div className="rounded-2xl border border-primary/30 bg-card shadow-xl overflow-hidden">
          <div className="pattern-tile bg-primary/10 px-5 py-4 border-b border-primary/20 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-bold text-sm">خلاصه مرجوعی</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* فیلدهای خودکار */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground text-xs">صندوقدار ثبت‌کننده (خودکار)</span>
                <span className="font-bold">{user.fullName}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground text-xs">زمان ثبت (خودکار)</span>
                <span className="font-bold text-xs">لحظه ثبت در سرور</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground text-xs">مقدار کل اقلام</span>
                <span className="font-bold num">{formatQuantity(totalCount)}</span>
              </div>
            </div>

            <IlluminatedDivider />

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                {transferAmount !== total ? "جمع کل اقلام مرجوعی" : "جمع کل وجه قابل بازگشت"}
              </p>
              <MoneyDisplay amount={total} size="lg" />
              {transferAmount !== total && (
                <div className="mt-3 pt-3 border-t border-primary/20 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">مبلغ قابل انتقال</span>
                    <Badge
                      variant={settlementType === "debt" ? "destructive" : "secondary"}
                      className="text-[10px] gap-1"
                    >
                      <ArrowLeftRight className="size-3" />
                      {SETTLEMENT_META[settlementType].label}
                    </Badge>
                  </div>
                  <MoneyDisplay amount={Math.max(0, transferAmount)} showWords={false} />
                  {exchangeValue > 0 && (
                    <p className="text-[11px] text-muted-foreground num leading-5">
                      کالای جایگزین: {formatMoney(exchangeValue)} ریال
                    </p>
                  )}
                  {customerDebt > 0 && (
                    <p className="text-[11px] text-destructive num leading-5">
                      بدهی مشتری: {formatMoney(customerDebt)} ریال
                    </p>
                  )}
                  {customerCredit > 0 && (
                    <p className="text-[11px] text-chart-4 num leading-5">
                      اعتبار باقی‌مانده: {formatMoney(customerCredit)} ریال
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base font-extrabold"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  در حال ارسال…
                </>
              ) : (
                <>
                  <Send className="size-5" />
                  ثبت و ارسال به مدیریت
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground leading-5">
              میان‌بر ثبت سریع: <kbd className="rounded border bg-muted px-1.5 py-0.5 num">Ctrl</kbd> +{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 num">Enter</kbd>
              <br />
              پس از ثبت، مرجوعی‌های وجه‌دار به آقای نوروزی پیامک می‌شوند و مرجوعی‌های تبادلی به تأیید مدیر کل (خانم لطفی) می‌رسند
            </p>

            {/* نشانگر ذخیرهٔ خودکار پیش‌نویس */}
            <AnimatePresence>
              {draftSavedAt && !success && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2"
                  role="status"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    <Save className="size-3.5" />
                    ذخیرهٔ خودکار پیش‌نویس
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="num text-[10px] text-muted-foreground">{formatJalaliDateTime(draftSavedAt)}</span>
                    <button
                      type="button"
                      onClick={discardDraft}
                      aria-label="دورریختن پیش‌نویس"
                      title="دورریختن پیش‌نویس"
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {todayCount > 0 && (
          <div className="rounded-2xl border bg-muted/40 px-5 py-4 flex items-center gap-3 text-sm">
            <ClipboardList className="size-5 text-primary shrink-0" />
            <span className="num">
              امروز {toFaDigits(todayCount)} مرجوعی از این دستگاه ثبت شده است
            </span>
          </div>
        )}
      </aside>

      {/* گفت‌وگوی سابقه کامل مشتری (از راهنمای شناسایی) */}
      <CustomerHistoryDialog
        open={customerHistoryOpen}
        onOpenChange={setCustomerHistoryOpen}
        phone={customerPhone}
      />

      {/* اسکنر بارکد با دوربین */}
      <CameraScannerDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={handleCameraDetect}
      />
    </form>
  );
}
