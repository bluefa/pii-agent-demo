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

### Step 3 — `bash scripts/dev.sh <TARGET>` 백그라운드 실행

`Bash` 도구를 `run_in_background: true` 로 호출:

```
bash scripts/dev.sh <TARGET>
```

`dev.sh` 가 내부에서:
1. `bootstrap-worktree.sh` 로 node_modules 검증/install
2. `.next/dev/lock` 정리
3. 같은 워크트리 서버가 이미 떠 있으면 그 포트 보고하고 exit (재기동 X)
4. 빈 포트 탐색 (3000-3100)
5. `npx next dev -p <port>` 실행

### Step 4 — 기동 검증

백그라운드 출력을 3-5초 내에 `BashOutput` 으로 확인. 다음 패턴 매칭:

| 출력 | 해석 | 액션 |
|------|------|------|
| `✅ 이미 이 워크트리의 서버가 포트 N에서 실행 중` | 기존 서버 재사용 | 포트 보고 후 종료 |
| `Dev server: http://localhost:N` + `Ready` (Next.js) | 신규 기동 성공 | 포트 + URL 보고 |
| `IS_MOCK: true` (첫 API 호출 후 로그) | mock 활성 확인 | 정상 |
| `IS_MOCK: false` 또는 `USE_MOCK_DATA: undefined` | env 미반영 | dev 서버 종료, 사용자에게 보고 |
| `next: command not found` | node_modules 누락 | 사용자에게 보고 (재시도 X) |
| `TurbopackInternalError: Symlink node_modules is invalid` | symlink node_modules 사용 중 | 사용자에게 보고. `rm node_modules && npm install` 가이드 |
| `error TS2307` in `.next/types/validator.ts` | 라우트 stale 캐시 | `rm -rf .next/types` 후 재시도 1회 허용 |

### Step 5 — 보고

사용자에게 한 줄로 보고:

```
Mock dev server: http://localhost:<port> (TARGET)
```

## Rules

- **재시도 금지** (예외: `.next/types` stale 만 1회 허용)
- 백그라운드 실행 필수 (`run_in_background: true`)
- `.env.local` 의 다른 키는 **건드리지 않음** — `USE_MOCK_DATA` 만 추가/검증
- 사용자가 명시적으로 BFF 모드 의도를 밝힌 경우에는 이 스킬을 쓰지 말고 `/dev-server` 사용

## 관련 Memory

- `feedback_worktree_env_local` — `.env.local` 미복사 → `USE_MOCK_DATA=undefined` → BFF URL `undefined/install/...` 500 에러
- `feedback_turbopack_worktree_install` — node_modules symlink 금지, `npm install` 필수
- `feedback_getstore_auto_seed` — mock seed가 BFF 모드로 누설 가능 → mock 모드를 명시적으로 선언/검증하는 게 안전
- `feedback_next_validator_stale` — 라우트 이동 후 `.next/types` 정리
