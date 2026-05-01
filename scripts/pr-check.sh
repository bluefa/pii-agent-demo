#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr-check.sh [--base main] [--quiet]

Runs the local PR gate with quiet logs. On success it writes validation
metadata into the git directory. On failure it prints only the failed step and
the last log lines for that step.
EOF
}

BASE_BRANCH="main"
QUIET="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --quiet)
      QUIET="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-check] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "main" || "${branch}" == "master" || "${branch}" == "HEAD" ]]; then
  echo "[pr-check] Cannot run on ${branch}." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[pr-check] Working tree is dirty. Commit or stash changes first." >&2
  exit 1
fi

log_branch="${branch//\//-}"
LOG_DIR="${TMPDIR:-/tmp}/pii-agent-demo-pr-check-${log_branch}-$$"
mkdir -p "${LOG_DIR}"

STEP_COUNT=0
VALIDATION_RESULTS=()

run_step() {
  local label="$1"
  shift

  STEP_COUNT=$((STEP_COUNT + 1))
  local log_file="${LOG_DIR}/step-${STEP_COUNT}.log"

  if "$@" >"${log_file}" 2>&1; then
    VALIDATION_RESULTS+=("- ${label}: PASS")
    return 0
  fi

  echo "[pr-check] ${label}: FAILED" >&2
  echo "[pr-check] Last log lines (${log_file}):" >&2
  tail -80 "${log_file}" >&2 || true
  exit 1
}

