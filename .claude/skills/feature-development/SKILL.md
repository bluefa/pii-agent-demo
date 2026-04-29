---
name: feature-development
description: Workflow for focused feature work, bug fixes, API changes, and component changes.
---

# Feature Development Workflow

Use this skill for implementation work. Keep the change scoped to the request
and route detailed rules to the current repo authorities instead of copying
them here.

## 0. Worktree Required

Before editing code:

```bash
bash scripts/guard-worktree.sh
```

If the guard blocks you, create a fresh worktree from updated `main`:

```bash
bash scripts/create-worktree.sh --topic {name} --prefix {prefix}
bash scripts/bootstrap-worktree.sh "$(pwd)"
```

Allowed prefixes: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `codex`.

## 1. Requirements And Authorities

- Read nearby existing code before changing a module.
- Use `coding-standards` as the repo map.
- UI work: read `DESIGN.md`, `frontend-design`, `lib/theme.ts`, and existing
  `app/components/ui` primitives.
- API/BFF/data-access work: read `docs/api/boundaries.md`, the relevant ADRs,
  and Swagger under `docs/swagger/*.yaml`.
- Approval, install, confirmation, or provider state flows: read ADR-006 and
  `docs/cloud-provider-states.md`.
- API contract changes: use `CONTRACT_CHECK.md` when present; otherwise use the
  compatibility pointer at `.claude/skills/shared/CONTRACT_VALIDATION.md`.

## 2. Contract-First API Work

Swagger is the public API contract source. Before API code changes, map the
affected endpoint:

- request required fields
- response required fields
- enum values
- renamed, removed, or legacy alias fields
- expected error response shape and timestamp string fields

Do not treat lint, tests, build, or contract check as proof of contract safety
by themselves. If the public contract changes, update Swagger in the same
change or stop and ask before editing Swagger.

## 3. Implementation Order

Use only the slices that apply:

```text
1. docs/swagger/*.yaml                     Public API contract, if contract changes
2. lib/types/*.ts                          Shared domain and UI-facing types
3. lib/constants/*.ts                      Shared constants and labels
4. lib/bff/types/**                        Typed BFF method contracts
5. lib/bff/mock/**                         Mock BFF domain behavior
6. lib/bff/http.ts                         Real upstream BFF adapter
7. app/integration/api/v1/**/route.ts      Thin route handlers using bff.method()
8. app/lib/api/**                          CSR helpers for client components
9. tests near the changed code             Focused regression coverage
10. app/components/**, app/integration/**  UI integration using design tokens
```

ADR-011 is current for BFF access. Route handlers and Server Components use
`bff` from `@/lib/bff/client`; CSR components use `@/app/lib/api/*`.

## 4. Parallel Work

- Do not split one endpoint's route, mock/BFF behavior, and UI-facing type work
  across concurrent agents. That causes field-name drift.
- Parallelize only independent slices such as isolated UI components,
  types-only additions, unrelated helpers, or verification tasks.
- Give subagents file ownership and explicit acceptance criteria.

## 5. Mockup-Based UI Work

Before coding from a mockup, extract:

- required text, badges, status copy, counts, and hints
- required UI patterns such as tabs, segmented controls, progress bars, cards,
  and editor behavior
- route entry points, navigation labels, and active-route matching changes
- state combinations such as one-side edited, both edited, neither edited

Preserve meaningful mockup patterns unless the user approves a different
interaction.

## 6. Validation

Broad mechanical validation is owned by current repo workflows. Do not copy a
fixed command matrix into this skill; read the active hook or script when exact
behavior matters:

- `.githooks/pre-commit`
- `.codex/hooks/pre-bash-pr-create.sh`
- `.claude/hooks/pre-bash-pr-create.sh`
- `/pr` and `/pr-flow`
- `CONTRACT_CHECK.md` when present

During implementation, run focused checks only when they materially reduce risk
for the changed files. Report both the checks run locally and the checks left to
those workflows. Preserve intentionally quiet hook success behavior.

## 7. Completion

- Remove only unused artifacts introduced by your own change.
- Keep unrelated issues out of the diff; mention them instead.
- If opening a PR, use `/pr` or `/pr-flow` rather than hand-writing a minimal
  PR description.
