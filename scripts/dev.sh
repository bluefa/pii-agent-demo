#!/usr/bin/env bash
# Dev server starter — random free port, detached process, HTTP readiness poll.
#
# Why this shape (measured 2026-08-29 on this repo):
#   - The old script walked 3000→3100 calling `lsof` once per port, plus a second
#     `lsof -p` per occupied port. At 60–120ms a call that burned 6–12s BEFORE
#     next even started, while Next itself reports `Ready in 2.1s` and compiles
#     the first page in 1.4s. The scan was the cost, not Next. So: draw ONE
#     random port and check it with ONE `lsof -ti`.
#   - The old script ran `npx next dev` in the foreground, so the server died
#     with the shell — a haiku subagent going idle took its server down with it.
#     So: `nohup … & disown`.
#   - The old skill told the agent to sleep 3–5s and hope. So: poll HTTP.
#
# Usage:
#   bash scripts/dev.sh [worktree-path] [port]
#     worktree-path  defaults to $(pwd)
#     port           optional fixed port; default is a random one in 3000–8000
#
# Prints on success (machine-greppable, one per line):
#   DEV_URL=http://localhost:<port>/pass
#   DEV_PID=<pid>
#   DEV_LOG=<path>
set -euo pipefail

DIR="${1:-$(pwd)}"
DIR="$(cd "$DIR" && pwd)"  # resolve to absolute path
FIXED_PORT="${2:-}"

LOG="$DIR/.next/dev-server.log"
# "PID PORT" of the server this script last started for THIS worktree.
STATE="$DIR/.next/dev-server.pid"
# The app mounts under basePath '/pass' (next.config.ts), so `/` does not serve.
BASE_PATH="/pass"
READY_TIMEOUT_S=90

# Bootstrap worktree dependencies (guards against a missing node_modules).
bash "$(dirname "$0")/bootstrap-worktree.sh" "$DIR"

mkdir -p "$DIR/.next"

http_code() {
  curl -s -o /dev/null -m 2 -w '%{http_code}' "http://127.0.0.1:$1$BASE_PATH" 2>/dev/null || echo 000
}

# Already running for THIS worktree? One server per worktree is the rule, not a
# nicety: two `next dev` processes over the same `.next` clobber each other's
# build and the older one starts answering 404 (observed 2026-08-29).
# So the check is one cheap lookup, not a 101-port loop: the previous run recorded
# its own pid+port, and we only confirm that pid is still alive and still
# answering. A missing or stale state file just means "start a new one".
if [ -f "$STATE" ]; then
  read -r OLD_PID OLD_PORT < "$STATE" || true
  if [ -n "${OLD_PID:-}" ] && [ -n "${OLD_PORT:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    CODE="$(http_code "$OLD_PORT")"
    if [[ "$CODE" =~ ^[23] ]]; then
      echo "A dev server for this worktree is already running ($DIR)"
      echo "DEV_URL=http://localhost:$OLD_PORT$BASE_PATH"
      echo "DEV_PID=$OLD_PID"
      echo "DEV_LOG=$LOG"
      exit 0
    fi
  fi
  rm -f "$STATE"
fi

# Clear a stale .next/dev/lock.
if [ -f "$DIR/.next/dev/lock" ]; then
  rm -f "$DIR/.next/dev/lock"
  echo "Removed stale .next/dev/lock"
fi

# Random port in 3000–8000, one lsof per draw, redraw on collision.
pick_port() {
  if [ -n "$FIXED_PORT" ]; then
    if lsof -ti :"$FIXED_PORT" >/dev/null 2>&1; then
      echo "ERROR: port $FIXED_PORT is already in use" >&2
      return 1
    fi
    echo "$FIXED_PORT"
    return 0
  fi
  local attempt port
  for attempt in 1 2 3 4 5; do
    port=$(( RANDOM % 5001 + 3000 ))
    if ! lsof -ti :"$port" >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  echo "ERROR: 5 random draws in 3000-8000 all collided" >&2
  return 1
}

PORT="$(pick_port)"

# Detached: the server must outlive this shell and the subagent that launched it.
cd "$DIR"
# Run the binary, not `npx`: with the npx wrapper in front, $! is the wrapper, and
# killing it leaves the real server orphaned on the port. Started this way,
# `kill $DEV_PID` takes the whole tree down (verified 2026-08-29).
# bootstrap-worktree.sh above guarantees node_modules/.bin/next exists.
nohup ./node_modules/.bin/next dev -p "$PORT" > "$LOG" 2>&1 < /dev/null &
PID=$!
disown "$PID" 2>/dev/null || true
echo "$PID $PORT" > "$STATE"

# Readiness by polling, not sleeping.
DEADLINE=$(( SECONDS + READY_TIMEOUT_S ))
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "ERROR: the dev server process exited (PID $PID)" >&2
    tail -30 "$LOG" >&2
    rm -f "$STATE"
    exit 1
  fi
  CODE="$(http_code "$PORT")"
  if [[ "$CODE" =~ ^[23] ]]; then
    echo "DEV_URL=http://localhost:$PORT$BASE_PATH"
    echo "DEV_PID=$PID"
    echo "DEV_LOG=$LOG"
    exit 0
  fi
  if [[ "$CODE" =~ ^5 ]]; then
    echo "ERROR: server is listening but $BASE_PATH answered $CODE (PID $PID, port $PORT)" >&2
    tail -30 "$LOG" >&2
    exit 1
  fi
  sleep 0.3
done

echo "ERROR: not ready within ${READY_TIMEOUT_S}s (PID $PID, port $PORT)" >&2
tail -30 "$LOG" >&2
exit 1
