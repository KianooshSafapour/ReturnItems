# Research Notes — Holoo Apex Multi-Barcode (كد كالا) Export
Task ID: 1-b · Date: 2026-10-03 · Agent: general-purpose (research-only)

## Sources fetched & verified (raw HTML in this folder)
- help.holoo.co.ir (OFFICIAL Holoo help): کدهای یک کالا (01d18-0-1), گزارش کالا–مشخصات کالا (09d29-0-1), گزارش کالا–نمایش کالاها–تفکیک شده (09d27-0-1), گزارش پیشرفته (09d86-0-1), خروجی text (lock26), نمایش لیست کالاهای انبار (01d7-0-1), تعریف کالا–امکان کد و کلاس (01d1-0-212), گزارشات تجمیعی–مشخصات کالا (09d8-0-1), پیغام‌های متداول ویندوز (install12-0-1), پرینت بارکد کالاهای فاکتور (01d2-0-819)
- qa.holoo.co.ir (OFFICIAL Holoo Q&A network): Q9, Q108, Q112, Q131, Q228, Q324, Q330, Q1427, Q1629, Q1648, Q16874, Q18767?, Q19706, Q21173, Q22653, Q2541, Q25185, Q25656, Q25748
- digiholoo.ir (Seraj Sabz, Holoo reseller): تعریف چند کد برای یک کالا در نرم افزار هلو
- holoostore.com: وب‌سرویس ابری هلو APEX product page
- z-ai web_search: 11 distinct Persian/English queries (q01–q15 JSON files; several 429-retried)

## KEY FINDINGS

### 1) How Holoo stores multiple codes per product — CONFIRMED
- Primary code: the کد کالا field in معرفی کالا (product definition) = primary barcode. Barcodes ARE codes in Holoo (QA 108: "بارزترین مثال کد کالا، همان بارکد کالا است").
- Extra codes: separate feature/grid **«کدهای یک کالا»** — NOT comma-separated in one field:
  - Path: عملیات مرتبط به کالا → تعریف کالا → کدهای یک کالا
  - Window «لیست کدهای یک کالا»: pick product (گروه اصلی/فرعی), press **Insert** key to create each new row, enter code, تایید (official help 01d18-0-1; QA 9 says arrow-down also adds rows, Enter does not)
  - New versions: unlimited codes (older ~10) — QA 9, Q3247
- Feature activation: تنظیمات مدیریتی → تنظیمات نرم‌افزار → فاکتور → تیتر «گزینه های کلی» → tick «امکانات جهت استفاده از بارکدخوان», then tick «امکان/تعریف چند بارکد برای یک کالا» (help 01d18 + QA 1648/3247/9). If absent → buy possibility (هلو استور / 02123067 ext. فروش).
- Excel IMPORT of extra codes exists: اطلاعات پایه → ورود اطلاعات از اکسل → کدهای کالا (QA 5512) — Excel columns **نام کالا + کد** (one row per code), .xls 97-2003, English filename, short path; button «انتقال از فایل اکسل» inside «ورود لیستی کدهای یک کالا از فایل اکسل» form (official help 01d18-0-1).
- In invoices, new versions search by 2nd code too (QA 1629: "در ورژن‌های جدید برنامه هلو می‌توانید در فاکتور کد دوم را جستجو کنید").
- Barcode print uses بارکد ۱ by default; کیت طراحی بارکد lets printing other codes (QA 1629/330).

### 2) Report that shows ALL codes — PARTIAL (needs on-site verify)
Candidates in order:
1. **گزارشات → گزارش کالا → مشخصات کالا** — official help: "لیست کالاها با اطلاعات کامل". QA 228 best answer: "گزارشات، گزارش کالا، مشخصات کالا — توی این قسمت باید گزینه مربوط به کد کالا فعال باشه تا همه رو بیاره" (enable the کد کالا option → brings all).
2. **گزارشات → حسابداری → گزارش کالا – نمایش کالاها – تفکیک شده** — official help: "تهیه گزارش ... به همراه دریافت بارکد مجزا برای هر کالا" (separate barcode per product ⇒ likely one row per کد).
3. **گزارشات → گزارشات کالا → گزارش کالاهای کد (دار)** — QA 228 answer 2 (informal name).
- Report forms have دکمه «گزارش پیشرفته»: toggle/show columns incl. کد کالا (help 09d86-0-1).

### 3) Excel export — CONFIRMED mechanism
- «کیت/امکان خروجی متن (خروجی اکسل)»: Text/Excel/HTML from ALL ستونی reports; default on کدهای پیشرفته, purchasable otherwise (QA 2541/19706/16874, help lock26).
- In report forms: next to دکمه تهیه گزارش (F2) there is **«ذخیره در فایل»** → choose خروجی اکسل → save path (QA 1427 answer by iraninf.com).
- Excel export from «نمایش لیست کالاهای انبار» confirmed working in practice (QA 25656).

### 4) Barcode → product resolution — CONFIRMED
- In صدور فاکتور product search: type/scan any کد کالا (alias codes searchable in new versions) → product appears (QA 108, QA 1629).

### 5) DB-level access — CONFIRMED
- Holoo Apex = SQL Server (2008R2/2014). Install folder **TNCSoftware**; DB files under **NUL.DATASQL** and **Data1\DATASQL** (.mdf) (help install12-0-1).
- Attach in SQL Server Management Studio possible (officially documented for troubleshooting); products table = **dbo.ARTICLE** (QA 25748). Extra codes presumably in a sibling table (discover after attach).
- Official paid API: وب‌سرویس ابری نرم‌افزار هلو APEX (holoostore.com/product/وب-سرویس-اتصال-به-نرم-افزار-هلو) — two-way sync Holoo↔external systems.

## RECOMMENDED WORKFLOW (for Mr. Norouzi)
1. Check feature on: تنظیمات مدیریتی → تنظیمات نرم‌افزار → فاکتور → گزینه‌های کلی → both ticks.
2. گزارشات → گزارش کالا → مشخصات کالا → (شروط: همه گروه‌ها) → گزارش پیشرفته → ensure کد کالا visible → تهیه گزارش (F2) → ذخیره در فایل (Excel) → check a known multi-code product.
3. Fallback A: گزارشات → حسابداری → گزارش کالا–نمایش کالاها–تفکیک شده → same export.
4. Fallback B: عملیات مرتبط به کالا → انبارگردانی → نمایش لیست کالاهای انبار → تهیه گزارش → Excel.
5. Fallback C (manual, guaranteed): تعریف کالا → کدهای یک کالا → per product read grid → retype into Excel (نام کالا + کد) — matches documented Holoo import template = our alias-import format.
6. Fallback D (technical): backup copy of TNCSoftware\Data1\DATASQL\*.mdf → SSMS attach (read-only) → query dbo.ARTICLE + codes table → export.

## Platform import format recommendation
Accept Holoo alias sheet: columns «نام کالا» + «کد» (one row per alias; first row per product = primary barcode). Also tolerate «كد كالا» header with Arabic ك/ي. Map by product name (trimmed) or by primary barcode.
