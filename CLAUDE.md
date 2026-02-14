# PII Agent — Claude Code Rules

## 핵심 원칙 (from AGENTS.md)

- **Simplicity First**: 요청된 것만 구현. 투기적 추상화·옵션·불가능 케이스 핸들링 금지. 구현이 비대해지면 완료 전 단순화.
- **Think Before Coding**: 가정을 명시. 모호하면 구현 전에 질문. 가장 단순한 접근을 우선.
- **Surgical Changes**: 요청에 필요한 파일/줄만 변경. 무관한 영역 리팩토링 금지.

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
| BFF API 명세 | `docs/api/{common,core,scan}.md`, `docs/api/providers/*.md` |
| API Routes | `docs/api-routes/README.md` |
| ADR | `docs/adr/README.md` |
| Skills | `.claude/skills/README.md` |
