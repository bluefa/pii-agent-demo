---
name: pr-merge
description: Pull Request 머지 워크플로우. PR 상태 확인 후 merge/squash/squid 전략으로 머지하고 브랜치 정리가 필요할 때 사용.
user_invocable: true
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
4. 지정 전략(`strategy`)에 맞는 명령으로 머지합니다.
5. 머지 후 결과를 확인합니다.
6. 로컬 worktree 정리가 필요하면 `/worktree-cleanup` 스킬을 실행합니다.

```bash
gh pr view <pr> --json number,state,mergedAt,mergeCommit
```

## 규칙

- 머지 전략을 임의 변경하지 않습니다.
- 기본 전략은 `squid`(squash)입니다.
- PR이 `OPEN`이 아니거나 충돌 상태면 머지하지 않습니다.
- 생성+머지를 한 번에 처리할 때는 `/pr-flow` 스킬을 우선 사용합니다.
