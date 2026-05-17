# SIT Prototype v7 — Implementation Gap Audit

**Date:** 2026-05-14
**Reference design:** `design/SIT Prototype v7 - standalone.html` (669 KB, single-file Toss-flavored prototype)
**Reference implementation HEAD:** `ad6339f` (post-Wave 7 merge, all of Waves 0–7 on main)
**Scope:** Target-source detail page (`/integration/target-sources/[targetSourceId]`) — all seven `ProcessStatus` states across Azure / AWS / GCP

---

## 0. TL;DR

Eight `ProcessStatus` × three providers should produce one consistent visual surface that only diverges where the install mechanics genuinely diverge. The current code base ships **partial typography/background tokens but stops short of the prototype's design language**, omits the **Guide Card on six of seven steps**, lacks the **per-row hover affordances** (resource-id copy button, info-icon tooltip, action-row hover tinting), and contains **one provider divergence** (`CloudInstallingStep` excludes `ConfirmedResourcesSlot` for GCP) that is structural, not a "install-state-only" delta.

The seven concrete blocks below each list:
- the prototype rule,
- the current state with file:line,
- severity (P1/P2/P3),
- a fix-shaped follow-up.

A consolidated punch list is in §8.

---

## 1. Audit dimensions

The user surfaced five concerns, expanded to seven dimensions for grep-able coverage:

| # | Dimension | Prototype anchor | Audit method |
|---|---|---|---|
| D1 | Guide Card presence per step | `.card.guide-variant` block in screen-4 | Grep `GuideCardContainer` usage in step components |
| D2 | Card typography tokens | `--type-display` 28 / `--type-h1` 22 / `.eyebrow` 12 / `.ds-card-title` 14 uppercase | Compare to `cardStyles.*` token usage in step components |
| D3 | Background palette | `--bg-page` #FFF, `--bg-muted` #F9FAFB, `--bg-tinted` #F3F4F6, guide #FFFDF5 | Grep `bgColors.*` and raw `bg-*` classes |
| D4 | Provider parity within a state | All providers share the same shell; only install mechanics differ | Grep `cloudProvider` branches in step components |
| D5 | Resource ID copy-on-hover | `.copy-btn` opacity 0 → 1 on row hover | PageMeta has it; tables do not |
| D6 | Tooltip pattern (`ⓘ` icon hover) | `.tooltip-trigger` + `.tooltip-content` dark popover | `Tooltip` primitive exists but under-used |
| D7 | Action / row / chip hover | `.row-action.{add,remove,revert}:hover`, `.install-task:hover`, `.approval-stat:hover` | Most rows do `hover:bg-gray-50` only; no scoped variants |

---

## 2. Prototype design language (extracted reference)

> Captured from `design/SIT Prototype v7 - standalone.html`. The single-file mockup uses a Toss-derived token set. Headings and the eyebrow rule below are **the authoritative target** for §4.

**Type scale:**
```
--type-display: 28px       /* h1 — page title */
--type-h1:      22px       /* h2 — card title */
--type-h3:      18px       /* h3 — subsection */
--type-body:    15px       /* body */
--type-caption: 13px       /* helper */
--type-label:   12px       /* form labels, eyebrow */
```

**Heading specs:**
- `h1` — 28 / 700 / `-0.02em` / 1.15 / `--fg-1` #111827
- `h2` — 22 / 700 / `-0.01em` / 1.25 / `--fg-1`
- `h3` — 18 / 600 / 1.3 / `--fg-1`
- `.eyebrow` — 12 / 700 / `0.02em` / `--color-primary` #0064FF
- `.ds-card-title` — 14 / 600 / uppercase / `--fg-3` #6B7280 / letter-spacing 0.05em

**Surface palette:**
- Page bg — `#FFFFFF`
- Muted (table header, disabled) — `#F9FAFB`
- Tinted (subsections, approval stats) — `#F3F4F6`
- Guide card — `#FFFDF5` (warm amber) + `#F3E8B8` border + gradient header

