# PII Agent — Shared Agent Rules

This file defines shared rules for coding agents working in this repository.
Apply these rules in both Codex and Claude Code sessions.

## 1) Worktree-First Workflow (Required)

- Never implement code changes directly on `main` or `master`.
- Never implement code changes from the canonical repo path:
  - `/Users/study/pii-agent-demo`
- Run `scripts/guard-worktree.sh` before code edits.
- If blocked, create and move to a worktree first:

```bash
git worktree add ../pii-agent-demo-{topic} -b feat/{topic}
```

Allowed branch prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`, `codex/`.

## 2) Think Before Coding

- State assumptions explicitly.
- If requirements are ambiguous, ask before implementing.
- If multiple interpretations exist, surface options and tradeoffs.
- Prefer the simplest valid approach and call out unnecessary complexity.

## 3) Simplicity First

- Implement only what was requested.
- Do not add speculative abstractions or optionality.
- Do not add impossible-case handling.
- If implementation became bloated, simplify before finalizing.

## 4) Surgical Changes

- Touch only files and lines needed for the request.
- Follow existing project style and patterns.
- Do not refactor unrelated areas.
- Remove only unused artifacts caused by your own change.
- Report unrelated issues; do not silently modify them.

## 5) Goal-Driven Execution

- Convert requests into verifiable checks.
- For bug fixes, add/adjust tests when feasible.
- Before finishing, run relevant checks and report results:
  - `npm run test:run`
  - `npm run lint`
  - `npm run build` (if build impact exists)

## 6) Project Coding Rules

- No `any` type. Use concrete types or `unknown` + type guard.
- Use `@/` absolute imports only.
- For modal state, use `useModal()`.
- For API mutation flows, use `useApiMutation()`.
- Use Tailwind for layout; no standalone CSS files.
- Desktop-only UI unless explicitly requested otherwise.

## 7) Styling Rules (Design System)

- Do not hardcode raw color classes in feature code (`bg-blue-600`, `text-red-500`, etc.).
- Use tokens/helpers from `lib/theme.ts` and existing UI components.
- Prefer shared UI components in `app/components/ui`.

## 8) API + ADR Guardrails

- `app/api/**` routes must follow `docs/api/**` specs.
- ADR-005 required:
  - Do not import `@/lib/mock-*` directly inside API Routes.
  - Use `@/lib/adapters` (`dataAdapter`) instead.
- ADR-006 required when touching approval/install/confirmation flows:
  - `docs/adr/006-integration-confirmation-approval-redesign.md`
  - `docs/cloud-provider-states.md`

## 9) Skill Routing

- Implementation tasks:
  - `.codex/skills/feature-development/SKILL.md` (mirror)
  - `.codex/skills/coding-standards/SKILL.md` (mirror)
  - `.claude/skills/feature-development/SKILL.md`
  - `.claude/skills/coding-standards/SKILL.md`
- Code review tasks:
  - `.codex/skills/code-review/SKILL.md` (mirror)
  - `.claude/skills/code-review/SKILL.md`
- UI/UX tasks:
  - `.codex/skills/frontend-design/SKILL.md` (mirror)
  - `.claude/skills/frontend-design/SKILL.md`

### Codex Skill Triggers

- Worktree/branch setup 요청:
  - `.codex/skills/worktree/SKILL.md`
- PR 생성/검증 요청:
  - `.codex/skills/pr/SKILL.md`
- 구현/기능 추가 요청:
  - `.codex/skills/feature-development/SKILL.md`
- 코딩 규칙/스타일 검토 요청:
  - `.codex/skills/coding-standards/SKILL.md`
- 코드 리뷰 요청:
  - `.codex/skills/code-review/SKILL.md`

## 10) Precedence

- Higher-priority runtime/system rules take precedence over this file.
- If this file conflicts with explicit user direction for a task, confirm intent and proceed with the user-approved path.
