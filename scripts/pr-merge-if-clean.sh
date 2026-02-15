#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/pr-merge-if-clean.sh [--pr <number|url>] [--strategy squid]

Options:
  --pr        PR number or URL (default: open PR for current branch)
  --strategy  merge | squash | squid (default: squid)
USAGE
}

PR_REF=""
STRATEGY="squid"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      PR_REF="${2:-}"
      shift 2
      ;;
    --strategy)
      STRATEGY="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-merge-if-clean] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "${STRATEGY}" in
  merge) MERGE_FLAG="--merge" ;;
  squash|squid) MERGE_FLAG="--squash" ;;
  *)
    echo "[pr-merge-if-clean] Invalid strategy: ${STRATEGY}" >&2
    exit 1
    ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  echo "[pr-merge-if-clean] gh CLI is required." >&2
  exit 1
fi

if [[ -z "${PR_REF}" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  PR_REF="$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number')"
  if [[ -z "${PR_REF}" || "${PR_REF}" == "null" ]]; then
    echo "[pr-merge-if-clean] No open PR found for branch ${branch}." >&2
    exit 1
  fi
fi

pr_number="$(gh pr view "${PR_REF}" --json number --jq .number)"
pr_state="$(gh pr view "${pr_number}" --json state --jq .state)"

if [[ "${pr_state}" != "OPEN" ]]; then
  echo "[pr-merge-if-clean] PR #${pr_number} is not OPEN (state=${pr_state})." >&2
  exit 1
fi

mergeable="UNKNOWN"
for _ in {1..10}; do
  mergeable="$(gh pr view "${pr_number}" --json mergeable --jq .mergeable)"
  if [[ "${mergeable}" != "UNKNOWN" ]]; then
    break
  fi
  sleep 1
done

if [[ "${mergeable}" != "MERGEABLE" ]]; then
  echo "[pr-merge-if-clean] PR #${pr_number} is not mergeable (mergeable=${mergeable})." >&2
  exit 1
fi

review_decision="$(gh pr view "${pr_number}" --json reviewDecision --jq '.reviewDecision // ""')"
if [[ "${review_decision}" == "CHANGES_REQUESTED" ]]; then
  echo "[pr-merge-if-clean] PR #${pr_number} has CHANGES_REQUESTED reviewDecision." >&2
  exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
head_sha="$(gh pr view "${pr_number}" --json headRefOid --jq .headRefOid)"

codex_check_count="$(gh api "repos/${repo}/commits/${head_sha}/check-runs?per_page=100" --jq '[.check_runs[] | select(.name == "Codex PR Review")] | length')"
if [[ "${codex_check_count}" == "0" ]]; then
  echo "[pr-merge-if-clean] Codex PR Review check not found on head ${head_sha}." >&2
  exit 1
fi

codex_conclusion="$(gh api "repos/${repo}/commits/${head_sha}/check-runs?per_page=100" --jq '[.check_runs[] | select(.name == "Codex PR Review")][-1].conclusion')"
if [[ "${codex_conclusion}" != "success" ]]; then
  echo "[pr-merge-if-clean] Codex PR Review conclusion is ${codex_conclusion}, merge blocked." >&2
  echo "[pr-merge-if-clean] Codex comment snapshot:" >&2
  gh api "repos/${repo}/issues/${pr_number}/comments?per_page=100" --jq '[.[] | select(.body | contains("<!-- codex-pr-review -->"))][-1].body // "(no codex comment)"' >&2
  exit 1
fi

echo "[pr-merge-if-clean] Codex PR Review is success. Proceeding with ${STRATEGY} merge."
gh pr merge "${pr_number}" ${MERGE_FLAG} --delete-branch

echo "[pr-merge-if-clean] Merge completed for PR #${pr_number}."