run_policy_grep() {
  local changed
  changed="$(git diff --name-only --diff-filter=ACMR "origin/${BASE_BRANCH}...HEAD" 2>/dev/null | /usr/bin/grep -E '\.(tsx?|jsx?)$' || true)"
  [ -n "${changed}" ] || return 0

  local problems=""
  append_problem() {
    problems+=$'\n['"$1"$']\n'"$2"$'\n'
  }

  while IFS= read -r file; do
    [ -n "${file}" ] && [ -f "${file}" ] || continue

    case "${file}" in
      *.ts|*.tsx)
        if hits=$(/usr/bin/grep -HnE ':\s*any\b|<any>|<[^>]*\b,\s*any[\s,>]|as\s+any\b|any\[\]|=\s*any\b' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "any" "${hits}"
        fi
        if hits=$(/usr/bin/grep -HnE "(from|import)\s+['\"](\.\.?/)|import\(['\"](\.\.?/)" "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "relative-import" "${hits}"
        fi
        case "${file}" in
          *__tests__*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
          *)
            if hits=$(/usr/bin/grep -HnE '(^|[^.A-Za-z0-9_])(window\.)?alert\(' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
              append_problem "alert" "${hits}"
            fi
            ;;
        esac
        ;;
    esac

    case "${file}" in
      *.tsx)
        if hits=$(/usr/bin/grep -HnE '(text|bg|border|ring|divide|from|to|via|shadow)-(red|blue|green|yellow|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "raw-color" "${hits}"
        fi
        if hits=$(/usr/bin/grep -HnE '`(hover|focus|active|sm|md|lg|xl):\$\{' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "dynamic-tailwind" "${hits}"
        fi
        if hits=$(/usr/bin/grep -HnE '<svg[^>]*animate-spin' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "animate-svg-wrapper" "${hits}"
        fi
        ;;
    esac

    case "${file}" in
      */route.ts)
        if hits=$(/usr/bin/grep -HnE 'await\s+[A-Za-z_$][A-Za-z0-9_$]*\.json\s*\(\s*\)' "${file}" 2>/dev/null | /usr/bin/grep -vE 'await\s+(request|req)\.json' | head -2); [ -n "${hits}" ]; then
          append_problem "route-json-dispatch" "${hits}"
        fi
        ;;
    esac

    case "${file}" in
      *theme.ts) ;;
      *)
        if hits=$(/usr/bin/grep -HnE '#[0-9a-fA-F]{6}' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
          append_problem "raw-hex" "${hits}"
        fi
        ;;
    esac

    if hits=$(/usr/bin/grep -HnE '@(gmail|naver|kakao|daum|hanmail|yahoo|samsung)\.(com|co\.kr|net)' "${file}" 2>/dev/null | head -2); [ -n "${hits}" ]; then
      append_problem "mockup-pii" "${hits}"
    fi
  done <<< "${changed}"

  if [ -n "${problems}" ]; then
    printf '%s\n' "${problems}"
    return 1
  fi
}

run_step "guard-worktree" bash scripts/guard-worktree.sh
run_step "fetch origin/${BASE_BRANCH}" git fetch origin "${BASE_BRANCH}"
run_step "rebase origin/${BASE_BRANCH}" git rebase "origin/${BASE_BRANCH}"

commit_count="$(git rev-list --count "origin/${BASE_BRANCH}..HEAD")"
if [[ "${commit_count}" == "0" ]]; then
  echo "[pr-check] No commits found compared with origin/${BASE_BRANCH}." >&2
  exit 1
fi

# Reuse pre-commit validation if HEAD has not moved since the last commit's
# validation. Both pre-commit and pr-check run the same lint/tsc/test/build set
# so re-running them on the unchanged tree is pure waste.
skip_heavy_checks=0
precommit_marker="$(git rev-parse --git-path pii-pre-commit-validated.env 2>/dev/null || true)"
current_head="$(git rev-parse HEAD 2>/dev/null || true)"
if [ -n "${precommit_marker}" ] && [ -f "${precommit_marker}" ] && [ -n "${current_head}" ]; then
  if /usr/bin/grep -qx "head=${current_head}" "${precommit_marker}" 2>/dev/null; then
    skip_heavy_checks=1
  fi
fi

run_step "policy-grep" run_policy_grep

run_parallel_heavy_checks() {
  local parallel_log_dir="${LOG_DIR}/parallel"
  mkdir -p "${parallel_log_dir}"
  local labels=(lint type-check test build)

  # Track child pids so an interrupt (SIGINT/SIGTERM) or unexpected exit kills
  # the whole process tree instead of leaving orphan npm/tsc/build processes
  # running after the parent script dies. Without this, Ctrl+C during a slow
  # `next build` leaves the build running for minutes, still writing to logs.
  # Each `&`-spawned subshell launches `npm run X` -> `node` -> tool, so we
  # have to walk descendants (pgrep -P) recursively rather than just killing
  # the captured subshell pid.
  local -a CHILD_PIDS=()
  kill_tree() {
    local pid="$1"
    local sig="$2"
    local kid
    for kid in $(pgrep -P "$pid" 2>/dev/null); do
      kill_tree "$kid" "$sig"
    done
    kill "-${sig}" "$pid" 2>/dev/null || true
  }
  cleanup_children() {
    local pid
    for pid in "${CHILD_PIDS[@]:-}"; do
      [ -n "${pid}" ] && kill_tree "$pid" TERM
    done
    sleep 1 2>/dev/null || true
    for pid in "${CHILD_PIDS[@]:-}"; do
      [ -n "${pid}" ] && kill_tree "$pid" KILL
    done
  }
  trap 'cleanup_children; echo "[pr-check] interrupted; logs preserved at ${parallel_log_dir}" >&2; exit 130' INT TERM

  npm run lint                    >"${parallel_log_dir}/lint.log"       2>&1 & CHILD_PIDS+=($!)
  npx tsc --noEmit --pretty false >"${parallel_log_dir}/type-check.log" 2>&1 & CHILD_PIDS+=($!)
  npm run test:run                >"${parallel_log_dir}/test.log"       2>&1 & CHILD_PIDS+=($!)
  npm run build                   >"${parallel_log_dir}/build.log"      2>&1 & CHILD_PIDS+=($!)

  local rc=0
  local failed=()
  local i
  for i in "${!labels[@]}"; do
    if wait "${CHILD_PIDS[$i]}"; then
      VALIDATION_RESULTS+=("- ${labels[$i]}: PASS")
    else
      failed+=("${labels[$i]}")
      rc=1
    fi
  done

  trap - INT TERM

  if (( rc != 0 )); then
    echo "[pr-check] heavy checks FAILED: ${failed[*]}" >&2
    echo "[pr-check] full logs preserved at ${parallel_log_dir}" >&2
    for label in "${failed[@]}"; do
      echo "[pr-check] ----- ${label} log tail -----" >&2
      tail -80 "${parallel_log_dir}/${label}.log" 2>/dev/null >&2 || echo "(log unavailable)" >&2
    done
    exit 1
  fi
}

if (( skip_heavy_checks == 1 )); then
  for label in lint type-check test build; do
    VALIDATION_RESULTS+=("- ${label}: PASS (cached from pre-commit @ ${current_head:0:12})")
  done
  if [[ "${QUIET}" != "1" ]]; then
    echo "[pr-check] reusing pre-commit validation @ ${current_head:0:12}"
  fi
else
  run_parallel_heavy_checks
fi

run_step "contract-check" bash scripts/contract-check.sh --mode diff --base "origin/${BASE_BRANCH}" --head HEAD

summary_file="$(git rev-parse --git-path pii-pr-validation-summary.md)"
marker_file="$(git rev-parse --git-path pii-pr-validation.env)"
head_sha="$(git rev-parse HEAD)"
validated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

printf '%s\n' "${VALIDATION_RESULTS[@]}" >"${summary_file}"
{
  printf 'base=%s\n' "${BASE_BRANCH}"
  printf 'branch=%s\n' "${branch}"
  printf 'head=%s\n' "${head_sha}"
  printf 'commitCount=%s\n' "${commit_count}"
  printf 'summaryFile=%s\n' "${summary_file}"
  printf 'logDir=%s\n' "${LOG_DIR}"
  printf 'validatedAt=%s\n' "${validated_at}"
} >"${marker_file}"

if [[ "${QUIET}" != "1" ]]; then
  echo "[pr-check] OK: branch=${branch}, commits=${commit_count}, logs=${LOG_DIR}"
fi
