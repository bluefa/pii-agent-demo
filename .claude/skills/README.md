# PII Agent Skills

Claude Code에서 사용하는 프로젝트 전용 스킬 모음입니다.

## 사용 가능한 스킬

| 스킬 | 명령어 | 설명 | 자동 호출 |
|------|--------|------|----------|
| [feature-development](./feature-development/SKILL.md) | `/feature-development` | 새 기능 개발 워크플로우 | O |
| [coding-standards](./coding-standards/SKILL.md) | `/coding-standards` | 코딩 규칙 및 패턴 | O |
| [code-review](./code-review/SKILL.md) | `/code-review` | 코드 리뷰 가이드 | O |

## 스킬 사용법

### 자동 호출
Claude가 관련 작업 시 자동으로 스킬을 로드합니다:
- 기능 구현 요청 → `feature-development`
- 코드 작성 시 → `coding-standards`
- 리뷰 요청 시 → `code-review`

### 직접 호출
```
/feature-development
/coding-standards
/code-review [파일경로]
```

## 스킬 구조

```
.claude/skills/
├── README.md                    # 이 파일
├── feature-development/
│   └── SKILL.md                # 기능 개발 워크플로우
├── coding-standards/
│   └── SKILL.md                # 코딩 규칙
└── code-review/
    └── SKILL.md                # 코드 리뷰 가이드
```

## 관련 문서

- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 전체 지침
- [docs/adr/](../../docs/adr/) - 설계 결정 기록
- [docs/api/](../../docs/api/) - BFF API 명세
