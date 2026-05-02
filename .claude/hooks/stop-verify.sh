#!/usr/bin/env bash
# Stop hook: run project verify script when session ends.
# Scoped to main project verify (tsc + lint), summarized output only.
set -uo pipefail

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Skip when there is nothing to verify (clean tree).
if git -C "$repo_root" diff --quiet HEAD 2>/dev/null \
   && git -C "$repo_root" diff --cached --quiet 2>/dev/null; then
  exit 0
fi

# Skip when pre-commit just validated this exact HEAD and nothing has been
# touched since the commit (e.g., session ends right after pre-commit OK).
marker="$(git -C "$repo_root" rev-parse --git-path pii-pre-commit-validated.env 2>/dev/null || true)"
head_sha="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || true)"
if [ -n "$marker" ] && [ -f "$marker" ] && [ -n "$head_sha" ]; then
  if /usr/bin/grep -qx "head=${head_sha}" "$marker" 2>/dev/null \
     && git -C "$repo_root" diff --quiet HEAD 2>/dev/null \
     && git -C "$repo_root" diff --cached --quiet 2>/dev/null; then
    exit 0
  fi
fi

if [ -x "$repo_root/scripts/verify.sh" ]; then
  cd "$repo_root" && bash scripts/verify.sh 2>&1 | tail -15
fi

exit 0