**Banner variants:**
| Variant | bg | text | use |
|---|---|---|---|
| `.step-banner` (default info) | `#EFF6FF` | `#1E40AF` | waiting / instruction |
| `.warn` | `#FFFBEB` | `#78350F` | action needed |
| `.success` | `#ECFDF5` | `#065F46` | step completed |
| `.error` | `#FEF2F2` | `#7F1D1D` | blocker |

**Provider tag (`.provider-badge`):**
- 16 / 700 / `-0.02em` inline-flex with 8 px dot before the label.
- Variants: aws `#FF9900`, azure `#0078D4`, gcp `#4285F4`, idc `#374151`, sdu `#9333EA`.

**Hover & interaction:**
- `.copy-btn` — opacity 0 by default, opacity 1 on parent hover; turns green on `.copied`.
- `.tooltip-trigger` — dark popover (`#111827`) below the trigger, shown on `:hover` and `:focus`.
- `.install-task:hover` — `translateY(-2px)` + medium shadow.
- `.row-action.add:hover` `#DBEAFE` / `.row-action.remove:hover` `#FEE2E2` / `.row-action.revert:hover` `#D1FAE5`.
- `.approval-stat:hover` — `#ECEEF1` background.
- `.scan-pill` — three states: `new` blue, `changed` amber, `integrated` green.

---

## 3. Current implementation state (per-step)

| `ProcessStatus` | Step component | Cards rendered | Guide? | Heading style applied | Background |
|---|---|---|---|---|---|
| WAITING_TARGET_CONFIRMATION | `WaitingTargetConfirmationStep.tsx` | PageMeta · ProcessStatus · **GuideCardContainer** · CandidateResourceSection · RejectionAlert | **YES (only step)** | (delegated to children) | white |
| WAITING_APPROVAL | `WaitingApprovalStep.tsx` → `WaitingApprovalCard.tsx` | PageMeta · ProcessStatus · WaitingApprovalCard (stats + toolbar + table + pagination) · RejectionAlert | NO | `text-lg font-semibold` (ad-hoc) | white |
| APPLYING_APPROVED | `ApplyingApprovedStep.tsx` | PageMeta · ProcessStatus · ApprovalApplyingBanner · ApprovedIntegrationSection · RejectionAlert | NO | (delegated) | white |
| INSTALLING | `InstallingStep.tsx` → `CloudInstallingStep.tsx` | PageMeta · ProcessStatus · InstallationStatusSlot · **ConfirmedResourcesSlot (Azure/AWS only)** · RejectionAlert | NO | (delegated) | white |
| WAITING_CONNECTION_TEST | `WaitingConnectionTestStep.tsx` | PageMeta · ProcessStatus · ConfirmedResourcesSlot · ConnectionTestSlot · LogicalDbSlot · RejectionAlert | NO | (delegated) | white |
| CONNECTION_VERIFIED | `ConnectionVerifiedStep.tsx` | PageMeta · ProcessStatus · custom card (h2 + subtitle + status badge) · StepBanner (info) · ConfirmedResourcesSlot · retest button · RejectionAlert | NO | `text-lg font-semibold` (ad-hoc) | white |
| INSTALLATION_COMPLETE | `InstallationCompleteStep.tsx` | PageMeta · ProcessStatus · custom card (h2 + subtitle + HealthBadge right) · InstallationCompleteActions · ConfirmedResourcesSlot variant=`complete` · RejectionAlert | NO | `text-lg font-semibold` (ad-hoc) | white |

**Page chrome:**
- `CloudTargetSourceLayout.tsx:46` — `<main className="max-w-[1200px] mx-auto p-7 space-y-6">` (no explicit page bg; relies on browser default white).
- `PageMeta` already wires `mono + copyText` for top-of-page identifiers (project id, target source id) — this is the **only** copy-on-hover affordance in the entire detail surface.

