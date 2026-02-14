#!/usr/bin/env bash
# 검증 스크립트 — 성공/실패 요약만 출력 (토큰 절약)
# 사용: bash scripts/verify.sh [--verbose]
set -uo pipefail

VERBOSE="${1:-}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

pass=0
fail=0
summary=""

run_check() {
  local label="$1"
  shift
  local output
  output=$("$@" 2>&1)
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    ((pass++))
    summary+="  ✅ ${label}\n"
  else
    ((fail++))
    # 에러 마지막 5줄만 요약
    local tail_output
    tail_output=$(echo "$output" | tail -5)
    summary+="  ❌ ${label}\n"
    if [[ "$VERBOSE" == "--verbose" ]]; then
      summary+="${output}\n"
    else
      summary+="${tail_output}\n"
    fi
  fi
}

echo "[verify] Running checks..."

run_check "lint" npm run lint -- --quiet
run_check "type-check" npx tsc --noEmit --pretty false
run_check "build" npm run build

echo ""
echo "━━━ Verify Result ━━━"
printf "$summary"
echo "━━━ ${pass} passed, ${fail} failed ━━━"

[[ $fail -eq 0 ]]
