---
name: pr-flow
description: Pull Request 생성 자동화 워크플로우. 기본은 PR 생성까지만 수행하고, 사용자의 명시적 merge 요청이 있을 때만 머지를 수행해야 할 때 사용.
user_invocable: true
---

# /pr-flow - Create PR (Merge Gated)

PR 생성을 자동 처리하고, merge는 명시적 승인 옵션이 있을 때만 수행합니다.

## 기본 동작

```bash
bash scripts/pr-flow.sh --strategy squid
```

- 기본 base: `main`
- 기본 전략: `squid` (=`squash`)
- PR 본문은 `scripts/build-pr-body.sh`로 상세 생성
- 기본 동작은 PR 생성까지만 수행 (merge 미수행)

## 옵션

```bash
bash scripts/pr-flow.sh --base main --strategy squid --title "<title>" --body "<body>" --merge-approved
```

- `--strategy`: `merge` | `squash` | `squid`
- `--merge-approved`: 사용자 명시 요청이 있을 때만 부여

## PR Description

- `--body` 미지정 시 `scripts/build-pr-body.sh`로 상세 본문을 자동 생성합니다.
- 생성 본문은 `Summary / What Changed / Validation / Risks / Notes For Reviewer` 섹션을 포함합니다.

## 규칙

- `scripts/guard-worktree.sh`를 항상 통과해야 합니다.
- 브랜치 시작 시점은 `scripts/create-worktree.sh`를 통해 최신화된 `main` 기준이어야 합니다.
- 더러운 워킹트리(미커밋 변경)에서는 중단합니다.
- 기본 실행에서는 PR 생성 후 종료합니다.
- 사용자의 명시적 merge 요청 전까지 `--merge-approved`를 사용하지 않습니다.
- 머지 가능 상태(`MERGEABLE`)가 아니면 중단합니다.
- merge 이후 로컬 worktree 정리는 `/worktree-cleanup` 스킬을 사용합니다.
