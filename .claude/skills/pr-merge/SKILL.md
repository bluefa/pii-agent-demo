---
name: pr-merge
description: Pull Request 머지 워크플로우. PR 상태 확인 후 merge/squash/squid 전략으로 머지하고 브랜치 정리가 필요할 때 사용.
user_invocable: true
model: haiku
---

# /pr-merge - Merge Pull Request

PR 머지 전 검증과 머지 전략을 일관되게 수행합니다.

## 입력

- `pr`: PR 번호 또는 URL
- `strategy`: `merge` | `squash` | `squid`

기본값:
- `strategy=squid`

## 전략 매핑

- `merge` -> `gh pr merge <pr> --merge --delete-branch`
- `squash` -> `gh pr merge <pr> --squash --delete-branch`
- `squid` -> `gh pr merge <pr> --squash --delete-branch` (팀 별칭)

## 실행 절차

1. PR 기본 정보를 확인합니다.

```bash
gh pr view <pr> --json number,title,state,mergeable,headRefName,baseRefName
```

2. PR이 `OPEN`인지 확인합니다.
3. `mergeable` 상태가 머지 가능인지 확인합니다.
4. head branch에 연결된 worktree가 있으면 **머지 전에** 제거합니다.

```bash
# headRefName과 일치하는 worktree 확인
git worktree list
# 있으면 제거
bash scripts/worktree-cleanup.sh --path <worktree-path> --force
```

> **주의**: `--delete-branch` 플래그는 머지 후 로컬 브랜치를 삭제하므로, worktree가 해당 브랜치를 checkout하고 있으면 실패합니다. 반드시 worktree를 먼저 제거하세요.

5. 지정 전략(`strategy`)에 맞는 명령으로 머지합니다.
6. 머지 후 결과를 확인합니다.

```bash
gh pr view <pr> --json number,state,mergedAt,mergeCommit
```

## 규칙

- 머지 전략을 임의 변경하지 않습니다.
- 기본 전략은 `squid`(squash)입니다.
- 사용자의 명시적 `merge` 요청이 없으면 머지하지 않습니다.
- PR이 `OPEN`이 아니거나 충돌 상태면 머지하지 않습니다.
- PR 머지 완료 후, 작업 중 생성한 workflow 디렉토리가 있으면 반드시 삭제합니다.
