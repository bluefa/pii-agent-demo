---
name: wave-spec
description: Convert a Korean requirements draft into a wave-task spec markdown that follows the proven 7-step template used across wave9~wave13. Drives the spec-author phase that precedes /wave-task.
user_invocable: true
---

# /wave-spec — Wave-Task Spec Author

Take a user-authored Korean requirements draft and produce a wave-task spec
markdown that `/wave-task` can run end-to-end without re-asking the user any
question.

A good wave-task spec is **executable prose** — the LLM consuming it must be
able to reach the merged-PR state by following the spec literally. The spec
is correct when an LLM that has never seen the conversation can still produce
the right PR.

## Input

- `$1` (required): path to a Korean requirements draft. May be partial.
- `$2` (optional): proposed wave key (e.g. `wave15-D2`, `wave12-step5-6-7-post-install`). If absent, derive one from the draft.
- `$3` (optional): output directory under `docs/reports/`. If absent, infer the topic bundle from the draft and ask the user once.

## Output

A single markdown file at:

```
docs/reports/{topic-bundle}/{wave-key}-{slug}.md
```

Examples that have shipped:
- `docs/reports/sit-step-polish/wave12-step5-6-7-post-install.md`
- `docs/reports/sit-step-polish/wave13-tables-copy-hover.md`
- `docs/reports/sit-step-polish/wave9-foundation.md`
- `docs/reports/sit-migration-prompts/wave14-B1c-azure-project-page-split.md`

## Process

### Phase A — Read & classify the Korean draft

1. Read the draft top to bottom. Do not edit it.
2. Extract and classify every sentence into one bucket:
   - **Goal** — what to ship → becomes Context
   - **Constraint** — what NOT to touch / hard limits → becomes Do NOT touch + Self-review
   - **Upstream dep** — what must already exist → becomes Precondition + Required reading
   - **Acceptance** — observable success → becomes Acceptance + Self-review checkbox
   - **Code intent** — desired code/JSX/className shape → becomes Step 3 snippet
   - **Out-of-scope** — explicit deferrals → becomes "Deliberately excluded" in PR body
3. If any of {Goal, Constraint, Acceptance} is missing or thin, **STOP** and ask the user the specific missing pieces before drafting. Do not invent.

### Phase B — Locate facts in the codebase

Before writing the spec, verify every claim the draft makes:

- File paths the draft mentions — `git ls-files | grep` each one. Record the *current line numbers* of the call-sites you'll edit (line refs go in Required reading).
- Upstream symbols the draft assumes — `git grep` each. If absent, that's a Precondition that must abort the wave, not a runtime check.
- Token / theme names — `git grep "<name>" lib/theme.ts`. If the token doesn't exist, the spec needs to add it (not assume it).
- ADR / audit references — confirm the doc exists and the section number is real.

Findings from this phase populate `Step 2: Required reading` and the `Precondition` block. **Do not paraphrase the user's Korean — use the verified file paths**.

### Phase C — Draft the spec

Use the 7-step template (§Required structure below). Write in English. Keep
Korean UI strings verbatim where they appear in the product.

### Phase D — Self-check before handing off

Run the §Self-check checklist at the bottom of this file against the draft
spec. Fix any miss. Then write the file and report the path to the user.

## Required structure (the 7-step template)

Every wave-task spec MUST have these sections in this order. Section heading
text must match exactly — `/wave-task` Phase 0 reads them as anchors.

```
# Wave N — <one-line title>

## Context
## Precondition
## Step 1: Worktree
## Step 2: Required reading
## Step 3: Implementation
  ### 3-1. <sub-target>
  ### 3-2. <sub-target>
  ...
## Step 4: Do NOT touch
## Step 5: Verify
## Step 6: Commit + push + PR
## Step 7: Self-review checklist
## Acceptance for this wave
```

### Heading title

Format: `# Wave N — <what + where>`

- `Wave N` matches the wave key (`wave12`, `wave15-B1c`, `wave9-foundation`).
- Title states **what changes** and **where**, not the motivation.

