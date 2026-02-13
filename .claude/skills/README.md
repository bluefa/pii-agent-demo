# PII Agent Skills

Claude Code에서 사용하는 프로젝트 전용 스킬 모음입니다.

## 사용 가능한 스킬

| 스킬 | 명령어 | 설명 | 자동 호출 | 사용 에이전트 |
|------|--------|------|----------|--------------|
| [feature-development](./feature-development/SKILL.md) | `/feature-development` | 새 기능 개발 워크플로우 | O | code-implementer |
| [coding-standards](./coding-standards/SKILL.md) | `/coding-standards` | 코딩 규칙 및 패턴 | O | 전체 |
| [code-review](./code-review/SKILL.md) | `/code-review` | 코드 리뷰 가이드 | O | code-reviewer |
| [frontend-design](./frontend-design/SKILL.md) | `/frontend-design` | 프론트엔드 디자인 | O | designer |
| [dev-server](./dev-server/SKILL.md) | `/dev-server` | Worktree dev 서버 실행 | - | team-lead |
| [worktree](./worktree/SKILL.md) | `/worktree` | worktree + 브랜치 초기 세팅 강제 | O | code-implementer |
| [pr](./pr/SKILL.md) | `/pr` | 검증 후 PR 생성 워크플로우 | O | code-implementer |
| [pr-merge](./pr-merge/SKILL.md) | `/pr-merge` | PR 머지 워크플로우 (squid 지원) | O | code-implementer |
| [pr-flow](./pr-flow/SKILL.md) | `/pr-flow` | PR 생성+머지+브랜치정리 자동화 | O | code-implementer |

## 에이전트 (Agents)

### 팀 에이전트 (`/team-dev` 명령어로 사용)

| 에이전트 | 파일 | 역할 | 접근 권한 |
|----------|------|------|----------|
| code-reviewer | `.claude/agents/code-reviewer.md` | 종합 코드 리뷰 | Read-only |
| code-implementer | `.claude/agents/code-implementer.md` | 기능 구현 | Full |
| designer | `.claude/agents/designer.md` | UI 디자인/구현 | Full |
| ux-expert | `.claude/agents/ux-expert.md` | UX 분석/제안 | Read-only |

### 경량 리뷰 에이전트 (`/review` 명령어로 사용)

| 에이전트 | 파일 | 역할 |
|----------|------|------|
| typescript-checker | `.claude/agents/typescript-checker.md` | TS 규칙 검사 |
| react-pattern | `.claude/agents/react-pattern.md` | React 패턴 검사 |
| tailwind-style | `.claude/agents/tailwind-style.md` | 스타일 규칙 검사 |
| project-structure | `.claude/agents/project-structure.md` | 프로젝트 구조 검사 |

## 명령어 (Commands)

| 명령어 | 파일 | 설명 |
|--------|------|------|
| `/team-dev` | `.claude/commands/team-dev.md` | 팀 기반 개발 모드 시작 |
| `/review` | `.claude/commands/review.md` | 경량 병렬 코드 리뷰 |
| `/sadd` | `.claude/commands/sadd.md` | 서브에이전트 주도 개발 |

## 스킬 구조

```
.claude/
├── skills/
│   ├── README.md
│   ├── feature-development/
│   │   └── SKILL.md
│   ├── coding-standards/
│   │   └── SKILL.md
│   ├── code-review/
│   │   └── SKILL.md
│   ├── frontend-design/
│   │   └── SKILL.md
│   ├── worktree/
│   │   └── SKILL.md
│   ├── dev-server/
│   │   └── SKILL.md
│   ├── pr/
│   │   └── SKILL.md
│   ├── pr-merge/
│   │   └── SKILL.md
│   └── pr-flow/
│       └── SKILL.md
├── agents/
│   ├── code-reviewer.md         # 팀: 종합 코드 리뷰
│   ├── code-implementer.md      # 팀: 코드 구현
│   ├── designer.md              # 팀: UI 디자인
│   ├── ux-expert.md             # 팀: UX 분석
│   ├── typescript-checker.md    # 경량 리뷰
│   ├── react-pattern.md         # 경량 리뷰
│   ├── tailwind-style.md        # 경량 리뷰
│   └── project-structure.md     # 경량 리뷰
└── commands/
    ├── team-dev.md              # 팀 개발 모드
    ├── review.md                # 병렬 코드 리뷰
    └── sadd.md                  # 서브에이전트 개발
```

## 관련 문서

- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 전체 지침
- [docs/adr/](../../docs/adr/) - 설계 결정 기록
- [docs/api/](../../docs/api/) - BFF API 명세

## Codex 미러링

- Claude Skills는 `scripts/sync-claude-skills-to-codex.sh`로 repo 내부 `.codex/skills`에 동기화됩니다.
- Git hooks 경로(`.githooks`)가 활성화된 경우 아래 시점에 자동 동기화됩니다:
  - `post-checkout`
  - `post-merge`
  - `post-commit`
