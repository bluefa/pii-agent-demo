---
name: codex-simplify
description: Three-lens (reuse, quality, efficiency) cleanup of changed files via OpenAI Codex CLI (gpt-5.5, reasoning=xhigh). Codex-only counterpart to /simplify — Codex reviews, Claude applies the fixes. Use when an external model should drive the cleanup pass before merge.
---

# Codex Simplify Skill

Run `/simplify`'s three-lens review-and-cleanup pipeline through Codex CLI. Mirrors `/simplify`'s `Phase 1 → Phase 2 → Phase 3` flow but replaces the parallel Claude sub-agents with parallel Codex CLI calls — one per lens. Codex reviews only; Claude owns Phase 3 (apply the fixes).

The Lens 1 / 2 / 3 checklists are kept verbatim from `/simplify` so a Codex pass and a Claude pass produce comparable findings. Engine concerns (full-access flag, pinned model, fresh base, foreground bash, prohibitions) inherit from [`/codex-review`](../codex-review/SKILL.md).

## Execution principles

1. **Full access**: pass `--dangerously-bypass-approvals-and-sandbox`.
2. **Pinned model**: pass `-c model="gpt-5.5" -c model_reasoning_effort="xhigh"`.
3. **Fresh base**: run `git fetch origin --quiet` **once before the fan-out** (not per lens). Do not use `git fetch origin main` — it leaves `refs/remotes/origin/main` stale.
4. **Foreground Bash with `timeout: 600000`** + `</dev/null`. Pipe stdout to the user verbatim, prepend a 1–3 line Claude summary per lens.
5. **Parallel fan-out**: launch all three Codex calls in a single message (three Bash tool calls in parallel). Wait for all three before Phase 3.

Rationale for principles 1–4 is the same as [`/codex-review`'s execution principles](../codex-review/SKILL.md#execution-principles). Principle 5 is the codex-simplify delta.

## Arg parsing

| Invocation | DIFF_SCOPE |
|---|---|
| `/codex-simplify` | `git diff` (working tree). If staged changes exist, use `git diff HEAD`. |
| `/codex-simplify uncommitted` | `git diff HEAD` plus untracked files (`git ls-files --others --exclude-standard`, `cat`-ed in the prompt). |
| `/codex-simplify commit <sha>` | `git show <sha>`. |
| `/codex-simplify base=<branch>` | `git diff <branch>...HEAD` (three-dot — merge-base diff). |
| `/codex-simplify "<free text>"` | Appended as extra reviewer instructions to all three lenses. |

Combinable, e.g. `/codex-simplify base=main "focus on the polling loop"`.

## Phase 1: Identify changes

Resolve `DIFF_SCOPE` per the Arg parsing table above. If the resolved scope produces no diff output, stop — there is nothing to review.

## Phase 2: Launch three Codex review calls in parallel

For each lens, build the Codex prompt by inserting the lens's checklist into the wrapper below. Launch all three calls in a single message (three Bash tool calls in parallel).

### Command template

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  -c model="gpt-5.5" \
  -c model_reasoning_effort="xhigh" \
  "$(cat <<'PROMPT'
<wrapper with LENS_NAME and LENS_CHECKLIST filled in, DIFF_SCOPE resolved>
PROMPT
)" </dev/null
```

### Wrapper prompt (used for all three lenses)

```
You are an external reviewer running as OpenAI Codex CLI. You are running the **<LENS_NAME>** lens of /simplify.

=== STEP 1. Gather context ===
1. Run: DIFF_SCOPE. If the scope is `uncommitted`, also `cat` every untracked file listed by `git ls-files --others --exclude-standard`.
2. Read these baseline rule files before reviewing:
   - .claude/skills/coding-standards/SKILL.md
   - .claude/skills/anti-patterns/SKILL.md
   - CLAUDE.md (root)

=== STEP 2. Review checklist ===
<LENS_CHECKLIST>

=== STEP 3. Output format (strict) ===

## Lens
<LENS_NAME>