✅ `# Wave 12 — Step 5 + Step 6 + Step 7 post-install polish (GuideCard + cardTitle)`
✅ `# Wave 13 — Tables copy-on-hover (3 cross-cutting tables)`
❌ `# Wave 12 — Improve UI` *(too vague)*
❌ `# Wave 12 — Closes audit punch-list G1+G3` *(why, not what)*

### Section: Context

Purpose: tell the implementer *why this wave exists* and *what the boundary is*.

MUST contain:
1. The triggering document (audit / ADR / report) — link by file path.
2. Numbered list of gaps / decisions being closed, each tagged with the source
   identifier (`G1`, `D2`, `T17`, `R3`, etc.).
3. A table or bullet-list of the **target files** in scope (one row per file).
4. Out-of-scope items mentioned inline so the boundary is unambiguous.
5. Upstream dependencies — wave keys that must be merged first.

✅ Good (from wave13):

```
The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
flags resource-ID copy-on-hover as **P1 / G2**: the prototype attaches a
hover-revealed `.copy-btn` to every mono identifier cell across approval,
approved, and confirmed tables, but the current implementation only ships
the pattern on `PageMeta`. This wave wires the Wave 9 `CopyButton` into
three cross-cutting tables...

| Table | Mounted on | Mono columns to wire |
|---|---|---|
| `WaitingApprovalTable.tsx` | Step 2 (WAITING_APPROVAL) | Resource ID, Region, Resource Name |
| `ApprovedIntegrationTable.tsx` | Step 3 (APPLYING_APPROVED) | Resource ID |
| `ConfirmedIntegrationTable.tsx` | Steps 5/6/7 (both variants) | Resource ID |

`InstallResourceTable.tsx` is **NOT** in scope — Wave 10 owns it.
```

❌ Bad:

```
Wires copy buttons into the tables so users can copy resource IDs.
```

Length: typically 10–40 lines, table or numbered list, no marketing copy.

### Section: Precondition

Purpose: an upstream-dependency abort gate. Run-once, fail-loud, no retries.

MUST contain:
1. `git fetch origin main` as the first line (mandatory — local HEAD lags).
2. `git grep` / `test -f` checks for upstream waves / symbols.
3. Explicit echo of `"✓"` on success and abort instruction on failure.

✅ Good (from wave10):

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "export const CopyButton" app/components/ui && echo "✓ Wave 9 merged"
```

Followed by: `If the check fails, stop. Wave 10 must follow Wave 9.`

❌ Bad (silent assumption):

```
Make sure Wave 9 is merged before starting.
```

⛔ Anti-pattern: skipping the precondition because "the user said the dep is ready". The check costs nothing and catches the case where main is behind.

### Section: Step 1 — Worktree

Purpose: mandatory worktree creation. Branch prefix derives from spec type.

Format:

```bash
bash scripts/create-worktree.sh --topic {topic-slug} --prefix {feat|fix|refactor|chore|docs|test}
cd /Users/study/pii-agent-demo-{topic-slug}
```

Rules:
- `{topic-slug}` is kebab-case, ≤ 50 chars, contains the wave key.
- `{prefix}` mirrors the conventional-commit type the PR will use.
- Worktree path stated explicitly so the implementer can `cd` without thinking.

✅ `bash scripts/create-worktree.sh --topic sit-step-polish-wave13-tables-copy-hover --prefix feat`
❌ `bash scripts/create-worktree.sh --topic wave13 --prefix feat` *(slug too short, ambiguous on disk)*

### Section: Step 2 — Required reading

Purpose: every file the implementer must read **before** editing anything.

MUST contain (numbered list):
1. Design source (HTML mockup / Figma export) with the specific search anchors (`#screen-4`, `.copy-btn`, `--type-h1`).
2. Triggering audit / ADR with the specific section reference.
3. Upstream wave specs that ship symbols this wave consumes.
4. Every target file the implementer will edit, with the *current line number* of the relevant region.
5. Every test file the implementer will extend.
6. Related contract files (swagger, theme tokens, type definitions).

