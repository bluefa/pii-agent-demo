---
name: worktree
description: Git worktree/브랜치 초기 세팅을 강제하는 워크플로우. 구현 시작 전 worktree 생성, 디렉터리 이동, 검증이 필요할 때 사용.
user_invocable: true
---

# /worktree - Set Up Feature Worktree

구현 작업 시작 전에 worktree를 준비합니다.

## 입력

- `topic`: 기능 이름 (예: `adr006-approval-flow`)
- `prefix`: 브랜치 prefix (`feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `codex`)

기본값:
- `prefix=feat`

## 실행 절차

1. canonical repo 루트(`/Users/study/pii-agent-demo`)에서 시작합니다.
2. **⛔ 최신 main을 fetch & merge합니다 (스킵 불가).**

```bash
git fetch origin main && git merge origin/main
```

3. worktree + 브랜치를 생성합니다.

```bash
git worktree add ../pii-agent-demo-{topic} -b {prefix}/{topic}
```

4. 새 worktree 경로로 이동합니다.
5. 프로젝트 검증을 실행합니다.

```bash
bash scripts/guard-worktree.sh
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git worktree list
```

6. `node_modules`가 없으면 설치합니다.

```bash
npm install
```

7. 필요 시 dev 서버를 시작합니다.

```bash
bash scripts/dev.sh "$(pwd)"
```

## 규칙

- `main`/`master`에서 구현 작업을 시작하지 않습니다.
- worktree 준비 전에는 코드 변경을 시작하지 않습니다.
- 모든 후속 작업은 방금 생성한 worktree에서만 수행합니다.
