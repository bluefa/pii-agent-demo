# Wave-Task Spec — Required Structure

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

## Heading title

Format: `# Wave N — <what + where>`

- `Wave N` matches the wave key (`wave12`, `wave15-B1c`, `wave9-foundation`).
- Title states **what changes** and **where**, not the motivation.

✅ `# Wave 12 — Step 5 + Step 6 + Step 7 post-install polish (GuideCard + cardTitle)`
✅ `# Wave 13 — Tables copy-on-hover (3 cross-cutting tables)`
❌ `# Wave 12 — Improve UI` *(too vague)*
❌ `# Wave 12 — Closes audit punch-list G1+G3` *(why, not what)*

## Section: Context

Purpose: tell the implementer *why this wave exists* and *what the boundary is*.

MUST contain:
1. The triggering document (audit / ADR / report) — link by file path.
2. Numbered list of gaps / decisions being closed, each tagged with the source identifier (`G1`, `D2`, `T17`, `R3`, etc.).
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

## Section: Precondition

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

## Section: Step 1 — Worktree

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

## Section: Step 2 — Required reading

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

## Section: Step 3 — Implementation

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

````
Current state (lines 70–110): the table renders `Resource ID`, `Region`,
and `Resource Name` as `font-mono` cells with the `textColors.secondary`
treatment. The `#`, `DB Type`, ... columns are NOT mono identifiers — they
stay untouched.

Change shape — add the import, add `'group'` to the `<tr>`, rewrite the
three mono cells...

```tsx
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
```

`MONO_CELL` is a local `const` inside the component — it deduplicates the
three identical className expressions, not a public helper.

**Why these three columns:** Resource ID, Region, Resource Name are mono
identifiers per the prototype...
````

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

## Section: Step 4 — Do NOT touch

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

## Section: Step 5 — Verify

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

## Section: Step 6 — Commit + push + PR

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

⛔ Rule: the PR body inside the spec must not include the literal string `gh pr create` (project memory: `feedback_gh_pr_create_hook_workaround`). Use `gh api` if a wrapper command is needed.

## Section: Step 7 — Self-review checklist

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

## Section: Acceptance for this wave

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
