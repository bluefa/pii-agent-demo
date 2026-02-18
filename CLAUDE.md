# PII Agent — Claude Code Rules

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## ⛔ CRITICAL (위반 시 즉시 중단)

1. **main 브랜치 수정 금지** — `scripts/guard-worktree.sh` 실행 후 worktree에서 작업
2. **any 타입 금지**
3. **상대 경로 import 금지** — `@/` 절대 경로만
4. **Raw 색상 클래스 직접 사용 금지** — theme.ts 토큰 또는 UI 컴포넌트를 통해서만 적용

## Tech Stack

Next.js 14 (App Router) · TypeScript · TailwindCSS · Desktop only · 한국어 UI

## Skill 라우팅

| 작업 | Skill | 트리거 |
|------|-------|--------|
| 코드 작성·스타일·구조 | `/coding-standards` | 자동 |
| 기능 개발 워크플로우 | `/feature-development` | 구현 요청 시 |
| UI/디자인 | `/frontend-design` | 디자인 요청 시 |
| 코드 리뷰 | `/code-review` | 리뷰 요청 시 |
| Worktree 설정 | `/worktree` | 수동 |
| PR 생성·머지 | `/pr`, `/pr-merge` | 수동 |
| UX 현황 분석 | `/ux-audit` | UX 수정 전 현황 파악 시 |
| UX 요구사항 도출 | `/ux-requirements` | UI 기능 설계 시 |

## Git Workflow

- main 직접 push 금지
- `bash scripts/create-worktree.sh --topic {name} --prefix {prefix}`
- Prefix: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`
- **⛔ push/PR 전**: `git fetch origin main && git rebase origin/main` 필수
- **개발 완료 즉시 commit & rebase & push** — 사용자 확인 대기 없이 바로 수행
- PR Merge 이전 문서화 필수

## Reference Docs

| 문서 | 위치 |
|------|------|
| Shared Agent Rules | `AGENTS.md` |
| 비즈니스 도메인 | `docs/domain/README.md` |
| Cloud Provider 프로세스 | `docs/cloud-provider-states.md` |
| BFF API 명세 (Swagger) | `docs/swagger/*.yaml` |
| API Routes | `docs/api-routes/README.md` |
| ADR | `docs/adr/README.md` |
| CSR 에러 처리 전략 | `docs/adr/008-error-handling-strategy.md` |
| Skills | `.claude/skills/README.md` |
