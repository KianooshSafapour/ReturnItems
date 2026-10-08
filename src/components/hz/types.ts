// انواع مشترک داده‌های سمت کلاینت
export type Role = "admin" | "gm" | "owner" | "cashier";

export const ROLE_LABELS: Record<string, string> = {
  admin: "مدیر ارشد سامانه",
  gm: "مدیر کل",
  owner: "مدیر فروشگاه",
  cashier: "صندوقدار",
};

/** نقش‌های مدیریتی — دسترسی به داشبورد/آرشیو/بانک کالا… */
export const MANAGER_ROLES: Role[] = ["admin", "gm", "owner"];

/** نقش‌هایی که می‌توانند مرجوعی بدون انتقال وجه را تأیید و بایگانی کنند (مدیر کل و بالاتر) */
export const APPROVER_ROLES: Role[] = ["admin", "gm", "owner"];

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  /** شماره تماس — اختیاری (فقط از مسیر /api/auth/profile پر می‌شود) */
  phone?: string | null;
  /** آواتار کاربر — JSON {type, color?, emoji?, photo?} (اختیاری) */
  avatar?: string | null;
  /** مجوزهای عملیاتی (مستقل از نقش) */
  canActAsCashier?: boolean;
  canApproveReturns?: boolean;
  canRecordPayment?: boolean;
}

/** آیا کاربر می‌تواند مثل صندوقدار مرجوعی ثبت کند؟ */
export function canSubmitReturns(user: SessionUser): boolean {
  return user.role === "cashier" || user.canActAsCashier === true;
}

/** آیا کاربر می‌تواند مرجوعی را تأیید کند؟ */
export function canApproveReturns(user: SessionUser): boolean {
  return user.canApproveReturns === true;
}

/** آیا کاربر می‌تواند پرداخت/انتقال وجه ثبت کند؟ (آقای نوروزی + منتخب‌های صریح) */
export function canRecordPayment(user: SessionUser): boolean {
  return user.canRecordPayment === true;
}

/** حرف نخست نام‌خانوادگی — آواتار (آخرین واژه نام کامل) */
export function lastNameInitial(fullName: string): string {
  const words = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const last = words.length > 0 ? words[words.length - 1] : "";
  const ch = [...last][0] ?? [...String(fullName ?? "").trim()][0] ?? "؟";
  return ch;
}

export function isManagerRole(role: string): boolean {
  return role === "owner" || role === "admin" || role === "gm";
}

/** نقش‌های مجاز به تأیید مرجوعی بدون پرداخت (مدیر کل/مدیر ارشد/مالک) */
export function isApproverRole(role: string): boolean {
  return role === "gm" || role === "admin" || role === "owner";
}

/** برچسب وضعیت مرجوعی — pending | approved | paid
 *  نمایش «approved» دو حالت دارد: وجه‌دار → در انتظار پرداخت آقای نوروزی؛ تبادلی → بایگانی نهایی */
export const STATUS_META: Record<
  string,
  { label: string; short: string; className: string }
> = {
  pending: {
    label: "در انتظار تأیید مدیر کل",
    short: "در انتظار تأیید",
    className: "bg-chart-2/15 text-chart-2 border-chart-2/30 hover:bg-chart-2/20",
  },
  approved: {
    label: "تأیید شد",
    short: "تأیید شد",
    className: "bg-chart-5/20 text-chart-3 border-chart-5/40 hover:bg-chart-5/30",
  },
  paid: {
    label: "پرداخت و بایگانی شد",
    short: "پرداخت شد",
    className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20",
  },
};

