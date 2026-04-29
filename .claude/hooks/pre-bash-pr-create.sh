#!/usr/bin/env bash
# PreToolUse hook for Bash: run the shared quiet PR gate before direct `gh pr create`.
set -uo pipefail

input="$(cat)"

command="$(echo "${input}" | /usr/bin/jq -r '.tool_input.command // empty' 2>/dev/null || true)"
case "${command}" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "${repo_root}" || exit 0

[ -x scripts/pr-check.sh ] || exit 0

head_sha="$(git rev-parse HEAD 2>/dev/null || true)"
marker_file="$(git rev-parse --git-path pii-pr-validation.env 2>/dev/null || true)"
if [ -n "${head_sha}" ] && [ -n "${marker_file}" ] && [ -f "${marker_file}" ]; then
  if /usr/bin/grep -qx "head=${head_sha}" "${marker_file}" 2>/dev/null; then
    exit 0
  fi
fi

if bash scripts/pr-check.sh --base main --quiet; then
  exit 0
fi

echo "Pre-PR check failed. Fix the failed step before opening a PR." >&2
exit 2
