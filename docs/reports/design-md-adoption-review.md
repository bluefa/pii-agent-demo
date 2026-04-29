# DESIGN.md Adoption Plan

> **Goal**: Adopt the [`google-labs-code/design.md`](https://github.com/google-labs-code/design.md) format (`@google/design.md@0.1.1`, alpha) as the canonical visual-identity source for this repository, and route all frontend skills + hooks through it.
> **Status**: Approved decisions D1–D10 (2026-04-28 review thread). Codex cross-review v1 produced 4 Critical / 5 Major / 1 Minor; this v2 incorporates all confirmed corrections.
> **Audience**: Engineering team + Claude/Codex agents reading this repo.
> **Authoring date**: 2026-04-28
> **Spec version pinned**: `@google/design.md@0.1.1`

---

## 0. TL;DR

- The token surface is already centralised at `lib/theme.ts` (428 LOC) + `app/globals.css` (218 LOC). Two skills (`frontend-design`, `coding-standards`) plus the hard rule in `CLAUDE.md` ⛔ #4 declare raw-class bans, and the real-time `post-edit-grep.sh` hook enforces them at edit time. The `anti-patterns` skill covers a different surface (icons/assets in category H, plus 7 other categories) and does not currently include a colour-class rule.
- Yet the system fails the DESIGN.md spec contract: tokens are stored as completed Tailwind class strings (`'bg-[#0064FF]'`), not as machine-readable hex values; there is no typography scale, no canonical Elevation/Shapes section, and no "why" prose. The design rules currently live in four places that drift independently — `lib/theme.ts` (token values), `app/globals.css` (CSS variables), the `frontend-design` and `coding-standards` skills (token-usage rules), and `CLAUDE.md` ⛔ #4 (the hard rule). The `anti-patterns` catalogue is a separate surface (icons/assets etc.) and is not a design-rule source.
- The approved plan introduces `/DESIGN.md` at repo root as the **single source of truth**. theme.ts and `app/globals.css` become its derived runtime expressions; eventually generated, manually mirrored until the generator lands.
- Phase 0 (1 week) ships a lint-clean DESIGN.md plus a rewritten `frontend-design` skill that defers all aesthetic decisions to DESIGN.md. Phase 1 wires the harness (hooks + CI). Phase 2a migrates the 396 raw-class violations. Phase 2b introduces the generator and rewrites the runtime token layer once stable. Phase 3 covers dark-mode and Figma round-trip and is intentionally deferred until the spec exits alpha.
- The `.codex/skills/` mirror is currently broken (8 SKILL directories missing, sync hooks commented out). Re-enabling sync is a Phase 0 prerequisite, not an aside.

---

## 1. DESIGN.md spec summary (what we are adopting)

### 1.1 File structure

```
---  ← YAML front matter (machine-readable tokens)
name: <string>
colors:        { <name>: "#hex" }
typography:    { <name>: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, fontFeature, fontVariation } }
rounded:       { <scale>: <Dimension> }
spacing:       { <scale>: <Dimension> }
components:
  <name>:
    backgroundColor: "{colors.tertiary}"   ← token reference
    textColor:       "{colors.on-tertiary}"
    rounded:         "{rounded.sm}"
    padding:         12px
---

## Overview          ← brand & tone prose
## Colors            ← rationale per palette role
## Typography
## Layout
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
```

### 1.2 Token contract

| Type | Format | Example |
|------|--------|---------|
| Color | `#` + 6-digit hex (sRGB) | `"#0064FF"` |
| Dimension | number + unit (`px`, `em`, `rem`) | `24px`, `-0.02em` |
| Token Reference | `{path.to.token}` | `{colors.primary}` |
| Typography | object with `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `fontFeature`, `fontVariation` | per spec |

Component property allow-list: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. Variants (hover/active/pressed) are separate component entries with related names (`button-primary` + `button-primary-hover`).

### 1.3 Lint rules (8 total)

| Rule | Severity | Detects |
|------|----------|---------|
| `broken-ref` | error | `{token.path}` reference that does not resolve |
| `missing-primary` | warning | `colors` defined but no `primary` |
| `contrast-ratio` | warning | Component `backgroundColor`/`textColor` pair below WCAG AA (4.5:1) |
| `orphaned-tokens` | warning | Color token defined but never referenced |
| `token-summary` | info | Token counts per section |
| `missing-sections` | info | Optional sections (`spacing`, `rounded`) absent when other tokens exist |
| `missing-typography` | warning | Colors defined but no typography tokens |
| `section-order` | warning | Sections out of canonical order |

(v1 of this doc listed 7; `missing-typography` was missing — corrected.)

### 1.4 CLI commands

```bash
npm install --save-dev @google/design.md@0.1.1   # pin exact alpha (D6)

npx @google/design.md lint DESIGN.md             # → exit 1 on errors
npx @google/design.md diff before.md after.md    # → exit 1 on regressions
npx @google/design.md export --format tailwind DESIGN.md > tailwind.theme.json
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
npx @google/design.md spec                       # → format spec for agent prompts
```

Tailwind export emits a Tailwind theme JSON, not class strings — see §3.6 for why this is relevant to our runtime layer.

---

## 2. Current state — verified inventory

All file paths, line counts, and violation counts in this section are re-verified at the doc's authoring date.

### 2.1 Asset inventory

All line counts and file counts in this table were re-verified at the doc's authoring date with `wc -l` and `find … -name '*.tsx' | wc -l`.

| Layer | Path | Size | Role |
|-------|------|------|------|
| Token source (TS) | `lib/theme.ts` | 428 LOC | Tailwind class-string tokens; helpers `cn`, `getButtonClass`, `getInputClass` |
| Token source (CSS) | `app/globals.css` | 218 LOC | CSS variables (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`); dark-mode partial |
| Prototype CSS (out-of-scope) | `design/app/globals.css` | 116 LOC | Design prototype tree; **`design/**` is ignored by ESLint** (`eslint.config.mjs`) — not part of the runtime |
| UI components | `app/components/ui/**/*.tsx` | 37 files (recursive) | Button, Card, Badge, Modal, Table, LoadingSpinner, Tooltip, plus `icons/`, `HistoryTable/`, `toast/` subtrees; consume theme.ts tokens |
| Feature components | `app/components/features/**/*.tsx` | 107 files | Domain UI (process-status, resource-table, admin, queue-board, …) |
| Skill (design) | `.claude/skills/frontend-design/SKILL.md` | 82 LOC | Design thinking + token enforcement (mixes generic creative guidance with project-specific rules; D5 = full rewrite) |
| Skill (rules) | `.claude/skills/coding-standards/SKILL.md` | 178 LOC | §5 token enforcement |
| Skill (catalogue) | `.claude/skills/anti-patterns/SKILL.md` | index | 47 patterns across 8 categories. Category H today is "UI Composition (Icons/Assets)" with 3 patterns; it does **not** currently reference DESIGN.md and is not modified by this plan |
| Designer agent | `.claude/agents/designer.md` | 114 LOC | Inherits `frontend-design` + `coding-standards` skills |
| Reviewer agent | `.claude/agents/tailwind-style.md` | — | Lightweight grep-based color enforcement; this plan does not modify it |
| Hook (Edit/Write) | `.claude/hooks/post-edit-grep.sh` | 64 LOC | Detects raw `bg-{color}-{n}` patterns; warns to stderr (does **not** block) |
| Hook (language) | `.claude/hooks/post-edit-language.sh` | — | English-only paths enforcement |
| Pre-commit hook | `.githooks/pre-commit` | 28 LOC | **Early-returns when no `.ts/.tsx/.js/.jsx/.mjs` is staged** — Markdown-only commits skip lint/tsc/test/build entirely (relevant for DESIGN.md commits, see §3.4) |
| Post-* sync hooks | `.githooks/post-{commit,checkout,merge}` | each 9 LOC | Each contains the line `bash scripts/sync-claude-skills-to-codex.sh` **commented out**. Sync script `scripts/sync-claude-skills-to-codex.sh` exists and is functional, but is not invoked. The script copies child directories under `.claude/skills/` that contain a `SKILL.md`; it does **not** copy `.claude/skills/README.md`, `.claude/skills/shared/` (which has no `SKILL.md`), or any other top-level files. |
| Hard rule | `CLAUDE.md` ⛔ #4 | top-of-file rules section | Raw color-class ban (current text) |
| ESLint | `eslint.config.mjs` | 78 LOC | Path-based import boundaries (CSR vs route handlers); no design-token rules |

