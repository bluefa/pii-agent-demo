---
name: code-review
description: Review changes for merge risk by routing to the current repo authorities. Use for local code review, PR review summaries, and quality checks.
context: fork
agent: Explore
---

# Code Review Router

This skill is a review entrypoint, not the source of coding rules and not a
general clean-code catalogue. Its job is to decide which current authority
documents apply, then report concrete merge risk with file and line evidence.

## Primary Role

Prioritize findings that can break users, contracts, security, permissions,
builds, tests, or established repository boundaries. Treat maintainability and
clean-code concerns as secondary unless they create a specific, explainable
risk in this change.

Avoid preference-only comments. A finding needs at least one of:

- A runtime or user-facing failure mode.
- A contract, boundary, or architecture violation.
- A test, build, lint, type, or documented rule violation.
- A clear future maintenance risk caused by this diff, not by unrelated legacy code.

## Authority Routing

Always read the changed files first, then select the relevant references:

- Hard repo rules: `AGENTS.md` and `CLAUDE.md`
- Repo map and import boundaries: `coding-standards`
- UI or visual changes: `frontend-design`, `DESIGN.md`, `lib/theme.ts`, and existing `app/components/ui`
- React or Next.js performance changes: `vercel-react-best-practices`
- API route, CSR helper, Server Component data access, or BFF changes: `docs/api/boundaries.md` and ADR-011
- CSR error handling: ADR-008, `lib/fetch-json.ts`, and `lib/errors.ts`
- Approval, install, confirmation, or provider state flows: ADR-006 and `docs/cloud-provider-states.md`
- API contract changes: Swagger under `docs/swagger/*.yaml`, `CONTRACT_CHECK.md` when present, otherwise the compatibility pointer at `.claude/skills/shared/CONTRACT_VALIDATION.md`
- PR URL or PR number review: use `pr-context-review` so PR description, commit history, previous comments, and latest head are checked

If a skill file disagrees with a more specific document such as an ADR,
`DESIGN.md`, Swagger, or `docs/api/boundaries.md`, trust the specific document
and flag the stale skill as a separate maintenance issue only when relevant.

## Review Checks

Use this order:

1. Scope and intent: compare the diff with the user's request or PR description.
2. Contract and boundary safety: API shapes, timestamps as strings, BFF routing, import boundaries, permission checks, and data flow.
3. Runtime correctness: loading, empty, error, disabled, selected, and success states where relevant.
4. Verification: inspect existing workflow evidence, then run only focused checks that materially confirm or reject a specific risk.
5. Maintainability: duplication, naming, component size, abstractions, and clean-code issues only when they affect the changed behavior or future change safety.

## Severity

- `P1`: likely breakage, contract mismatch, security/permission issue, data loss, failed build/type/lint/test, or violation of a hard repository boundary.
- `P2`: real behavioral risk, missing important state, incomplete migration, or maintainability issue that will likely cause near-term mistakes.
- `P3`: low-risk cleanup, readability, naming, or optional simplification.

## Output

Findings come first, ordered by severity. Each finding must include:

- `severity`
- `file:line`
- actual impact
- why this change causes it
- the authority or evidence used

If there are no findings, say so clearly and list any verification that was not
run or any residual risk.

Do not duplicate the repo's broad validation matrix. When exact validation
behavior matters, read the current hooks and PR scripts. Preserve intentionally
quiet hook success behavior.

Do not modify files during review.
