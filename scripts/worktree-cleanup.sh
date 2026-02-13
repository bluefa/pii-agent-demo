#!/usr/bin/env bash
set -euo pipefail

CANONICAL_REPO="/Users/study/pii-agent-demo"
TARGET_WORKTREE=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/worktree-cleanup.sh --path <worktree-path> [--repo /Users/study/pii-agent-demo]

Options:
  --path   Worktree path to remove
  --repo   Canonical repo path (default: /Users/study/pii-agent-demo)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      TARGET_WORKTREE="${2:-}"
      shift 2
      ;;
    --repo)
      CANONICAL_REPO="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[worktree-cleanup] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${TARGET_WORKTREE}" ]]; then
  echo "[worktree-cleanup] --path is required" >&2
  usage
  exit 1
fi

TARGET_WORKTREE="$(cd "${TARGET_WORKTREE}" && pwd -P)"
CANONICAL_REPO="$(cd "${CANONICAL_REPO}" && pwd -P)"
CURRENT_DIR="$(pwd -P)"

if [[ "${TARGET_WORKTREE}" == "${CANONICAL_REPO}" ]]; then
  echo "[worktree-cleanup] Refusing to remove canonical repo path." >&2
  exit 1
fi

if [[ "${CURRENT_DIR}" == "${TARGET_WORKTREE}"* ]]; then
  echo "[worktree-cleanup] Run from outside target worktree: ${TARGET_WORKTREE}" >&2
  exit 1
fi

if ! git -C "${CANONICAL_REPO}" worktree list --porcelain | grep -Fq "worktree ${TARGET_WORKTREE}"; then
  echo "[worktree-cleanup] Target is not an active worktree: ${TARGET_WORKTREE}" >&2
  exit 1
fi

branch="$(git -C "${TARGET_WORKTREE}" rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" == "main" || "${branch}" == "master" || "${branch}" == "HEAD" ]]; then
  echo "[worktree-cleanup] Refusing protected/invalid branch: ${branch}" >&2
  exit 1
fi

git -C "${CANONICAL_REPO}" fetch origin main >/dev/null 2>&1 || true

if git -C "${CANONICAL_REPO}" show-ref --verify --quiet "refs/heads/${branch}"; then
  merged_by_history="0"
  merged_by_pr="0"

  if git -C "${CANONICAL_REPO}" merge-base --is-ancestor "${branch}" origin/main; then
    merged_by_history="1"
  fi

  # squash/squid merge does not preserve branch commit ancestry, so verify merged PR by head branch.
  if [[ "${merged_by_history}" != "1" ]] && command -v gh >/dev/null 2>&1; then
    merged_pr_count="$(
      cd "${CANONICAL_REPO}" &&
      gh pr list \
        --state merged \
        --head "${branch}" \
        --base main \
        --json number \
        --jq 'length' 2>/dev/null || echo "0"
    )"
    if [[ "${merged_pr_count}" != "0" ]]; then
      merged_by_pr="1"
    fi
  fi

  if [[ "${merged_by_history}" != "1" && "${merged_by_pr}" != "1" ]]; then
    echo "[worktree-cleanup] Branch ${branch} is not merged into origin/main (history or merged PR check failed)." >&2
    exit 1
  fi
fi

echo "[worktree-cleanup] Removing worktree: ${TARGET_WORKTREE}"
git -C "${CANONICAL_REPO}" worktree remove "${TARGET_WORKTREE}"

if git -C "${CANONICAL_REPO}" show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "[worktree-cleanup] Deleting local branch: ${branch}"
  git -C "${CANONICAL_REPO}" branch -d "${branch}" || git -C "${CANONICAL_REPO}" branch -D "${branch}"
fi

git -C "${CANONICAL_REPO}" worktree prune
echo "[worktree-cleanup] Done"