Each entry MUST have a one-line purpose annotation.

✅ Good (from wave9):

```
1. `design/SIT Prototype v7 - standalone.html` — search for `.copy-btn`
   (the hover-revealed pattern), `--type-h1` (22 px card title rule),
   `.scan-pill` (3 semantic variants), `--bg-muted` (`#F9FAFB`).
2. `app/components/ui/PageMeta.tsx` — the source of truth for the copy-on-hover
   pattern. The new `CopyButton` is a strict extraction of what `PageMetaRow`
   already does — do not invent new copy semantics.
```

❌ Bad:

```
Read the relevant files before starting.
```

⛔ Anti-pattern: listing files without saying *what to look for* in them. The implementer wastes context window re-deriving why each file matters.

### Section: Step 3 — Implementation

Purpose: the exact change shape for every file in scope.

MUST contain:
1. Numbered subsections (`3-1`, `3-2`, ...) per target file or per cohesive change.
2. For each subsection:
   - Target file path (full absolute-style path from repo root).
   - **Current state** observation — what's there today, with line numbers.
   - **Change shape** — concrete code block showing the after-state with real imports, real type names, real className strings.
   - Inline **Why** notes for non-obvious decisions.
   - Inline **No / Don't** notes that clarify the boundary inside this step.
3. Helper-extraction decisions stated explicitly (`No <FooHelper> — N call sites don't justify it`).
4. Import-order conventions noted if any new imports are added.

✅ Good (from wave13 §3-1):

```
Current state (lines 70–110): the table renders `Resource ID`, `Region`,
and `Resource Name` as `font-mono` cells with the `textColors.secondary`
treatment. The `#`, `DB Type`, ... columns are NOT mono identifiers — they
stay untouched.

Change shape — add the import, add `'group'` to the `<tr>`, rewrite the
three mono cells...

​```tsx
import { CopyButton } from '@/app/components/ui/CopyButton';

const MONO_CELL = cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary);

<tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
  <td className={MONO_CELL}>
    <span className="inline-flex items-center gap-1">
      <span>{resource.resourceId}</span>
      <CopyButton
        value={resource.resourceId}
        label={`${resource.resourceId} 복사`}
        className="opacity-0 group-hover:opacity-100"
      />
    </span>
  </td>
  ...
</tr>
​```

`MONO_CELL` is a local `const` inside the component — it deduplicates the
three identical className expressions, not a public helper.

**Why these three columns:** Resource ID, Region, Resource Name are mono
identifiers per the prototype...
```

❌ Bad:

```
### 3-1. Update WaitingApprovalTable.tsx
Add CopyButton to the resource ID column. Make sure to add the group class.
```

Rules for code snippets inside Step 3:
- Use real import paths (`@/...`, never `./...`).
- Use real type names and never `any`.
- Korean UI strings (e.g. `${value} 복사`) stay in Korean — they're product copy.
- Comments inside snippets describe **invariants**, not history.
- If the snippet uses `// ...` to elide context, the elided block must be unambiguous.

⛔ Anti-pattern: writing "make the JSX look like X" without showing the JSX. The implementer will invent the wrong shape.

### Section: Step 4 — Do NOT touch

Purpose: the negative space. Every file or system the wave must leave alone.

MUST contain (bullet list):
1. **ADR-enforced freezes** (e.g. ADR-014 R3 stepper four files) with ADR reference.
2. **Sibling waves' surfaces** — file ownership boundaries ("Wave 10 owns InstallResourceTable").
3. **Upstream wave deliverables** — if Wave 12 consumes Wave 9, Wave 9's files cannot be re-edited.
4. **Shared/sensitive files** — `lib/theme.ts`, `app/layout.tsx`, BFF clients, swagger.
5. **Type / contract layers** — `lib/types.ts`, `docs/swagger/*.yaml` if no contract change.
6. **Forbidden refactors** — no `<XxxHelper>` extraction when N call sites are below the threshold.

Each item MUST state *why* it's frozen.

✅ Good (from wave13):

