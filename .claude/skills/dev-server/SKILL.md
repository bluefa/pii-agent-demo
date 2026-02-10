---
name: dev-server
description: Worktree dev 서버 실행. lock 정리 + 빈 포트 자동 탐색.
user_invocable: true
---

# Dev Server

Worktree 경로에서 Next.js dev 서버를 실행합니다.

## 실행 방법

아래 스크립트를 **백그라운드**로 실행합니다:

```bash
bash scripts/dev.sh <worktree-path>
```

- `<worktree-path>`: 현재 작업 중인 worktree 경로 (예: `/Users/study/pii-agent-demo-scan-feedback`)
- worktree가 없으면 프로젝트 루트 `/Users/study/pii-agent-demo` 사용

## 스크립트 동작

1. `.next/dev/lock` 파일이 있으면 자동 제거
2. 3000번 포트부터 빈 포트를 자동 탐색 (최대 3100)
3. `npx next dev -p <빈포트>` 실행

## 규칙

- **반드시 `run_in_background: true`로 실행** — dev 서버는 종료되지 않는 프로세스
- 실행 후 5초 대기 → TaskOutput으로 출력에서 `Ready` 확인
- 포트 번호를 사용자에게 알려줄 것
- **재시도 금지** — 한 번 실행 후 실패하면 사용자에게 보고
