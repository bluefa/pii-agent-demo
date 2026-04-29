#!/usr/bin/env bash
# PreToolUse hook for Bash: when running `codex exec`, auto-refresh origin so the
# default diff scope (`origin/main...HEAD`) is accurate.
#
# The codex-review skill calls out `git fetch origin --quiet` as a mandatory
# "Fresh base" step (a stale `refs/remotes/origin/main` would silently invert
# the merge-base diff), but it's easy to skip when invoking codex manually.
# This hook makes that step idempotent and free.
#
# Best-effort: never blocks. Network failures, missing remote, or cwd outside a
# git repo all silently pass through to codex.

set -uo pipefail

input="$(cat)"
command="$(echo "$input" | /usr/bin/jq -r '.tool_input.command // empty')"

case "$command" in
  *"codex exec"*) ;;
  *) exit 0 ;;
esac

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Skip if not inside a git repo (codex may be invoked outside repos for unrelated tasks)
if ! git -C "$repo_root" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# Skip if origin remote is not configured
if ! git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
  exit 0
fi

# Refresh origin (best effort; never block codex on a fetch failure)
git -C "$repo_root" fetch origin --quiet 2>/dev/null || true

exit 0