```
- **ADR-014 R3 four files** (stepper): `ProcessProgressBar.tsx`, ...
  `motion/`.
- **Step components** — `WaitingApprovalStep`, ... Waves 10 / 11 / 12 own them.
- **`InstallResourceTable.tsx`** — Wave 10 owns it.
- **`app/components/ui/CopyButton.tsx`** — Wave 9 ships it; Wave 13 only imports.
- **`lib/theme.ts`** — no new token, no existing token rename.
- **BFF / swagger / `lib/types`** — no schema change.
- **No `<MonoIdCell>` / `<CopyableMono>` helper** — three call sites
  don't justify it.
```

❌ Bad:

```
Don't touch unrelated files.
```

⛔ Anti-pattern: implicit "Do NOT touch". If you don't list it, the LLM will think it's fair game during Phase 3 audit cleanup.

### Section: Step 5 — Verify

Purpose: the verification command set + browser smoke matrix.

MUST contain:
1. `npx tsc --noEmit` (always — no exceptions).
2. `npm run lint -- {explicit file paths}` — paths must be literal, not glob.
3. `npm test --run {explicit test files}` if tests changed.
4. **Browser smoke matrix** — per-provider × per-state observations, one line per row.
5. **File-diff guard commands** — bash one-liners using `git diff --name-only origin/main -- {forbidden files}` that emit `✗` if anything was touched.

✅ Good (from wave13):

```bash
TABLES_DIR="app/integration/target-sources/[targetSourceId]/_components"
TARGETS=(
  "$TABLES_DIR/layout/WaitingApprovalTable.tsx"
  "$TABLES_DIR/layout/WaitingApprovalTable.test.tsx"
  ...
)

npx tsc --noEmit
npm run lint -- "${TARGETS[@]}"
npm test --run \
  "$TABLES_DIR/layout/WaitingApprovalTable.test.tsx" \
  ...
```

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  ... \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

✅ Browser smoke (from wave12):

```
- **Azure × WAITING_CONNECTION_TEST.** GuideCard appears between
  `ProcessStatusCard` and `ConfirmedResourcesSlot`. Warm-amber surface.
- **AWS-AUTO × WAITING_CONNECTION_TEST.** Same as above; slot key
  branches to the AWS-auto variant.
- **GCP × WAITING_CONNECTION_TEST.** Slot key resolves via the GCP
  branch of the registry.
- All three providers × all three steps: no console errors, no
  layout shift, no React key warnings.
```

❌ Bad:

```
Run tsc, lint, and tests. Open the browser and check it works.
```

### Section: Step 6 — Commit + push + PR

Purpose: the literal commands + the PR body template.

MUST contain:
1. `git add` with the exact file list (no `git add .`).
2. A heredoc commit message that:
   - Uses Conventional Commits: `<type>(<scope>): <desc> (<wave-key>)`.
   - First line ≤ 72 chars.
   - Body lists the per-file changes.
   - Ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
3. `git push -u origin <branch>` with the literal branch name.
4. A PR body template with these sections in order:
   - `## Summary`
   - `## Changes`
   - `## Out of scope` (or `## Deliberately excluded`)
   - `## Test plan` — markdown checklist

✅ Good commit subject:
- `feat(step-polish): Step 5+6+7 — GuideCard mount + cardTitle token swap (wave12)`
- `refactor(target-sources): approved/confirmed sections + delete (wave15-D2)`

❌ Bad commit subject:
- `Update tables` *(no type, no scope, no wave key)*
- `feat: improve UI` *(too vague)*

⛔ Rule: the PR body inside the spec must not include the literal string `gh pr create` (memory: `feedback_gh_pr_create_hook_workaround`). Use `gh api` if a wrapper command is needed.

### Section: Step 7 — Self-review checklist

Purpose: an unchecked-box list the implementer ticks before push.

MUST contain 10–20 items. Each item:
- Verifiable by `git diff` or `git grep` alone.
- Mixes positive checks (`X is present`) and negative checks (`Y is gone`).
- Includes the project-level mandatories: no `any`, no relative imports, no raw hex.
- Re-states the guard commands' expected outcomes.

