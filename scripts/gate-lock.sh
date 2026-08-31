#!/usr/bin/env bash
# Machine-wide gate lock. Dozens of worktrees of this repo share 8 cores / 16GB
# and every gate assumes it owns the machine -- one `vitest run` alone spawns 14
# workers at ~151MB each. Concurrent gates thrash superlinearly (test:run measured
# 49s idle vs 288s under load) and the slowdown turns into wrong answers: a vitest
# segfault, and 13 failed test files under load where a calm run reported 1.
#
# ponytail: mkdir is the atomic primitive every POSIX box has, and macOS has no
# flock(1). Deliberately NOT lockf(1): wrapping the script in another process
# means a signal aimed at the wrapper orphans the gate and frees the lock while
# it still runs. Staying in-process keeps the caller's signal on the gate's own
# trap. Stale locks are reclaimed by pid liveness, not by a timeout.
GATE_LOCK_DIR="${GATE_LOCK_DIR:-/tmp/pii-agent-gate.lock}"

# gate_lock_acquire [max_wait_seconds] -> 0 acquired, 1 gave up (caller runs unlocked)
gate_lock_acquire() {
  local deadline=$(( $(date +%s) + ${1:-900} )) holder
  while ! mkdir "${GATE_LOCK_DIR}" 2>/dev/null; do
    holder="$(cat "${GATE_LOCK_DIR}/pid" 2>/dev/null || true)"
    if [ -n "${holder}" ] && ! kill -0 "${holder}" 2>/dev/null; then
      # ponytail: tiny race -- a fresh holder could land between the read and the
      # rm. Worst case is two gates, which is slow, not wrong. Upgrade path:
      # mktemp -d + rename if that ever actually bites.
      rm -rf "${GATE_LOCK_DIR}"
      continue
    fi
    [ "$(date +%s)" -ge "${deadline}" ] && return 1
    sleep 3
  done
  echo $$ >"${GATE_LOCK_DIR}/pid"
  trap 'rm -rf "${GATE_LOCK_DIR}"' EXIT
  return 0
}