---

## 4. Gap matrix

### D1 — Guide Card coverage

**Prototype:** Every install/setup step on screen-4 surfaces a guide card with step-specific copy. The guide block is `.card.guide-variant` (warm amber surface, `#FFFDF5` body / `#FFF8E1→#FFFCEE` gradient header).

**Current:**
- `GuideCardContainer` (`@/app/components/features/process-status/GuideCard/GuideCardContainer`) is **only mounted in `WaitingTargetConfirmationStep.tsx`**.
- Guide slot keys are registered in `resolve-step-slot.ts` for every step × provider (× AWS-mode), but **six of seven steps render no guide card at all** — the slot is dead code from the consumer's perspective.

| Step | `resolveStepSlot` slot defined? | Renders `GuideCardContainer`? |
|---|---|---|
| WAITING_TARGET_CONFIRMATION | ✓ | ✓ |
| WAITING_APPROVAL | ✓ | ✗ |
| APPLYING_APPROVED | ✓ | ✗ |
| INSTALLING | ✓ | ✗ |
| WAITING_CONNECTION_TEST | ✓ | ✗ |
| CONNECTION_VERIFIED | ✓ | ✗ |
| INSTALLATION_COMPLETE | ✓ | ✗ |

**Severity:** **P1**. The prototype's pedagogical-overlay pattern is the dominant visual element on screens 2–7; the absence of the guide card is the single most noticeable divergence.

**Fix shape:**
1. In each of the six steps, mount `<GuideCardContainer slotKey={resolveStepSlot(project.cloudProvider, ProcessStatus.X, awsInstallationMode)} />` after the step's primary card.
2. Verify the CMS has content for each slot key (some may currently 404; treat missing content as a content task, not a code task).
3. Document in `docs/cloud-provider-states.md` that the guide card is the per-step instructional surface and must be wired in every step.

---

### D2 — Card typography

**Prototype:** h1 28/700, h2 22/700, h3 18/600. `.eyebrow` 12/700 in primary blue above the h2 title. `.ds-card-title` 14/600 uppercase / `letter-spacing: 0.05em` for grouped section dividers inside a card.

**Current:**
- `cardStyles.eyebrow` / `cardStyles.displayTitle` / `cardStyles.subtitle` exist in `lib/theme.ts` (Wave 0).
- They are wired into `PageMeta` and into the page chrome.
- **Step content card titles are NOT using them.** Three step components hardcode `text-lg font-semibold`:
  - `WaitingApprovalCard.tsx` — card header
  - `ConnectionVerifiedStep.tsx` — h2
  - `InstallationCompleteStep.tsx` — h2
- `text-lg` = 18 px / line-height 28 px under Tailwind defaults — that's `--type-h3`, not the `--type-h1` 22 px the prototype uses for card titles. The result: card headings read smaller than the design.

**Severity:** **P2**. Visually inconsistent but doesn't break flow. Cheap to fix.

**Fix shape:**
1. Add a `cardStyles.cardTitle` token in `lib/theme.ts`:
   ```ts
   cardTitle: 'text-[22px] font-bold tracking-[-0.01em] leading-[1.25] text-gray-900',
   ```
2. Replace `text-lg font-semibold` in the three components with `cardStyles.cardTitle`.
3. Where the prototype shows an eyebrow above the title (guide card, approval card), wire `cardStyles.eyebrow` consistently.
4. Promote `.ds-card-title` (14 / 600 / uppercase) to a `cardStyles.sectionLabel` token if any in-card section dividers need it (currently no consumer needs it, so skip until a step requires).

---

### D3 — Background palette

**Prototype:**
- `main` wrapper is white over a `--bg-muted` `#F9FAFB` page background (the prototype renders inside a tinted shell).
- `.approval-stat` containers, table headers, and subsections use `--bg-tinted` `#F3F4F6`.
- The guide card uses warm `#FFFDF5`.

