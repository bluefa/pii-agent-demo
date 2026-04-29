#!/usr/bin/env bash
# PreToolUse hook for Bash: run the shared quiet PR gate before direct `gh pr create`.
set -uo pipefail

input="$(cat)"
node_bin="$(command -v node 2>/dev/null || true)"
[ -n "${node_bin}" ] || exit 0

command="$(printf '%s' "${input}" | "${node_bin}" -e '
let data = "";
process.stdin.on("data", chunk => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    process.stdout.write(parsed?.tool_input?.command || "");
  } catch {
    process.stdout.write("");
  }
});
')"

case "${command}" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

repo_root="${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
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
