---
name: worktree-cleanup
description: PR merge 후 완료된 작업 worktree를 정리하는 워크플로우. merged 브랜치의 worktree 제거와 로컬 브랜치 삭제가 필요할 때 사용.
user_invocable: true
model: haiku
---

# /worktree-cleanup - Cleanup Merged Worktree

PR merge가 끝난 worktree를 안전하게 정리합니다.

## 실행 방법

```bash
bash scripts/worktree-cleanup.sh --path <worktree-path>
```

예시:

```bash
bash scripts/worktree-cleanup.sh --path /Users/study/pii-agent-demo-auto-pr-flow
```

## 동작

1. 대상 경로가 active worktree인지 확인
2. 대상 branch가 `origin/main`에 merge 되었는지 확인
3. worktree 제거
4. 로컬 branch 제거
5. `git worktree prune` 실행

## 규칙

- canonical repo (`/Users/study/pii-agent-demo`)는 제거하지 않습니다.
- `main`/`master`/`HEAD` branch는 정리하지 않습니다.
- 정리 스킬은 대상 worktree 외부 경로에서 실행합니다.
