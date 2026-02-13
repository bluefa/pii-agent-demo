#!/usr/bin/env bash
set -euo pipefail

CANONICAL_REPO_PATH="/Users/study/pii-agent-demo"
ALLOWED_PREFIX_REGEX='^(feat|fix|docs|refactor|chore|test|codex)/'

git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${git_root}" ]]; then
  echo "[guard-worktree] Not inside a git repository." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "${branch}" || "${branch}" == "HEAD" ]]; then
  echo "[guard-worktree] Detached HEAD is not allowed for implementation work." >&2
  exit 1
fi

if [[ "${branch}" == "main" || "${branch}" == "master" ]]; then
  echo "[guard-worktree] Direct work on '${branch}' is blocked." >&2
  echo "[guard-worktree] Create a worktree branch first." >&2
  exit 1
fi

if [[ "${git_root}" == "${CANONICAL_REPO_PATH}" ]]; then
  echo "[guard-worktree] Canonical repo path is read-only for implementation flow:" >&2
  echo "  ${CANONICAL_REPO_PATH}" >&2
  echo "[guard-worktree] Use a sibling worktree path instead." >&2
  exit 1
fi

if ! [[ "${branch}" =~ ${ALLOWED_PREFIX_REGEX} ]]; then
  echo "[guard-worktree] Branch '${branch}' does not match allowed prefixes." >&2
  echo "[guard-worktree] Allowed: feat/, fix/, docs/, refactor/, chore/, test/, codex/" >&2
  exit 1
fi

echo "[guard-worktree] OK: ${git_root} (${branch})"