/** نمایش وضعیت با تفکیک نوع مرجوعی — approved وجه‌دار = در انتظار انتقال وجه */
export function statusMetaFor(
  status: string,
  transferAmount: number
): { label: string; short: string; className: string } {
  if (status === "approved" && transferAmount > 0) {
    return {
      label: "تأیید شد — در انتظار انتقال وجه به کارت مشتری",
      short: "در انتظار پرداخت",
      className: "bg-chart-4/15 text-chart-4 border-chart-4/40 hover:bg-chart-4/25",
    };
  }
  if (status === "approved") {
    return {
      label: "تأیید و بایگانی شد (مرجوعی تبادلی — بدون پرداخت)",
      short: "تأیید و بایگانی",
      className: STATUS_META.approved.className,
    };
  }
  return STATUS_META[status] ?? { label: status, short: status, className: "" };
}

/** نوع تسویه مرجوعی با مشتری */
export type SettlementType = "full" | "exchange" | "partial" | "debt";

export const SETTLEMENT_META: Record<
  SettlementType,
  { label: string; hint: string }
> = {
  full: { label: "انتقال کامل وجه", hint: "کل مبلغ اقلام به حساب مشتری منتقل می‌شود" },
  exchange: { label: "تبادل با کالا", hint: "مشتری به‌جای وجه، کالای جایگزین برده است" },
  partial: { label: "انتقال با کسری", hint: "مبلغ انتقالی کمتر از ارزش اقلام است — دلیل الزامی است" },
  debt: { label: "بدهی مشتری", hint: "ارزش کالای جایگزین از جمع مرجوعی بیشتر است — مشتری بدهکار است" },
};

export function deriveSettlementType(
  total: number,
  exchangeValue: number,
  transferAmount: number
): SettlementType {
  if (exchangeValue > total) return "debt";
  if (exchangeValue > 0 && transferAmount + exchangeValue === total) return "exchange";
  if (transferAmount + exchangeValue < total) return "partial";
  return "full";
}

export interface ProductDTO {
  id: string;
  code: string | null;
  barcode: string | null;
  name: string;
  unit: string;
  price: number;
  stock: number | null;
  category: string | null;
  /** بارکدهای جایگزین (هلو: کالایی که چند «كد كالا» دارد) */
  extraBarcodes?: string[];
}

export interface ReturnItemDraft {
  key: string;
  productId: string | null;
  name: string;
  barcode: string | null;
  code: string | null;
  quantity: number;
  unitPrice: number;
  fromDb: boolean;
  /** بارکد از بانک کالا آمده یا تولید داخلی/دستی است */
  barcodeLocked?: boolean;
}

export interface ReturnListRow {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  exchangeValue: number;
  transferAmount: number;
  settlementType: SettlementType;
  status: "pending" | "approved" | "paid";
  cashierName: string;
  submittedAt: string;
  itemCount: number;
  payment: {
    bankName: string;
    transferredAt: string;
    referenceNumber: string | null;
  } | null;
}

export interface ReturnDetailDTO {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  customerCardNumber: string;
  /** آیا پیامک‌های خودکار این مشتری روشن است (لایه دوم) */
  customerSmsEnabled?: boolean;
  purchaseAt: string;
  reason: string;
  note: string | null;
  totalAmount: number;
  exchangeValue: number;
  transferAmount: number;
  transferNote: string | null;
  settlementType: SettlementType;
  status: "pending" | "approved" | "paid";
  submittedAt: string;
  cashier: { id: string; fullName: string; username: string };
  /** تأییدکننده مرجوعی بدون پرداخت (مدیر کل) */
  approvedBy: { fullName: string; username: string } | null;
  approvedAt: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    barcode: string | null;
    code: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payment: {
    bankName: string;
    accountNumber: string | null;
    cardNumber: string | null;
    referenceNumber: string | null;
    transferredAt: string;
    amount: number;
    recordedBy: { fullName: string; username: string };
  } | null;
  smsLogs: Array<{
    id: string;
    phone: string;
    message: string;
    status: string;
    provider: string | null;
    templateTitle: string | null;
    createdAt: string;
  }>;
}

export interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  phone: string | null;
  avatar?: string | null;
  isActive: boolean;
  createdAt: string;
  canActAsCashier?: boolean;
  canApproveReturns?: boolean;
  canRecordPayment?: boolean;
  returnCount: number;
  paymentCount: number;
}

