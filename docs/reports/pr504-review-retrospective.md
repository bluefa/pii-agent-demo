# PR #504 Review Retrospective — why the findings happened, and which harness layer catches each

PR #504 (`refactor/idc-adr-refactor`) refactored the IDC steps onto the new
ADR-018 state-view components + an ADR-017 read hook, via a fan-out of mechanical
subagents (one per step). A React-component review afterward raised 5 findings;
2 were rejected. This records **why each occurred** and **where, honestly, a
harness can prevent recurrence** — distinguishing what a grep/lint can mechanize
from what is irreducibly a judgment call.

## Findings and root causes

### #2 (Major, fixed) — a full-panel `<ErrorState>` used for a secondary status line

`IdcStep4Installing.tsx`: the installation-status error sits **inside** the
task-pipeline card (between the heading and `InstallTaskPipeline`). The W1
subagent replaced its small inline `<p text-[12px]>` with `<ErrorState>`, a full
centered panel (icon + headline + `py-12`) that visually dwarfs the pipeline.

**Two compounding causes:**
1. **Tooling gap.** ADR-018 shipped `EmptyState` as a variant family
   (`block | inline | card`) but `ErrorState` with a **single** full-panel layout.
   There was no "inline error" tool, so the only target for the swap was the
   wrong-sized one.
2. **Mechanical instruction without context.** The subagent prompt said "swap
   inline error markup → `ErrorState`" uniformly, with no rule separating a
   *primary read failure* (full panel is right) from a *secondary status line*
   (inline is right). The agent executed faithfully and picked the only tool it had.

### #3 (Minor, fixed) — state components lacked ARIA live-region roles

`LoadingState` / `ErrorState` rendered no `role="status"` / `role="alert"`, so a
screen reader announced nothing (or raw SVG path data) when a fetch resolved.

**Cause:** accessibility was **absent from the W0 build spec.** The prompt asked
for token-based props + render tests, not ARIA roles; the render tests asserted
slots, not roles, so the gap was invisible to the suite. Not a regression (the
old inline `<div>로딩 중…</div>` was equally inert) — but consolidating into a
shared primitive was exactly the moment to fix it, and nothing required it.

### #4 (Minor, fixed) — the unused `card` `EmptyState` variant shipped with a contrast bug

The `card` variant's icon chip used `bgColors.muted`, identical to the card's own
`bgColors.muted` background → invisible. Only `block` has a real consumer (Step 1).

**Cause:** **speculative completeness + partial test coverage.** All three variants
were built to the ADR-018 spec before a `card`/`inline` consumer existed, and the
render tests covered `block` + `inline` but not `card`, so a latent bug shipped in
dead-but-public code. This is a YAGNI miss: a variant with no caller and no test.

### #1 (Major, rejected) — proposed "reset to loading on `targetSourceId` change"

The reviewer flagged `useIdcResources` for not resetting to `loading` when the
target switches, claiming stale rows render under the new target. **Rejected:**
the IDC subtree is **keyed by `targetSourceId` (DR2 remount)** — documented in the
step's own comment — so the hook remounts fresh; there is no stale window in any
current consumer. The proposed in-effect `setState` was attempted and **the lint
rule `react-hooks/set-state-in-effect` rejected it immediately.** The premise
("the hook is not remounted") is false under the keying invariant.

### #5 (Nit, rejected) — barrel should use relative imports

Rejected: CLAUDE.md #3 mandates `@/` absolute and **forbids** relative imports.
The suggestion would violate the existing rule; the barrel is already correct.

## The meta root cause

#2, #3, #4 share one shape: a **mechanical fan-out** (swap X→Y per file, build the
spec'd component) executes faithfully but without the judgment a reviewer later
applied — *full-vs-inline sizing*, *ARIA roles*, *variant test coverage*. The
agents had no signal for any of these because the **prompts and the W0 spec did
not encode them.** The fix is to move that judgment out of the human-reviewer loop
and into the artifacts authors and agents consult **before** writing.

## Harness mapping — what actually catches each (honest)

| Finding | Mechanizable? | Harness layer | Action |
|---|---|---|---|
| #1 in-effect setState | **Yes — already** | lint `react-hooks/set-state-in-effect` | none (worked) |
| #5 relative import | **Yes — already** | CLAUDE.md #3 + import lint | none (worked) |
| #3 missing ARIA role | **Partly** | `sit-recurring-checks` (grep new `*State.tsx` for `role=`) + render-test assertion | add check + tests |
| #2 full-panel for inline status | **No (judgment)** | `sit-recurring-checks` **manual** entry + design tool (`ErrorState` `inline` variant) | add manual check; propose variant |
| #4 speculative untested variant | **No (judgment)** | YAGNI / over-engineering convention (`/ponytail`, anti-patterns) | record lesson; propose rule |

The honest split: **2 findings were already caught** by the existing harness
(lint + CLAUDE.md). Of the 3 real ones, only #3 is cleanly mechanizable; #2 and #4
are judgment calls best served by (a) a better **tool** (an inline `ErrorState`
variant so the right swap exists) and (b) **convention text** in the skills
authors/agents read — a grep that flags every `<ErrorState>` would be noise, not a
guard. Harness theater (rules that can't actually detect the issue) is worse than
an honest manual checklist item.

## Actions

**Done (this PR):**
- #2 reverted to inline `<p>`; #3 roles added; #4 card-icon surface fixed (commit `53fe103`).
- `sit-recurring-checks`: new checks for state-view ARIA roles (#3) and
  full-panel-vs-inline state usage (#2, manual).
- Render-test assertions for the live-region roles (regression guard for #3).

**Proposed (follow-up, needs sign-off):**
- Add an `inline` variant to `ErrorState` (parity with `EmptyState`) — the real
  tool fix for #2; deferred because there is currently one inline error site (YAGNI).
- An anti-patterns rule for #4 ("no speculative variant without a consumer + test").
- Fan-out prompt template: include ARIA + full-vs-inline + per-variant-test in the
  standing instructions so future swaps carry the judgment by default.
