---
name: pr
description: 기능 완료 후 Pull Request 생성 워크플로우. 동일 브랜치 검증, 빌드/타입 체크, PR 본문 작성, URL 보고가 필요할 때 사용.
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
  - 본문: 변경 요약 + 검증 결과 + 수정 파일 목록
7. 생성된 PR URL을 사용자에게 보고합니다.
8. PR 머지는 `/pr-merge` 스킬로 진행합니다.

## 규칙

- `main`에 직접 push하지 않습니다.
- 변경사항을 여러 브랜치로 분산하지 않습니다.
- 검증 실패 상태로 PR을 만들지 않습니다.