export interface StatsDTO {
  /** در انتظار تأیید مدیر کل (همه انواع — pending) */
  pendingCount: number;
  pendingTotalAmount: number;
  /** تأییدشده + وجه‌دار — در انتظار انتقال وجه (اقدام آقای نوروزی) */
  awaitingPaymentCount: number;
  awaitingPaymentTotalAmount: number;
  /** تأییدشده تبادلی — بایگانی نهایی */
  approvedArchivedCount: number;
  approvedArchivedTotalAmount: number;
  paidCount: number;
  paidTotalAmount: number;
  paidCountMonth: number;
  paidTotalAmountMonth: number;
  totalCount: number;
  cashiers: Array<{
    id: string;
    fullName: string;
    isActive: boolean;
    returnCount: number;
    totalAmount: number;
    lastActivityAt: string | null;
  }>;
  topProducts: Array<{ name: string; quantity: number; amount: number }>;
  recentReturns: Array<{
    id: string;
    code: string;
    customerName: string;
    totalAmount: number;
    status: string;
    submittedAt: string;
    cashierName: string;
  }>;
  series: Array<{ date: string; count: number; amount: number }>;
  /** هشدار موجودی بانک کالا — کالاهای رو به اتمام (بر اساس بروزرسانی هلو) */
  lowStock: {
    products: Array<{ id: string; name: string; stock: number; unit: string; code: string | null }>;
    total: number;
    outOfStock: number;
    bankUpdatedAt: string | null;
  };
}

export interface NotificationDTO {
  /** در انتظار تأیید مدیر کل — همه مرجوعی‌های pending */
  pendingCount: number;
  pendingTotalAmount: number;
  /** در انتظار انتقال وجه به کارت مشتری (اقدام آقای نوروزی — تأییدشده وجه‌دار) */
  awaitingPaymentCount: number;
  /** در انتظار تأیید مدیر کل */
  awaitingApprovalCount: number;
  canApproveReturns?: boolean;
  canRecordPayment?: boolean;
  serverTime: string;
  latest: Array<{
    id: string;
    code: string;
    customerName: string;
    totalAmount: number;
    transferAmount: number;
    submittedAt: string;
    cashierName: string;
  }>;
}

export interface ActivityRow {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { fullName: string; username: string; role: string } | null;
}

// ---- دفترچه مشتریان (تجمیع مرجوعی‌ها بر اساس شماره موبایل) ----

/** ردیف دفترچه مشتریان — نمای مدیریتی */
export interface CustomerRow {
  phone: string;
  /** آخرین نام ثبت‌شده برای این شماره */
  name: string;
  /** پیامک‌های خودکار این مشتری روشن است؟ (لایه دوم — قابل تغییر) */
  smsEnabled?: boolean;
  returnCount: number;
  pendingCount: number;
  /** جمع ارزش اقلام همه مرجوعی‌ها */
  itemsTotal: number;
  /** جمع ارزش کالای جایگزین برداشته‌شده */
  exchangedTotal: number;
  /** جمع وجه منتقل‌شده به مشتری */
  transferredTotal: number;
  /** اعتبار نزد فروشگاه (کسری توضیح‌دار: اقلام − جایگزین − انتقال) */
  creditTotal: number;
  /** بدهی مشتری به فروشگاه (حالت بدهی: جایگزین − اقلام) */
  debtTotal: number;
  firstAt: string;
  lastAt: string;
}

/** خلاصه سابقه مشتری برای پیش‌نمایش سریع (فرم ثبت مرجوعی) */
export interface CustomerLookupDTO {
  found: boolean;
  phone: string;
  name: string | null;
  returnCount: number;
  pendingCount: number;
  itemsTotal: number;
  creditTotal: number;
  debtTotal: number;
  lastAt: string | null;
}