## Findings
### <file:line> — <title>
<evidence + quote>
<suggested fix>

(write "None" if there are no findings)

=== Constraints ===
- Do NOT modify code. Review only.
- No speculation. If unsure, mark "needs verification".
- Write the output in English.
```

### Lens 1: Code Reuse — checklist

```
1. Search for existing utilities and helpers that could replace newly written code. Look for similar patterns elsewhere in the codebase — common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. Flag any new function that duplicates existing functionality. Suggest the existing function to use instead.
3. Flag any inline logic that could use an existing utility — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns are common candidates.
```

### Lens 2: Code Quality — checklist

```
1. Redundant state: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls.
2. Parameter sprawl: adding new parameters to a function instead of generalizing or restructuring existing ones.
3. Copy-paste with slight variation: near-duplicate code blocks that should be unified with a shared abstraction.
4. Leaky abstractions: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries.
5. Stringly-typed code: using raw strings where constants, enums (string unions), or branded types already exist in the codebase.
6. Unnecessary JSX nesting: wrapper Boxes/elements that add no layout value — check if inner component props (flexShrink, alignItems, etc.) already provide the needed behavior.
7. Nested conditionals: ternary chains (`a ? x : b ? y : ...`), nested if/else, or nested switch 3+ levels deep — flatten with early returns, guard clauses, a lookup table, or an if/else-if cascade.
8. Unnecessary comments: comments explaining WHAT the code does (well-named identifiers already do that), narrating the change, or referencing the task/caller — delete; keep only non-obvious WHY (hidden constraints, subtle invariants, workarounds).
```

### Lens 3: Efficiency — checklist

```
1. Unnecessary work: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns.
2. Missed concurrency: independent operations run sequentially when they could run in parallel.
3. Hot-path bloat: new blocking work added to startup or per-request/per-render hot paths.
4. Recurring no-op updates: state/store updates inside polling loops, intervals, or event handlers that fire unconditionally — add a change-detection guard so downstream consumers aren't notified when nothing changed. Also: if a wrapper function takes an updater/reducer callback, verify it honors same-reference returns (or whatever the "no change" signal is) — otherwise callers' early-return no-ops are silently defeated.
5. Unnecessary existence checks: pre-checking file/resource existence before operating (TOCTOU anti-pattern) — operate directly and handle the error.
6. Memory: unbounded data structures, missing cleanup, event listener leaks.
7. Overly broad operations: reading entire files when only a portion is needed, loading all items when filtering for one.
```

## Phase 3: Fix issues

After all three Codex calls return:

1. Dump each Codex stdout **verbatim** to the user, in lens order (Reuse → Quality → Efficiency). Prepend a 1–3 line Claude summary per lens (count of findings, top issue).
2. Aggregate findings across the three lenses. Deduplicate (same file:line raised by two lenses → keep the more specific one).
3. Apply each finding directly via Claude edits. If a finding is a false positive or not worth addressing, note it and move on — do not argue with it, just skip.
4. Briefly summarize what was fixed and what was skipped (with a one-line reason per skip).

## Output handling

- Codex stdout is dumped **verbatim** — the external model's wording is the value of the sign-off; users compare lens outputs side-by-side.
- Per-lens Claude summary: 1–3 lines (counts, top finding).
- Final summary after Phase 3: bullet list of applied fixes and skipped findings.

## Failure handling

- `codex: command not found` → tell the user to install Codex CLI, stop.
- Non-zero exit on a single lens → surface stderr verbatim, continue with the other two lenses, do not retry.
- Timeout on a single lens → report which lens timed out, suggest narrowing with `commit <sha>` or `base=<branch>`.

## Prohibitions

Same as [`/codex-review`'s prohibitions](../codex-review/SKILL.md#prohibitions): no `--full-auto` (still sandboxed — skill-file reads become unreliable), no editing Codex output before surfacing it, no auto-applying suggestions silently. Phase 3 must be **explicit Claude edits** the user can see in the diff; Codex output is review-only and is never piped into a code change without Claude's filter.