✅ Good (excerpt from wave12):

```
- [ ] `WaitingConnectionTestStep` JSX order: `PageMeta` → `ProcessStatusCard`
      → `GuideCardContainer` → `ConfirmedResourcesSlot` → ...
- [ ] `cardStyles.cardTitle` consumed via the `cardStyles` import that
      already exists in Step 6 / Step 7. No new import for `cardTitle`.
- [ ] `text-lg font-semibold` is gone from `ConnectionVerifiedStep` and
      `InstallationCompleteStep`. `git grep "text-lg font-semibold"
      app/integration/target-sources/.../_components/layout/` returns
      zero hits on these three files.
- [ ] No `any` introduced. No relative imports introduced. No raw hex added.
- [ ] Stepper four-file guard passes.
- [ ] `npx tsc --noEmit` is clean.
```

❌ Bad:

```
- [ ] Code looks good
- [ ] Tests pass
```

### Section: Acceptance for this wave

Purpose: the outside-the-code definition of "done".

MUST contain (bullet list):
- 4–8 observable conditions, each starting with "Wave N is correct when..." or written as a positive statement.
- At least one condition references each major change in Step 3.
- At least one condition states what was NOT changed (negative acceptance).
- At least one condition is a guard command outcome.

✅ Good (from wave12):

```
Wave 12 is correct when:
- `WaitingConnectionTestStep`, `ConnectionVerifiedStep`, and
  `InstallationCompleteStep` each render `<GuideCardContainer>` after
  `ProcessStatusCard` and before their step-specific panels.
- `ConnectionVerifiedStep` and `InstallationCompleteStep` render their
  in-card `<h2>` with `cardStyles.cardTitle` — visibly 22 px / 700, not
  the previous 18 px / 600.
- `WaitingConnectionTestStep` has no typography change.
- The Wave-9 deliverables (...) are untouched.
- ADR-014 R3 stepper four-file guard passes.
- `tsc` is clean, lint is clean, the three step test files plus the
  coverage test are green.
```

## Universal RULES

These apply to every wave-task spec, regardless of topic.

### R1 — Language

- Spec body, headings, code comments, code identifiers: **English**.
- Korean UI strings (button labels, aria-labels, screen copy) inside code snippets: **preserve verbatim**. `완료 여부 관리자 승인 대기`, `${resource.resourceId} 복사` — never translate.
- Heredoc commit message body: **English**.
- The user's Korean requirements draft itself is never quoted in the spec — translate the *intent* into English prose.

### R2 — Scope

- One spec = one PR = one wave key.
- A spec must not span two PRs ("Phase A then Phase B"). If the work is two PRs, write two specs.
- A spec must not contain conditional branches ("if X then do Y, else do Z"). Decide which one in Phase A or stop and ask.

### R3 — Specificity

- Every file path in the spec must be resolvable to a real file (or stated as `(new)`).
- Every symbol named in the spec must currently exist (or be added in this spec).
- Every line-number reference must match the current `origin/main` HEAD (Phase B verifies).
- Audit / ADR / report references must include the section identifier (`§3 D2`, `§4 D5`, `R3`).

### R4 — Surgical-changes rule (project CLAUDE.md #3)

- The spec must explicitly state any orphan cleanup ("if `textColors` becomes unused, remove the import").
- The spec must NOT request "improve adjacent code", "while you're there", or "fix any other issues".
- Comments inside code snippets must describe invariants, not history (`AP-G9`).

### R5 — Project mandatories (project CLAUDE.md ⛔)

The spec body must reaffirm these for non-trivial waves:
- No `any` types.
- No relative imports — `@/` only.
- No raw hex colors — `theme.ts` tokens only.
- main branch is never edited — worktree mandatory (Step 1).

### R6 — Test-shape rules

- New tests use `satisfies <Type>` for fixtures, never `as <Type>`.
- Real registered enum/key literals over `'stub-foo' as Type` (`AP-A2`).
- Don't duplicate behavior tests across files — assert only the new mount/wiring.

