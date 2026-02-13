#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  bash scripts/build-pr-body.sh [--base main]

Generates a human-readable PR description in Markdown.
EOF
      exit 0
      ;;
    *)
      echo "[build-pr-body] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

git fetch origin "${BASE_BRANCH}" >/dev/null 2>&1 || true

summary_lines="$(git log --no-merges --pretty='- %s' "origin/${BASE_BRANCH}..HEAD" | head -n 20 || true)"
if [[ -z "${summary_lines}" ]]; then
  summary_lines="- No commit summary found"
fi

changed_files="$(git diff --name-only "origin/${BASE_BRANCH}...HEAD" | awk '{printf "- `%s`\n", $0}' || true)"
if [[ -z "${changed_files}" ]]; then
  changed_files="- No file diff detected"
fi

validation="${PII_PR_VALIDATION:-Not provided (add executed commands and key results)}"

cat <<EOF
## Summary
${summary_lines}

## What Changed
${changed_files}

## Validation
${validation}

## Risks
- Potential impact areas: touched files listed above
- Rollback plan: revert this PR merge commit

## Notes For Reviewer
- Focus on behavior regressions and workflow rule compliance
- Confirm branch/worktree policy and skills updates are consistent
EOF
