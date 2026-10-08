# Task 5-a — frontend-permissions-ui

## Scope (ONLY these 3 files — all others untouched)
1. `src/components/hz/users-view.tsx`
2. `src/components/hz/customers-view.tsx`
3. `src/components/hz/notification-bell.tsx`

## What was implemented

### users-view.tsx
- `Perms` interface + `ROLE_PERM_DEFAULTS` (cashier {act,–,–} / gm {–,approve,–} / owner {–,approve,pay} / admin {act,approve,pay}) — mirrors server `defaultPermissionsForRole`.
- `PERM_META` per permission: full label, short badge label, Persian hint, Lucide icon (ScanLine / ShieldCheck / Wallet).
- **Row badges**: under the role badge in the «نقش» column — compact muted `Badge` (secondary, text-[10px]) only when the flag is true, with `title` hint.
- **Edit dialog**: «مجوزهای عملیاتی» section with 3 `Switch` rows (min-h-11, clickable Label = ≥44px touch target). Every toggle fires an immediate `PATCH /api/users/{id}` with ALL THREE booleans from the draft state. Success → sonner toast + `onSaved()` (refresh list, dialog stays open) + savedPerms updated. Error → `toast.error(data.error)` + switch reverts to savedPerms. All switches disabled while saving. Note in UI: role change + save resets perms to new-role defaults (server logic).
- **Create dialog**: 3 `Checkbox` rows with the same labels/hints; role defaults recompute on role Select change unless `permTouched` (any manual checkbox change); badge «پیش‌فرض نقش / تنظیم دستی»; POST body includes the three booleans.
- All existing behavior intact (role change, activate/deactivate, password reset, avatar, sorting).

### customers-view.tsx
- Explanatory `Alert` banner (MessageSquareText icon, primary-tinted) under the header: «لایه دوگانه پیامک: هر نوع پیامک در مرکز پیامک دارای کلید سراسری است و هر مشتری را می‌توانید اینجا جداگانه خاموش/روشن کنید.»
- New «پیامک» table column (before «آخرین مراجعه», colSpan 6→7) with a small `Switch` per row inside a `size-11` cell with `stopPropagation` (row click opens history dialog — switch clicks don't).
- Toggle → `PATCH /api/customers/{phone}` `{ smsEnabled }`; per-row saving state (that row disabled + single-flight guard); success toast «پیامک‌های مشتری «نام» روشن/خاموش شد» + local `setData` row update; error toast with server message. Default true when field absent (`c.smsEnabled !== false`).
- Pagination / sorting / search / summary cards untouched.

### notification-bell.tsx
- Permission resolution: from `user` prop via helpers `canApproveReturns(user)` / `canRecordPayment(user)` (from `./types`); falls back to API flags `data.canApproveReturns` / `data.canRecordPayment` when the prop fields are undefined.
- `myTotal = (approveAllowed ? awaitingApprovalCount : 0) + (payAllowed ? awaitingPaymentCount : 0)` — drives bell badge, pulse animation, aria-label and the header «X مورد» badge.
- Header sections permission-gated: «در انتظار انتقال وجه (X): مبلغ…» only for payers; «در انتظار تأیید مدیر کل (X)» only for approvers; empty text «در حال حاضر اقدامی در انتظار شما نیست».
- Latest items now render a status chip via `statusMetaFor(r.status ?? "pending", r.transferAmount)` (badge with meta.className + title=meta.label) plus «ثبت‌شده توسط …»; empty state when `latest.length === 0`; list shown otherwise (informational, regardless of permission).
- Local `LatestItem = NotificationDTO["latest"][number] & { status?: string; settlementType?: string }` — compiles whether or not types.ts later declares the fields (defensive against the parallel types.ts edit).
- `onOpenPending` behavior, polling (30s + focus), styling and animation preserved. Unused `Hourglass` import removed.

## Verification
- `bun run lint`: my three files CLEAN (only remaining project error is `owner-dashboard.tsx` `MoneyDisplay` undefined — another agent's file, mid-edit).
- `tsc --noEmit`: zero errors in my three files.
- `GET /` → 200, dev.log shows successful compiles after edits.
- API contracts verified by reading routes + live curl (login kianoosh): `/api/notifications` latest items DO include `status` + `settlementType`.

## ⚠️ Critical handoff notes for main agent (NOT fixed by me — outside my file scope)
1. **Stale Prisma client in the running dev server** (started 05:34; client regenerated on disk 06:45): `db.customer` is undefined → `GET /api/customers` 500, `GET /api/returns/[id]` 500, `PATCH /api/users/{id}` with permission booleans 500 (unknown field). User SELECTs lack the permission columns so GET /api/users omits them. **A dev server restart is required** (same as Tasks 4/5 previously). I was instructed not to restart it.
2. **seed.ts does not grant role permissions to the 4 main accounts** (all default false). Recommended after restart: kianoosh {act,approve,pay}, lotfi {act,approve}, norouzi {approve,pay}, mohammadi {act} — or apply via the new Users-view switches in the UI.
3. types.ts `NotificationDTO.latest` does not yet declare `status`/`settlementType` (server already sends them); my notification-bell uses a local intersection type so it compiles either way — adding the fields to types.ts is safe.
