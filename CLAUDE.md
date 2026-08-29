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
5. **영어 전용 경로에서는 영어로만 작성** — `.claude/skills/**`, `.claude/agents/**`, `.claude/hooks/**`, `docs/adr/**`, `docs/reports/**/(anti-pattern|audit|retrospective)*`, 모든 `CLAUDE.md`/`AGENTS.md`/`README.md`. PR description과 code comment도 영어. 사용자 대화는 한국어 유지. 한국어 허용 경로: `docs/domain/`, `docs/ux/`, UI 문자열, `memory/`

## Tech Stack

Next.js 14 (App Router) · TypeScript · TailwindCSS · Desktop only · 한국어 UI

## Verification & Observation Budget

Cost scales with change size. These are in-loop rules only — `pre-commit` still runs the full
lint + tsc + test + build gate on every commit, so nothing here weakens the gate.

### Test tiering (in-loop)

| Change | Run in loop | Why |
|---|---|---|
| Token/style 1-2 lines, copy, markdown | nothing | pre-commit runs the full suite |
| One component or route | `npm run test:changed` | related tests only — 6.6s vs 40.7s |
| Contract, mock, shared `lib/` module | `npm run test:run` | blast radius is wide |

Never call bare `npx vitest run` in the loop. There is exactly one full gate: `pre-commit`.

### Observation budget

- **Never read a number off a screenshot.** Color, contrast, width, spacing and font size come
  from `javascript_tool` (`getComputedStyle` / `getBoundingClientRect`). A screenshot costs
  ~58KB of context; the measured number costs ~0.5KB.
- Screenshot only for judgement — is the layout broken, does the design read as intended.
  **Max 3 per turn.**
- Responsive checks measure every width in one `javascript_tool` batch, not one capture per width.

### Navigation budget

A file over ~1,000 lines is found, not read. `lib/theme.ts` is 4,407 lines across 63 export
blocks; over 45 sessions its 808 tool calls ran 3:1 navigate-to-edit, and 390 of them were
broad greps. `text-[` hits 385 times across that file and 74 inside a single block, so a
class-fragment grep returns a haystack and buys another grep.

Take the index once, then jump straight to the block:

```bash
grep -n '^export const' lib/theme.ts   # 63 blocks, 2.5KB — the whole map
sed -n '1434,2269p' lib/theme.ts       # the one block the map named
```

Do not grep a large file for a class fragment (`card`, `border`, `text-[`, `hover`, `bg-`)
before the map has told you which block owns it.

## Skill 라우팅

| 작업 | Skill | 트리거 |
|------|-------|--------|
| 코드 작성·스타일·구조 | `/coding-standards` | 자동 |
| 기능 개발 워크플로우 | `/feature-development` | 구현 요청 시 |
| UI/디자인 | `/frontend-design` | 디자인 요청 시 |
| 코드 리뷰 | `/code-review` | 리뷰 요청 시 |
| Codex cross-review | `/codex-review` | External model validation before major decisions or PRs |
| Worktree 설정 | `/worktree` | 수동 |
| PR 생성·머지 | `/pr`, `/pr-merge` | 수동 |
| UX 현황 분석 | `/ux-audit` | UX 수정 전 현황 파악 시 |
| UX 요구사항 도출 | `/ux-requirements` | UI 기능 설계 시 |
| 안티패턴 카탈로그 | `/anti-patterns` | 코드 작성·리뷰 시 자동 |

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
| API 경계 (CSR/SSR/Route) | `docs/api/boundaries.md` |
| ADR | `docs/adr/README.md` |
| CSR 에러 처리 전략 | `docs/adr/008-error-handling-strategy.md` |
| Skills | `.claude/skills/README.md` |
