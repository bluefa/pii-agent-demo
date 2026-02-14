---
name: pr-description
description: Pull Request 본문을 변경 맥락 기반으로 직접 작성하는 워크플로우. PR 생성 전/생성 시 사람이 읽기 좋은 Summary/Description/Validation/Risks를 고품질로 작성해야 할 때 사용.
user_invocable: true
---

# /pr-description - Write PR Description

PR 본문을 자동 템플릿이 아닌 직접 작성 방식으로 생성합니다.

## 입력

- `base`: 비교 기준 브랜치 (기본값 `main`)
- `scope`: 이번 PR의 핵심 범위(예: API docs cleanup, approval flow fix)

## 작성 절차

1. 변경 맥락을 확인합니다.

```bash
git fetch origin main
git log --no-merges --pretty='%h %s' origin/main..HEAD
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
```

2. 아래 섹션 순서로 PR 본문을 직접 작성합니다.

```md
## Summary
- 변경 의도 1
- 변경 의도 2
- 변경 의도 3

## Description
이번 변경의 배경과 이유를 자연어 문단으로 작성.
무엇을 바꿨고, 왜 지금 이 변경이 필요한지 명확히 작성.

## What Changed
- 주요 파일/모듈 변경점
- 동작/규칙 변경점

## Validation
- 실행한 검증 명령
- 결과 (성공/실패, 미실행 사유 포함)

## Risks
- 영향 범위
- 배포/롤백 시 유의사항

## Notes For Reviewer
- 리뷰 우선순위
- 집중 확인 포인트
```

3. `Description` 문단은 반드시 포함합니다.
4. 변경이 많으면 `Summary`는 한 줄이 아니라 다중 bullet로 작성합니다.

## 규칙

- 스크립트 자동 생성 본문을 그대로 사용하지 않습니다.
- 커밋 제목 나열이 아니라 "맥락 + 의도 + 영향"을 설명합니다.
- 검증을 하지 못했으면 `Validation` 섹션에 명시합니다.