### R7 — Helper / abstraction threshold

- ≤ 3 call sites: do **not** extract a shared helper. State this in Step 4.
- ≥ 4 call sites or a contract-shaped responsibility: extract.
- If the spec instructs an extraction, the helper's API must be fully specified (props, exports, file path).

### R8 — Subagent fan-out hints

Identify in the spec which Step 3 subsections are **independent** (different files, no shared edit). The `/wave-task` Phase 2 fan-out reads this signal. Example:

```
### 3-1. (independent layer)
File: `app/components/ui/CopyButton.tsx` (new)
...

### 3-2. (independent layer)
File: `lib/theme.ts` — add `cardStyles.cardTitle`
...
```

Use the phrase `(independent layer)` in the subsection title when applicable, or list non-overlap explicitly at the end of Step 3.

⛔ A single swagger endpoint's mock + route + FE types is **not** an independent layer set — it's one contract. Never mark it for fan-out.

### R9 — Out-of-scope discipline

- Out-of-scope items live in **both** the Context section (so the boundary is visible up-front) and the PR body template (so the merge record is honest).
- Use the wording "Wave N owns it" when a sibling wave is the rightful place.
- Use the wording "deferred to a later wave" only when the user has confirmed the deferral exists.

### R10 — Pre-flight verification (the spec author's own gate)

Before saving the spec, run mentally:

- [ ] Can an LLM with zero context produce the correct PR from this spec alone?
- [ ] Is every claim in the spec verified against the current code?
- [ ] Are the file paths, line numbers, and symbol names all real?
- [ ] Are the verify commands runnable as-is (no placeholders)?
- [ ] Does the commit message subject match `<type>(<scope>): <desc> (<wave-key>)`?
- [ ] Does the spec name an upstream dep? If yes, is the Precondition's `git grep` checking for that dep's symbol?
- [ ] Are Korean UI strings preserved verbatim inside code blocks?

If any of these is "no", the spec is not ready.

## Common failure modes (anti-patterns)

These are spec-author mistakes observed across PRs #347, #357 (closed without
merge) and other turbulence. Avoid each one explicitly.

### F1 — Ambitious LOC target divorced from JSX reality

Example: `wave14-B1c-azure-project-page-split.md` set a target of "main ≤ 220
LOC" but the actual delivery landed at 276 (deviation +56). The spec
forbade JSX restructuring at the same time, making the LOC target
unreachable. Result: PR #347 closed.

**Rule:** if the spec sets a numeric target, the spec author must verify
the target is reachable under the spec's other constraints.

### F2 — Step 3 written as paraphrase, not as code

Example: "Make the table render the copy button on hover" without the JSX.
The implementer invents a shape that doesn't match the prototype.

**Rule:** every Step 3 subsection includes at least one ```tsx / ```ts
fenced block showing the after-state.

### F3 — Skipped Precondition

Example: "Wave 12 follows Wave 9" stated in Context but no `git grep` in
Precondition. The wave runs on a stale local main without Wave 9, and the
import fails halfway through.

**Rule:** every upstream-dep claim in Context has a matching `git grep`
or `test -f` in Precondition.

### F4 — Helper extracted to abstract away two call sites

Example: a spec invents `<MonoIdCell>` for two table cells. The result
is +30 LOC of abstraction layer for -10 LOC at call sites — net negative.

