# v16 Design Tokens — Target-Source Detail (screen-4)

Authority: `design/SIT Prototype Athena v16.html` · target: `lib/theme.ts`.
Source: `token-spec` agent decomposition (opus), to be reviewed by Codex + opus to unanimity.

## 0. Critical reading rule

The v16 HTML has **two `<style>` blocks**. Lines 6–504 are a generic `.ds-*` system
(radius 12, type 28/700) that **screen-4 does NOT use**. screen-4 + all modals use **block 2**
(HTML 506–5075), governed by the Toss `:root` at HTML 546–567 (radius-card 20, card titles
26/800/-0.045em, modal radius 24). **Every token below is vs block 2. Never extract from `.ds-*`.**

The Toss `:root` already maps 1:1 onto existing `tossColors`/`tossShadow`/`borderRadius`
(strong#191F28, medium#4E5968, weak#8B95A1, divider#EBEEF2, inner#F7F8FA, radius-card 20…).
So most of screen-4 is already token-backed. The work below is a small ADD + RECONCILE set.

## 1. Minimal set to make screen-4 byte-exact

**ADD:** §A7 `tag.gray`, §A8 `scanPillStyles`, §A10 `approvalStatStyles`, §A13 `modalBtn.gray`,
§A14 `credSelect`, plus §A5 `approvalTableStyles` (submit modal) and §A3 modal `shadow.lg`,
and §A6 `reqApprovalStyles` (the new 완료 승인 요청 modal).
**RECONCILE:** §B1 page title color, §B3 unhealthy dot, §B6 ghost-blue, §B10 modal overlay.
**DEFER (separate PRs):** §A16 logical-DB modal subsystem, §A4 form-section-label, §A9 `.pill`,
screen-3 `.db-table` (§B4), Step-4 install status-pill (§B5).

## 2. Tokens to ADD (exact class strings, paste-ready)

| id | token | value | used by |
|----|-------|-------|---------|
| §A7 | `idcStyles.tag.gray` | `bg-[#F7F8FA] text-[#4E5968]` | neutral tag |
| §A8 | `scanPillStyles` | base `inline-flex items-center gap-[5px] px-2 py-0.5 rounded-[4px] text-[11px] font-semibold tracking-[0.01em]`; new `bg-[#DBEAFE] text-[#1E40AF]`, changed `bg-[#FEF3C7] text-[#92400E]`, kept `bg-[#F3F4F6] text-[#374151]`, integrated `bg-[#D1FAE5] text-[#065F46]`, none transparent | scan/연동이력 |
| §A10 | `approvalStatStyles` | grid `gap-3 mb-[18px]`; stat `rounded-[12px] p-[18px_20px] bg-[#F7F8FA] flex flex-col gap-1.5 hover:bg-[#ECEEF1]`; lbl `text-[13px] font-semibold text-[#8B95A1] flex items-center gap-1.5`; swatch `w-2 h-2 rounded-[2px]` + target `bg-[#10B981]`/exclude `bg-[#D1D5DB]`/scanNew `bg-[#3B82F6]`; num `text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-[#191F28] leading-[1.1]`; pct `text-[13px] font-semibold text-[#8B95A1] ml-2` | step5 modal stats |
| §A13 | `idcStyles.modalBtn.gray` | `inline-flex h-[52px] items-center justify-center rounded-[14px] px-[22px] text-[15px] font-semibold text-[#191F28] bg-[#F7F8FA] hover:bg-[#EBEEF2]` | modal 취소 |
| §A14 | `idcStyles.credSelect` | `h-8 max-w-[150px] pl-[11px] pr-7 rounded-lg border border-gray-200 font-mono text-[12px] font-semibold text-[#111827] bg-white appearance-none hover:border-[#0064FF] focus:border-[#0064FF] focus:outline-none` + chevron bg-image | step5 DB Credential |
| §A5 | `approvalTableStyles` | header `bg-[#F7F8FA] text-[12px] font-semibold text-[#8B95A1] whitespace-nowrap` pad `px-[18px] py-3`; cell `px-[18px] py-4 text-[#191F28] font-medium`; row.selected `bg-[rgba(0,100,255,0.05)]`; checkbox `accent-[#0064FF]` | submit-approval modal |
| §A3 | `tossShadow.lg` | `0 8px 16px rgba(17,24,39,.04), 0 24px 48px -16px rgba(17,24,39,.14)` → apply to `.modal` container | all modals |
| §A6 | `reqApprovalStyles` (new 완료 승인 요청 modal) | headerPad `px-7 pt-[26px] pb-1`; eyebrow `inline-flex items-center font-mono text-[11px] font-semibold tracking-[0.09em] uppercase text-[#0064FF] mb-[9px]` + 6px primary dot ::before; title `text-[23px] font-extrabold tracking-[-0.03em] leading-[1.25] text-[#191F28]` (NOTE: 23px, smaller than std 26); sub `text-[13px] font-medium text-[#6B7280] leading-[1.6] max-w-[60ch]`; thHeader `text-[11px] font-bold tracking-[0.05em] uppercase text-[#9CA3AF]`; rmName `text-[13px] font-semibold text-[#111827] tracking-[-0.01em]`; rmNum `font-mono text-[13.5px] font-semibold tabular-nums text-[#111827]`; statNum override `text-[30px] tracking-[-0.035em]` | step5 req-approval modal |
| §A12 | `buttonStyles.variants.reject` | `bg-white text-[#991B1B] border border-[#FECACA] hover:bg-[#FEF2F2]` | step6 reject |
| §A1 | `tossColors.pageBg` | `#F2F4F6` | page bg |
| §A2 | `tossShadow.md` | `0 2px 4px rgba(17,24,39,.04), 0 12px 32px -12px rgba(17,24,39,.10)` | — |

## 3. Tokens to RECONCILE (current theme value → v16 value)

| id | token (theme.ts) | current | v16 | priority |
|----|------------------|---------|-----|----------|
| §B1 | `pageChromeStyles.title` | `text-gray-900` (#111827) | **#191F28** | HIGH (screen-4 page title) |
| §B3 | `idcStyles.status.unhealthy.dot` | `bg-[#991B1B]` | **#EF4444** | HIGH (screen-4 conn status) |
| §B6 | `buttonStyles.ghost` | gray | **#0064FF blue** (transparent, hover #EFF6FF) | HIGH — add `ghostPrimary` (don't break gray callers); used by 논리 DB 관리 "설정" `.btn.sm.ghost` |
| §B10 | `modalStyles.overlay` | black/50, z50 | **rgba(15,23,42,.5), z100** | MED (all modals) |
| §B2 | `pageChromeStyles.breadcrumb` | #6B7280 | #8B95A1 | LOW |
| §B7/B8/B9 | secondary dark / approve hover / field ring | — | audit | LOW/cosmetic |

## 4. v16 deltas — token coverage

| delta | token-backed? | action |
|-------|---------------|--------|
| 연동 대상 220→168px | ✅ widths never tokenized; no stale 220 on this col (220 only on 제외 사유) | inline `w-[168px]` |
| DB Credential column | ⚠️ select MISSING | ADD §A14 `credSelect` |
| IDC 논리 DB 관리 column | ⚠️ ghost is gray not primary | RECONCILE §B6 ghostPrimary |
| 완료 승인 요청 modal | ❌ largest new surface | ADD §A6 + §A10 + §A13 |
| IDC step1 col5/6 padding | ✅ positional rule, not token | apply `pr-2`/`pl-2` to nth-child 5/6 |

## 5. Verified EXACT (no change) — condensed

Typography (card title/eyebrow/subtitle ✅), status (success/partial ✅; dot mismatch §B3),
`.tag` 4 colors ✅, `.target-pill` ✅, `.kind-badge` ✅, `.db-list-table` (idcStyles.table
13/700/#4E5968/pad14·16 ✅EXACT), cards ✅, `.step-banner` info/warn/success/error ✅,
buttons primary/soft/warnOutline/dangerOutline/sm ✅, modal-footer 52px primary/outline ✅,
modal title/sub/header/body/footer ✅, `.field` input ✅ (focus ring 2px vs 3px cosmetic).

## 6. Deferred to separate PRs

- §A16 `logicalModalStyles` — logical-DB modal is a large internal subsystem (w1040, twin-panel,
  staged add/remove, sticky headers). Own PR.
- §A4 form-section-label, §A9 `.pill`, §A5 only if submit-approval modal is touched,
  screen-3 `.db-table` (§B4), Step-4 `.status-pill` (§B5).

## 7. theme.ts line index (for implementation)

tossColors 33–46 · tossShadow 52–54 · cardStyles 254–296 · buttonStyles 227–249 ·
pageChromeStyles 324–328 · bannerStyles 491–500 · idcStyles 546–637 · modalStyles 396–425 ·
tableStyles 430–438.

v16 line index: Toss root 546–567 · req-modal CSS 2647–98 · IDC col padding 2699–2706 ·
approval-stats/swatch 2708–46 · scan-pill 3084–96 · req-approval markup 8086–8209 ·
exclusion modal 8478–97 · step5 card cloud 6883–6997 / idc 7004–7070.

---
## Review log (converge to unanimous before freeze)

### Round 1 — Codex (gpt-5.5, xhigh): **NOT complete**
- CONFIRMED correct: §A7, §A12, §B1, §B2, §B3, §B6.
- Fix (incomplete token strings): §A3 not paste-ready → `shadow-[0_8px_16px_rgba(17,24,39,0.04),0_24px_48px_-16px_rgba(17,24,39,0.14)]`;
  §A5 add wrapper/hover/last-row/checkbox/excluded states; §A6 add eyebrow gap6/title mb8/stat-label
  override/pct ml6/body td+mono/modal widths; §A8 add `.none` = `bg-transparent text-[#9CA3AF] p-0` + svg
  `flex-shrink-0`; §A10 grid is **grid-cols-4** (req-modal overrides to 3 inline) + stat `border-0 transition-colors`;
  §A13 add `border-0 tracking-[-0.01em] transition-colors`; §A14 add `cursor-pointer transition-colors` +
  bg repeat/pos + `.empty` variant `text-[#6B7280] font-sans font-medium`; §B10 overlay also needs
  `grid place-items-center opacity-0 pointer-events-none transition-opacity` + open state.
- OMISSIONS to add: `connProgressStyles` (step5 진행바, v16 2552–2645), `paginationRowStyles` (3099–3157 —
  note impl already has `Pagination` component; verify it matches), `resourceIdCellStyles` (2885–2910 — impl
  already has `ResourceIdCell`; verify), `dbListTableFrameStyles` (1850–1869 table wrapper),
  `sourceIpTooltipStyles` (4942–4958), `logicalModalCloseStyles` (defer with §A16).

### Round 1 — opus token-verify-add / token-verify-reconcile: _pending_

### Round 2 — corrected token strings (Codex round-1 applied; opus verifiers + element-inventory pending)
These supersede the round-1 §A values where they differ:
- §A3 paste-ready: `shadow-[0_8px_16px_rgba(17,24,39,0.04),0_24px_48px_-16px_rgba(17,24,39,0.14)]`
- §A8 add: `none: 'bg-transparent text-[#9CA3AF] p-0'`, `icon: 'flex-shrink-0'`
- §A10 fix: grid base is `grid grid-cols-4` (req-modal overrides to 3 inline); stat add `border-0 transition-colors`
- §A13 add: `border-0 tracking-[-0.01em] transition-colors`
- §A14 add: `cursor-pointer transition-colors` + bg repeat/position + `empty: 'text-[#6B7280] font-sans font-medium'`
- §A6 add: eyebrow `gap-1.5`, title `mb-2`, stat-label override, pct `ml-1.5` tracking-0, body td/mono overrides, modal body padding, widths (760 cloud / 820 idc)
- §B10 full: `fixed inset-0 grid place-items-center bg-[rgba(15,23,42,0.5)] z-[100]` + open-state (opacity/pointer-events/transition)
- OMITTED → add: §A17 `connProgressStyles` (step5 진행바, v16 2552–2645) **NEW, required for step5**;
  §A18 pagination — impl `Pagination` EXISTS, verify it matches v16 3099–3157 (no new token unless drift);
  §A19 resource-id — `ResourceIdCell` EXISTS (verify v16 2885–2910); §A20 `idcStyles.table.frame` — **already added** (commit c80e3b9);
  §A21 sourceIpTooltip (v16 4942–4958) — defer; §A22 logical-modal close-x — defer with §A16.

### Round 2 — opus token-verify-reconcile: §B3 WRONG, §B6 rationale
- **§B3 DROP — do NOT change `unhealthy.dot` to #EF4444.** v16 screen-4 IDC conn table overrides to
  inline `#991B1B` dot + pill bg `#FEE2E2` (HTML 7352 / `idcHealthBadge` 10455); the current theme.ts
  `#991B1B` is CORRECT for that surface. The #EF4444 is the generic `.status.unhealthy` CSS class
  which screen-4 overrides. **Removing §B3 from the freeze.**
- **§B6** add `ghostPrimary` ✅ — but rationale corrected: v16 `.btn.ghost` is ALWAYS blue (no gray
  ghost exists). The app's 6 gray-ghost callers (PendingTasksTable etc. "상세", history modal paging)
  are an app-side deviation. → add `ghostPrimary`, point screen-4 callers (논리 DB 확인 "설정") at it.
- §B1/§B2/§B10 MISMATCH-CONFIRMED; 6 "verified EXACT" claims all genuinely byte-exact.

### Round 2 — opus token-verify-add + element-inventory: pending retrieval

### spec-step5 token flags (implementation-grade, for step5 surface)
NEW/no-token confirmed: `.idc-cred-select` (§A14), `.approval-stats`+swatch (§A10, mirror
`WaitingApprovalStats.tsx`), red warn box `#FEF1F1/#F8D2D0/#B42318` (use `statusColors.error`),
`.btn.sm.ghost` "설정" (reuse LogicalDbSlot pattern / ghostPrimary). IDC `tag gray` 자격 증명 필요
already covered by `IdcConnBadge`. Cloud `ConfirmedIntegrationTable[pre-install]` already renders
6/7 cols (extend, not rebuild); IDC `IdcResourceView` already has credentialId+connection (ADR
boundary intact — no new wire fields).

### Round 2 — opus token-verify-add: ALL 9 ADD tokens byte-exact ✓
§A3/§A5/§A6/§A7/§A8/§A10/§A12/§A13/§A14 all CORRECT vs v16 block 2; none collide with theme.ts —
safe to write as-is. RECONCILE values (§B3→#EF4444 generic / §B6 #0064FF / §B10) also confirmed.
Remaining omissions to ADD before a full-screen freeze (NOT all needed per-cell): `connProgress`
(**now ADDED** — `idcStyles.connProgress`, commit for IDC step5), `.th-tip` source-ip tooltip,
credSelect chevron stroke `#667085` (**fixed**) + `.empty` (**added** `credSelectEmpty`), req-modal
body padding 20/26/4 inline override.

### Round 2 — element-inventory: ~470 distinct selectors; doc covers ~25 (delta set, by design)
screen-4 + modals use ≈470 CSS selectors; this doc is a byte-exact **delta** (ADD/RECONCILE), not a
full inventory — ~90% (the JS-rendered layer: pbar, Athena tables, IDC rows, conn-progress, floating
tips, modal bodies) is intentionally added **per-cell as each is built**, not upfront. Captured as
html-analysis skill **L9** (completeness method). Full inventory lives in the element-inventory report.

**Token policy (locked):** add the token for each primitive AS its cell is implemented + screenshot-
verified + Codex/opus-reviewed — NOT all 470 upfront. step5 tokens (IDC) FROZEN & shipped. Cloud
step5 tokens reuse the same set.
