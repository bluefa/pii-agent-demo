#!/usr/bin/env bash
# PreToolUse hook for Bash: block destructive writes (git commit/push) on main.
# Reads JSON tool call from stdin; exits 2 with stderr message to feed back to Claude.
set -euo pipefail

input="$(cat)"
command="$(echo "$input" | /usr/bin/jq -r '.tool_input.command // empty')"

# Only inspect git mutation commands; let read-only git and other commands through.
case "$command" in
  *"git commit"*|*"git push"*|*"git merge"*|*"git rebase"*|*"git reset --hard"*)
    ;;
  *)
    exit 0
    ;;
esac

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
branch="$(git -C "$repo_root" branch --show-current 2>/dev/null || echo "")"

if [ "$branch" = "main" ]; then
  echo "BLOCK: main 브랜치에서 git 쓰기 금지 (CLAUDE.md CRITICAL #1)." >&2
  echo "worktree에서 작업하세요: bash scripts/create-worktree.sh --topic <name> --prefix <feat|fix|docs|refactor|chore>" >&2
  exit 2
fi

exit 0
