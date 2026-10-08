# Task 6-a — full-stack-developer (user editing)

Task: User edit APIs + users-view edit dialog + profile menu (حساب من)

## What I read first (contracts)
- worklog.md, src/lib/auth.ts (hashPassword + **verifyPassword(password, stored)** already exist — used directly), api-helpers.ts (jsonOk flat / jsonError {error}), users routes, users-view.tsx, page.tsx, types.ts, validators.ts (digitsOnly + isValidIranMobile — pure, server-safe), activity-view.tsx ACTION_META, prisma seed (norouzi/Zeytoon@1404)

## Backend contracts implemented

### PATCH /api/users/[id] (rewritten, owner-only via requireOwner)
Body (all optional, only-changed applied): `fullName` (3-100 after trim), `username` (^[a-z0-9_.-]{3,30}$ + uniqueness vs other users → 400 «این نام کاربری قبلاً ثبت شده است»), `phone` ("" or null clears → null; non-empty must be valid 09xxxxxxxxx), `password` (min 6 → user_reset_password log, unchanged behavior), `isActive` (guards kept: owner self-deactivate 400, owner-role deactivate 400; logs user_activate/user_deactivate). `role` field is ignored (roles fixed). All validation happens BEFORE any write (no partial application). Profile changes → ONE `user_update` ActivityLog: `ویرایش کاربر «<fullName>»: <labels joined with ،>` (labels: نام کامل / نام کاربری / شماره تماس). Returns `jsonOk({ ok: true })`. Owner can edit own row's fullName/username/phone here.

### POST /api/auth/password (NEW, any authenticated user)
Body: `{ currentPassword, newPassword }`. verifyPassword against stored hash → 400 «گذرواژه فعلی نادرست است» if wrong; newPassword min 6 → 400 «گذرواژه جدید حداقل ۶ نویسه باشد». Success: hash update + ActivityLog `user_password_change` «تغییر گذرواژه توسط خود کاربر» → `jsonOk({ ok: true })`.

### /api/auth/profile (NEW)
- **GET**: own user incl. phone → `{ user: { id, username, fullName, role, phone } }` (used by ProfileMenu to prefill phone).
- **PATCH**: self-service, body `{ fullName?, phone? }` (same validation; ""/null clears phone). Changed fields → ActivityLog `user_update` «به‌روزرسانی شخصی: <labels>»... exact detail: «به‌روزرسانی مشخصات شخصی: <فیلدها>». Returns `{ user: { id, username, fullName, role, phone } }` — SessionUser shape + phone. Username NOT changeable here.

## Frontend
- **users-view.tsx**: operations cell = flex; owner row keeps «حساب مدیر» badge AND now gets the ops dropdown (ویرایش اطلاعات + بازنشانی گذرواژه, NO activate/deactivate); cashier rows get ویرایش اطلاعات added first. New EditUserDialog: fullName/username(ltr)/phone/گذرواژه جدید (optional, eye toggle, «برای حفظ گذرواژه فعلی خالی بگذارید»)/وضعیت Switch (disabled for owner row + note «وضعیت و نقش حساب مدیر قابل تغییر نیست»). Sends ONLY changed fields (phone "" = clear); no-change → toast.info «تغییری برای ذخیره وجود ندارد»; success → toast «کاربر به‌روزرسانی شد» + load() + onChanged?.(). Persian inline errors same style as AddCashierDialog.
- **profile-menu.tsx (NEW)**: `ProfileMenu({ user, onUserUpdated?, onLogout? })`. Avatar ghost Button (size-9 rounded-full bg-primary/15 text-primary border-primary/30) → DropdownMenu dir="rtl" (dir on Root — radix pattern) with header (initial circle + fullName + username + role badge مدیر/صندوقدار), «حساب من و امنیت» (UserCog) opens Dialog «حساب کاربری من» (max-h-[calc(100dvh-2rem)] overflow-y-auto — CONTENT WAS TALLER THAN VIEWPORT, buttons unreachable without scroll!), «خروج از حساب» (variant destructive). Dialog: section مشخصات (read-only username row with Lock + «نام کاربری قابل تغییر نیست», fullName, phone prefetched via GET /api/auth/profile with loading hint, «ذخیره مشخصات» → PATCH → toast + onUserUpdated), Separator, section تغییر گذرواژه (3 password inputs with individual eye toggles, dir ltr; validation new≥6 + repeat match; POST → toast «گذرواژه با موفقیت تغییر کرد» + clear), role badge meta. State reset happens in openAccountDialog click handler (NO effect-setState — lint-safe). DialogTitle+Description present.
- **page.tsx**: user card kept; ProfileMenu added right after it (onUserUpdated={(u)=>setUser(u)}, onLogout={handleLogout}); old standalone logout icon Button REMOVED (LogOut + Button imports cleaned).
- **types.ts**: SessionUser + optional `phone?: string | null` (backward-compatible).
- **activity-view.tsx**: added ACTION_META entries `user_update` (UserCog, primary, «ویرایش کاربر») and `user_password_change` (ShieldCheck, chart-1, «تغییر گذرواژه») — existing entries untouched.

## Verification
- ESLint: **0 problems** repo-wide; tsc --noEmit: 0 errors in my files.
- API smoke (bun fetch, 21 checks, all ✅): owner PATCH user fields, username-taken 400, invalid fullName/phone 400, owner self-deactivate 400, owner self profile via users API, GET/PATCH /api/auth/profile, wrong current password → 400 «گذرواژه فعلی نادرست است», password change + re-login, cashier self profile + 403 on /api/users/[id], empty-string phone → null clear, activity logs user_update + user_password_change present. Seed data restored afterwards (norouzi phone 09153456789, names intact).
- Browser E2E (agent-browser): header shows ProfileMenu avatar (old logout gone); dropdown → account dialog (username lock row, phone prefilled 09153456789); wrong current password → 400 + flow; correct → toast «گذرواژه با موفقیت تغییر کرد»; profile name save → toast + HEADER name refreshes via onUserUpdated; users tab: owner row has badge + dropdown (edit+reset only), cashier rows have edit+reset+activate/deactivate; owner-row edit dialog Switch disabled; zahra edit invalid phone → inline «شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود» + NO request; edit save → «کاربر به‌روزرسانی شد» + list reloads with new phone; activity tab shows new labels; logout menu item → POST /api/auth/logout 200 + login view + toast; cashier sees ProfileMenu too.
- dev.log: no compile errors.

## Gotchas for next agents
- Dialogs taller than viewport MUST get `max-h-[calc(100dvh-2rem)] overflow-y-auto` (headless viewport was 577px tall — submit button unreachable otherwise).
- /api/auth/me and /api/auth/login still return SessionUser WITHOUT phone — only GET /api/auth/profile includes it.
- PATCH /api/users/[id] now applies isActive/password only when actually changed (UI never sends no-ops).
