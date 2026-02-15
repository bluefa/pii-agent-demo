---
name: pr-merge
description: Pull Request 머지 워크플로우. PR 상태 확인 후 merge/squash/squid 전략으로 머지하고 브랜치 정리가 필요할 때 사용.
user_invocable: true
---

# /pr-merge - Merge Pull Request (Codex Review Gate)

PR 머지 전 Codex 자동 리뷰 결과를 확인한 뒤 머지합니다.

## 입력

- `pr`: PR 번호 또는 URL
- `strategy`: `merge` | `squash` | `squid`

기본값:
- `strategy=squid`

## 실행 절차

1. PR 정보를 확인합니다.

```bash
gh pr view <pr> --json number,title,state,mergeable,reviewDecision,headRefName,baseRefName
```

2. Codex 자동 리뷰 코멘트를 확인합니다.

```bash
gh pr view <pr> --comments
```

3. Codex 리뷰 체크를 게이트로 검증하고 머지합니다.

```bash
bash scripts/pr-merge-if-clean.sh --pr <pr> --strategy <strategy>
```

4. 머지 완료 상태를 확인합니다.

```bash
gh pr view <pr> --json number,state,mergedAt,mergeCommit
```

## 규칙

- 사용자의 명시적 `merge` 요청이 없으면 머지하지 않습니다.
- `Codex PR Review` 체크가 `success`가 아니면 머지하지 않습니다.
- `reviewDecision=CHANGES_REQUESTED`이면 머지하지 않습니다.
- 기본 전략은 `squid`(squash)입니다.
- 머지 후 로컬 정리는 `/worktree-cleanup` 스킬을 사용합니다.