**Current:**
- `<main>` wrapper has **no background** declaration → renders browser default white over a white body.
- `WaitingApprovalStats.tsx` containers — check whether they use `bgColors.muted` or stay white.
- `ApprovedIntegrationTable` and `WaitingApprovalTable` table headers use `bgColors.muted` (`bg-gray-50`) — this matches `--bg-muted`. ✓
- The page itself has no tinted shell, so the white card on white background reads flat compared to the prototype.

**Severity:** **P2**. The page-level tint is what gives the prototype its "depth"; without it, cards float and the visual hierarchy feels thinner.

**Fix shape:**
1. Apply `bg-gray-50` (= `bgColors.muted` = `--bg-muted`) to the layout wrapper:
   ```tsx
   <main className={cn('max-w-[1200px] mx-auto p-7 space-y-6', bgColors.muted)}>
   ```
   Or better — apply it to the root `<body>` / global layout so the entire detail surface gets the shell.
2. Audit `WaitingApprovalStats` / `ApprovalApplyingBanner` / `InstallationCompleteActions` for any place a tinted section is meant to live; raise to `bgColors.muted` if they're currently white.
3. Reserve `cardStyles.warmVariant.container` for the Guide Card — already correct.

---

### D4 — Provider parity within a state

**Prototype:** All providers share the same shell; only the install task pipeline diverges (Azure & GCP have different installation orchestration, AWS has AUTO vs MANUAL modes).

**Current:**
- One component-level fork: `CloudInstallingStep.tsx:49` — `{project.cloudProvider !== 'GCP' && <ConfirmedResourcesSlot />}`.
- All other state shells (WAITING_APPROVAL, APPLYING_APPROVED, WAITING_CONNECTION_TEST, CONNECTION_VERIFIED, INSTALLATION_COMPLETE) use a single layout for all three providers.
- Guide slot resolution branches inside `resolveStepSlot(provider, step, awsMode)` — that's by design.

**Drift:** The GCP-excludes-ConfirmedResourcesSlot fork was introduced to handle a GCP-specific install ordering quirk, but the user's expectation is "providers differ only in install mechanics, not in step UI". Two possibilities:
1. GCP should render ConfirmedResourcesSlot too; the slot is provider-agnostic. — most likely the right outcome.
2. The slot has a provider-specific assumption that breaks for GCP. — needs a code read to confirm.

**Severity:** **P2** (or P1 if the slot truly works for GCP and the fork is a leftover).

**Fix shape:**
1. Read `ConfirmedResourcesSlot.tsx` and trace its data dependencies. If it does not consume any provider-specific shape, remove the GCP gate.
2. If it does, push the provider branch inside the slot so the step shell stays uniform.
3. Add a `CloudTargetSourceLayout.coverage.test.tsx` case that asserts each step renders the same top-level card spine for all three providers.

---

### D5 — Resource ID copy-on-hover

**Prototype:** Every mono / resource-id cell in tables has a hidden `.copy-btn` (opacity 0) that fades in on row hover. Clicking copies the cell content and flips the icon green for 1.5 s. Pattern is consistent across:
- approval table rows
- confirmed resource table rows
- install resource table rows
- page meta strip

**Current:**
- `PageMeta.tsx` — has the pattern (Wave 1).
- Tables — DO NOT. `WaitingApprovalTable`, `ApprovedIntegrationTable`, `ConfirmedIntegrationTable`, `InstallResourceTable` all render mono IDs as plain text without any affordance.

This is the user's specific complaint ("resource id의 hover가 누락").

**Severity:** **P1**. The user is paying attention to this and it's a real cross-table consistency gap.

**Fix shape:**
1. Extract the PageMeta copy-button pattern into a tiny primitive:
   ```ts
   // app/components/ui/CopyButton.tsx
   export const CopyButton = ({ value, label }: { value: string; label?: string }) => { ... }
   // wraps the existing CopyIcon + clipboard logic
   ```
