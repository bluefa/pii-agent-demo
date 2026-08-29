---
name: mock-dev-server
description: Mock 모드(USE_MOCK_DATA=true)로 dev 서버 실행. .env.local 가드 + 빈 포트 자동 탐색 + 백그라운드 실행.
user_invocable: true
---

# Mock Dev Server

Worktree(또는 메인 repo)에서 **mock 모드**로 Next.js dev 서버를 실행합니다.

`/dev-server` 와의 차이: 실행 전에 `.env.local`의 `USE_MOCK_DATA=true` 를 **명시적으로 검증/설정**합니다. memory `feedback_worktree_env_local` / `feedback_getstore_auto_seed` 의 재발 방지가 목적.

## When to Use

- 사용자가 "mock-dev-server 시작해줘" / `/mock-dev-server` 라고 요청
- Worktree 새로 만든 직후 dev 서버 띄울 때 (`.env.local` 미복사 위험)
- BFF 호출 없이 mock seed 로만 UI 검증할 때

## Arguments

- `$1` (선택): worktree 또는 repo 경로. 생략 시 현재 작업 디렉토리 사용.

## Execution Steps

다음 순서로 실행. 실패하면 **재시도 금지**, 사용자에게 즉시 보고.

### Step 1 — 대상 경로 결정

```bash
TARGET="${1:-$(pwd)}"
TARGET="$(cd "$TARGET" && pwd)"
```

### Step 2 — `.env.local` 가드

`$TARGET/.env.local` 검사:

| 상태 | 조치 |
|------|------|
| 파일 없음 | `USE_MOCK_DATA=true` 한 줄로 생성 |
| 존재 + `USE_MOCK_DATA=true` 포함 | 통과 |
| 존재 + `USE_MOCK_DATA=false` 명시 | **중단**. 사용자에게 "mock 모드 의도가 맞는지" 확인 후 사용자가 직접 변경하도록 요청 |
| 존재 + `USE_MOCK_DATA` 키 없음 | `USE_MOCK_DATA=true` 한 줄을 append |

```bash
ENV_FILE="$TARGET/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "USE_MOCK_DATA=true" > "$ENV_FILE"
elif grep -q "^USE_MOCK_DATA=false" "$ENV_FILE"; then
  echo "❌ USE_MOCK_DATA=false 가 명시되어 있음. mock 의도면 사용자가 수동으로 변경 필요" >&2
  exit 1
elif ! grep -q "^USE_MOCK_DATA=" "$ENV_FILE"; then
  echo "USE_MOCK_DATA=true" >> "$ENV_FILE"
fi
```

### Step 3 — Start the server

```bash
bash scripts/dev.sh <TARGET>
```

Run it in the **foreground** and read stdout. The script detaches the server
itself and returns in ~1-4s, so there is nothing to background and nothing to
sleep for. It owns the port logic (random port in 3000-8000, single `lsof`
check), the `.next/dev/lock` cleanup, the already-running short-circuit, and the
HTTP readiness poll — this skill does not repeat any of it. See `/dev-server`.

### Step 4 — Read the result

| stdout | Meaning | Action |
|--------|---------|--------|
| `DEV_URL=http://localhost:<port>/pass` | Ready (new or reused server) | Continue to Step 5 |
| `ERROR: ...` + log tail | Startup failed | Report verbatim. Do NOT retry |
| `IS_MOCK: true` in the log after the first API call | Mock mode confirmed | Normal |
| `IS_MOCK: false` / `USE_MOCK_DATA: undefined` in the log | env not applied | Kill the server (`kill $DEV_PID`) and report |
| `TurbopackInternalError: Symlink node_modules is invalid` | symlinked node_modules | Report. Guide: `rm node_modules && npm install` |
| `error TS2307` in `.next/types/validator.ts` | stale route cache | `rm -rf .next/types`, one retry allowed |

### Step 5 — Hand over the URL list

Report the full URL list per `/dev-server`, not a bare port — every URL complete
with the `/pass` base path and any query the screen needs, each verified with
`curl`.

## Rules

- **재시도 금지** (예외: `.next/types` stale 만 1회 허용)
- `scripts/dev.sh` detaches the server on its own — do not wrap it in `run_in_background`
- `.env.local` 의 다른 키는 **건드리지 않음** — `USE_MOCK_DATA` 만 추가/검증
- 사용자가 명시적으로 BFF 모드 의도를 밝힌 경우에는 이 스킬을 쓰지 말고 `/dev-server` 사용

## 관련 Memory

- `feedback_worktree_env_local` — `.env.local` 미복사 → `USE_MOCK_DATA=undefined` → BFF URL `undefined/install/...` 500 에러
- `feedback_turbopack_worktree_install` — node_modules symlink 금지, `npm install` 필수
- `feedback_getstore_auto_seed` — mock seed가 BFF 모드로 누설 가능 → mock 모드를 명시적으로 선언/검증하는 게 안전
- `feedback_next_validator_stale` — 라우트 이동 후 `.next/types` 정리
