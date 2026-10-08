# Task 3-b — full-stack-developer (management views)

**Task:** Products / users / activity management views + paginated product list API extension.

## Files created
- `src/components/hz/products-view.tsx` — `ProductsView({ user })`: Tabs «بانک کالا» / «ورود از اکسل (هلو)».
- `src/components/hz/users-view.tsx` — `UsersView({ user, onChanged })`: users table + add cashier dialog + reset-password dialog + activate/deactivate.
- `src/components/hz/activity-view.tsx` — `ActivityView({ user })`: vertical RTL timeline, per-action icons/labels.

## Files modified (exactly ONE API route, as instructed)
- `src/app/api/products/route.ts` — added `mode=list` branch BEFORE the existing search logic (search behavior 100% intact, verified by curl):
  - Params: `page` (1-based, min 1), `pageSize` (default 20, clamped 1..100), optional `q` (name/barcode/code contains — barcode matched via `digitsOnly(q)` when ≥4 digits, same convention as search mode), optional `category` (exact match).
  - Response (jsonOk envelope → fields at TOP level, no `data` wrapper): `{ products: ProductDTO[], total, page, pageSize, categories: string[] }` — categories = distinct non-null categories of ACTIVE products, Persian-sorted (`localeCompare fa`).
  - Auth: `requireUser()` (same as search). No ActivityLog write (read-only op).
  - Typing: `Prisma.ProductWhereInput` imported from `@prisma/client`; count + findMany + distinct run in `Promise.all`.

## Contract notes for later agents
- `jsonOk(data)` returns the payload at the TOP level: `{ products, total, ... }` / `{ users }` / `{ activities }` — NOT `{ ok, data }`. Errors: `{ error }` + non-200 status.
- `/api/products/import` POST: FormData field name is **`file`** (plus optional `priceUnit`: "rial"|"toman"); response = ImportReport fields at TOP level (total/created/updated/invalid/headerRow/mapping/sheetName/errors/priceUnit) — my import panel unwraps it directly (the task brief said `{ report }` nested — actual route returns flat, I matched the real route).
- Session cookie name is `hz_session` (not `hz_token`).
- Seeded owner for testing: username `norouzi` / password `Zeytoon@1404`.
- All three views are plain named exports; parent should render them for **owner** role only (no internal role checks, per spec). UsersView accepts optional `onChanged` to refresh parent stats.

## UI decisions
- Sticky table headers: shadcn `Table` renders its own `overflow-x-auto` wrapper which breaks `thead sticky` inside an outer vertical scroller, so I used the codebase's proven pattern (raw `<table>` + `TableHeader/TableRow/TableHead/TableCell` styling components) with `overflow-x-auto` OUTSIDE the `max-h-[520px] overflow-y-auto` div — same as `return-history.tsx`.
- Timeline line on the RIGHT (RTL reading start): `border-s-2` (logical inline-start = right in RTL) on each `<li>`; icon circles centered on the line via `start-[-18px]`.
- Price column: `formatMoney` (Rial) + hover Tooltip showing `formatToman`; barcode shown as-is in Persian digits (`toFaDigits`) with `dir="ltr"`.
- RTL pagination: «قبلی» rendered first (right side) with ChevronRight; «بعدی» with ChevronLeft; page counter «X / Y» in Persian digits.
- Import report: stats grid (total/created/updated/invalid), sheetName + detected headerRow, priceUnit note (toman → ×10 conversion explained), mapping table (7 fields), errors list `max-h-40 overflow-y-auto`, «رفرش بانک کالا» switches back to bank tab (Radix TabsContent unmounts inactive tabs → fresh fetch on remount).
- Upload zone: drag&drop + click + keyboard (Enter/Space), client-side ext/size validation matching server rules, priceUnit Select (rial default).
- No blue/indigo anywhere — only theme vars (primary pistachio, chart-2 saffron, chart-3 copper, chart-4 terracotta, chart-5 olive, destructive).

## Verification
- `bun run lint`: my 3 new files + edited route → **0 errors/warnings**. (4 pre-existing problems remain in OTHER files: jalali-datetime-picker.tsx, return-form.tsx, return-history.tsx — not mine to touch.)
- `bunx tsc --noEmit`: **0 errors** in my 4 files (project has pre-existing errors elsewhere: seed.ts, import route, returns route, examples/, skills/).
- curl tests (owner cookie): `mode=list` page/pageSize ✅, `q` filter ✅ (4 hits for «شیر»), `category` filter + page 2 ✅, old `q` search mode intact ✅ (3 hits for «برنج»), unauthenticated → 401 Persian error ✅, `/api/users` + `/api/activity` envelopes ✅.
- dev.log: all routes 200, no compile errors.
