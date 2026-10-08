// استراتژیک: احراز هویت با scrypt + توکن امضاشده HMAC (بدون وابستگی خارجی)
import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export { hashPassword, verifyPassword };

const SECRET =
  process.env.AUTH_SECRET || "hyper-zeytoon-rafsanjan-kerman-iran-secret-key-v1";
export const SESSION_COOKIE = "hz_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // ۳۰ روز

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string): string | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    if (sign(payload) !== signature) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data?.uid || typeof data.exp !== "number" || data.exp < Date.now())
      return null;
    return data.uid as string;
  } catch {
    return null;
  }
}

export type Role = "admin" | "gm" | "owner" | "cashier";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  avatar?: string | null;
  /** مجوزهای عملیاتی — مستقل از نقش، قابل تنظیم توسط مدیر ارشد/مالک */
  canActAsCashier: boolean;
  canApproveReturns: boolean;
  canRecordPayment: boolean;
}

/** مجوزهای پیش‌فرض هر نقش — هنگام ایجاد/تغییر نقش اعمال می‌شود */
export function defaultPermissionsForRole(role: Role) {
  switch (role) {
    case "admin":
      return { canActAsCashier: true, canApproveReturns: true, canRecordPayment: true };
    case "owner":
      // آقای نوروزی: تأیید + ثبت پرداخت؛ خودش صندوقداری نمی‌کند (مگر صریحاً فعال شود)
      return { canActAsCashier: false, canApproveReturns: true, canRecordPayment: true };
    case "gm":
      // مدیر کل (خانم لطفی): تأیید مرجوعی‌ها؛ فرم پرداخت پیش‌فرض مخفی
      return { canActAsCashier: false, canApproveReturns: true, canRecordPayment: false };
    default:
      return { canActAsCashier: true, canApproveReturns: false, canRecordPayment: false };
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = readSessionToken(token);
  if (!userId) return null;
  const user = await db.user.findFirst({ where: { id: userId, isActive: true } });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as Role,
    avatar: user.avatar,
    canActAsCashier: user.canActAsCashier,
    canApproveReturns: user.canApproveReturns,
    canRecordPayment: user.canRecordPayment,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("ابتدا وارد حساب خود شوید");
  return user;
}

/** نقش‌های مدیریتی: مدیر کل (خانم لطفی)، مدیر فروشگاه (owner) و مدیر ارشد سامانه (admin) */
export function isManager(user: { role: string }): boolean {
  return user.role === "owner" || user.role === "admin" || user.role === "gm";
}

/** نقش‌های مجاز به تأیید مرجوعی — مدیر کل و بالاتر */
export function isApprover(user: { role: string; canApproveReturns?: boolean }): boolean {
  return user.role === "gm" || user.role === "admin" || user.role === "owner";
}

/** آیا کاربر می‌تواند مثل صندوقدار مرجوعی ثبت کند؟ (صندوقدارها + مدیران با مجوز صریح) */
export function canSubmitReturns(user: { role: string; canActAsCashier?: boolean }): boolean {
  return user.role === "cashier" || user.canActAsCashier === true;
}

/** آیا کاربر می‌تواند مرجوعی را تأیید کند؟ (مجوز صریح ذخیره‌شده) */
export function canApprove(user: { canApproveReturns?: boolean }): boolean {
  return user.canApproveReturns === true;
}

/** آیا کاربر می‌تواند پرداخت/انتقال وجه ثبت کند؟ (آقای نوروزی + منتخب‌های صریح) */
export function canPay(user: { canRecordPayment?: boolean }): boolean {
  return user.canRecordPayment === true;
}

/** عملیات مدیریتی — مجاز برای مدیر کل، مالک فروشگاه (آقای نوروزی) و مدیر ارشد سامانه (کیانوش صفاپور) */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isManager(user))
    throw new AuthError("این عملیات تنها برای مدیران سامانه مجاز است", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
