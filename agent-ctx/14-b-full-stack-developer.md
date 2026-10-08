# Task 14-b — full-stack-developer subagent

## Task
Low-stock inventory alerts card «هشدار موجودی بانک کالا» on the owner dashboard (Hyper Zeytoon, Next.js 16 + Prisma SQLite). Task spec: extend `/api/stats` with low-stock queries, extend `StatsDTO`, add a 3rd card to the last dashboard grid. Only 3 files in scope.

## Files changed (exactly the 3 allowed)
1. `src/app/api/stats/route.ts` — +4 Prisma queries in the existing `Promise.all` (products lte 5 take 8 sorted stock-asc/name-asc, count lte 5, count = 0, findFirst updatedAt desc), exposed as `jsonOk({ ..., lowStock: { products, total, outOfStock, bankUpdatedAt } })`.
2. `src/components/hz/types.ts` — `StatsDTO.lowStock` added.
3. `src/components/hz/owner-dashboard.tsx` — imports `TriangleAlert` + `PackageCheck`; last grid → `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3`; new card «هشدار موجودی بانک کالا» (chips row, scrollable top-8 list with code/stock badges, Jalali bank-updated footer, healthy empty state when total=0).

## Verification results
- `bunx tsc --noEmit`: 0 errors in the 3 files (35 pre-existing in seed/examples/skills/products-import).
- `bunx eslint <3 files>`: 0 problems.
- curl (owner norouzi): `lowStock = { total: 2788, outOfStock: 227, bankUpdatedAt: "2026-09-30T16:31:41.343Z", products: 8 all stock=0, stock-asc then name-asc }`; rest of envelope unchanged (pendingCount 1, 4 cashiers, series 14, topProducts 6, recentReturns 5).
- agent-browser (isolated session `qa-b`, 1440×900): card renders — badge «۲۷۸۸ کالا», chips «۲۲۷ کالای تمام‌شده» + «۲۷۸۸ کالا با موجودی کم», 8 rows with «ناموجود» badges, footer timestamp; list scrolls (256 client / 560 scrollHeight); 3×357px grid columns; `errors --json` → []; regression: stat cards, charts, cashiers, recent returns all render.
- Mobile 390×844: `body.scrollWidth === innerWidth === 390`, cards 366px stacked, list scrolls.

## Key bug found & fixed (important for future agents)
Long `truncate` (white-space:nowrap) product names give the card a min-content of ~416px; on mobile the last grid had an implicit `auto` column (no `grid-cols-1`) → track sized 416px → ALL three cards stretched & clipped while `body.scrollWidth` stayed 390 (naive overflow check passes!). Fix: `grid-cols-1` (minmax(0,1fr) track). Diagnosis recipe: `getComputedStyle(grid).gridTemplateColumns` + hide-one-child binary search.

## Deviations from spec
- Grid class includes `grid-cols-1` (spec's literal string lacked it) — required by the spec's own mobile no-overflow requirement. Reason: see bug above.
- Dev server (system-managed) died mid-task (EADDRINUSE crash cycle); restarted manually `nohup bun run dev >> dev.log 2>&1 &` to complete QA.
- Chip 2 kept as spec primary form: «{total} کالا با موجودی کم» (spec allowed «کم‌موجود» variant).
- Footer bank-updated note renders in both healthy and alert states (spec: "inside CardContent end").

## Screenshots
- `agent-ctx/14-b-screenshots/hz-14b-lowstock-card.png` (desktop 1440×900)
- `agent-ctx/14-b-screenshots/hz-14b-mobile.png` (390×844)

Full worklog entry appended to `/home/z/my-project/worklog.md` (Task ID 14-b).