### 2.2 What is genuinely working

1. **Token centralisation in TS**: every status, provider, surface, and component style is an exported constant in `lib/theme.ts`.
2. **Real-time enforcement**: `post-edit-grep.sh` flags raw `(bg|text|border|ring|divide|from|to|via|shadow)-(red|blue|…)-N` immediately on Edit/Write, surfacing to stderr.
3. **Multi-layer guardrails**: skills (natural-language) + agent front-matter + grep hook + CLAUDE.md hard rule. A bypass at one layer is usually caught at another.
4. **Helper-driven authoring pattern**: `cn(...)`, `getButtonClass(variant, size)`, `getInputClass(state)` — no dynamic class concatenation by callers.

### 2.3 Gaps versus the DESIGN.md spec

#### A. Token format incompatibility

```ts
// today (theme.ts)
export const primaryColors = {
  bg: 'bg-[#0064FF]',
  bgHover: 'hover:bg-[#0050D6]',
  text: 'text-[#0064FF]',
  ...
} as const;
```

```yaml
# DESIGN.md spec
colors:
  primary:        "#0064FF"
  primary-hover:  "#0050D6"
```

**Consequence**: `npx @google/design.md lint` cannot validate these strings, `diff` cannot detect token-level changes, `export tailwind` cannot regenerate them. We are decoupled from the entire CLI.

#### B. No typography scale

Today's typography lives only in `pageChromeStyles` and ad-hoc utility classes:
```ts
breadcrumb: 'text-[12.5px] text-gray-500 px-6 pt-5',
title:      'text-[24px] font-semibold tracking-[-0.02em] text-gray-900 px-6 mt-1',
subtitle:   'text-[13.5px] text-gray-500 px-6 mt-1 mb-5',
```
Body text uses Tailwind defaults (`text-{xs|sm|base|lg|xl}`) at 528 occurrences across `app/`. There is no canonical `h1`/`body-md`/`label-caps` scale. `globals.css` line 90 sets the body font to `Arial, Helvetica, sans-serif` — directly contradicting the (now-being-rewritten) `frontend-design` skill's "avoid Arial/Inter" guidance.

#### C. No "why" prose

`lib/theme.ts` documents *how* tokens are applied but never *why* they exist. A new component author cannot answer "what is the secondary accent on this product?" from the code alone.

#### D. Component tokens duplicate raw hex

`#0064FF` appears literally 13 times in `theme.ts`, `#45CB85` 8 times, `#FF9900` 5 times, `#0078D4` 5 times. No `{colors.primary}`-style references. Renaming the brand requires a multi-line grep-and-replace.

#### E. Elevation and Shapes scales are ad-hoc

`shadows` has 4 entries (card / modal / button / pill); `borderRadius` has 4 (card / button / badge / input). No documented relationship or rationale; nothing prevents someone from adding a 5th.

#### F. WCAG validation is not in any tool

