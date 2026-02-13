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

## 옵션

```bash
bash scripts/pr-flow.sh --base main --strategy squid --title "<title>" --body "<body>"
```

- `--strategy`: `merge` | `squash` | `squid`

## 규칙

- `scripts/guard-worktree.sh`를 항상 통과해야 합니다.
- 더러운 워킹트리(미커밋 변경)에서는 중단합니다.
- 머지 가능 상태(`MERGEABLE`)가 아니면 중단합니다.
- 자동화 흐름에서 사용자 추가 확인을 요구하지 않습니다.
