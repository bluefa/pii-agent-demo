# ADR-014: Toss-flavored Typography & Surface Tokens (Phased Adoption)

## Status

Proposed (2026-05-12)

**Relates to:** Wave 0 of `docs/reports/sit-target-detail-prototype/`.

## Context

The product introduced a new visual reference — `design/SIT Prototype v7 - standalone.html` `screen-4 (04 Infrastructure Detail)`. That mockup uses a Toss-flavored type/surface ramp that differs from `DESIGN.md`'s current declared values:

- `<style>` block at `screen-4` parent declares a full type scale: `--type-display: 28px / --type-h1: 22px / --type-h2: 20px / --type-h3: 18px / --type-body: 15px / --type-body-sm: 14px / --type-caption: 13px / --type-label: 12px / --type-micro: 11px`.
- `body, .ds-body` sets `font-family: 'Geist', -apple-system, ..., 'Pretendard', 'Malgun Gothic', system-ui, sans-serif`, `font-size: 15px`, `letter-spacing: -0.018em`.
- `.page-title`: 30px / 800 / -0.03em / line-height 1.2.
- `.card-header h2`: 26px / 800 / -0.045em / line-height 1.2.
- `.card-header p`: 13.5px / 500 / line-height 1.55.
- `.card-header .eyebrow`: 12px / 700 / 0.02em / color primary.
- `.page-meta .k`: 13px / 500.
- `.page-meta .v`: 15px / 600 / -0.01em.
- `.breadcrumb`: 13px / 500.
- `:root` introduces `--toss-page-bg: #F2F4F6`, `--toss-strong-text: #191F28`, `--toss-medium-text: #4E5968`, `--toss-weak-text: #8B95A1`, `--toss-faint-text: #B0B8C1`.
- Card surface radius is 20px (`--toss-radius-card`), vs `DESIGN.md`'s `rounded.xl: 12px`.

`DESIGN.md` (root, 171 lines) currently declares only four page-chrome typography tokens (`page-title 24px/600/-0.02em`, `page-subtitle 13.5px/400`, `page-breadcrumb 12.5px/400`, `card-title 14px/600/0.05em`), defers body text to "Tailwind's default `text-{xs|sm|base|lg|xl}` scale", and names `fontFamily: system-ui` despite `app/layout.tsx` actually loading Geist via `next/font/google` (the document lies about font family).

Three structural mismatches between current and prototype:

1. **`card-title` role conflict.** Current `cardStyles.title` (`lib/theme.ts:227`) is `'text-sm font-semibold text-gray-500 uppercase tracking-wide'` — a small uppercase eyebrow. The prototype's `.card-header h2` is a large display heading (26px / 800), and the prototype has a separate `.card-header .eyebrow`. The same name encodes two different roles depending on which source you read.

2. **Body base size.** Tailwind's `text-sm` (14px) is the de facto body size in target-source detail pages today. The prototype's body base is 15px. Components built against 14px will visually drift when reset to 15px.

3. **Letter-spacing default.** The prototype applies `letter-spacing: -0.018em` on `body`; current globals do not. Switching globally is a one-line CSS change but affects every page.

PR #292 (TopNav injection) and the wave2 PR set (#274–#291) were the last large visual changes. Both stayed inside Tailwind's default scale. The Toss-flavored prototype is the first design that doesn't fit.

This ADR resolves: which tokens are added, which existing tokens are deprecated, where the surface ramp lives, and how migration is staged.

## Decision

Adopt **Option B — Phased token addition with deprecation aliases.**

### D1. Token shape

Add a Toss-flavored type/surface ramp to `DESIGN.md` frontmatter and a matching `pageChromeStyles.toss` / `cardStyles.tossDisplay` / `pageMetaStyles` set in `lib/theme.ts`. Keep existing tokens. Mark the conflicting names (`page-title`, `card-title`) as deprecated with a migration target.

### D2. fontFamily correction is a sub-decision

