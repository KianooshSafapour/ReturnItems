# Task 8-a — main (Z.ai Code)

**Task:** Update ONLY `src/components/hz/return-history.tsx` so returns list, detail dialog and payment form reflect the Task-7 settlement model (exchange/credit/debt) + admin role.

## Files changed
- `src/components/hz/return-history.tsx` (only file touched; page.tsx / return-form.tsx / types.ts NOT modified)

## Key UI decisions
- **List table**: header «مبلغ کل»→«مبلغ قابل انتقال»; primary = `formatMoney(r.transferAmount)` + toman line; when `transferAmount !== totalAmount` adds `جمع اقلام: X ریال` (muted `text-[10px]`) + `SettlementBadge` (debt→destructive, exchange→secondary+chart-3, partial→outline+chart-4, full→nothing). Block layout (`space-y-1 min-w-0`) → badges are `w-fit` (shadcn base) and wrap on mobile. Sticky-header pattern (overflow-x-auto OUTSIDE `max-h-[70vh] overflow-y-auto`) untouched.
- **SettlementBadge** (new component): `SETTLEMENT_META[type].label`, per-type icon (TriangleAlert/Repeat2/Info/Wallet), `title={meta.hint}` tooltip, cn-merged chart color classes.
- **Detail dialog**: tfoot «جمع کل:»→«جمع کل اقلام:»; plain full (X===T ∧ E===0) keeps original dashed money-words box; else `SettlementBreakdown` card: جمع کل اقلام مرجوعی / ارزش کالای جایگزین (Repeat2, chart-3, −) / بدهی مشتری = E−T (destructive, only E>T) / اعتبار باقی‌مانده = T−E−X (chart-4, only >0) / primary box «مبلغ قابل انتقال به حساب مشتری» + rial/toman words (only when >0) / transferNote quote box (border-r-2 accent + MessageSquareText, label «دلیل اختلاف تسویه»).
- **Payment section (paid)**: `payment.amount===0` → header badge «تسویه بدون انتقال وجه» (chart-3+Repeat2), bank row hidden, time label «زمان تسویه»; `amount>0` → NEW InfoRow «مبلغ انتقالی» as-is.
- **PaymentForm**: title «(ویژه مدیریت)»; amount box = transferAmount + breakdown lines when differs; `transferAmount===0` → noTransfer mode (chart-3 Info card + only JalaliDateTimePicker «زمان تسویه» + button «تسویه و بایگانی بدون انتقال وجه» + body `{noTransfer:true, transferredAt}`, validation only transferredAt); bank flow untouched when >0. `onPaid(code, noTransfer?)` — noTransfer toast «مرجوعی X بدون انتقال وجه تسویه و بایگانی شد ✅».
- **Role gates**: 3× `user.role === "owner"` → `isManagerRole(user.role)`.
- **Items table**: barcode cell + Barcode lucide icon (dir=ltr, Persian digits).
- No blue/indigo — primary/chart-3/chart-4/destructive/muted only; Persian digits + `num` class throughout.

## Verification
- `bunx tsc --noEmit`: 0 errors in return-history.tsx (pre-existing only: prisma/seed.ts, examples/, skills/, api/products/import/route.ts).
- `bunx eslint src/components/hz/return-history.tsx`: 0 problems.
- curl smoke (owner jar /tmp/nz.jar): list rows carry exchangeValue/transferAmount/settlementType — HZ-14050708-0004 debt (T=700000/E=4000000/X=0, payment.amount=0) + HZ-14050708-0005 partial (T=200000/E=50000/X=100000 + transferNote); all detail items have barcodes.
- `GET /` → 200; dev.log `✓ Compiled` clean, no runtime errors.

## Contract notes for later agents
- PaymentForm now: amount = `detail.transferAmount` (server decides actual payment amount; legacy rows coalesce to totalAmount server-side).
- POST /api/returns/{id}/payment accepts `noTransfer: true` — server skips bank/reference validation, stores amount=0 + bankName=«تسویه بدون انتقال وجه».
