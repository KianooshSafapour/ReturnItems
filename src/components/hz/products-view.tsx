"use client";

// بانک کالا + ورود از اکسل (هلو APEX) — نمای مدیریت محصولات
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, PackageSearch, Boxes, Upload,
  FileSpreadsheet, Download, FileUp, Loader2, CheckCircle2, AlertTriangle, X,
  Info, Database, PlusCircle, ArrowLeftRight, ScanLine, Sparkles, Barcode as BarcodeIcon, ListOrdered,
} from "lucide-react";
import { formatMoney, formatToman, toFaDigits } from "@/lib/money";
import type { ImportReport, ProductDTO, SessionUser } from "./types";

const PAGE_SIZE = 20;
const MAX_FILE_SIZE = 16 * 1024 * 1024; // ۱۶ مگابایت (مطابق سرور)

/** نمای اصلی مدیریت کالا — سه زبانه: بانک کالا، ورود از اکسل هلو و کدهای چندگانه */
export function ProductsView({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState("bank");

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <TabsList className="h-11 w-full sm:w-fit p-1 flex-wrap">
        <TabsTrigger value="bank" className="h-9 px-4 text-sm gap-1.5">
          <Boxes className="size-4" />
          بانک کالا
        </TabsTrigger>
        <TabsTrigger value="import" className="h-9 px-4 text-sm gap-1.5">
          <FileSpreadsheet className="size-4" />
          ورود از اکسل (هلو)
        </TabsTrigger>
        <TabsTrigger value="aliases" className="h-9 px-4 text-sm gap-1.5">
          <BarcodeIcon className="size-4" />
          کدهای چندگانه
        </TabsTrigger>
      </TabsList>

      <TabsContent value="bank">
        <ProductBankTab />
      </TabsContent>
      <TabsContent value="import">
        <HolooImportPanel user={user} onSwitchToBank={() => setTab("bank")} />
      </TabsContent>
      <TabsContent value="aliases">
        <BarcodeAliasesPanel user={user} onSwitchToBank={() => setTab("bank")} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------- زبانه ۱: بانک کالا ----------------

function ProductBankTab() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: "list",
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (q.trim()) params.set("q", q.trim());
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.products ?? []);
        setTotal(data.total ?? 0);
        setCategories(data.categories ?? []);
      } else {
        toast.error(data.error || "خطا در دریافت بانک کالا");
      }
    } catch {
      toast.error("خطا در دریافت بانک کالا");
    } finally {
      setLoading(false);
    }
  }, [q, category, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // اگر پس از فیلتر شماره صفحه از مجموع بیشتر شد، به آخرین صفحه برمی‌گردیم
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* فیلترها */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="جستجو در نام کالا، بارکد یا کد کالا…"
            className="ps-10 h-11"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-full sm:w-48">
            <SelectValue placeholder="همه دسته‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11 gap-1.5" onClick={() => load()} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          به‌روزرسانی
        </Button>
      </div>

      {/* جدول بانک کالا */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm min-w-[820px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
                <TableRow className="text-muted-foreground text-xs hover:bg-transparent">
                  <TableHead className="text-start font-semibold px-3 py-3 w-14">#</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">نام کالا</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">بارکد</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">کد کالا</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">دسته</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">قیمت فروش (ریال)</TableHead>
                  <TableHead className="text-start font-semibold px-4 py-3">موجودی</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-14">
                      <div className="text-center text-muted-foreground">
                        <PackageSearch className="size-12 mx-auto mb-3 opacity-40" />
                        <p className="font-semibold text-sm">کالایی یافت نشد</p>
                        <p className="text-xs mt-1 opacity-80">
                          بانک کالا خالی است یا نتیجه‌ای برای جستجوی شما ندارد؛ از زبانه «ورود از اکسل» استفاده کنید.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.25) }}
                      className="border-b last:border-0 hover:bg-accent/40 transition-colors"
                    >
                      <TableCell className="px-3 py-3 num text-xs text-muted-foreground">
                        {toFaDigits((page - 1) * PAGE_SIZE + i + 1)}
                      </TableCell>
                      <TableCell className="px-4 py-3 max-w-[280px]">
                        <p className="font-semibold truncate" title={p.name}>
                          {p.name}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.barcode ? (
                          <span className="num text-xs text-muted-foreground" dir="ltr">
                            {toFaDigits(p.barcode)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.code ? (
                          <span className="num text-xs" dir="ltr">
                            {toFaDigits(p.code)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.category ? (
                          <Badge variant="secondary" className="font-medium">
                            {p.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`num font-bold cursor-default border-b border-dotted border-primary/40 ${
                                  p.price > 0 ? "" : "text-muted-foreground"
                                }`}
                              >
                                {formatMoney(p.price)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="num text-xs">
                              معادل تومانی: {formatToman(p.price)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="px-4 py-3 num whitespace-nowrap">
                        {p.stock !== null ? (
                          <span
                            className={
                              p.stock > 0
                                ? "font-semibold"
                                : "text-destructive font-semibold"
                            }
                          >
                            {toFaDigits(p.stock)}{" "}
                            <span className="text-xs text-muted-foreground font-normal">{p.unit}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">نامشخص</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </table>
          </div>
        </div>

        {/* شمارش و صفحه‌بندی (راست‌به‌چپ: «قبلی» سمت راست) */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t bg-muted/30">
            <p className="num text-xs text-muted-foreground">
              نمایش {toFaDigits(from)} تا {toFaDigits(to)} از {toFaDigits(total)} کالا
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="صفحه قبل"
                >
                  <ChevronRight className="size-4" />
                  قبلی
                </Button>
                <span className="num text-sm font-bold px-2">
                  {toFaDigits(page)} / {toFaDigits(pages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="صفحه بعد"
                >
                  بعدی
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- زبانه ۲: ورود از اکسل (هلو APEX) ----------------

const HOLOO_COLUMNS: Array<{ label: string; hint: string }> = [
  { label: "رديف", hint: "شماره ردیف — محاسبه‌ای و نادیده گرفته می‌شود" },
  { label: "كد كالا", hint: "در هلو همین ستون، بارکد هم هست — کد = بارکد" },
  { label: "نام كالا", hint: "شرح کالا" },
  { label: "مقدار", hint: "موجودی انبار" },
  { label: "مقدار دوم", hint: "محاسبه‌ای — نادیده گرفته می‌شود" },
  { label: "نام واحد", hint: "واحد شمارش کالا" },
  { label: "قيمت خريد", hint: "جایگزین وقتی قیمت فروش خالی است" },
  { label: "قيمت فروش", hint: "قیمت مصرف‌کننده (ریال)" },
  { label: "تعدا*في خريد", hint: "ارزش کل = مقدار × فی خرید — محاسبه‌ای و نادیده گرفته می‌شود" },
];

function HolooImportPanel({
  user,
  onSwitchToBank,
}: {
  user: SessionUser;
  onSwitchToBank: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [priceUnit, setPriceUnit] = useState<"rial" | "toman">("rial");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const pickFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (!/\.(xlsx|xls|xlsm|csv)$/.test(name)) {
      toast.error("فقط فایل‌های اکسل (xls / xlsx / csv) پذیرفته می‌شوند");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("حجم فایل نباید بیشتر از ۱۶ مگابایت باشد");
      return;
    }
    setFile(f);
    setReport(null);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("priceUnit", priceUnit);
      const res = await fetch("/api/products/import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setReport(data as ImportReport);
        toast.success(
          `ورود بانک کالا انجام شد: ${toFaDigits(data.created ?? 0)} کالای جدید و ${toFaDigits(
            data.updated ?? 0
          )} به‌روزرسانی`
        );
      } else {
        toast.error(data.error || "خطا در پردازش فایل اکسل");
      }
    } catch {
      toast.error("خطا در ارسال فایل به سرور");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* معرفی سازگاری با هلو APEX */}
      <Card className="pattern-girih border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-5 text-primary" />
            ورود بانک کالا از فایل اکسل
          </CardTitle>
          <CardDescription className="leading-6">
            قالب پیش‌فرض و استاندارد این سامانه، همان خروجی رسمی نرم‌افزار حسابداری هلو (APEX —
            سیستم‌گروپ) با ۹ ستون است: رديف، كد كالا، نام كالا، مقدار، مقدار دوم، نام واحد، قيمت
            خريد، قيمت فروش و تعدا*في خريد. فایل‌های xls و xlsx هر دو پذیرفته می‌شوند؛ نویسه‌های
            عربی/فارسی (ك و ي) یکسان در نظر گرفته می‌شوند و سطر جمع انتهایی خودکار رد می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {HOLOO_COLUMNS.map((c) => (
              <Badge
                key={c.label}
                variant="outline"
                className="bg-card/80 gap-1.5 py-1.5 px-3"
                title={`نام‌های پذیرفته: ${c.hint}`}
              >
                {c.label}
                <span className="text-[10px] text-muted-foreground font-normal">({c.hint})</span>
              </Badge>
            ))}
          </div>

          <ul className="text-xs text-muted-foreground space-y-1.5 leading-6">
            <li className="flex items-start gap-1.5">
              <Info className="size-3.5 mt-1 shrink-0 text-primary" />
              ستون‌های «رديف»، «مقدار دوم» و «تعدا*في خريد» (ارزش کل = مقدار × فی خرید) محاسبه‌ای هستند و
              نادیده گرفته می‌شوند؛ سطر جمع آخر فایل هم رد می‌شود.
            </li>
            <li className="flex items-start gap-1.5">
              <ScanLine className="size-3.5 mt-1 shrink-0 text-primary" />
              در هلو ستون بارکد جداگانه وجود ندارد — مقدار «كد كالا» هم به‌عنوان بارکد ثبت می‌شود
              تا اسکنر صندوق آن را بیابد (کد = بارکد).
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="size-3.5 mt-1 shrink-0 text-primary" />
              اگر «قيمت فروش» خالی باشد، از «قيمت خريد» استفاده می‌شود.
            </li>
            <li className="flex items-start gap-1.5">
              <ArrowLeftRight className="size-3.5 mt-1 shrink-0 text-primary" />
              تطبیق رکوردها برای به‌روزرسانی: ابتدا کد/بارکد و در پایان نام دقیق کالا.
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="size-3.5 mt-1 shrink-0 text-primary" />
              این بخش تنها برای مدیر سامانه ({user.fullName}) نمایش داده می‌شود.
            </li>
          </ul>

          <Button
            variant="secondary"
            className="gap-1.5"
            onClick={() => window.open("/api/products/template", "_blank")}
          >
            <Download className="size-4" />
            دانلود فایل نمونه (قالب رسمی هلو APEX — ۹ ستون)
          </Button>
        </CardContent>
      </Card>

      {/* ناحیه بارگذاری فایل */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="size-5 text-primary" />
            بارگذاری فایل اکسل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm flex-1">
              <span className="text-muted-foreground">واحد قیمت‌های فایل:</span>
              <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v === "toman" ? "toman" : "rial")}>
                <SelectTrigger className="h-10 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rial">ریال</SelectItem>
                  <SelectItem value="toman">تومان (×۱۰ تبدیل می‌شود)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="انتخاب فایل اکسل"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-accent/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <FileSpreadsheet className="size-10 text-primary" />
                <div className="text-start">
                  <p className="font-bold text-sm break-all" dir="auto">
                    {file.name}
                  </p>
                  <p className="num text-xs text-muted-foreground mt-0.5">
                    حجم: {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="حذف فایل انتخاب‌شده"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setReport(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Upload className="size-10 mx-auto mb-3 opacity-50" />
                <p className="font-semibold text-sm text-foreground">
                  فایل اکسل را اینجا رها کنید یا برای انتخاب کلیک کنید
                </p>
                <p className="text-xs mt-1.5">
                  فرمت‌های مجاز: xlsx، xls، csv — حداکثر حجم ۸ مگابایت
                </p>
              </div>
            )}
          </div>

          <Button
            className="w-full sm:w-auto gap-1.5"
            disabled={!file || uploading}
            onClick={upload}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                در حال پردازش فایل…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                شروع ورود بانک کالا
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* گزارش ورود */}
      {report && (
        <ImportReportCard
          report={report}
          onRefreshBank={() => {
            setFile(null);
            onSwitchToBank();
            toast.success("بانک کالا به‌روزرسانی شد");
          }}
        />
      )}
    </div>
  );
}

/** نمایش گزارش ورود فایل اکسل */
function ImportReportCard({
  report,
  onRefreshBank,
}: {
  report: ImportReport;
  onRefreshBank: () => void;
}) {
  const mappingRows: Array<[string, string]> = [
    ["code", "کد کالا"],
    ["name", "نام کالا"],
    ["barcode", "بارکد"],
    ["unit", "واحد کالا"],
    ["price", "قیمت فروش"],
    ["stock", "موجودی"],
    ["category", "گروه کالا"],
  ];

  const stats = [
    { label: "کل سطرهای فایل", value: report.total, cls: "text-foreground" },
    { label: "کالای جدید", value: report.created, cls: "text-primary" },
    { label: "به‌روزرسانی‌شده", value: report.updated, cls: "text-chart-2" },
    { label: "نامعتبر", value: report.invalid, cls: "text-destructive" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-primary/25 glow-pistachio">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-5 text-primary" />
            گزارش ورود فایل
          </CardTitle>
          <CardDescription>
            شیت «{report.sheetName}» — سرستون در سطر {toFaDigits(report.headerRow)} شناسایی شد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* آمار */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className={`num text-2xl font-extrabold ${s.cls}`}>{toFaDigits(s.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* یادداشت واحد قیمت */}
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-xs leading-6 text-muted-foreground">
            {report.priceUnit === "toman"
              ? "واحد قیمت فایل «تومان» بود؛ مبالغ هنگام ذخیره ×۱۰ و به ریال تبدیل شدند."
              : "واحد قیمت فایل «ریال» در نظر گرفته شد و مبالغ بدون تغییر ذخیره شدند."}
          </div>

          {/* یادداشت‌های نگاشت هوشمند */}
          {report.notes && report.notes.length > 0 && (
            <ul className="space-y-1.5">
              {report.notes.map((n, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-chart-2/30 bg-chart-2/5 px-4 py-2.5 text-xs leading-6"
                >
                  <Sparkles className="size-3.5 mt-1 shrink-0 text-chart-2" />
                  {n}
                </li>
              ))}
            </ul>
          )}

          {/* جدول نگاشت ستون‌ها */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              نگاشت ستون‌های شناسایی‌شده:
            </p>
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[360px]">
                  <TableHeader className="bg-muted/70 border-b">
                    <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                      <TableHead className="text-start font-semibold px-4 py-2.5">فیلد سامانه</TableHead>
                      <TableHead className="text-start font-semibold px-4 py-2.5">سرستون فایل شما</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingRows.map(([key, label]) => (
                      <TableRow key={key}>
                        <TableCell className="px-4 py-2.5 font-semibold">{label}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          {report.mapping?.[key] ? (
                            <span className="num" dir="auto">
                              {report.mapping[key]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">یافت نشد (اختیاری)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            </div>
          </div>

          {/* خطاها */}
          {report.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-chart-2" />
                {toFaDigits(report.errors.length)} هشدار در حین پردازش:
              </p>
              <ul className="max-h-40 overflow-y-auto rounded-xl border bg-muted/30 divide-y text-xs leading-6">
                {report.errors.map((err, i) => (
                  <li key={i} className="px-4 py-2 text-muted-foreground">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="secondary" className="gap-1.5" onClick={onRefreshBank}>
            <PlusCircle className="size-4" />
            رفرش بانک کالا
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** حجم فایل به فارسی */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${toFaDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
  }
  return `${toFaDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

// ---------------- زبانه ۳: کدهای چندگانه (بارکدهای جایگزین هلو) ----------------

/** گزارش ورود کدهای چندگانه — ساختار پاسخ API */
interface AliasImportReport {
  total: number;
  matchedProducts: number;
  aliasesAdded: number;
  alreadyPrimary: number;
  duplicates: number;
  unknown: number;
  unknownNames: string[];
  headerRow: number;
  mapping: Record<string, string | null>;
  sheetName: string;
  detectedFormat: string;
  errors: string[];
}

/** گام‌های گرفتن همهٔ بارکدها از هلو APEX — بر اساس مستندات و پرسش‌های رسمی هلو */
const HOLOO_BARCODE_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "۱. گزارش مشخصات کالا (مسیر پیشنهادی)",
    body: "در هلو: «گزارشات ← گزارش کالا ← مشخصات کالا». در فرم انتخاب شروط، گروه‌ها را خالی بگذارید (همه کالاها) ← دکمه «گزارش پیشرفته» ← مطمئن شوید ستون «کد کالا» تیک خورده ← تأیید.",
  },
  {
    title: "۲. تهیه گزارش و ذخیره اکسل",
    body: "دکمه «تهیه گزارش» (F2) را بزنید؛ در نوار ابزار پیش‌نمایش، کنار همان دکمه، «ذخیره در فایل» ← «خروجی اکسل» را انتخاب و فایل .xls را ذخیره کنید. اگر کالای چندکدی هر کدامش چند سطر شد (نام تکراری، کدهای متفاوت) — همان چیزی است که می‌خواهیم!",
  },
  {
    title: "۳. اگر فقط بارکد اول آمد (گزارش جایگزین)",
    body: "گزارش «گزارشات ← حسابداری ← گزارش کالا ← نمایش کالاها – تفکیک شده» را امتحان کنید — طبق راهنمای هلو «بارکد مجزا برای هر کالا» می‌دهد. باز هم F2 ← ذخیره در فایل ← خروجی اکسل.",
  },
  {
    title: "۴. راه صددرصد مطمئن (چند کالا محدود)",
    body: "برای کالاهای خاص: «عملیات مرتبط به کالا ← تعریف کالا ← کدهای یک کالا» — کدهای هر کالا را ببینید و در یک اکسل دوستونه (نام کالا / کد) بریزید؛ یا از دکمه «فایل نمونه» همین صفحه قالب را بگیرید.",
  },
  {
    title: "۵. بارگذاری همین‌جا",
    body: "فایل را در کادر روبه‌رو بیندازید — سامانه هر ردیف را به کالای هم‌نام (یا هم‌کد) بانک کالا وصل می‌کند و کدهای بعدی را به‌عنوان «بارکد جایگزین» ثبت می‌کند. از آن پس اسکن هر یک از آن بارکدها در فرم ثبت مرجوعی، همان کالا را پیدا می‌کند.",
  },
];

function BarcodeAliasesPanel({
  user,
  onSwitchToBank,
}: {
  user: SessionUser;
  onSwitchToBank: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<AliasImportReport | null>(null);
  const isManager = user.role !== "cashier";

  const pickFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (!/\.(xlsx|xls|xlsm|csv)$/.test(name)) {
      toast.error("فقط فایل‌های اکسل (xls / xlsx / csv) پذیرفته می‌شوند");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("حجم فایل نباید بیشتر از ۱۶ مگابایت باشد");
      return;
    }
    setFile(f);
    setReport(null);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/products/barcodes-import", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setReport(data as AliasImportReport);
        toast.success(
          `ورود کدهای چندگانه انجام شد: ${toFaDigits(data.aliasesAdded ?? 0)} بارکد جایگزین برای ${toFaDigits(
            data.matchedProducts ?? 0
          )} کالا`
        );
      } else {
        toast.error(data.error || "خطا در پردازش فایل کدها");
      }
    } catch {
      toast.error("خطا در ارسال فایل به سرور");
    } finally {
      setUploading(false);
    }
  };

  if (!isManager) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          ورود کدهای چندگانه تنها برای مدیران مجاز است.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* چرا این بخش؟ */}
      <Card className="border-chart-3/30 bg-chart-3/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarcodeIcon className="size-5 text-chart-3" />
            کدهای چندگانه (كد كالاهای بعدی هلو)
          </CardTitle>
          <CardDescription className="leading-6">
            در هلو APEX هر کالا می‌تواند چند «كد كالا / بارکد» داشته باشد (تعریف کالا ← کدهای یک
            کالا) — اما گزارش موجودی انبار فقط <b>بارکد نخست</b> را صادر می‌کند. اگر کالایی با
            بارکد دومش اسکن شود، سامانه آن را نمی‌شناسد! با بارگذاری فایل کدهای کامل (راهنمای
            روبه‌رو)، همه بارکدها به کالای درست وصل می‌شوند.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* گام‌های هلو */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="size-5 text-primary" />
            چطور همه بارکدها را از هلو خروجی بگیریم؟
          </CardTitle>
          <CardDescription>گام‌به‌گام — طبق مستندات رسمی هلو (help.holoo.co.ir)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {HOLOO_BARCODE_STEPS.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-3.5">
              <p className="font-bold text-sm mb-1 text-primary">{s.title}</p>
              <p className="text-xs leading-6 text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* بارگذاری */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="size-5 text-primary" />
            بارگذاری فایل کدها
          </CardTitle>
          <CardDescription className="leading-6">
            دو قالب پذیرفته می‌شود: (۱) قالب «کدهای یک کالا» هلو با ستون‌های «نام کالا» و «کد» —
            هر سطر یک کد؛ (۲) خروجی کامل گزارش «مشخصات کالا» — نام کالا در سطرهای تکراری و کدهای
            متفاوت. سطرهای جمع و خالی خودکار رد می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ناحیه رهاسازی */}
          <div
            role="button"
            tabIndex={0}
            aria-label="انتخاب فایل کدهای چندگانه"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
              dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-muted-foreground/25"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col items-center gap-2.5">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-chart-3/15 border border-chart-3/30">
                <BarcodeIcon className="size-7 text-chart-3" />
              </span>
              <p className="font-bold text-sm">فایل کدهای هلو را اینجا رها کنید یا کلیک کنید</p>
              <p className="text-xs text-muted-foreground leading-6">
                xls / xlsx / csv — حداکثر ۱۶ مگابایت — نام کالا + کد
              </p>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="size-5 text-chart-3 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" dir="auto">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground num">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1"
                  onClick={() => {
                    setFile(null);
                    setReport(null);
                  }}
                >
                  <X className="size-4" />
                  حذف
                </Button>
                <Button size="sm" className="h-9 gap-1.5 font-bold" onClick={upload} disabled={uploading}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  ورود کدها
                </Button>
              </div>
            </div>
          )}

          {/* نمونه */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={async () => {
                try {
                  const res = await fetch("/api/products/barcodes-import");
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    toast.error(d.error || "دانلود نمونه در دسترس نیست");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "holoo-codes-of-product-sample.xls";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("دانلود نمونه ناموفق بود");
                }
              }}
            >
              <Download className="size-4" />
              فایل نمونه «کدهای یک کالا»
            </Button>
            <Button variant="secondary" size="sm" className="h-9 gap-1.5" onClick={onSwitchToBank}>
              <Boxes className="size-4" />
              مشاهده بانک کالا
            </Button>
          </div>

          {/* گزارش ورود */}
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-chart-3/40 bg-chart-3/5 p-4 space-y-3"
            >
              <p className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="size-4 text-chart-3" />
                گزارش ورود کدهای چندگانه
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                {[
                  { label: "ردیف‌های فایل", value: report.total, tone: "muted" },
                  { label: "بارکد جایگزین افزوده", value: report.aliasesAdded, tone: "primary" },
                  { label: "کالای به‌روزشده", value: report.matchedProducts, tone: "primary" },
                  { label: "کد اصلی تکراری", value: report.alreadyPrimary, tone: "muted" },
                  { label: "تکراری/تداخلی", value: report.duplicates, tone: "warn" },
                  { label: "کالای ناشناس", value: report.unknown, tone: "warn" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-lg border px-2 py-2.5 ${
                      s.tone === "primary"
                        ? "border-primary/30 bg-primary/10"
                        : s.tone === "warn" && (s.value as number) > 0
                          ? "border-chart-4/30 bg-chart-4/10"
                          : "bg-card"
                    }`}
                  >
                    <p className="num text-lg font-extrabold">{toFaDigits(s.value)}</p>
                    <p className="text-[10px] text-muted-foreground leading-4 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-6">
                قالب شناسایی‌شده:{" "}
                {report.detectedFormat === "product-specs"
                  ? "گزارش مشخصات کالا هلو"
                  : "قالب کدهای یک کالا (نام کالا + کد)"}{" "}
                — شیت «{report.sheetName}»، سرستون در سطر {toFaDigits(report.headerRow)} (ستون‌ها:{" "}
                {report.mapping.name ?? "—"} / {report.mapping.code ?? "—"})
              </p>
              {report.unknownNames.length > 0 && (
                <div className="rounded-lg border border-chart-4/30 bg-chart-4/5 p-3 text-[11px] leading-6">
                  <p className="font-bold mb-1">نام‌هایی که در بانک کالا پیدا نشدند:</p>
                  <ul className="list-disc ps-4 space-y-0.5 text-muted-foreground">
                    {report.unknownNames.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-muted-foreground">
                    این کالاها را ابتدا از زبانه «ورود از اکسل» به بانک کالا اضافه کنید.
                  </p>
                </div>
              )}
              {report.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] leading-6 space-y-1">
                  {report.errors.slice(0, 6).map((e) => (
                    <p key={e} className="text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="size-3.5 shrink-0 mt-1" />
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
