---
name: html-analysis
description: Analyze an HTML mockup byte-exact so the app can be aligned to it. Use whenever a design HTML mockup (e.g. design/SIT Prototype Athena v16.html) must be reproduced exactly — to extract design tokens, map interactions, or diff the running impl against the mockup per screen. Pairs with /design-extract and /frontend-design. This skill carries a growing LESSONS list of past analysis failures and their rules — read it before analyzing, and append to it when an analysis miss is found.
---

# HTML Analysis

Reproduce an HTML mockup **byte-exact** in the app. The job has three outputs:
**design tokens** (every px/weight/color → `lib/theme.ts` token), **interaction scenarios**
(every actionable element → behavior), and **per-screen fidelity diffs** (mockup vs running impl).

The recurring failure mode is **incompleteness** — a real element gets missed and surfaces
late (in review or in the running app). This skill exists to make analysis EXHAUSTIVE. Work
the checklist; obey the rules; when something was still missed, add a rule.

## Harness

Render the mockup and the impl, then diff the PNGs.

```bash
# mockup at a given provider × step (drives the prototype JS: showScreen + setProvider + setStep)
bash scripts/v16shot.sh <azure|gcp|aws|idc> <step 1-7> /tmp/v16_x.png
# running impl (dev server on :3000) for a targetSourceId
bash scripts/implshot.sh <id> /tmp/impl_x.png
```

- Dev server: `npx next dev --webpack` (NOT turbopack — it panics in this worktree). Mock seeds
  load at boot → **restart after seed/mock edits**; component code hot-reloads.
- The cell matrix (provider × step → targetSourceId) is in `docs/v16-alignment/00-PLAN.md`.
- A new mockup version → clone the renderer: `sed 's/vNN/vMM/' scripts/vNNshot.sh` and fix the
  `src=` path (the sed will wrongly rewrite the worktree dir too — check it).

**Strengthen the harness** when analysis is hard: add element-coverage helpers, JS-state probes,
or per-region screenshot crops. Record what failed (below) so the harness grows.

## Process (per screen / cell)

1. **Find the authoritative style block first.** A mockup may carry MORE THAN ONE design system
   in its `<style>`. Identify which `:root` / class family the target screen actually uses, and
   analyze ONLY that. (See L1.)
2. **Render with JS, not just static markup.** Tables/rows/modized content are often injected by
   the prototype's JS. Screenshot via the harness AND read the `<script>` that populates dynamic
   content. Never trust the static `<tbody>` alone. (See L6.)
3. **Walk the completeness checklist** (below) for the screen + every modal it can open.
4. **For tokens:** map each primitive to an existing `lib/theme.ts` token; if it differs flag
   MISMATCH; if absent flag MISSING and give a paste-ready class string. Capture inline
   dimensional overrides (width / text-align) separately — they are not tokens. (See L5, L7.)
5. **For interactions:** map every button / select / checkbox → does it open a modal (which?),
   navigate (where?), or change state (what transition / gating)? List every modal id.
6. **Verify before declaring "missing".** Grep `lib/theme.ts` and the impl components — some
   primitives already exist (e.g. `Pagination`, `ResourceIdCell`). (See L8.)
7. **Cross-check with an independent reviewer (Codex + a second opus agent).** Loop until they
   unanimously agree the analysis is complete. Incompleteness is the default outcome of one pass.

## Completeness checklist (walk ALL — missing one is the failure mode)

Static is easy; the misses are always the **stateful / interactive / chrome** elements.

- [ ] Typography: page title, breadcrumb, card title (h2), eyebrow, subtitle, body, label, caption
- [ ] Status: success / wait / fail / progress — color AND text label (a11y), dot colors
- [ ] Tables: EACH table variant (read-only vs editable) — header style, cell style, wrapper
      frame (border/radius/shadow), row hover, **excluded/row-state tints**, column widths + align
- [ ] Pills / tags / badges: every color variant + kind/scan/target pills
- [ ] Buttons: every variant (primary/soft/ghost/warn/danger/secondary/approve/reject) AND size
      (sm/md) AND modal-footer (52px) AND **in-table** buttons