`DESIGN.md` declares `fontFamily: system-ui` but `app/layout.tsx:2,7,12` loads `Geist` via `next/font/google`. The token must be corrected to `fontFamily: Geist` (with the system stack fallback `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', system-ui, sans-serif`). This part has no migration cost — the document is currently wrong about reality.

### D3. Stepper-label tokens are excluded

The prototype declares stepper label typography (`.step .label { font-size: 13px; font-weight: 500 / 600 / 700 }` per state). This ADR **excludes** stepper-label tokens. The shipped `ProcessProgressBar` (`app/components/features/process-status/ProcessProgressBar.tsx`) has a wave-front motion engine the team prefers to keep, and adding tokens nobody consumes is design-system dead weight. If the stepper visual is ever revisited, that wave adds the token at the same time.

### D4. Surface tokens scoped to "target-source detail" for the first migration

`--toss-page-bg: #F2F4F6` (gray page background) is **declared** in `DESIGN.md` as `surface-page` but **not applied globally** in this phase. The first consumers (Wave 1 page meta, Wave 4 step split) opt in via the new `pageChromeStyles.toss.background` class. Admin dashboard, guides, and project-create stay white until a separate decision approves cross-app rollout.

### D5. Card radius adds a new value, not a replacement

`rounded.card-display: 20px` is added as a new entry. `rounded.xl: 12px` remains. Consumers that want the Toss display look (Wave 4 / 5 cards) consume the new value; existing cards (admin dashboard, GuideCard warm variant) keep 12px.

### D6. Deprecation policy

The two name conflicts get aliases:

- `card-title` (current 14/600 uppercase) → rename to **`card-eyebrow`**. Add new token `card-display-title` (26/800/-0.045em). The old `card-title` name remains for one wave (Wave 0) with a deprecation note pointing readers to the new names. Consumer migration is a separate wave.
- `page-title` (current 24/600/-0.02em) → keep the name, **update the value** to 30/800/-0.03em. This is a visual change but the role is unchanged (page-level h1), so a rename only adds churn. Document the value change in Wave 0 PR notes.

### Options considered

| Option | Decision | Reason |
|---|---|---|
| A. Aggressive — replace DESIGN.md, migrate all pages | Rejected | Forces simultaneous visual change on admin dashboard, guides, project-create. Each has its own visual review history; bundling them is high blast-radius. |
| B. Phased — add Toss tokens, deprecate conflicts, migrate detail page first | **Chosen** | New tokens land in one PR (Wave 0). Detail page adopts them next. Other surfaces opt in when their own redesign comes up. |
| C. Detail-only — namespace `target-source-detail-*` tokens | Rejected | Creates a parallel design system. Violates the "DESIGN.md is single source of truth" rule (`DESIGN.md` paragraph 3). Tokens cannot be reused. |
| D. Minimal — fix fontFamily lie + page-title size only | Rejected | Every subsequent wave needs its own DESIGN.md update PR. Multiplies review cycles and creates a moving target. |

## Architectural Rules

### R1 — DESIGN.md is single source

Token additions land in `DESIGN.md` frontmatter first, `lib/theme.ts` second, consumer files third. A consumer that needs a value not declared in `DESIGN.md` blocks on Wave 0, not the other way around. Existing `CLAUDE.md` ⛔#4 enforces this.

### R2 — Toss surface tokens are opt-in

`surface-page: #F2F4F6`, `text-strong-toss: #191F28`, and `rounded.card-display: 20px` are declared but **not applied to global selectors** (`body`, `html`, etc.). Consumers opt in via Tailwind class strings exposed in `lib/theme.ts`. Global background flip is a separate decision.

### R3 — Stepper component is frozen

The four files in `app/components/features/process-status/ProcessProgressBar.tsx`, `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`, and `motion/**` are not edited by any wave in this set. Wave 0 deliberately omits stepper-label typography tokens; any future stepper change is a new ADR.

### R4 — Deprecation aliases survive one wave