2. Add a `MonoCell` helper or a `<CopyableMono>` component used inside the four tables.
3. Apply `group` / `group-hover:opacity-100` on every `<tr>` to mirror the prototype:
   ```tsx
   <tr className={cn(tableStyles.row, 'group')}>
     <td>
       <span className={cn(TABLE_MONO_CELL, 'inline-flex items-center gap-1')}>
         {resource.resourceId}
         <CopyButton value={resource.resourceId} className="opacity-0 group-hover:opacity-100" />
       </span>
     </td>
   </tr>
   ```
4. Write one test per table asserting the copy button mounts, is initially hidden, and triggers `navigator.clipboard.writeText` on click.

---

### D6 — Tooltip / info-icon hover

**Prototype:** `.tooltip-trigger` ⓘ icon on column headers, on truncated descriptions, on form labels. Hover → dark gray-900 popover with explanation. Keyboard accessible: also activates on `:focus`.

**Current:**
- `Tooltip` primitive (`app/components/ui/Tooltip.tsx`) exists. ReasonChipInline uses it (Wave 3). ConfirmedIntegrationTable status info uses it.
- **Resource-ID cells, resource-name cells, mono fields — none have tooltips.**
- The `Tooltip` primitive itself was flagged in earlier waves as not yet keyboard-a11y complete (Wave 5 deferred follow-up).

**Severity:** **P2** for coverage; **P2** for the keyboard a11y.

**Fix shape:**
1. Coverage — add tooltips wherever the prototype shows them: install task labels, table column headers that need explanation, status badges in card headers ("승인 대기 중" / "설치 진행 중" need explanation).
2. A11y — finish the `Tooltip` primitive's `onFocus` / `onBlur` handlers so trigger elements can show the popover via keyboard. Track via the open Wave 5 follow-up.

---

### D7 — Row / action / chip hover variants

**Prototype:**
- `.install-task:hover` — `translateY(-2px)` + medium shadow.
- `.approval-stat:hover` — background `#ECEEF1`.
- `.row-action.add:hover` `#DBEAFE` (blue-100), `.remove:hover` `#FEE2E2` (red-100), `.revert:hover` `#D1FAE5` (green-100).
- `.scan-pill` — three semantic variants (`new` blue, `changed` amber, `integrated` green). Currently the ScanPill primitive only ships `integrated` / `pending` / `none`.

