#!/bin/bash
# Dev server starter — lock 정리 + 랜덤 포트 + CWD 검증
set -e

DIR="${1:-$(pwd)}"
DIR="$(cd "$DIR" && pwd)"  # resolve to absolute path

# worktree 의존성 부트스트랩 (node_modules 누락 방지)
bash "$(dirname "$0")/bootstrap-worktree.sh" "$DIR"

# 이 워크트리의 서버가 이미 떠 있으면 그 포트를 알려주고 끝낸다.
# 포트가 랜덤이라 포트로는 못 찾는다 — 프로세스의 cwd 로 찾는다.
for pid in $(pgrep -f 'next dev' 2>/dev/null); do
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  [ "$cwd" = "$DIR" ] || continue
  port=$(lsof -aPi -p "$pid" -sTCP:LISTEN -Fn 2>/dev/null | sed -n 's/^n.*:\([0-9]*\)$/\1/p' | head -1)
  echo "✅ 이미 이 워크트리의 서버가 포트 ${port:-?}에서 실행 중 (PID: $pid)"
  exit 0
done

# .next/dev/lock 정리
if [ -f "$DIR/.next/dev/lock" ]; then
  rm -f "$DIR/.next/dev/lock"
  echo "Lock 파일 제거됨"
fi

# 3000-8000 랜덤 한 발. 순차 탐색은 하지 않는다 — 막히면 실패로 보고하고 끝낸다.
# bash 는 셸 시작 때 RANDOM 을 자동 시드하지만, 시간 시드를 명시해 둔다.
# 초 단위만 쓰면 같은 초에 뜬 두 워크트리가 같은 포트를 뽑으므로 PID 를 섞는다.
RANDOM=$(( $(date +%s) ^ $$ ))
PORT=$(( 3000 + RANDOM % 5001 ))
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "ERROR: 포트 $PORT 사용 중 — 다시 실행해 주세요" >&2
  exit 1
fi

echo "Dev server: http://localhost:$PORT ($DIR)"
cd "$DIR" && npx next dev -p "$PORT"
