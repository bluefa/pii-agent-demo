---
name: sit-recurring-checks
description: Grep/rule-based checklist that prevents the review findings repeated across PRs #274-288. Runs inside /wave-task Phase 3 or manually before review.
user_invocable: true
---

# /sit-recurring-checks - Repeat-Offender Checks

Checks derived from `/pr-context-review` findings on PRs #274-288. Run before self-review to pre-empt the same comments.

## How to invoke

- Auto: called by `/wave-task` Phase 3 (first in the audit chain).
- Manual: run standalone after implementing a change, before opening a PR.

## Input

- `$1` (optional): glob of changed paths to scope the scan. Defaults to files changed vs. `origin/main`.

```bash
CHANGED=$(git diff --name-only origin/main...HEAD | grep -E '\.(tsx?|jsx?)$')
```

## Checks

### 1. `animate-spin` directly on `<svg>` — P1

Rule: Vercel `rendering-animate-svg-wrapper`. GPU acceleration drops on some browsers.
Source: PR #288 `ScanRunningState`.

Detect:
```bash
grep -nE '<svg[^>]*animate-spin' $CHANGED
```

Auto-fix: wrap the SVG with `<div className="animate-spin">...</div>` and remove the class from the `<svg>`.

### 2. Raw hex color — P2

Route through `lib/theme.ts` tokens. Exceptions:
- `lib/theme.ts` itself.
- Brand gradient stops where a theme token does not yet exist — require a neighboring comment stating the exception.

Detect:
```bash
grep -HnE '#[0-9a-fA-F]{6}' $CHANGED | grep -v 'lib/theme.ts'
```

Auto-fix: replace with the matching token from `theme.ts`. If none exists, leave as-is and record as `## Deferred — theme token extension` in the PR body.

### 3. Empty fragment wrapper — P3 (auto-fix OK inside scope)

`<main><>...</></main>` or any single-child `<>...</>` that wraps unconditional JSX.
Source: PR #284, #287.

Detect manually while reading the diff. Legitimate uses (conditional rendering blocks) stay.

Auto-fix: unwrap the fragment.

### 4. Static JSX / SVG hoisting — P3 (report only)

Rule: `rendering-hoist-jsx`. Constant JSX fragments declared inside a component body recreate on each render.

Detect manually. Report; do not auto-fix unless the spec explicitly asks for it (diff-bloat).

### 5. Orphan imports / state — P2

Imports, state, or fetch logic made unused by the current diff must be removed **in this PR** unless the spec defers them to a later wave (e.g. T17). Pre-existing orphans remain untouched.

Detect:
```bash
npm run lint -- $CHANGED 2>&1 | grep -E 'is defined but never used|is assigned a value but never used'
```

Auto-fix: remove only the symbols that this PR's changes rendered unused.

### 6. Mockup PII hardcoding — ⛔ P1

Never carry real emails / names / initials from design mockups into code. Replace with placeholders (`user@example.com`, `JD`, `홍길동`).
Source: wave2-T3.

Detect:
```bash
grep -HnE '@(gmail|naver|kakao|daum|hanmail|yahoo)\.(com|co\.kr|net)' $CHANGED
```

Manual scan: look for proper nouns that resemble real Korean/English personal names in string literals inside mockup-origin components.

Auto-fix: replace with placeholders and note in PR body.

### 7. Spec lookup missed `origin/main` — process

If the user referenced a spec file and you concluded it does not exist, verify you ran:
```bash
git fetch origin main && git show origin/main:<path>
```
before reporting "not found". Local HEAD may lag behind.

## Output

After running, emit a single table:

```
## /sit-recurring-checks — <branch>

| # | check                        | hits | action        |
|---|------------------------------|------|---------------|
| 1 | animate-svg-wrapper          | 0    | —             |
| 2 | raw-hex                      | 2    | auto-fixed    |
| 3 | empty-fragment               | 1    | auto-fixed    |
| 4 | hoist-jsx                    | 3    | reported (P3) |
| 5 | orphan-imports               | 0    | —             |
| 6 | mockup-pii                   | 0    | —             |
| 7 | spec-lookup (origin/main)    | ok   | —             |
```

Findings with severity P1 or P2 that were **not** auto-fixed must appear in the chat response with `file:line` so the user can act.

## Prohibited

- Auto-fixing P3 items merely to clear the table (they belong in a follow-up or `React Compiler` work).
- Expanding beyond the current PR's changed file set — this skill never scans unchanged files.
- Claiming a check passed without running the associated grep / lint command.