**Current:**
- `tableStyles.row` uses `hover:bg-gray-50 transition-colors` — uniform across all tables. ✓
- `WaitingApprovalStats` cards — verify whether they hover-tint (Wave 2 spec didn't require it; prototype does).
- `InstallTaskPipeline` task cards — flat; no lift-on-hover.
- `ScanPill` — missing `new` and `changed` states (Wave 7 only shipped `integrated` / `pending` / `none`).

**Severity:** **P3** for the hover variants (decorative), **P2** for the missing ScanPill states (semantic).

**Fix shape:**
1. **ScanPill** — extend `ScanPillState` to `'integrated' | 'pending' | 'new' | 'changed' | 'none'`. Add palette entries: new → `statusColors.info`, changed → `statusColors.warning` (existing token). Note: `pending` and `changed` both look orange in the prototype; verify the design intent before duplicating.
2. **Approval-stat hover** — add `hover:bg-gray-100 transition-colors` to the tiles in `WaitingApprovalStats.tsx`.
3. **Install task hover** — add `hover:-translate-y-0.5 hover:shadow-md transition-all` to task tiles when they're clickable (only when `onClick` exists).
4. **Row-action color hover** — defer until a row-action UI lands (not currently shipped).

---

## 5. Provider-specific drift — INSTALLING & INSTALLATION_COMPLETE

The user said: *"Azure는 GCP와 설치 상태만 다를 뿐인데 step이 일치하지 않는 것으로 보입니다."*

This claim resolves into two observations:

### 5-1. INSTALLING — `CloudInstallingStep`

The shell looks like this:

```
PageMeta
ProcessStatusCard
InstallationStatusSlot          ← provider-specific render (Azure / GCP / AWS-AUTO / AWS-MANUAL)
ConfirmedResourcesSlot          ← Azure/AWS only, hidden for GCP   ← drift
RejectionAlert
```

`InstallationStatusSlot` is meant to be the install-mechanic seam — that's where Azure/GCP/AWS should diverge. `ConfirmedResourcesSlot` is a static "approved resources" panel — it should be the same for every provider.

**Decision needed:** Was the GCP exclusion intentional?
- If GCP's install task pipeline already shows the approved resources inline (likely — GCP has the most integrated mock), the slot is duplicative.
- If GCP just hadn't been hooked up yet, the slot should mount.

Either answer is fine; the audit's job is to surface the fork.

### 5-2. INSTALLATION_COMPLETE — symmetric across providers

`InstallationCompleteStep` does not branch on provider. ConfirmedResourcesSlot renders with `variant="complete"` regardless. ✓

### 5-3. WAITING_CONNECTION_TEST — symmetric

`WaitingConnectionTestStep` mounts ConfirmedResourcesSlot, ConnectionTestSlot, LogicalDbSlot for every provider. ✓

**Conclusion:** The only structural drift is the GCP fork in `CloudInstallingStep.tsx:49`. Removing or justifying it closes D4.

---

## 6. Severity rollup

| ID | Dimension | Severity | Files touched (estimate) |
|---|---|---|---|
| G1 | Guide Card on six steps | **P1** | 6 step components |
| G2 | Resource-ID copy-on-hover in tables | **P1** | 4 tables + new `CopyButton` |
| G3 | Card-title typography token | P2 | `lib/theme.ts` + 3 step components |
| G4 | Page background `bg-muted` | P2 | `CloudTargetSourceLayout.tsx` (1 line) |
| G5 | GCP fork in `CloudInstallingStep` | P2 | 1 component (decision required first) |
| G6 | Tooltip coverage on mono cells / headers | P2 | tables + a few column headers |
| G7 | Tooltip primitive keyboard a11y | P2 | `Tooltip.tsx` (already a deferred follow-up) |
| G8 | ScanPill missing `new` / `changed` states | P2 | `ScanPill.tsx` + tests |
| G9 | Approval-stat / install-task hover lift | P3 | `WaitingApprovalStats.tsx` + `InstallTaskPipeline.tsx` |

---

## 7. Recommended follow-up waves

The audit suggests three independently shippable waves; each can run in a separate worktree because the file scopes do not overlap.

### Wave 8 — Guide Card coverage (G1)
- **Scope:** 6 step components + a tiny test per step (`__tests__/<Step>.test.tsx` already exists; extend with "renders GuideCardContainer").
- **Risk:** Low. CMS may not have content for some slot keys — that's a content task, not blocking.
- **PR shape:** `feat(target-source-detail): mount GuideCardContainer on every step (wave8)`

### Wave 9 — Table copy-on-hover + ScanPill states (G2, G8)
- **Scope:** new `app/components/ui/CopyButton.tsx` (extracted from PageMeta); apply to 4 tables; extend ScanPill with `new` + `changed`.
- **Risk:** Medium — tests need updating to account for the extra DOM. Run vitest with the `--reporter=verbose` flag during dev.
- **PR shape:** `feat(target-source-detail): copyable mono cells + ScanPill semantic states (wave9)`

### Wave 10 — Typography + background + GCP-fork decision (G3, G4, G5)
- **Scope:** `lib/theme.ts` (new `cardStyles.cardTitle`), 3 step components for token swap, `CloudTargetSourceLayout.tsx` for page bg, `CloudInstallingStep.tsx` for the GCP gate decision.
- **Risk:** Visual regression — must include manual browser checks across all 7 states × 3 providers.
- **PR shape:** `feat(target-source-detail): card-title token + tinted page surface (wave10)`

### Deferred (no wave)
- G6 (tooltip coverage) — content-driven, do per surface when copy is finalized.
- G7 (Tooltip a11y) — track in the Wave 5 follow-up issue.
- G9 (hover lift) — purely decorative; ship when there is no higher-priority work.

---

## 8. Punch list (copy-paste for issue tracker)

- [ ] **P1 / G1** — Mount `GuideCardContainer` in `WaitingApprovalStep`, `ApplyingApprovedStep`, `CloudInstallingStep`, `WaitingConnectionTestStep`, `ConnectionVerifiedStep`, `InstallationCompleteStep`.
- [ ] **P1 / G2** — Extract `CopyButton` from PageMeta; apply to `WaitingApprovalTable`, `ApprovedIntegrationTable`, `ConfirmedIntegrationTable`, `InstallResourceTable`. Group-hover reveals it on the row.
- [ ] **P2 / G3** — Add `cardStyles.cardTitle` (22 / 700 / `-0.01em`); replace `text-lg font-semibold` in `WaitingApprovalCard`, `ConnectionVerifiedStep`, `InstallationCompleteStep`.
- [ ] **P2 / G4** — Apply `bgColors.muted` to the `CloudTargetSourceLayout` main wrapper (or to the root `<body>` in `app/layout.tsx`).
- [ ] **P2 / G5** — Decide on `CloudInstallingStep.tsx:49` GCP exclusion. Either remove the gate or document the GCP-specific reason in a code comment.
- [ ] **P2 / G6** — Add tooltips on (a) status badges in card headers, (b) abbreviated mono cells, (c) `InstallTaskPipeline` task labels.
- [ ] **P2 / G7** — Wire keyboard focus / blur in `Tooltip.tsx`.
- [ ] **P2 / G8** — Extend `ScanPill` with `new` (blue) and `changed` (amber) states.
- [ ] **P3 / G9** — Hover lift on `WaitingApprovalStats` tiles and clickable `InstallTaskPipeline` task tiles.

---

## 9. What this audit did NOT cover

To keep the audit shippable in one pass, the following were intentionally out of scope. Flag if any should be folded in:

- **Screen 1 / 2 / 3 of the prototype** — the audit covers screen-4 (target-source detail) only. The "infrastructure registration" modal (screen-1) and the "approval review" panel (screen-3) live elsewhere in the app and have their own surface story.
- **Mobile / responsive** — prototype is fixed-width 1440 px (per `CLAUDE.md`: desktop only).
- **Dark mode** — prototype is light-only; no dark variants to compare against.
- **Animation polish** — `ProcessBar` motion work (`ProcessBar Motion Prototype.html`) is tracked separately under recent PRs (#458–#460).
- **Per-step copy / Korean wording** — content is owned by the Guide CMS and is not in scope here.

---

## Appendix A — File references

| Component | Path |
|---|---|
| Routing | `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx:22` |
| GCP fork | `app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep.tsx:49` |
| PageMeta copy pattern (reference) | `app/components/ui/PageMeta.tsx` (Wave 1) |
| Tooltip primitive | `app/components/ui/Tooltip.tsx` |
| Guide card pure | `app/components/features/process-status/GuideCard/GuideCardPure.tsx:18-36` |
| Guide slot resolver | `app/components/features/process-status/GuideCard/resolve-step-slot.ts` |
| Design tokens | `lib/theme.ts` (`cardStyles`, `pageMetaStyles`, `bgColors`, `interactiveColors`, `tagStyles`) |
| Prototype | `design/SIT Prototype v7 - standalone.html` |
| Design doc | `DESIGN.md` (root) |
