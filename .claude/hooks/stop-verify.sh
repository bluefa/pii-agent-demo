#!/usr/bin/env bash
# Stop hook: run project verify script when session ends.
# Scoped to main project verify (tsc + lint), summarized output only.
set -uo pipefail

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Skip if no code files changed in this session (cheap preflight)
if ! git -C "$repo_root" diff --quiet HEAD 2>/dev/null \
   || ! git -C "$repo_root" diff --cached --quiet 2>/dev/null; then
  if [ -x "$repo_root/scripts/verify.sh" ]; then
    cd "$repo_root" && bash scripts/verify.sh 2>&1 | tail -15
  fi
fi

exit 0
