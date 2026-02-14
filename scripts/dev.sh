#!/bin/bash
# Dev server starter — lock 정리 + 빈 포트 자동 탐색
set -e

DIR="${1:-$(pwd)}"
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

# .next/dev/lock 정리
if [ -f "$DIR/.next/dev/lock" ]; then
  rm -f "$DIR/.next/dev/lock"
  echo "Lock 파일 제거됨"
fi

PORT=$(find_free_port)
echo "Dev server: http://localhost:$PORT ($DIR)"
cd "$DIR" && npx next dev -p "$PORT"
