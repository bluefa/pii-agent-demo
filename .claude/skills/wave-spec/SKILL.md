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
is correct when an LLM with zero conversation context can still produce the
right PR.

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

## Process (4 phases)

### Phase A — Read & classify the Korean draft

1. Read the draft top to bottom. **Do not edit it.**
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

Findings from this phase populate `Step 2: Required reading` and the `Precondition` block. **Do not paraphrase the user's Korean — use the verified file paths.**

### Phase C — Draft the spec

Read **[template.md](./template.md)** for the 10-section structure and
section-by-section ✅ / ❌ guidance. Write in English; keep Korean UI strings
verbatim where they appear in product copy.

While drafting, apply the 10 universal rules in **[rules.md](./rules.md)**
(R1–R10) and avoid the failure modes catalogued in
**[anti-patterns.md](./anti-patterns.md)** (F1–F8).

If unsure how a finished spec should read, study **[example.md](./example.md)**
— a complete ~80-line Wave 17 mini-spec demonstrating every required section.

### Phase D — Self-check before handing off

Run the 16-item gate in **[self-check.md](./self-check.md)** against the
draft. Fix any miss. Then write the file and report the path to the user.

## Reference files (read on demand)

| File | When to read |
|---|---|
| [template.md](./template.md) | Phase C — every time you draft a section. |
| [rules.md](./rules.md) | Phase C — applied continuously while drafting. |
| [anti-patterns.md](./anti-patterns.md) | Phase C — sanity check after the first pass. |
| [example.md](./example.md) | Phase C — when you need a complete worked reference. |
| [self-check.md](./self-check.md) | Phase D — final gate before saving. |

## Top-level prohibitions

- Writing a spec when the user's Korean requirements draft is missing Goals, Constraints, or Acceptance — ask first, don't invent.
- Editing the user's requirements draft. The user reviews and edits it themselves; this skill only consumes.
- Producing a spec that depends on a sibling wave whose spec doesn't yet exist or isn't merged. State the dep, but don't author the dep's spec in the same pass.

See **[self-check.md § Prohibited](./self-check.md)** for the full list.

## Origin

This skill codifies the spec-author process behind the high-fidelity wave
specs that shipped between 2026-05-12 and 2026-05-14: `wave9-foundation`,
`wave10-step4-installing`, `wave11-step2-3-approval-applying`,
`wave12-step5-6-7-post-install`, `wave13-tables-copy-hover`,
`wave14-step1-candidate-polish`. These ran the `/wave-task` pipeline
end-to-end with single-iteration Phase 7 loops, which is the strongest
empirical signal that the underlying spec was correct.