/** سابقه کامل یک مشتری — ردیف مرجوعی */
export interface CustomerReturnRow {
  id: string;
  code: string;
  status: "pending" | "approved" | "paid";
  settlementType: SettlementType;
  totalAmount: number;
  exchangeValue: number;
  transferAmount: number;
  itemCount: number;
  submittedAt: string;
  cashierName: string;
}

export interface CustomerDetailDTO extends CustomerLookupDTO {
  name: string;
  exchangedTotal: number;
  transferredTotal: number;
  firstAt: string | null;
  returns: CustomerReturnRow[];
}

// ---- تنظیمات سامانه (مدیریت توسط مدیر ارشد/مالک) ----
export interface StoreSettings {
  storeName: string;
  storeCity: string;
  storePhone: string;
  managerName: string;
  receiptFooter: string;
  developerCredit: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "هایپر زیتون",
  storeCity: "رفسنجان، کرمان",
  storePhone: "",
  managerName: "آقای نوروزی",
  receiptFooter: "از خرید شما سپاسگزاریم — کالای مرجوعی تا ۷ روز پذیرفته می‌شود",
  developerCredit: "کیانوش صفاپور (Kianoosh Safapour)",
};

export interface AdminOverviewDTO {
  users: { total: number; active: number; cashiers: number; managers: number };
  products: { total: number; active: number; withBarcode: number; categories: number };
  returns: { total: number; pending: number; paid: number };
  payments: { count: number; totalAmount: number };
  settlement: {
    full: number;
    exchange: number;
    partial: number;
    debt: number;
    debtTotal: number;
    customerCreditTotal: number;
  };
  activityToday: number;
  dbSizeBytes: number;
  serverTime: string;
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  invalid: number;
  headerRow: number;
  mapping: Record<string, string | null>;
  sheetName: string;
  errors: string[];
  notes?: string[]; // یادداشت‌های نگاشت هوشمند (مثل استنباط بارکد از کد کالا)
  priceUnit: string;
}

/** DTO ویرایش/ایجاد کالا (مدیریت بانک کالا) */
export interface ProductEditDTO {
  id?: string;
  code: string | null;
  barcode: string | null;
  name: string;
  unit: string;
  price: number;
  stock: number | null;
  category: string | null;
  isActive: boolean;
}

// ---- پیامک اطلاع‌رسانی به مشتری ----

/** قالب/نوع پیامک — قابل تعریف توسط مدیران */
export interface SmsTemplateDTO {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  sortOrder: number;
}

/** وضعیت اتصال پنل پیامک (مقادیر محرمانه ماسک‌شده) */
export interface SmsConfigDTO {
  enabled: boolean;
  provider: string;
  sender: string;
  username: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  hasPassword: boolean;
  passwordMasked: string;
  customUrl: string;
  customMethod: string;
  customHeaders: string;
  customBody: string;
  ready: boolean;
  missing: string[];
  /** هشدار پیامکی مرجوعی به مدیران */
  alert?: {
    enabled: boolean;
    userIds: string[];
    template: string;
  };
  /** پیامک‌های خودکار — لایه ۱ (کلید سراسری هر نوع) */
  auto?: {
    customerSubmitEnabled: boolean;
    customerSubmitTemplate: string;
    paymentEnabled: boolean;
    ownerNotifyEnabled: boolean;
    ownerNotifyTemplate: string;
    includeItems: boolean;
    defaults?: {
      customerSubmitTemplate: string;
      ownerNotifyTemplate: string;
    };
  };
  providers?: Array<{
    id: string;
    label: string;
    needs: string[];
    hint: string;
    docs: string | null;
  }>;
}

/** ردیف تاریخچه ارسال پیامک */
export interface SmsLogRow {
  id: string;
  phone: string;
  message: string;
  amount: number | null;
  status: string;
  provider: string | null;
  error: string | null;
  templateTitle: string | null;
  requestCode: string | null;
  customerName: string | null;
  createdAt: string;
}
