---
name: wave-task
description: Spec-driven PR pipeline. Takes one markdown spec and runs implement → self-audit → PR → auto review+fix loop → merge wait. Standardizes the workflow used across PRs #274-288.
user_invocable: true
---

# /wave-task - Spec-Driven PR Pipeline

Take one markdown spec and drive a single PR end-to-end.

## Input

- `$1` (required): spec path or spec key — e.g. `wave5-B5`, `docs/reports/sit-migration-prompts/wave7-B8.md`
- `--skip-merge-wait` (optional): skip Phase 8 user confirmation and auto-merge. Off by default, not recommended.
- `--max-review-loops <N>` (optional): cap on Phase 7 auto-fix iterations (default 3).

## Phase 0 — Spec Locate (⛔ include origin/main)

Local HEAD may lag behind origin. Always fetch first.

```bash
git fetch origin main
```

Lookup order:
1. If `$1` is a file path, Read it directly.
2. If it is a key, check `docs/reports/sit-migration-prompts/<key>.md` locally.
3. If missing locally, try `git show origin/main:docs/reports/sit-migration-prompts/<key>.md`.
4. Still missing: `git ls-tree -r origin/main | grep <key>` and `find . -name "*<key>*.md"`.

Once the spec is loaded, report the following to the user before continuing:
- spec file path + origin SHA
- target files / components / scope
- Phase 0 decisions (I-XX) referenced by the spec
- explicitly deferred items (T17 etc.) the spec says are out of scope

## Phase 1 — Worktree

Invoke `/worktree`. Derive branch prefix from spec type: `feat/`, `refactor/`, `fix/`, `docs/`.
Example: `feat/sit-wave7-b8`.

## Phase 2 — Implement

Follow the spec's implementation steps in order. `/coding-standards` auto-applies.

⛔ Rules:
- **Do not touch files outside the spec's declared scope** — capture any drive-by findings for Phase 7 instead.
- Keep orphan imports/state only when the spec explicitly defers them to a later wave (e.g. T17); otherwise remove in-PR.
- Never hardcode real PII (emails, names, initials) from design mockups. Use placeholders (`user@example.com`, `JD`, etc.).
- Stay aligned with `/sit-recurring-checks` while writing.

## Phase 3 — Self-Audit (sequential)

Invoke the following skills in order. Any fix in a step triggers re-running the previous step to check for regression.

1. `/sit-recurring-checks` — grep/rule-based detection + auto-fix for repeat offenders.
2. `/simplify` — review the diff for reuse, quality, efficiency.
   > ⚠️ **No dedicated `/simplify` skill file exists yet** — this step currently runs as an inline self-review.
   > Until a skill is authored, walk through the checklist below on the diff and fix every violation before moving on:
   >
   > - **Reuse**: any new constant / helper duplicated across files in the diff? If yes, extract to `connection-test/constants.ts`, `lib/constants/*`, or a co-located helper.
   > - **Discriminated-union naming (AP-C9)**: do union variants carrying the same entity use the same field name (`item` vs `target`)?
   > - **Parameter naming (AP-G7)**: are callback / utility parameters role-named (`fetcher`, `mapper`, `validator`, `onApprove`) — not `fn` / `cb` / `data` / `val`?
   > - **Sibling-cluster consistency (AP-G8)**: within a cluster (refs, error locals, modal states, option fields), does every member follow one convention? No `stopFnRef` among `fetchRef/updateRef/completeRef`; no `sidErr` among `nameErr/hostErr/portErr`.
   > - **Comments (AP-G9)**: every comment describes an invariant, not history. No "this refactor" / "the fix" / "was flagged" / "PR #NNN".
   > - **Dynamic imports**: client-only modals use `dynamic(..., { ssr: false })` when not needed server-side.
3. `/vercel-react-best-practices` — cross-check against the 57 React/Next.js rules and fix violations.

Constraints:
- A fix in step 2 or 3 must re-run step 1 (recurring checks) before moving on.
- Do not expand beyond spec scope to satisfy an audit finding — record it in Phase 7 instead.

## Phase 4 — Verify

```bash
npx tsc --noEmit
npm run lint -- <changed paths>
```

- `tsc` must exit 0.
- Lint: 0 new warnings introduced by this PR. Pre-existing warnings may remain.

## Phase 5 — Commit & Push

```bash
git fetch origin main && git rebase origin/main
```

