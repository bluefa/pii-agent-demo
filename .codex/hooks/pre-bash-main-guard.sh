#!/usr/bin/env bash
# PreToolUse hook for Bash: block git write operations on main.
set -euo pipefail

input="$(cat)"
node_bin="$(command -v node 2>/dev/null || true)"
[ -n "$node_bin" ] || exit 0

command="$(printf '%s' "$input" | "$node_bin" -e '
const fs = require("fs");
let data = "";
process.stdin.on("data", chunk => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    const command = parsed && parsed.tool_input && typeof parsed.tool_input.command === "string"
      ? parsed.tool_input.command
      : "";
    process.stdout.write(command);
  } catch {
    process.stdout.write("");
  }
});
')"

case "$command" in
  *"git commit"*|*"git push"*|*"git merge"*|*"git rebase"*|*"git reset --hard"*) ;;
  *) exit 0 ;;
esac

repo_root="${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
branch="$(git -C "$repo_root" branch --show-current 2>/dev/null || true)"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "BLOCK: git write operations are forbidden on $branch. Create a worktree branch first." >&2
  exit 2
fi

exit 0
