---
name: pr-flow
description: Pull Request 생성부터 머지/원격 브랜치 정리까지 한 번에 자동 수행하는 워크플로우. 승인 요청 없이 PR 자동화가 필요할 때 사용.
user_invocable: true
---

# /pr-flow - Create And Merge PR

PR 생성/머지를 자동으로 처리합니다.

## 기본 동작

```bash
bash scripts/pr-flow.sh --strategy squid
```

- 기본 base: `main`
- 기본 전략: `squid` (=`squash`)
- PR 본문은 `/pr-description` 스킬 기준으로 직접 작성 후 `--body`로 전달

## 옵션

```bash
bash scripts/pr-flow.sh --base main --strategy squid --title "<title>" --body "<body>"
```

- `--strategy`: `merge` | `squash` | `squid`

## PR Description

- `--body`는 필수입니다.
- 본문은 `/pr-description` 스킬 기준으로 작성하고 `Summary / Description / What Changed / Validation / Risks / Notes For Reviewer` 섹션을 포함합니다.
- 변경 규모가 크면 `Summary`는 여러 줄 bullet로 작성합니다.

## 규칙

- `scripts/guard-worktree.sh`를 항상 통과해야 합니다.
- 브랜치 시작 시점은 `scripts/create-worktree.sh`를 통해 최신화된 `main` 기준이어야 합니다.
- 더러운 워킹트리(미커밋 변경)에서는 중단합니다.
- 머지 가능 상태(`MERGEABLE`)가 아니면 중단합니다.
- `--body` 없이 PR 생성을 시도하지 않습니다.
- 자동화 흐름에서 사용자 추가 확인을 요구하지 않습니다.
- merge 이후 로컬 worktree 정리는 `/worktree-cleanup` 스킬을 사용합니다.
