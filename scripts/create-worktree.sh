#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/create-worktree.sh --topic <topic> [--prefix feat] [--base main] [--remote origin]

Options:
  --topic   Branch/worktree topic name (required)
  --prefix  Branch prefix: feat|fix|docs|refactor|chore|test|codex (default: feat)
  --base    Base branch to sync from remote before branching (default: main)
  --remote  Remote name (default: origin)
EOF
}

TOPIC=""
PREFIX="feat"
BASE_BRANCH="main"
REMOTE_NAME="origin"
ALLOWED_PREFIX_REGEX='^(feat|fix|docs|refactor|chore|test|codex)$'
CANONICAL_REPO_PATH="/Users/study/pii-agent-demo"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --topic)
      TOPIC="${2:-}"
      shift 2
      ;;
    --prefix)
      PREFIX="${2:-}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --remote)
      REMOTE_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[create-worktree] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${TOPIC}" ]]; then
  echo "[create-worktree] --topic is required." >&2
  usage
  exit 1
fi

if ! [[ "${PREFIX}" =~ ${ALLOWED_PREFIX_REGEX} ]]; then
  echo "[create-worktree] Invalid --prefix '${PREFIX}'." >&2
  echo "[create-worktree] Allowed: feat|fix|docs|refactor|chore|test|codex" >&2
  exit 1
fi

if ! git -C "${CANONICAL_REPO_PATH}" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "[create-worktree] Canonical repository not found: ${CANONICAL_REPO_PATH}" >&2
  exit 1
fi

repo_root="${CANONICAL_REPO_PATH}"
branch_name="${PREFIX}/${TOPIC}"
worktree_path="$(dirname "${repo_root}")/$(basename "${repo_root}")-${TOPIC}"
base_ref="refs/heads/${BASE_BRANCH}"

echo "[create-worktree] Fetching ${REMOTE_NAME}/${BASE_BRANCH}"
git -C "${repo_root}" fetch "${REMOTE_NAME}" "${BASE_BRANCH}" --prune

main_worktree_path="$(
  git -C "${repo_root}" worktree list --porcelain | awk -v target="${base_ref}" '
    $1=="worktree" { current=$2 }
    $1=="branch" && $2==target { print current; exit }
  '
)"

if [[ -n "${main_worktree_path}" ]]; then
  echo "[create-worktree] Syncing local ${BASE_BRANCH} in worktree: ${main_worktree_path}"
  git -C "${main_worktree_path}" pull --ff-only "${REMOTE_NAME}" "${BASE_BRANCH}" >/dev/null
else
  if git -C "${repo_root}" show-ref --verify --quiet "${base_ref}"; then
    echo "[create-worktree] Updating local ${BASE_BRANCH} to ${REMOTE_NAME}/${BASE_BRANCH}"
    git -C "${repo_root}" branch -f "${BASE_BRANCH}" "${REMOTE_NAME}/${BASE_BRANCH}" >/dev/null
  else
    echo "[create-worktree] Creating local ${BASE_BRANCH} from ${REMOTE_NAME}/${BASE_BRANCH}"
    git -C "${repo_root}" branch "${BASE_BRANCH}" "${REMOTE_NAME}/${BASE_BRANCH}" >/dev/null
  fi
fi

local_base_sha="$(git -C "${repo_root}" rev-parse "${BASE_BRANCH}")"
remote_base_sha="$(git -C "${repo_root}" rev-parse "${REMOTE_NAME}/${BASE_BRANCH}")"

if [[ "${local_base_sha}" != "${remote_base_sha}" ]]; then
  echo "[create-worktree] Local ${BASE_BRANCH} is not synced to ${REMOTE_NAME}/${BASE_BRANCH}." >&2
  echo "[create-worktree] local=${local_base_sha} remote=${remote_base_sha}" >&2
  exit 1
fi

if git -C "${repo_root}" show-ref --verify --quiet "refs/heads/${branch_name}"; then
  echo "[create-worktree] Branch already exists: ${branch_name}" >&2
  exit 1
fi

if [[ -e "${worktree_path}" ]]; then
  echo "[create-worktree] Target worktree path already exists: ${worktree_path}" >&2
  exit 1
fi

echo "[create-worktree] Creating worktree ${worktree_path} on ${branch_name} from ${BASE_BRANCH}"
git -C "${repo_root}" worktree add "${worktree_path}" -b "${branch_name}" "${BASE_BRANCH}" >/dev/null

echo "[create-worktree] Done"
echo "  worktree: ${worktree_path}"
echo "  branch:   ${branch_name}"
echo "  base:     ${BASE_BRANCH}@${local_base_sha}"
