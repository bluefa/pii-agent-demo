# Implementation ↔ v15 Gap Ledger

> Source: 9 Opus fidelity audits (impl `app/` vs the byte-exact `design/v15-extract/`
> 00–09 specs). Organized into fix waves by leverage. The current app predates v15,
> so the gap is large. **Root cause = token foundation rot → systematic cascade.**

## Wave A — Token foundation (highest leverage; fixes the cascade)

**`app/globals.css`:**
- `--color-primary` = `theme('colors.blue.600')` → **#2563EB**; must be **#0064FF**. Same for `--color-primary-hover` → **#0050D6**, `--color-primary-light` → **#E8F1FF**. (Used by `.prose-guide a`/`marker`, focus ring, editor anchors, `mgmtGroupStyles`.)
- `body { font-family: Arial, Helvetica, sans-serif }` (×87–90) → must be **Geist** (`var(--font-geist-sans)`). Inherited base font is currently Arial.
- No global `letter-spacing` → add **`-0.018em`** on `body` (v15 global inherited default).
- `--radius-card` = `theme('borderRadius.xl')` = **12px** → **20px** (Toss `--toss-radius-card`).
- Page/shell bg uses `bg-gray-50` (#F9FAFB) → v15 effective **#F4F4FB** (inline 5168) / `#F2F4F6`.
- Dangling `--fg-3` referenced (`.prose-guide`) but never defined → define or map.

**`lib/theme.ts`:**
- Add the Toss text tokens (`#191F28` strong / `#4E5968` medium / `#8B95A1` weak / `#B0B8C1` faint) + surface (`#F7F8FA` inner / `#EBEEF2` divider) as named tokens; today they're scattered inline literals.
- `borderRadius.card` → 20px. Add 2-layer toss-shadow-sm (`0 1px 2px rgba(17,24,39,.04), 0 4px 16px -8px rgba(17,24,39,.06)`).
- `colorRaw.pendingText` etc.: where exact, use literal `#9CA3AF` not `text-gray-400` (Tailwind v4 OKLCH gray-400 = **#99A1AF**, off by a hair).

## Wave B — Component token-sets (consume A)

- **`cardStyles`**: radius 20px; 2-layer shadow; header padding **28px 28px 12px** (not px-6 py-4) + border base **0**; body padding **16px 28px 28px** (not p-6); card title → **26/800/-0.045em** (step cards use `cardTitle` 22px; switch to `displayTitle`); subtitle **13.5/500/#8B95A1** (step cards hardcode `text-[12px]`/gray-500); color #191F28.
- **`tableStyles`**: thead **remove `uppercase` + `tracking-wider`** (v15 has neither), bg **#F7F8FA**, weight **600**, color **#8B95A1**; headerCell pad **12px 18px** (not px-6 py-3); divider **#EBEEF2**; cell pad **16px 18px**, td color **#191F28**/weight **500**. (`idcStyles.table` = the one mostly-correct set; only missing `font-size:13px` on `<table>` + th `-0.01em`.)
- **`bannerStyles`** (StepBanner): radius **12** (not 10), padding **18px 22px**, **border 0** (drop the 1px border), weight **500**, font **14**; info color **#1E40AF**, success **#065F46**; `strong` weight **700**.
- **`buttonStyles.base`/`Button.tsx`**: radius **12** (not lg/8), weight **700** (not 500), height **40**, font **14**, ls **-0.01em**, `:active scale(.97)`; `.sm` radius **10**/h32/13. (`idcStyles.triggerBtn` is correct — model on it.) Add **danger-outline** variant (#FEF2F2/#991B1B/600/0-border).
- **`pageMetaStyles`**: ib-k **12/600/#8B95A1** (not 13/500/gray-500); ib-mono **13/#191F28** (not 15/gray-900), ls 0.
- **`confirmModalStyles.dangerOutlineButton`** (cancel btn): radius **12**, border **0**, weight **600**, color **#991B1B**.

## Wave C — Per-component hardcoded fixes

- **`InstallTaskCard.tsx`** (GCP+IDC): align **flex-start** (not center), bg **#F7F8FA** (not white), radius **12** all corners, **border 0**; done card bg **#ECFDF5**, running **#EFF6FF**+inset ring; padding **24px 22px**; `InstallTaskPipeline` gap **12px** (not gap-0); connector **`›` chevron** (not rotated square), right -14, color #B0B8C1, 22px; num **32/14/800**, base #fff/#8B95A1; title **16/#191F28**, sub **13/#4E5968/500**; pill **12/700**, 대기 #fff/#8B95A1 label "대기" (not "해당없음"), 완료 #fff/#2A7D52, **진행중 #0064FF bg/#fff** (not blue-100), 실패 #fff/#991B1B.
- **`Pagination.tsx`**: make it the attached `.pagination-row` footer — border 1px #E5E7EB top-none, radius **0 0 10px 10px**, bg **#FCFCFD**, padding 10px 14px; select h26 + **chevron data-URI** (appearance:none); remove first/last/prev-next bordered icons (v15 = numbered + ellipsis only); inactive page btn **transparent border** (not gray); info color #374151, strong #111827; disabled opacity 0.35.
- **`CopyButton.tsx`**: radius **5** (not 6); copied color **#45CB85** (not #2A7D52); hover bg **#F9FAFB**/color **#111827**; icon **12px** (not 14).
- **`Breadcrumb.tsx`**: **13px** (not text-xs/12), weight **500**, color **#8B95A1** (not gray-500), **mb 16px**; sep margin **0 8px**, color #B0B8C1; current **#4E5968**.
- **`PageHeader.tsx`**: title color **#191F28** (geometry already exact 30/800/-0.03em/1.2); add gap 16, mb 8, actions flex-wrap+justify-end.
- **`WaitingApprovalToolbar.tsx`** (rebuild to `.table-toolbar`): surface **#F7F8FA**, radius **12px 12px 0 0**, padding 14px 16px; **filter-active bg #191F28** (NOT blue #0064FF) + weight 700; count badge **pill #F7F8FA / 1px 7px / 999px**; search 8px-radius/white-bg/focus-ring #0064FF; select chevron data-URI; tt-divider 1×18 #E5E7EB.
- **`WaitingApprovalStats.tsx`**: **borderless** (drop border) **#F7F8FA** tinted pills, padding **18px 20px**; **swatch.target green #10B981** (NOT blue), exclude #D1D5DB, swatch **2px square** (not circle); num **26/-0.03em/#191F28** (not 22/-0.02); lbl **13/600/#8B95A1**; pct 13/600/#8B95A1; 4-col grid + mb 18; hover #ECEEF1.
- **`ScanPill.tsx`**: radius **4px** (not full), weight **600**, **no dot** (svg only); variants = new/changed/kept/integrated/none (**add `kept` #F3F4F6/#374151, remove `pending`**); changed **#FEF3C7/#92400E**, integrated **#D1FAE5/#065F46**, none transparent/#9CA3AF/padding 0.
- **`ReasonChipInline.tsx`**: radius **6** (not full); padding 3px 9px; bg **#FFF7ED**, text **#9A3412**, border **#FED7AA** (not gray); hover bg #FFEDD5/border #FDBA74; icon **#C2410C** opacity .8; cursor help.
- **`cells.tsx` `IdcTargetPill`**: use dedicated `.target-pill` not generic Badge — 대상 bg **#F0FDF4**/text **#15803D**/border **#BBF7D0**/dot #10B981; 비대상 bg **#FFFFFF**/text **#6B7280**/border #E5E7EB; 11.5/600/pad 3px 9px.
- **`Tooltip.tsx`**: dark box **#111827** (status) / **#1F2937** (source-ip) — not gray-700; text **11.5px** (not 14), radius 8/10, fixed width **280px**, line-height 1.5/1.6, ls 0; add **:focus/keyboard** reveal; arrow rotated-square; trigger icon **13px**/hover #0064FF.
- **`ScanErrorState.tsx`**: bg **#FEF2F2** (not red-100 #FEE2E2), border **#FECACA** (not red-300), body text **#7F1D1D** (not #991B1B).
- **`ScanRunningState.tsx`**: gradient end **#4F46E5** (not indigo-500 #6366F1); bar transition **width 400ms** (not all 300ms); keep `.illus` neutral grey (currently recolored blue).
- **Stepper** (DESIGN.md-sanctioned divergence — confirm with user before touching): only incidental drifts = pending text `text-gray-400`→ literal **#9CA3AF**; label font Arial→Geist (fixed by Wave A body font); motion intentionally retuned.

## Wave D — Missing / structural (bigger build)

- **Identity bar**: build the v15 `.identity-bar` card (provider icon 38px + accent stripe 4px `--ib-accent` + ib-provider-name 17/700 + ib-sub + divider + agent badge) — currently a flat `<dl>` PageMeta. (8 critical missing pieces.)
- **AWS/Azure Step-4**: re-platform onto `InstallTaskPipeline` (currently bespoke inline). Build **`.seg-toggle`** (AWS auto/manual mode bar) + **`.tf-download-card`** (don't exist).
- **`.status.partial`**: add 3rd health state (orange "Partial Healthy") — `IdcHealth` type is 2-state.
- **`.tag.gray`** token (#F7F8FA/#4E5968) — used for 비대상/제외.
- **IDC Step-2 approval-stats**: no stats grid rendered (cloud has one).
- **Guide eyebrow**: token exists (`cardStyles.eyebrow`, correct) but no card renders it.
- **Delete orphan** `ScanProgressBar.tsx` (dead, off-design solid-orange).

## Wave E — Code quality (Vercel react-best-practices; mostly clean — no critical)

- **`WaitingApprovalCard.tsx:192` + `WaitingApprovalTable.tsx:58`** (highest impact): `visibleResources` slice = new array each render → whole results table + CopyButtons re-render on each search keystroke. Fix: `useMemo` the slice, `React.memo` the table, hoist `MONO_CELL`.
- **`ConnectionTestPanel.tsx:53-63`** (real bug): shake effect early-returns before advancing `prevUiStateRef`, so the ref never updates on the transition render. Fix: advance ref unconditionally / drive shake from the polling completion callback.
- **`IdcTargetFormModal.tsx:228` (ips) + `cells.tsx:65` (hosts)**: `key={index}` on mutable lists → input/focus mis-association on remove/edit. Fix: stable ids.
- `IdcTargetListTable.tsx:61` header `key={i}` (cosmetic, static), latent row memoization (only if lists grow), `'use client'` on 6 presentational UI files (RSC-hygiene, ~no bundle win here), `Modal.tsx:90` keydown listener re-binds per render (ref the onClose), `LoadingSpinner.tsx:16` `animate-spin` on `<svg>` (wrap in div), static JSX hoisting.
- **a11y bug (non-perf): `ProcessGuideTimeline.tsx:26`** `aria-label` references a bare `status` not in scope (resolves to `window.status`, always wrong). Fix the identifier.

## Confirmed-correct (no change)
- `IdcKindBadge`, `IdcFirewallBadge`, `IdcConnBadge`, `IdcDbTypeCell` (all-blue is correct), base `.tag`/`.status` geometry, healthy/unhealthy status colors.
- Stepper circle/label/connector geometry + glow + checkmark + 7 labels = byte-exact (motion retuned per DESIGN.md).
- `idcStyles.table` (db-list) + `idcStyles.triggerBtn` + `idcStyles.modalBtn` + `idcStyles.kind` = correct.
- ScanEmptyState + scan-progress geometry = correct (minor gradient/transition nits).
- `cardStyles.displayTitle`/`eyebrow`/`subtitle` tokens are correct **but not consumed** by the step cards (which hardcode smaller values) → Wave B switches consumers.
