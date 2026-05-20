# Wave-Task Spec — Universal Rules (R1–R10)

These apply to every wave-task spec, regardless of topic. Apply continuously
while drafting; verify in Phase D via [self-check.md](./self-check.md).

## R1 — Language

- Spec body, headings, code comments, code identifiers: **English**.
- Korean UI strings (button labels, aria-labels, screen copy) inside code snippets: **preserve verbatim**. `완료 여부 관리자 승인 대기`, `${resource.resourceId} 복사` — never translate.
- Heredoc commit message body: **English**.
- The user's Korean requirements draft itself is never quoted in the spec — translate the *intent* into English prose.

## R2 — Scope

- One spec = one PR = one wave key.
- A spec must not span two PRs ("Phase A then Phase B"). If the work is two PRs, write two specs.
- A spec must not contain conditional branches ("if X then do Y, else do Z"). Decide which one in Phase A or stop and ask.

## R3 — Specificity

- Every file path in the spec must be resolvable to a real file (or stated as `(new)`).
- Every symbol named in the spec must currently exist (or be added in this spec).
- Every line-number reference must match the current `origin/main` HEAD (Phase B verifies).
- Audit / ADR / report references must include the section identifier (`§3 D2`, `§4 D5`, `R3`).

## R4 — Surgical-changes rule (project CLAUDE.md #3)

- The spec must explicitly state any orphan cleanup ("if `textColors` becomes unused, remove the import").
- The spec must NOT request "improve adjacent code", "while you're there", or "fix any other issues".
- Comments inside code snippets must describe invariants, not history (`AP-G9`).

## R5 — Project mandatories (project CLAUDE.md ⛔)

The spec body must reaffirm these for non-trivial waves:
- No `any` types.
- No relative imports — `@/` only.
- No raw hex colors — `theme.ts` tokens only.
- main branch is never edited — worktree mandatory (Step 1).

## R6 — Test-shape rules

- New tests use `satisfies <Type>` for fixtures, never `as <Type>`.
- Real registered enum/key literals over `'stub-foo' as Type` (`AP-A2`).
- Don't duplicate behavior tests across files — assert only the new mount/wiring.

## R7 — Helper / abstraction threshold

- ≤ 3 call sites: do **not** extract a shared helper. State this in Step 4.
- ≥ 4 call sites or a contract-shaped responsibility: extract.
- If the spec instructs an extraction, the helper's API must be fully specified (props, exports, file path).

## R8 — Subagent fan-out hints

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

## R9 — Out-of-scope discipline

- Out-of-scope items live in **both** the Context section (so the boundary is visible up-front) and the PR body template (so the merge record is honest).
- Use the wording "Wave N owns it" when a sibling wave is the rightful place.
- Use the wording "deferred to a later wave" only when the user has confirmed the deferral exists.

## R10 — Pre-flight verification (the spec author's own gate)

Before saving the spec, run mentally:

- [ ] Can an LLM with zero context produce the correct PR from this spec alone?
- [ ] Is every claim in the spec verified against the current code?
- [ ] Are the file paths, line numbers, and symbol names all real?
- [ ] Are the verify commands runnable as-is (no placeholders)?
- [ ] Does the commit message subject match `<type>(<scope>): <desc> (<wave-key>)`?
- [ ] Does the spec name an upstream dep? If yes, is the Precondition's `git grep` checking for that dep's symbol?
- [ ] Are Korean UI strings preserved verbatim inside code blocks?

If any of these is "no", the spec is not ready. Run the full
[self-check.md](./self-check.md) gate before writing the file.
