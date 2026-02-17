#!/bin/bash
# Dev server starter — lock 정리 + 빈 포트 자동 탐색 + CWD 검증
set -e

DIR="${1:-$(pwd)}"
DIR="$(cd "$DIR" && pwd)"  # resolve to absolute path
START_PORT="${2:-3000}"

# worktree 의존성 부트스트랩 (node_modules 누락 방지)
bash "$(dirname "$0")/bootstrap-worktree.sh" "$DIR"

# 빈 포트 찾기 (3000부터)
find_free_port() {
  local port=$START_PORT
  while lsof -ti :"$port" >/dev/null 2>&1; do
    port=$((port + 1))
    if [ "$port" -gt 3100 ]; then
      echo "ERROR: 3000-3100 범위에 빈 포트 없음" >&2
      exit 1
    fi
  done
  echo "$port"
}

# 요청 포트에 다른 워크트리 서버가 있는지 확인
check_existing_server() {
  local port=$1
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null | head -1) || return 0
  if [ -n "$pid" ]; then
    local cwd
    cwd=$(lsof -p "$pid" 2>/dev/null | grep cwd | awk '{print $NF}')
    if [ "$cwd" = "$DIR" ]; then
      echo "✅ 이미 이 워크트리의 서버가 포트 $port에서 실행 중 (PID: $pid)"
      exit 0
    else
      echo "⚠️  포트 $port: 다른 워크트리 서버 (PID: $pid, cwd: $cwd) — 건너뜀"
    fi
  fi
}

# .next/dev/lock 정리
if [ -f "$DIR/.next/dev/lock" ]; then
  rm -f "$DIR/.next/dev/lock"
  echo "Lock 파일 제거됨"
fi

# 기존 서버 확인 (3000부터 순차)
for p in $(seq "$START_PORT" 3100); do
  if lsof -ti :"$p" >/dev/null 2>&1; then
    check_existing_server "$p"
  fi
done

PORT=$(find_free_port)
echo "Dev server: http://localhost:$PORT ($DIR)"
cd "$DIR" && npx next dev -p "$PORT"