`card-title` (old name) is kept in `DESIGN.md` for Wave 0 only. In Wave 1's consumer migration (or a follow-up PR — recorded in Wave 0's "Deferred" list), the old name is removed from `DESIGN.md` and `lib/theme.ts` along with the rename of any remaining consumers. No silent re-export.

### R5 — Body size change is class-string only, never `html`/`body` CSS

`globals.css`'s `body { font-family: ... }` block stays unchanged. The 15px body base is applied where it ships (page meta value, card body paragraph) via the new tokens. Changing `body { font-size: 15px }` globally would shift admin dashboard, guides, and project-create unintentionally and is out of scope.

## Token Inventory (Wave 0 implementation contract)

This is the exact set Wave 0 must add. Anything outside this list is out of scope.

### `DESIGN.md` frontmatter additions

```yaml
typography:
  # Existing — values updated per D6
  page-title:
    fontFamily: Geist                # was: system-ui
    fontSize: 30px                   # was: 24px
    fontWeight: 800                  # was: 600
    letterSpacing: -0.03em           # was: -0.02em
    lineHeight: 1.2

  # Existing — fontFamily corrected only
  page-subtitle:
    fontFamily: Geist                # was: system-ui
    fontSize: 13.5px
    fontWeight: 400

  page-breadcrumb:
    fontFamily: Geist                # was: system-ui
    fontSize: 13px                   # was: 12.5px
    fontWeight: 500                  # was: 400

  # Deprecated alias — see R4
  card-title:
    deprecated: true
    migrate-to: card-eyebrow
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 600
    letterSpacing: 0.05em

  # New
  card-eyebrow:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 700
    letterSpacing: 0.02em
    role: small uppercase header above a card display title

  card-display-title:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: 800
    letterSpacing: -0.045em
    lineHeight: 1.2

  card-subtitle:
    fontFamily: Geist
    fontSize: 13.5px
    fontWeight: 500
    lineHeight: 1.55
    color: text-tertiary

  page-meta-key:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    color: text-tertiary

  page-meta-value:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 600
    letterSpacing: -0.01em
    color: text-primary

  # Type scale — declared globally, consumed where appropriate
  type-display:    28px   # Dashboard hero h1 (already used in admin dashboard)
  type-h1:         22px   # KPI big numbers
  type-h2:         20px
  type-h3:         18px
  type-body:       15px   # Toss base; consumed by page-meta-value, card body p
  type-body-sm:    14px   # default Tailwind text-sm, used by tables
  type-caption:    13px
  type-label:      12px
  type-micro:      11px
```

### `colors` additions

```yaml
colors:
  surface-page:        "#F2F4F6"   # opt-in Toss page background, see R2
  text-strong-toss:    "#191F28"   # opt-in stronger black for display headers
  text-medium-toss:    "#4E5968"
  text-weak-toss:      "#8B95A1"
  text-faint-toss:     "#B0B8C1"
```

### `rounded` additions

```yaml
rounded:
  card-display: 20px   # Toss display card; xl (12px) stays for regular cards
```

### `lib/theme.ts` additions

```typescript
export const pageChromeStyles = {
  // Existing — values updated to match DESIGN.md page-title 30/800
  breadcrumb: 'text-[13px] text-gray-500 px-6 pt-5 font-medium',
  title: 'text-[30px] font-extrabold tracking-[-0.03em] text-gray-900 px-6 mt-1 leading-[1.2]',
  subtitle: 'text-[13.5px] text-gray-500 px-6 mt-1 mb-5',
} as const;

export const cardStyles = {
  // ... existing entries ...
  /** Deprecated — use cardEyebrow instead. Kept for one wave. */
  title: 'text-sm font-semibold text-gray-500 uppercase tracking-wide',
  /** New — small uppercase header above a display title */
  eyebrow: 'text-[12px] font-bold text-[#0064FF] tracking-[0.02em]',
  /** New — large display heading inside card-header */
  displayTitle: 'text-[26px] font-extrabold text-gray-900 tracking-[-0.045em] leading-[1.2]',
  /** New — paragraph beneath a display title */
  subtitle: 'text-[13.5px] font-medium text-gray-500 leading-[1.55]',
  // ... rest unchanged ...
} as const;

export const pageMetaStyles = {
  container: 'flex flex-wrap gap-9',
  item: 'flex flex-col gap-1',
  key: 'text-[13px] font-medium text-gray-500',
  value: 'text-[15px] font-semibold tracking-[-0.01em] text-gray-900',
  mono: 'font-mono',
} as const;
```

