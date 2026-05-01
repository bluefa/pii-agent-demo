#!/usr/bin/env bash
# PreToolUse hook for Bash: run the shared quiet PR gate before direct `gh pr create`.
#
# Worktree-aware: when Claude runs `cd /path/to/worktree && gh pr create ...`,
# this hook is invoked from the canonical project dir which may be on a
# detached HEAD. We parse the leading `cd <path>` so we resolve repo_root to
# the actual worktree the command targets.
set -uo pipefail

input="$(cat)"

command="$(echo "${input}" | /usr/bin/jq -r '.tool_input.command // empty' 2>/dev/null || true)"
case "${command}" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

extract_cd_target() {
  local cmd="$1"
  if [[ "$cmd" =~ ^[[:space:]]*cd[[:space:]]+([^[:space:]\&\;]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

cd_target="$(extract_cd_target "${command}" || true)"
if [ -n "${cd_target}" ] && [ -d "${cd_target}" ]; then
  repo_root="${cd_target}"
else
  repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
fi

cd "${repo_root}" 2>/dev/null || exit 0

# Detached HEAD or unknown branch → skip silently. The actual `gh pr create`
# call will surface its own error if needed.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [ "${branch}" = "HEAD" ] || [ -z "${branch}" ]; then
  exit 0
fi

[ -x scripts/pr-check.sh ] || exit 0

head_sha="$(git rev-parse HEAD 2>/dev/null || true)"

# Cache 1: existing pr-check marker.
pr_marker="$(git rev-parse --git-path pii-pr-validation.env 2>/dev/null || true)"
if [ -n "${head_sha}" ] && [ -n "${pr_marker}" ] && [ -f "${pr_marker}" ]; then
  if /usr/bin/grep -qx "head=${head_sha}" "${pr_marker}" 2>/dev/null; then
    exit 0
  fi
fi

# Cache 2: pre-commit validation marker promoted by post-commit. If pre-commit
# just validated this exact HEAD, the lint/tsc/test/build inside pr-check.sh
# would just re-prove what we already know.
precommit_marker="$(git rev-parse --git-path pii-pre-commit-validated.env 2>/dev/null || true)"
if [ -n "${head_sha}" ] && [ -n "${precommit_marker}" ] && [ -f "${precommit_marker}" ]; then
  if /usr/bin/grep -qx "head=${head_sha}" "${precommit_marker}" 2>/dev/null; then
    exit 0
  fi
fi

if bash scripts/pr-check.sh --base main --quiet; then
  exit 0
fi

echo "Pre-PR check failed. Fix the failed step before opening a PR." >&2
exit 2