- Commit format: `<type>(<scope>): <desc> (<spec-key>)`
  - e.g. `refactor(scan): ScanPanel headless (ScanController) (wave5-B6)`
- Resolve rebase conflicts then `git rebase --continue`.
- Push.

## Phase 6 — PR Create

Invoke `/pr`. PR body must include:
- Spec path + head SHA
- Changed files (net LOC)
- Deviations from the spec with rationale
- Orphan items deferred to later waves (if any)
- `tsc` / `lint` result summary

## Phase 7 — Self-Review + Auto-Fix Loop

Invoke `/pr-context-review <PR#>`. Parse the verdict:

| Verdict label | Next action |
|---|---|
| `APPROVE` / `READY_TO_MERGE` | Proceed to Phase 8 |
| `MINOR_COMMENTS` | If only P3 remains, proceed to Phase 8. If P2+ remains, enter loop. |
| `BLOCKING` / any P1 | Enter auto-fix loop |

### Auto-Fix Loop (up to `--max-review-loops` iterations)

1. Parse findings: severity (P1/P2/P3), `file:line`, impact.
2. Decide per finding:
   - **P1**: must fix.
   - **P2 (grep-fixable)**: auto-fix — raw hex → theme token, `animate-spin` wrapping, empty fragment removal, orphan import cleanup.
   - **P2 (structural)**: fix if inside spec scope; otherwise record in PR body under `## Deferred`.
   - **P3**: report only, do not auto-fix (avoids bloating the diff).
3. Re-run Phase 3 (self-audit) → Phase 4 (verify).
4. Commit: `review: address pr-context-review findings` + push.
5. Re-run `/pr-context-review <PR#>` — upsert the same comment via the `<!-- claude-pr-context-review -->` marker.
6. Repeat until `READY_TO_MERGE`. If the cap is hit, report remaining findings to the user and stop the loop.

## Phase 8 — Merge Wait

Default: wait for the user's explicit merge instruction (per CLAUDE.md: merges are user-triggered).
Only auto-merge when `--skip-merge-wait` is passed.

On user merge instruction → `/pr-merge` → `/worktree-cleanup`.

## Phase 9 — Final Report

Always emit a single final line before ending the turn, in this exact format:

```
wave-task done: PR #<number> <state> — <url>
```

- `<state>`: `OPEN` (Phase 6 finished, awaiting merge), `MERGED` (Phase 8 ran), or `CLOSED` if user aborted.
- Derive via `gh pr view <number> --json number,state,url -q '"#\(.number) \(.state) — \(.url)"'`.
- Print this line even when stopping early (review cap hit, user halt, error) — always include the PR number.

## Subagent Usage (must follow)

Default is main-session-only, but the points below MUST fan out to subagents (user preference: prefer parallel work over sequential).

| Phase | Fan-out target | Constraint |
|---|---|---|
| 2 (Implement) | Spec-declared independent layers (e.g. types-only, an unrelated helper, an isolated UI component) | ⛔ Never split a single swagger endpoint (mock + route + FE types) across subagents — see `feature-development` contract guard |
| 3 (1st pass only) | `sit-recurring-checks` / `simplify` / `vercel-react-best-practices` run concurrently as detection-only | First pass only. After any fix, the spec's "fix → rerun previous step" rule forces sequential reruns |
| 4 (Verify) | `tsc --noEmit` and `npm run lint` as parallel Bash calls in one message | None |
| 7 (Auto-Fix) | Findings grouped by independent area (theme tokens / orphan imports / a11y / type fixes) | ⛔ Same file or same swagger endpoint must not be edited by two subagents concurrently |

When fanning out, brief each subagent with: spec path, scope boundary, the contract files to re-read (swagger path), and the verification command to run before returning. Main session merges results, resolves conflicts, and runs Phase 4 after.

## Prohibited

- Skipping Phase 0 (no implementation without a located spec).
- Omitting any Phase 3 skill.
- Entering Phase 8 with unresolved BLOCKING findings.
- Refactoring outside spec scope inside the auto-fix loop.
- Auto-fixing P3 findings just to clear the comment.
- Splitting a single swagger endpoint's contract implementation across subagents (Phase 2).

## Origin of this pipeline

Standardization of the flow repeated across PRs #274-288 (SIT Wave 2-7). Recurring review findings are prevented by `/sit-recurring-checks`.