### Files NOT touched by Wave 0

- `app/globals.css` body block (R5).
- `app/components/features/process-status/ProcessProgressBar.tsx` (R3).
- `app/components/features/process-status/InstallationProcessProgressBar.tsx` (R3).
- `app/components/features/process-status/StepProgressBar.tsx` (R3).
- `app/components/features/process-status/motion/**` (R3).
- Any consumer file (`app/integration/**/*.tsx`) — consumer migration is Wave 1+.

## Consequences

### Positive

- Single source of truth for the Toss ramp lands in one PR.
- Consumer waves cite specific token names; visual review focuses on layout and motion, not on raw hex/px sizes.
- The fontFamily lie is repaired.
- Stepper motion stays untouched.

### Negative

- `card-title` (old uppercase eyebrow style) and `card-eyebrow` coexist for one wave. Reviewers must read R4 and the deprecation note in `DESIGN.md` to know which to use.
- `surface-page` is declared but unused until a consumer adopts it. Risk of an orphan token if the rollout stalls. Mitigated by Wave 1 being the first consumer.
- Two card radii (12px `xl`, 20px `card-display`) exist. Mixing them on the same page would look inconsistent; specs in this set route consumers explicitly.

### Migration triggers

The following waves trigger consumer adoption of these tokens:

- Wave 1 → `pageChromeStyles.title` (new 30/800), `pageMetaStyles.*`, `cardStyles.subtitle`.
- Wave 4 → `cardStyles.displayTitle` and `cardStyles.subtitle` on Step 5/6/7 card headers.
- Wave 5 → same as Wave 4 plus `rounded.card-display` on the Step 7 card.
- Wave 7 → `cardStyles.eyebrow` on Step 3/4 card headers (the small uppercase label above the display title).

When all named consumers have migrated, a cleanup wave (not in this set) removes the deprecated `cardStyles.title` and the `card-title` deprecation alias in `DESIGN.md`.

## Verification

The Wave 0 PR is correct when:

- `DESIGN.md` frontmatter parses (no YAML syntax error).
- `lib/theme.ts` compiles (`npx tsc --noEmit` exits 0).
- `lib/theme.ts` exports `pageMetaStyles` and the new `cardStyles.eyebrow`, `cardStyles.displayTitle`, `cardStyles.subtitle` keys.
- `app/components/features/process-status/ProcessProgressBar.tsx` and the three other R3 files are byte-for-byte unchanged from `origin/main`.
- `app/globals.css` `body { ... }` block is byte-for-byte unchanged from `origin/main`.
- No consumer file in `app/**` is modified.
- `card-title` retains its old class string in `lib/theme.ts` (deprecation alias, not deletion).

## Open issues

- **O1 — Body size cross-app rollout.** The new 15px body base ships only inside `pageMetaStyles.value`. Whether to globally flip Tailwind's default `text-sm` → 15px is deferred. Trigger to revisit: visual inconsistency reports from users comparing detail page to admin dashboard.
- **O2 — Surface-page (gray bg) cross-app rollout.** Same trigger as O1. Cross-app adoption is its own ADR.
- **O3 — Stepper visual revisit.** If the team later decides to align stepper labels to the Toss type ramp, that wave adds `stepper-label` tokens and edits the motion engine in a single PR. This ADR is the historical record of why those tokens were not added preemptively.