**Rule:** see R7. State the call-site count explicitly in Step 4 ("three
call sites don't justify a helper").

### F5 — "Out of scope" only in PR body

The implementer finishes Step 3 with leftover state from an audit hit
that wasn't called out in Context. Phase 7 review then re-opens the
question.

**Rule:** Out-of-scope items appear in Context AND in PR body. The
implementer must see the boundary before they start, not after.

### F6 — Korean instructions inside code blocks

Example: a spec writes `<h2>완료 여부 관리자 승인 대기</h2>` in a snippet
showing the *new* heading shape. The Korean string is product copy —
this is correct. But a spec that writes `// 여기는 폼 검증 부분` as a code
comment inside the snippet violates the English-only rule for `.claude/**`
and the rendered code.

**Rule:** UI strings (button text, aria-label, h2 text) stay Korean.
Code comments are English.

### F7 — Verify section missing file-diff guard

Example: the spec lists `tsc / lint / test` but no `git diff --name-only`
guard against the forbidden files in Step 4. The Phase 3 audit catches
the leak — but only after the implementer has already touched the file.

**Rule:** every forbidden file or directory in Step 4 has a matching
`git diff --name-only origin/main -- <file>` line in Step 5.

### F8 — Acceptance written as TODO list, not as observable conditions

Example: `- [ ] Implement CopyButton  - [ ] Add tests`. These restate the
work, not the success state.

**Rule:** Acceptance items are observable from outside the code — what
a reviewer or a browser session can confirm. Use "Wave N is correct
when..." framing.

## Working example — minimal valid wave-task spec

The following is a deliberately tiny spec illustrating every required
section. Real specs are 100–600 lines; this skeleton is ~80.

````markdown
# Wave 17 — Detail page subtitle eyebrow (audit G9)

## Context

The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
flags **G9 / D7**: the prototype renders an eyebrow above the page title
on the target-source detail page, using `cardStyles.eyebrow`. The current
detail page omits it.

| File | Change |
|---|---|
| `app/integration/target-sources/[targetSourceId]/page.tsx` | mount `<PageMeta eyebrow=...>` prop |

Out of scope: any other page, eyebrow on cards, theme additions. Wave 9
already ships `cardStyles.eyebrow`.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "cardStyles.eyebrow" lib/theme.ts && echo "✓ Wave 9 merged"
```

If the check fails, stop. Wave 9 must follow before Wave 17.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave17-eyebrow --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave17-eyebrow
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search `.eyebrow`. The
   prototype renders `대상 시스템` above the page title at 12 / 600 /
   uppercase.
2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md` §3
   G9 — the audit prescription.
3. `app/integration/target-sources/[targetSourceId]/page.tsx` — current
   page shell; the `<PageMeta>` mount is at line ~42.
4. `app/components/ui/PageMeta.tsx` — confirms `eyebrow?: string` prop
   exists and renders with `cardStyles.eyebrow`.

## Step 3: Implementation

### 3-1. `page.tsx` — add `eyebrow` prop

Current state (line 42): `<PageMeta title={...} subtitle={...} />` — no
`eyebrow` prop.

Change shape:

```tsx
<PageMeta
  eyebrow="대상 시스템"
  title={project.name}
  subtitle={...}
/>
```

The literal `'대상 시스템'` is Korean UI copy per the prototype. No
constant extraction (single call site).

## Step 4: Do NOT touch

- `PageMeta.tsx` — already ships the `eyebrow` prop. Wave 17 only mounts.
- `lib/theme.ts` — `cardStyles.eyebrow` exists; no token change.
- ADR-014 R3 stepper four files — unrelated; freeze.
- Any other page consuming `<PageMeta>` — out of scope.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/page.tsx
```

Browser smoke:
- Azure × WAITING_APPROVAL: eyebrow `대상 시스템` renders above the
  page title in uppercase 12 px.
- AWS × WAITING_APPROVAL: same.
- GCP × WAITING_APPROVAL: same.

Out-of-scope guard:

```bash
git diff --name-only origin/main -- \
  app/components/ui/PageMeta.tsx \
  lib/theme.ts \
  | (read -r line && echo "✗ out-of-scope file modified: $line" || echo "✓ untouched")
```

## Step 6: Commit + push + PR

```bash
git add app/integration/target-sources/'[targetSourceId]'/page.tsx
git commit -m "$(cat <<'EOF'
feat(detail): eyebrow on target-source detail page (wave17)

Closes audit G9. Mounts the existing PageMeta eyebrow prop with the
prototype's '대상 시스템' label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/sit-step-polish-wave17-eyebrow
```

PR body:

```
## Summary
Wave 17. Closes audit G9 by mounting the existing PageMeta `eyebrow`
prop on the target-source detail page.

## Changes
- `page.tsx` — adds `eyebrow="대상 시스템"` to the `<PageMeta>` mount.

## Out of scope
- `PageMeta.tsx` (already ships the prop, Wave 9).
- `lib/theme.ts` (`cardStyles.eyebrow` exists).
- Any other page or card eyebrow.

## Test plan
- [x] Detail page renders the eyebrow on all three providers
- [x] tsc / lint clean
- [x] Out-of-scope guard passes
```

## Step 7: Self-review checklist

- [ ] `eyebrow="대상 시스템"` literal is Korean per the prototype, not translated.
- [ ] No new import added (PageMeta already imported).
- [ ] No `lib/theme.ts` edit.
- [ ] No other page touched in the diff.
- [ ] No `any`. No relative import. No raw hex.
- [ ] Stepper guard passes.
- [ ] `tsc --noEmit` clean.

## Acceptance for this wave

Wave 17 is correct when:
- The target-source detail page renders `대상 시스템` above the page title
  for every provider.
- `PageMeta.tsx`, `lib/theme.ts`, and the stepper four files are untouched.
- `tsc --noEmit` exits 0; lint introduces 0 new warnings.
- Audit punch-list G9 is closed for the detail page (G9 on other pages,
  if any, remains under their own waves).
````

## Self-check before writing the spec

After drafting, run these checks on the draft itself. Do not write the file
until all pass.

- [ ] All 10 sections present, in order, with the exact heading text.
- [ ] Heading title matches `# Wave <key> — <what + where>`.
- [ ] Context lists the triggering document + numbered gaps + scope table + upstream deps.
- [ ] Every claim in Context has a matching artifact in Precondition / Required reading / Verify.
- [ ] Precondition starts with `git fetch origin main` and has at least one upstream-dep check.
- [ ] Required reading entries each have a one-line purpose annotation.
- [ ] Every Step 3 subsection contains at least one ```tsx / ```ts fenced block.
- [ ] Every forbidden item in Step 4 has a matching `git diff --name-only` guard in Step 5.
- [ ] Step 6 commit subject matches `<type>(<scope>): <desc> (<wave-key>)`.
- [ ] Step 6 PR body does NOT contain the literal string `gh pr create`.
- [ ] Step 7 has ≥ 10 checkbox items, including no-`any` / no-relative-import / no-raw-hex.
- [ ] Acceptance has ≥ 4 observable conditions, at least one negative.
- [ ] No Korean prose in the spec body. Korean is allowed ONLY in product-copy literals inside code blocks.
- [ ] File paths and line numbers are verified against `origin/main` (Phase B).
- [ ] No two subsections describe the same file with conflicting instructions.
- [ ] The spec contains no `TODO`, `TBD`, `???`, or placeholder text.

## Prohibited

- Writing a spec when the user's Korean requirements draft is missing Goals, Constraints, or Acceptance — ask first, don't invent.
- Editing the user's requirements draft. The user reviews and edits it themselves; this skill only consumes it.
- Producing a spec that depends on a sibling wave whose spec doesn't yet exist or isn't merged. State the dep, but don't author the dep's spec in the same pass.
- Using `as <Type>` casts in spec code snippets (`AP-A2`).
- Marking a single swagger endpoint (mock + route + FE types) as `(independent layer)`.
- Including `gh pr create` as a literal string in the PR body block (memory: `feedback_gh_pr_create_hook_workaround`).

## Origin

This skill codifies the spec-author process behind the high-fidelity wave
specs that shipped between 2026-05-12 and 2026-05-14: `wave9-foundation`,
`wave10-step4-installing`, `wave11-step2-3-approval-applying`,
`wave12-step5-6-7-post-install`, `wave13-tables-copy-hover`,
`wave14-step1-candidate-polish`. These ran the `/wave-task` pipeline
end-to-end with single-iteration Phase 7 loops, which is the strongest
empirical signal that the underlying spec was correct.
