# Wave-Task Spec — Phase D Self-Check & Prohibited

Run this gate against the draft before writing the file to disk. Do not save
until every box passes.

## 16-item self-check

- [ ] All 10 sections present, in order, with the exact heading text (see [template.md](./template.md)).
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
- Marking a single swagger endpoint (mock + route + FE types) as `(independent layer)` (see [rules.md § R8](./rules.md)).
- Including `gh pr create` as a literal string in the PR body block (project memory: `feedback_gh_pr_create_hook_workaround`).