- [ ] Inputs / selects: form field, textarea, **in-cell selects** (e.g. credential dropdown)
- [ ] Cards, banners (info/warn/success/error)
- [ ] **Progress indicators**: progress bars, % labels, count summaries, running/pending/done states
- [ ] **Pagination**: per-page select, info text, page buttons, first/last/prev/next, disabled
- [ ] **Tooltips / popovers**: header info tips, hover popovers, dark vs light
- [ ] **Icon buttons**: copy, close-x, edit, delete — and their hover/opacity states
- [ ] Checkboxes / radios (accent color)
- [ ] Modals: EACH modal id — overlay, container width/radius/shadow, header, body, footer,
      close paths, and the trigger that opens it
- [ ] Empty / loading / error states for each data region
- [ ] Provider-branch differences: which columns/copy/headers change per provider (intended) vs
      drift (accidental)

## LESSONS — analysis failures → rules (APPEND when a new miss is found)

When an analysis miss is caught (by review, by Codex, or in the running app), add a numbered
rule here with WHAT was missed and the RULE that prevents it next time. This list is the point
of the skill.

- **L1 — Multiple style blocks.** v16 has a generic `.ds-*` block (HTML 6–504, radius12/type28)
  that screen-4 does NOT use; screen-4 uses block 2 (506–5075, Toss `:root` 546–567, radius-card
  20, card title 26/800). Extracting from the wrong block gives wrong radius/type/weight.
  **Rule:** before extracting anything, identify which `:root`/class system the target screen
  actually consumes, and analyze only that block.
- **L2 — Stateful/interactive primitives get missed.** The first token pass omitted the step-5
  progress bar (`.conn-progress`), `.pagination-row`, `.res-id-cell`, the Source-IP tooltip, and
  modal `close-x`. **Rule:** explicitly enumerate progress bars, paginations, tooltips, copy/close
  buttons, and in-cell selects — they are never in the "obvious" static markup.
- **L3 — Read-only vs editable render the same data differently.** Confirmed/read-only tables
  rendered raw uppercase `MYSQL` while editable paths showed a `MySQL` pill. **Rule:** verify the
  SAME field renders consistently across ALL table variants (read-only + editable), and that
  display normalization (case/label) is applied everywhere, not just on the editable path.
- **L4 — Prototype sample data is provider-agnostic.** v16 shows Athena rows on Azure, but Athena
  is AWS-only in real data. **Rule:** separate prototype SAMPLE data from real provider-specific
  STRUCTURE; do not implement sample-only rows as if they were real for every provider.
- **L5 — Base CSS vs per-instance inline override.** `.approval-stats` base is `grid-cols-4`; the
  req-approval modal overrides to 3 columns inline. **Rule:** capture BOTH the base class CSS and
  every per-instance inline `style=` override.
- **L6 — JS-rendered content.** Rows/tbodies/modal bodies are populated by the prototype JS
  (`innerHTML`, template strings) and are absent from static markup. **Rule:** render with the
  harness (headless Chrome runs the JS) AND read the `<script>` functions that build dynamic
  content; never analyze from static `<tbody>` alone.
- **L7 — Dimensions are inline, not tokenized.** Column widths (e.g. 연동 대상 220→168px) and
  text-align live in inline `style=`, not the token system. **Rule:** capture inline width /
  text-align per column as explicit values; don't expect a token.
- **L8 — Verify "missing" against existing impl.** Some mockup primitives already have impl
  components/tokens (`Pagination`, `ResourceIdCell`, most `idcStyles`). **Rule:** grep
  `lib/theme.ts` and the impl components before declaring a primitive missing; reuse beats re-add.

## When HTML analysis fails

If the harness or analysis fails (mockup won't render, JS state unreachable, an element can't be
mapped to a token, a diff is ambiguous): record WHY here as a new `L#` rule, and — if it's a
tooling gap — strengthen the harness (a probe, a crop, a JS dump). The skill must trend toward
covering every element of the HTML.
