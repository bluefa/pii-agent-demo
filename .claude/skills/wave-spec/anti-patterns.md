# Wave-Task Spec — Failure Modes (F1–F8)

These are spec-author mistakes observed across PRs #347, #357 (closed without
merge) and other turbulence in the wave-task pipeline. Avoid each one
explicitly while drafting.

## F1 — Ambitious LOC target divorced from JSX reality

Example: `wave14-B1c-azure-project-page-split.md` set a target of "main ≤ 220
LOC" but the actual delivery landed at 276 (deviation +56). The spec
forbade JSX restructuring at the same time, making the LOC target
unreachable. Result: PR #347 closed.

**Rule:** if the spec sets a numeric target, the spec author must verify
the target is reachable under the spec's other constraints.

## F2 — Step 3 written as paraphrase, not as code

Example: "Make the table render the copy button on hover" without the JSX.
The implementer invents a shape that doesn't match the prototype.

**Rule:** every Step 3 subsection includes at least one ```tsx / ```ts
fenced block showing the after-state.

## F3 — Skipped Precondition

Example: "Wave 12 follows Wave 9" stated in Context but no `git grep` in
Precondition. The wave runs on a stale local main without Wave 9, and the
import fails halfway through.

**Rule:** every upstream-dep claim in Context has a matching `git grep`
or `test -f` in Precondition.

## F4 — Helper extracted to abstract away two call sites

Example: a spec invents `<MonoIdCell>` for two table cells. The result
is +30 LOC of abstraction layer for −10 LOC at call sites — net negative.

**Rule:** see [rules.md § R7](./rules.md). State the call-site count
explicitly in Step 4 ("three call sites don't justify a helper").

## F5 — "Out of scope" only in PR body

The implementer finishes Step 3 with leftover state from an audit hit
that wasn't called out in Context. Phase 7 review then re-opens the
question.

**Rule:** Out-of-scope items appear in Context AND in PR body. The
implementer must see the boundary before they start, not after.

## F6 — Korean instructions inside code blocks

Example: a spec writes `<h2>완료 여부 관리자 승인 대기</h2>` in a snippet
showing the *new* heading shape. The Korean string is product copy —
this is correct. But a spec that writes `// 여기는 폼 검증 부분` as a code
comment inside the snippet violates the English-only rule for `.claude/**`
and the rendered code.

**Rule:** UI strings (button text, aria-label, h2 text) stay Korean.
Code comments are English.

## F7 — Verify section missing file-diff guard

Example: the spec lists `tsc / lint / test` but no `git diff --name-only`
guard against the forbidden files in Step 4. The Phase 3 audit catches
the leak — but only after the implementer has already touched the file.

**Rule:** every forbidden file or directory in Step 4 has a matching
`git diff --name-only origin/main -- <file>` line in Step 5.

## F8 — Acceptance written as TODO list, not as observable conditions

Example: `- [ ] Implement CopyButton  - [ ] Add tests`. These restate the
work, not the success state.

**Rule:** Acceptance items are observable from outside the code — what
a reviewer or a browser session can confirm. Use "Wave N is correct
when..." framing.