Spot-check using the standard sRGB relative-luminance formula (verified against Codex's recomputation):

| Foreground | Background | Ratio | WCAG AA (≥4.5:1) |
|------------|------------|-------|------------------|
| `#0064FF` (primary) | white | 4.92:1 | pass |
| `#0078D4` (Azure) | white | 4.53:1 | pass (just) |
| `#2A7D52` (success-dark) | white | 5.06:1 | pass |
| `#45CB85` (success) | white | **2.07:1** | **fail** |

Conclusion: only `statusColors.success.text` is materially below AA for body text. Everything else is at or above the line. This is a one-line guidance issue, not a blocker — see §3.1 principle 5, decision D9, and the Do's and Don'ts in §7.5 for the agreed handling.

#### G. Codex skills mirror is broken

| Source | Mirror | Sync mechanism |
|--------|--------|----------------|
| `.claude/skills/` (21 child dirs, of which **19** carry a `SKILL.md`; the other two are `shared/` and a `vercel-react-best-practices` symlink that points outside the repo) | `.codex/skills/` (12 child dirs, of which **11** carry a `SKILL.md`) | `scripts/sync-claude-skills-to-codex.sh` (functional) invoked by `.githooks/post-{commit,checkout,merge}` (**all three commented out**) |

The sync script copies only child directories that contain a `SKILL.md`; it skips `shared/` and never copies `.claude/skills/README.md` or any other top-level files. The mirror contract is therefore: every `.claude/skills/<name>/SKILL.md` has a sibling `.codex/skills/<name>/SKILL.md`.

**Missing in mirror (8)**: `anti-patterns/`, `codex-review/`, `mock-dev-server/`, `pre-commit-check/`, `sit-recurring-checks/`, `ux-audit/`, `ux-requirements/`, `wave-task/`.

The reason the sync hooks were commented out is unrecorded in git log within recent history of those files — a Phase 0 task is to either restore the comment as a brief explanation or re-enable the sync (decision D7 = re-enable).

#### H. Counted violations of the existing token rule

| Pattern | Matching lines | Occurrences | Top offender file (occurrences) |
|---------|----------------|-------------|---------------------------------|
| Raw Tailwind colour class `(text\|bg\|border\|…)-{name}-{N}` outside `lib/theme.ts` and `DatabaseIcon.tsx` | **396** | **504** (across 69 files) | `VmDatabaseConfigPanel.tsx` (52) |
| Arbitrary hex `(text\|bg\|…)-[#…]` outside `lib/theme.ts` | **13** | **16** (across 5 files) | `VmDatabaseConfigPanel.tsx` (7), `CloudProviderIcon.tsx` (6) |

Top 10 hot-spot files by occurrences:

| File | Occurrences |
|------|-------------|
| `app/integration/target-sources/[targetSourceId]/_components/candidate/VmDatabaseConfigPanel.tsx` | 52 |
| `app/components/features/process-status/aws/AwsInstallationInline.tsx` | 49 |
| `app/components/features/ConnectionDetailModal.tsx` | 26 |
| `app/components/features/process-status/aws/AwsInstallationModeSelector.tsx` | 23 |
| `app/components/features/process-status/aws/TfRoleGuideModal.tsx` | 21 |
| `app/components/features/process-status/aws/TfScriptGuideModal.tsx` | 20 |
| `app/components/features/process-status/ApprovalModals.tsx` | 20 |
| `app/components/features/process-status/ProcessGuideStepCard.tsx` | 18 |
| `app/components/features/process-status/azure/AzureSubnetGuide.tsx` | 18 |
| `app/components/features/process-status/azure/AzurePeApprovalGuide.tsx` | 12 |

These 10 files contain 259 of 504 occurrences (51%). They are the rational target of Phase 2a.

#### I. Hook coverage is incomplete

`post-edit-grep.sh` detects `(text|bg|…)-{name}-{N}` patterns but **does not** detect `(text|bg|…)-[#…]` arbitrary hex. It also does not check for theme.ts↔DESIGN.md drift (DESIGN.md does not yet exist).

---

## 3. Adoption plan — phases

### 3.1 Operating principles

1. **Dual source first; merge later.** DESIGN.md is authored by hand alongside theme.ts in Phase 0/1/2a. The generator (Phase 2b) only lands once the spec, the token shape, and the component coverage are stable. The repo never carries an unbuildable single source.
2. **Harness only adds, never weakens.** The existing `post-edit-grep.sh` and skills stay enabled. New checks layer on top and have additive failure modes.
3. **Each phase has a binary gate.** Not "DESIGN.md drafted" but "`npm run design:lint` exits 0 on the committed file".
4. **Migration metric is line-based** (D8): the count printed by the existing grep recipe is the burn-down number. Occurrence count is reported alongside but is not the gate.
5. **WCAG handling is descoped from Phase 0/1** (D9). The single confirmed AA failure (`statusColors.success.text` on white = 2.07:1) becomes a one-line rule in `Do's and Don'ts`. A formal accessibility audit is a separate future ADR.

### 3.2 Phase summary

| Phase | Duration | Definition of done |
|-------|----------|---------------------|
| **0 — Foundation** | 1 week | DESIGN.md exists and lints clean; sync mirror restored; dependency pinned; rewritten `frontend-design` skill merged. |
| **1 — Harness** | 1–2 weeks | hooks emit DESIGN.md awareness; pre-commit + CI design-check gate runs even on Markdown-only commits. |
| **2a — Migration** | 4–8 weeks | 396 → 0 raw colour-class lines; 13 → 0 arbitrary-hex matching lines (per D4 there is no exception list — provider colours are absorbed as `colors.provider-*` tokens and consumed via `theme.ts`). theme.ts left structurally untouched. |
| **2b — Generator** | parallel start, lands after 2a | DESIGN.md → `lib/theme.tokens.ts` and `app/globals.css` are emitted by a script. theme.ts becomes a thin Tailwind-class wrapper over the generated layer. |
| **3 — Future** | spec ≥ v1.0 | dark-mode tokens, Figma round-trip via DTCG, multi-product theming. **Deferred** until `@google/design.md` is no longer alpha. |

Phase dependencies: 0 → 1 → 2a → 2b → 3. 2a does **not** modify theme.ts shape, so it cannot block 2b. 2b does not require 2a to finish, but landing 2b before 2a is hostile to reviewers (massive theme.ts churn meets ongoing migration). Recommended sequencing: complete 0 + 1, run 2a in parallel with 2b prep, ship 2b once 2a is past 50%.

### 3.3 Phase 0 — Foundation (1 week)

| # | Task | Owner | Gate |
|---|------|-------|------|
| 0-1 | Author `DESIGN.md` at repo root (token inventory in §7) | dev + Claude | `npx @google/design.md lint DESIGN.md` exit 0 |
| 0-2 | Add `@google/design.md@0.1.1` as devDependency; add `design:lint` script (script bodies in §3.4 task 1-2) | dev | `npm run design:lint` exit 0 |
| 0-3 | Restore `.codex/skills/` mirror: uncomment `bash scripts/sync-claude-skills-to-codex.sh` in all three `.githooks/post-*` hooks; run the script once; commit **all** resulting changes under `.codex/skills/` (the script uses `rsync -a --delete`, so existing mirror directories also receive content updates, not only the 8 brand-new directories). After the same PR upgrades `design:check` to call `check-design-mirror.sh`. The sync script copies only child directories with a `SKILL.md`, so `.claude/skills/shared/`, `.claude/skills/README.md`, and the symlinked `vercel-react-best-practices/` are intentionally **not** mirrored; the mirror contract is "every `.claude/skills/<name>/SKILL.md` has a sibling `.codex/skills/<name>/SKILL.md` whose contents match byte-for-byte after the next sync run". | dev | `bash scripts/sync-claude-skills-to-codex.sh && git diff --exit-code -- .codex/skills` exits 0 (i.e., a fresh sync produces no further diff) |
| 0-4 | Rewrite `frontend-design` skill (D5/B2) — replace generic aesthetic guidance with a 4-step routing skill anchored on DESIGN.md (§3.7) | dev + Claude | New skill ≤ 50 LOC (the §3.7 reference body is 44 lines including front matter and headings); existing project-specific token rules preserved; agent definitions still load |
| 0-5 | Update `CLAUDE.md` ⛔ #4 to declare DESIGN.md as the canonical source | dev | Single-line text change |
| 0-6 | Update `designer.md` agent so DESIGN.md is the first required Read | dev | Skill front matter reflects new order |

Phase 0 introduces no new tokens beyond those in §7. Token references in §7's `components` section only reference colors that are defined in §7's `colors` block (e.g., we omit `{colors.success-light}` because we are not defining `success-light` in Phase 0 — `badge-success` is therefore omitted from Phase 0 components and added in Phase 2a once `success-light` is computed and reviewed).

### 3.4 Phase 1 — Harness (1–2 weeks)

#### 1-1. Extend `post-edit-grep.sh`

Add three new checks, all stderr-only (consistent with current behaviour):

```bash
# (a) Arbitrary hex outside theme.ts — matches text-[#…]/bg-[#…] etc.
case "$file" in
  *.tsx)
    if [[ "$file" != *"/lib/theme.ts" ]] \
       && /usr/bin/grep -nE '(text|bg|border|ring|from|to|via|shadow|fill|stroke)-\[#[0-9A-Fa-f]{3,8}\]' "$file" >/dev/null 2>&1; then
      hits="$(/usr/bin/grep -nE '(text|bg|border|ring|from|to|via|shadow|fill|stroke)-\[#[0-9A-Fa-f]{3,8}\]' "$file" | head -3)"
      warnings+=$'\n[DESIGN] arbitrary hex outside theme.ts — declare it as a DESIGN.md token first:\n'"$hits"
    fi
    ;;
esac

# (b) theme.ts modified without DESIGN.md modified in the same change set
case "$file" in
  lib/theme.ts|*/lib/theme.ts)
    if ! /usr/bin/git status --porcelain DESIGN.md 2>/dev/null | /usr/bin/grep -q .; then
      warnings+=$'\n[DESIGN] theme.ts touched while DESIGN.md is unchanged — confirm tokens are sourced from DESIGN.md.'
    fi
    ;;
esac

# (c) DESIGN.md edited — surface the linter inline (best-effort; does not error)
case "$file" in
  DESIGN.md|*/DESIGN.md)
    if /usr/bin/command -v npx >/dev/null 2>&1 && [ -f "node_modules/@google/design.md/package.json" ]; then
      lint_out="$(/usr/bin/npx --no-install @google/design.md lint "$file" 2>&1 | /usr/bin/head -10 || true)"
      if [ -n "$lint_out" ]; then
        warnings+=$'\n[DESIGN] design.md lint output:\n'"$lint_out"
      fi
    fi
    ;;
esac
```

Note 1: the arbitrary-hex check (a) is enabled **after** Phase 2a starts, not in 1-1, to avoid a 13-line warning storm during Phase 0/1. Until then, this clause is added but commented with `# enable after Phase 2a > 50%`.

Note 2: clause (c) uses `--no-install` and additionally checks that `node_modules/@google/design.md/package.json` exists. If the dependency was not installed (e.g., a fresh clone before `npm install`), the linter is skipped silently rather than failing the hook.

#### 1-2. Add a `design:check` script that does **not** depend on staged code files

The current `.githooks/pre-commit` exits at line 14 when no `.ts/.tsx/.js/.jsx/.mjs` is staged. A DESIGN.md-only commit therefore skips lint/tsc/test/build, including any `npm run design:lint`. Two-part fix:

```jsonc
// package.json — initial form shipped by PR-2
{
  "scripts": {
    "design:lint":  "npx @google/design.md lint DESIGN.md",
    "design:check": "npx @google/design.md lint DESIGN.md"
  }
}

// PR-3, after the .codex/skills/ mirror is restored, upgrades design:check:
// "design:check": "npx @google/design.md lint DESIGN.md && bash scripts/check-design-mirror.sh"
```

PR-2's `design:check` is intentionally lint-only because the mirror is currently dirty (8 SKILL dirs missing). Wiring `check-design-mirror.sh` into `design:check` before PR-3 restores the mirror would put the gate in a perpetually-failing state. PR-3 restores the mirror and atomically upgrades `design:check` to include the mirror assertion.

```bash
# .githooks/pre-commit — additions BEFORE the existing early-return block
design_relevant=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep -cE '^(DESIGN\.md|lib/theme\.ts|app/globals\.css|\.claude/skills/|\.codex/skills/)' \
  || true)

if [[ "$design_relevant" -gt 0 ]]; then
  echo "[pre-commit] Running design:check..."
  npm run design:check
fi
```

`scripts/check-design-mirror.sh` re-runs `sync-claude-skills-to-codex.sh` in `--dry-run` (or simply runs it and `git diff --quiet .codex/skills/`) and exits non-zero if the mirror is dirty.

#### 1-3. Add CI required check

The repo currently has no `.github/workflows/`. Add one minimal job:

```yaml
# .github/workflows/design-check.yml
name: design-check
on: [pull_request]
jobs:
  design-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run design:check
```

Make `design-check` a required check in branch protection. Without this, the pre-commit hook is bypassable via `--no-verify`.

### 3.5 Phase 2a — Literal-class migration (4–8 weeks)

**Scope**: drive the verified count of `(text|bg|border|ring|divide|from|to|via|shadow)-{name}-{N}` matching lines in `app/` + `lib/` (excluding `lib/theme.ts` and `app/components/ui/DatabaseIcon.tsx`) from **396 to 0**, while leaving theme.ts shape unchanged. Also drive the 13 arbitrary-hex matching lines outside `lib/theme.ts` to 0; per D4 there is no exception list — provider colours and the brand-gradient end-stop are absorbed as DESIGN.md tokens, so callers must reference them through the `theme.ts` exports (e.g., `providerColors.AWS.bg`) rather than inlining `bg-[#FF9900]`.

**Tracking metric (D8 = A)**: a single number, produced by:

```bash
grep -rEn "(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+" \
  app lib 2>/dev/null \
  | grep -v "lib/theme.ts" \
  | grep -v "DatabaseIcon" \
  | wc -l
```

Burn-down checkpoints (linear, ~50 lines/week → 8 weeks):

| Week | Target | Cumulative removed |
|------|--------|--------------------|
| W1 | 350 | 46 |
| W2 | 300 | 96 |
| W3 | 240 | 156 |
| W4 | 180 | 216 |
| W5 | 130 | 266 |
| W6 | 80 | 316 |
| W7 | 40 | 356 |
| W8 | 0 | 396 |

**Sequencing (file-cluster order)**:

1. W1–W2: `VmDatabaseConfigPanel.tsx` (52 occurrences). This file already carries `// TODO: focus:border-[#0064FF] — no focus:border token in theme.ts` markers — the right move is to add the missing input tokens to theme.ts (e.g., `inputStyles.focused`, `inputStyles.warning`) first, then sweep the file.
2. W3–W4: `AwsInstallationInline.tsx` (49) + `ConnectionDetailModal.tsx` (26).
3. W5: `AwsInstallationModeSelector.tsx` (23) + `TfRoleGuideModal.tsx` (21) + `TfScriptGuideModal.tsx` (20).
4. W6: `ApprovalModals.tsx` (20) + `ProcessGuideStepCard.tsx` (18) + Azure guides (18 + 12).
5. W7–W8: long tail (~245 occurrences across ~59 remaining files; 69 raw-class offender files exist today, the top 10 listed in §2.3.H account for the rest) via `wave-task` skill, 5–10 occurrences per PR.

**Tooling**: each PR runs the grep recipe before and after the change; the delta is included in the PR description as a single "−N raw-class lines" line. The pre-commit hook surfaces violations; CI enforces the design-check gate (which now includes the violation ratchet — see below).

**Baseline ratchet (lands as part of Phase 1, before Phase 2a starts)**: `scripts/check-design-violations.sh` reads a baseline number from `.design-violations-baseline` (initialized to 396 raw-class lines + 13 arbitrary-hex lines = 409) and runs the grep recipe; CI fails if the current count exceeds the baseline. Each migration PR lowers the baseline by the delta it removes. Once both counts reach zero, the baseline file is deleted and the script asserts `count == 0` directly, which becomes the permanent regression gate. The script ships in PR-9 (Phase 1), not PR-G3 — Phase 2a's binding "0 raw-class lines" goal is enforceable from PR-1 of the migration onward.

**Out of scope for 2a**: token rewrites in theme.ts. The file remains structurally identical. If a hot-spot file requires a new token (as `VmDatabaseConfigPanel.tsx` does for input states), the new token is added to theme.ts in the same PR, but the surrounding `lib/theme.ts` shape (objects of class-string properties) is untouched.

### 3.6 Phase 2b — Generator (parallel with 2a, lands later)

**Goal**: produce `lib/theme.tokens.ts` (raw hex constants) and `app/globals.css` (CSS variables) deterministically from `DESIGN.md`, then refactor `lib/theme.ts` to consume `theme.tokens.ts` instead of inlining hex.

**Why this must lag, not lead**: Tailwind's JIT cannot statically extract dynamic class strings. Patterns like `` `bg-[${tokens.colors.primary}]` `` would compile but render no styles. Either (a) the generator emits **already-resolved** Tailwind class strings (`'bg-[#0064FF]'`) into `lib/theme.ts` directly — preserving the current shape — or (b) we abandon arbitrary-hex Tailwind classes and run a Tailwind theme `extend` derived from `npx @google/design.md export --format tailwind`. Decision is deferred until Phase 2b kicks off; the working assumption is (a) because (b) requires a Tailwind config restructure that is out of scope for this plan.

**Steps**:

1. `scripts/gen-design-tokens.ts` reads `DESIGN.md`, asserts lint-clean via the programmatic API (`import { lint } from '@google/design.md/linter'`), and emits:
   - `lib/theme.tokens.ts` — `export const tokens = { colors: { primary: '#0064FF', … } } as const;`
   - the `:root { … }` block in `app/globals.css` (between explicit `/* AUTO-GENERATED START */` / `/* AUTO-GENERATED END */` markers).
2. The script is wired to `npm run design:gen`; CI verifies that running it produces no diff against checked-in files (`git diff --exit-code`).
3. Refactor `lib/theme.ts`:
   ```ts
   import { tokens } from './theme.tokens';

   export const primaryColors = {
     bg:      `bg-[${tokens.colors.primary}]`,        // resolved at module-eval time
     bgHover: `hover:bg-[${tokens.colors['primary-hover']}]`,
     ...
   } as const;
   ```
   This still produces literal Tailwind classes at module-eval time, which Tailwind's JIT cannot extract from a template literal. To preserve JIT: the generator emits the resolved strings directly into the file, so the source-of-truth is DESIGN.md → generator → committed `lib/theme.ts`. The template-literal sketch above is a debugging aid only; the committed code is identical to today's hand-written class strings.
4. `eslint.config.mjs`: forbid editing the AUTO-GENERATED block of `app/globals.css` outside the generator (custom rule or simple grep-based pre-commit guard).

**Phase 2b gate**: `npm run design:gen && git diff --exit-code` is clean on every PR and on `main`.

### 3.7 Phase 0 deliverable — rewritten `frontend-design` skill (D5/B2)

The current 82-LOC skill mixes a generic creative-design playbook with project-specific token rules. The rewritten version is intentionally narrow.

```markdown
---
name: frontend-design
description: Build and modify UI for this repository. Anchored on DESIGN.md as the canonical visual identity source. Use whenever the request changes user-facing presentation.
---

# Frontend Design — pii-agent-demo

This repository ships an enterprise admin console. Aesthetic, typographic, and
colour decisions are governed by `/DESIGN.md`. This skill exists to route every
authoring step through that file.

## Required read order

Before writing or modifying any UI:

1. `/DESIGN.md` — read the front-matter tokens **and** the prose sections
   (Overview, Colors, Typography, Components, Do's and Don'ts).
2. `lib/theme.ts` — locate the runtime expression of the tokens you need
   (e.g., `primaryColors`, `statusColors`, `cardStyles`).
3. The closest sibling file to your target — match its imports, structure,
   and class-composition style.

If DESIGN.md and `lib/theme.ts` disagree, treat DESIGN.md as authoritative
and report the drift to the user before proceeding.

## Hard rules (`CLAUDE.md` ⛔ #4)

- Use only tokens declared in DESIGN.md (via `lib/theme.ts`).
- Never write raw colour classes (`bg-blue-600`, `text-red-500`, …).
- Never write arbitrary hex (`text-[#0064FF]`) outside `lib/theme.ts`. If a
  needed colour does not exist as a token, stop and propose adding it to
  DESIGN.md first.
- Existing UI components in `app/components/ui/` are the preferred
  composition unit (`Button`, `Card`, `Badge`, `Modal`, `Table`, …).

## Authoring loop

1. Identify the DESIGN.md component token that matches the requirement
   (e.g., `button-primary`, `card-default`).
2. Map it to the `lib/theme.ts` export (e.g., `getButtonClass('primary')`).
3. Compose using only layout utilities (`flex`, `grid`, `gap-*`, `p-*`,
   `rounded-*`, `shadow-*`) plus theme-token classes.
4. If a token is missing: stop, propose the DESIGN.md addition, wait for
   approval. Do not invent a token.
```

The skill drops: maximalism guidance, font diversity exhortations,
"distinctive aesthetic" framing. The agent (`designer.md`) inherits this
skill verbatim and continues to enforce TypeScript/import/component-size
rules from `coding-standards`.

---

## 4. Harness layering — concrete fixes per layer

```
┌────────────────────────────────────────────────────────────────────┐
│ L1. Single source                                                  │
│   /DESIGN.md  (canonical visual identity)                          │
└────────────────────┬───────────────────────────────────────────────┘
                     │ generator (Phase 2b)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│ L2. Runtime tokens                                                 │
│   lib/theme.tokens.ts  (raw hex; generated)                        │
│   lib/theme.ts         (Tailwind class strings; consumes tokens)   │
│   app/globals.css      (CSS variables, AUTO-GENERATED block)       │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│ L3. Skills & agents (natural-language guardrails)                  │
│   frontend-design SKILL.md   → DESIGN.md is the first read         │
│                                 (rewritten in PR-4)                │
│   coding-standards SKILL.md  → §5 token enforcement (existing,     │
│                                 unchanged by this plan)            │
│   designer agent             → inherits both skills (PR-5 adds     │
│                                 DESIGN.md as the first Read)       │
│                                                                    │
│   Out of scope for this plan: anti-patterns SKILL.md and the       │
│   tailwind-style agent. Category H today covers icons/assets, not  │
│   colour rules, and does not need DESIGN.md routing. The           │
│   tailwind-style agent runs a narrower colour grep than            │
│   post-edit-grep.sh; updating it is a separate cleanup, not a      │
│   prerequisite for this plan.                                      │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│ L4. Edit-time hooks (advisory, do not block)                       │
│   post-edit-grep.sh          → raw colour, arbitrary hex,           │
│                                 theme.ts↔DESIGN.md drift,           │
│                                 inline lint on DESIGN.md edits      │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│ L5. Commit/CI gates (blocking)                                     │
│   .githooks/pre-commit       → design:check on DESIGN.md /          │
│                                 theme.ts / globals.css /            │
│                                 .claude/skills/ / .codex/skills/    │
│   .github/workflows/         → required design-check job            │
└────────────────────────────────────────────────────────────────────┘
```

L4 stays advisory (Claude's stderr). The blocking lives at L5. This split is intentional: hooks that block edits during a flow erode trust; PR-level checks are tolerable because they are batched.

---

## 5. Risks and resolved questions

### 5.1 Risks

| Risk | Mitigation |
|------|------------|
| `@google/design.md` is alpha (`0.1.1`); minor versions may break the schema. | Pin exact version in `package.json` (D6). Schema bumps land via deliberate PR with `npx @google/design.md spec` re-read. |
| Generator decision in Phase 2b (Tailwind theme extend vs. emit literal classes) is unresolved. | Documented as a Phase 2b kick-off decision. Phase 2a does not depend on it. |
| `.codex/skills/` sync was disabled for an unknown reason. Re-enabling without that context might re-introduce noise. | Phase 0 task 0-3 explicitly investigates the commit history of the `.githooks/post-*` files and the script before flipping the switch. If the original disable cause is found, decide explicitly. |
| Phase 2a metric (line count) double-counts neither: a single line with three raw classes counts as one. Burn-down may stall while occurrence count drops. | Acceptable per D8 = A. Occurrence count tracked alongside but not gating. |
| Phase 2b is sequenced after 2a in narrative but starts in parallel. Generator development on a branch may collide with theme.ts edits in 2a PRs. | Generator branch consumes `theme.ts` only via copy-on-design.md-edit. theme.ts edits in 2a PRs are token additions, not restructuring; merge conflict surface is small. |
| Two-source drift between DESIGN.md and theme.ts during Phases 0–2a. | Hook 1-1(b) catches one direction (theme.ts touched, DESIGN.md unchanged). The reverse direction (DESIGN.md touched, theme.ts unchanged) is intentionally allowed during Phase 0 token bootstrapping; explicitly disallowed by the generator gate from Phase 2b onward. |
| `app/globals.css` has an `AUTO-GENERATED` block in Phase 2b. A reviewer or contributor may edit inside it by hand. | Pre-commit grep guard rejects edits inside the markers without an accompanying `--allow-design-edit` env flag; CI re-runs `design:gen` and fails if there is a diff. |

### 5.2 Approved decisions (D1–D10)

These were settled in the 2026-04-28 review thread; this section records the binding choices for future readers.

| ID | Decision |
|----|----------|
| D1 | DESIGN.md lives at the repo root (`/DESIGN.md`). |
| D2 | Tailwind aliases (e.g., `gray-700`) are flattened to their hex values in DESIGN.md. |
| D3 | DESIGN.md prose is written in English (consistent with `.codex/skills/` mirror and English-only paths in `CLAUDE.md`). |
| D4 | Provider colours and the brand-gradient end-stop are absorbed as DESIGN.md tokens (`colors.provider-aws` etc.). No `# allow:` exception list. |
| D5 | The `frontend-design` skill is fully rewritten (B2) into a routing-only skill (§3.7). The generic creative-design playbook is removed; project-specific rules are preserved. |
| D6 | `@google/design.md@0.1.1` is pinned exactly in `package.json`. |
| D7 | The `.codex/skills/` mirror is restored: sync hooks are uncommented and the 8 missing SKILL directories are committed in the same Phase 0 PR. |
| D8 | The migration metric is the **matching-line** count from the existing grep recipe (§3.5). Occurrence count is reported but not gating. |
| D9 | WCAG validation is not in Phase 0/1 scope. The single confirmed AA failure (`statusColors.success.text` / `#45CB85` on white = 2.07:1) becomes a one-line guidance in DESIGN.md `Do's and Don'ts`. A formal accessibility audit is a future ADR. |
| D10 | Phase 2 is split: 2a = literal-class migration only (theme.ts shape unchanged), 2b = generator + token-layer rewrite. 2b lands after 2a passes 50%. |

---

## 6. Action checklist (atomic PRs)

Each item is sized to land in a single PR. The order respects phase dependencies.

```
[Phase 0]
□ PR-1   Add /DESIGN.md (token inventory from §7); CLAUDE.md ⛔ #4 wording update
□ PR-2   package.json: add @google/design.md@0.1.1 devDependency; npm scripts `design:lint` and **lint-only `design:check`**; ship scripts/check-design-mirror.sh in the same PR but do not yet call it (PR-3 will wire it in once the mirror is restored)
□ PR-3   Re-enable sync hooks; run `bash scripts/sync-claude-skills-to-codex.sh` once and commit ALL resulting changes under `.codex/skills/` (the 8 missing skill dirs plus rsync-driven content updates to the 11 existing mirror dirs); upgrade `design:check` to `npx @google/design.md lint DESIGN.md && bash scripts/check-design-mirror.sh`
□ PR-4   Rewrite .claude/skills/frontend-design/SKILL.md (≤50 LOC, §3.7 content)
□ PR-5   .claude/agents/designer.md: DESIGN.md as first required Read

[Phase 1]
□ PR-6   post-edit-grep.sh: theme.ts↔DESIGN.md drift; inline DESIGN.md lint surfacing
□ PR-7   .githooks/pre-commit: design:check pre-amble for design-relevant paths
□ PR-8   .github/workflows/design-check.yml; mark design-check as a required check
□ PR-9   scripts/check-design-violations.sh + .design-violations-baseline (initial 409); design:check upgraded to run it

[Phase 2a — repeats over 4–8 weeks]
□ PR-10  theme.ts: add inputStyles.focused / .warning / .required tokens
□ PR-11  VmDatabaseConfigPanel.tsx: replace 52 occurrences of raw classes
□ PR-12  AwsInstallationInline.tsx: replace 49 occurrences
□ PR-13  ConnectionDetailModal.tsx: replace 26 occurrences
□ PR-14  AwsInstallationModeSelector + TfRoleGuideModal + TfScriptGuideModal: 64 occurrences
□ PR-15  ApprovalModals + ProcessGuideStepCard: 38 occurrences
□ PR-16  Azure guide cluster (Subnet + PeApproval + …): 30 occurrences
□ PR-17+ wave-task PRs of 5–10 occurrences each, until grep returns 0

[Phase 2b]
□ PR-G1  scripts/gen-design-tokens.ts; npm run design:gen
□ PR-G2  Generated lib/theme.tokens.ts; refactor lib/theme.ts to import from it
□ PR-G3  AUTO-GENERATED block in app/globals.css; pre-commit guard; remove `.design-violations-baseline` once count reaches zero (the script's permanent assertion takes over)

[Phase 3]
(Deferred until @google/design.md ≥ 1.0)
```

---

## 7. Appendix — Phase 0 token inventory (intentionally partial seed)

The values below are an **intentionally partial seed** for the Phase 0 DESIGN.md authoring task — covering the brand, status, surface, border, text, and provider-base palettes plus the four ad-hoc page-chrome typography roles. They are extracted manually from `lib/theme.ts` and `app/globals.css` with Tailwind aliases flattened per D2.

This appendix is **not** a complete inventory of the runtime. Known omissions that the Phase 0 author must resolve before lint passes:

- Provider gradient stops and intermediate ramps (`#FFA936`, `#FFC266`, `#2E90E8`, `#5CA9F5`, `#34A853`, `#FBBC04`).
- The success-button hover (`#3AB574`).
- The dark-mode foreground/background pair currently in `app/globals.css`.
- Body-text scale (Tailwind `text-xs/sm/base/lg/xl` defaults).

Where this appendix's scale values diverge from runtime Tailwind v4 (e.g., `rounded-xl` is `0.75rem` in Tailwind v4 but the runtime CSS variable definitions in `app/globals.css` may differ), Phase 0 task 0-1 mechanically re-extracts from `app/globals.css` rather than copying these numbers.

### 7.1 Colours

```yaml
colors:
  # brand
  primary:               "#0064FF"   # primaryColors.bg
  primary-hover:         "#0050D6"   # primaryColors.bgHover
  primary-light:         "#E8F1FF"   # primaryColors.bgLight
  primary-accent:        "#4F46E5"   # navStyles.brandGradient end-stop

  # status
  success:               "#45CB85"
  success-dark:          "#2A7D52"
  error:                 "#EF4444"   # tailwind red-500
  error-dark:            "#991B1B"   # red-800
  warning:               "#F97316"   # orange-500
  warning-dark:          "#9A3412"   # orange-800
  pending:               "#9CA3AF"   # gray-400
  info:                  "#3B82F6"   # blue-500

  # text
  text-primary:          "#111827"   # gray-900
  text-secondary:        "#374151"   # gray-700
  text-tertiary:         "#6B7280"   # gray-500
  text-quaternary:       "#9CA3AF"   # gray-400
  text-inverse:          "#FFFFFF"

  # surface
  surface-primary:       "#FFFFFF"
  surface-secondary:     "#F9FAFB"   # gray-50
  surface-tertiary:      "#F3F4F6"   # gray-100

  # border
  border-light:          "#F3F4F6"   # gray-100
  border-default:        "#E5E7EB"   # gray-200
  border-strong:         "#D1D5DB"   # gray-300

  # provider (per D4: absorbed, not exception-listed)
  provider-aws:          "#FF9900"
  provider-azure:        "#0078D4"
  provider-gcp:          "#4285F4"
  provider-idc:          "#374151"   # gray-700
  provider-sdu:          "#9333EA"   # purple-600
```

### 7.2 Typography (Phase 0 minimum)

Phase 0 names only the four typography roles that appear today as `text-[Npx]` ad-hoc declarations. The body-text scale (`text-xs/sm/base/lg/xl`) stays on Tailwind defaults until Phase 2a; expanding it requires a separate decision.

```yaml
typography:
  page-title:
    fontSize: 24px
    fontWeight: 600
    letterSpacing: -0.02em
  page-subtitle:
    fontSize: 13.5px
  page-breadcrumb:
    fontSize: 12.5px
  card-title:
    fontSize: 14px
    fontWeight: 600
    letterSpacing: 0.05em
```

### 7.3 Rounded / spacing / elevation

```yaml
rounded:
  sm:   6px      # toolbarBtn
  md:   8px      # button, input
  lg:   12px     # button alt
  xl:   PLACEHOLDER   # card — Tailwind v4 ships --radius-xl: 0.75rem (12px); confirm against runtime before lint
  full: 9999px   # badge

spacing:
  card-padding: 24px
  section-gap:  24px
  form-gap:     20px
  button-gap:   12px

elevation:
  card:   "0 1px 2px rgba(0,0,0,0.05)"            # Tailwind shadow-sm
  button: "0 1px 2px rgba(0,0,0,0.05)"            # shadow-sm
  pill:   "0 1px 2px rgba(0,0,0,0.06)"
  modal:  PLACEHOLDER                              # the value `0 25px 50px -12px rgba(0,0,0,0.25)` matches Tailwind shadow-2xl, not shadow-xl; confirm runtime intent before lint
```

### 7.4 Components (Phase 0 — only refs to Phase-0 colours)

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.text-inverse}"
    rounded:         "{rounded.md}"
    padding:         "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-tertiary}"
    textColor:       "{colors.text-secondary}"
    rounded:         "{rounded.md}"
    padding:         "8px 16px"
  card-default:
    backgroundColor: "{colors.surface-primary}"
    rounded:         "{rounded.xl}"
```

`badge-success`, `badge-error`, `badge-warning`, and `badge-info` are **not** declared in Phase 0; they require pre-computed `*-light` background tokens (e.g., `success-light` for the `bg-[#45CB85]/10` equivalent), and that computation is part of Phase 2a, not Phase 0. Declaring them here would produce `broken-ref` lint errors and contradict §3.3's "Phase 0 lints clean" gate.

### 7.5 Do's and Don'ts (initial draft)

```markdown
## Do's and Don'ts

- Do use `statusColors.success.textDark` (`#2A7D52`, 5.06:1 on white) for success
  text on light surfaces. The base `success` colour (`#45CB85`, 2.07:1) does not
  meet WCAG AA for body text and is reserved for backgrounds and large display.
- Do reuse the components in `app/components/ui/` (`Button`, `Card`, `Badge`,
  `Modal`, `Table`) instead of re-styling.
- Don't introduce a new colour by adding a Tailwind utility class. Add the
  hex to `colors:` in this file first; the runtime layer derives from it.
- Don't pick a font face per component. Body text uses the system stack
  declared in `app/globals.css`; deviating requires a typography token here.
- Don't edit the `AUTO-GENERATED` block in `app/globals.css` by hand once
  Phase 2b lands; run `npm run design:gen` instead.
```
