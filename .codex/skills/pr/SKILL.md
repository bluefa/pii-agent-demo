---
name: pr
description: 기능 완료 후 Pull Request 생성 워크플로우. 동일 브랜치 검증, 빌드/타입 체크, 사람 리뷰어가 이해 가능한 상세 PR description 작성, URL 보고가 필요할 때 사용.
user_invocable: true
---

# /pr - Create Pull Request

기능 완료 후 PR을 생성합니다.

## 실행 절차

1. 현재 브랜치가 feature 브랜치인지 확인합니다.
2. 변경사항이 모두 같은 브랜치에 있는지 확인합니다.
3. 검증 명령을 실행합니다.

```bash
bash scripts/guard-worktree.sh
npm run lint
npx tsc --noEmit
npm run build
```

4. 커밋이 없다면 중단하고 사용자에게 알립니다.
5. 브랜치를 origin으로 push합니다.
6. PR을 생성합니다.
  - 제목: 브랜치명 기반 요약
  - 본문: 사람이 검토 가능한 상세 설명(아래 템플릿 필수)
7. 생성된 PR URL을 사용자에게 보고합니다.
8. PR 머지는 `/pr-merge` 스킬로 진행합니다.
9. 생성+머지를 한 번에 자동화하려면 `/pr-flow` 스킬을 사용합니다.

## PR Description 템플릿 (필수)

본문은 아래 섹션을 모두 포함합니다.

```md
## Summary
- 무엇을 왜 바꿨는지 핵심 요약

## What Changed
- 주요 변경 파일/모듈
- 동작 변경 포인트

## Validation
- 실행한 검증 명령과 결과

## Risks
- 잠재 영향 범위
- 롤백 방법

## Notes For Reviewer
- 리뷰어가 집중해서 볼 체크포인트
```

## 권장 생성 방법

아래 명령으로 기본 본문을 생성한 후 필요 내용을 보강합니다.

```bash
PR_BODY="$(bash scripts/build-pr-body.sh --base main)"
gh pr create --base main --head "$(git rev-parse --abbrev-ref HEAD)" --title "<title>" --body "${PR_BODY}"
```

## 규칙

- `main`에 직접 push하지 않습니다.
- 브랜치는 최신 `origin/main`으로 동기화된 로컬 `main`에서 시작해야 합니다.
- 변경사항을 여러 브랜치로 분산하지 않습니다.
- 검증 실패 상태로 PR을 만들지 않습니다.
- PR description은 생략하거나 한 줄 요약으로 제출하지 않습니다.
