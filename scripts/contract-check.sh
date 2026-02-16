#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/contract-check.sh [--mode staged|diff] [--base <ref>] [--head <ref>] [--rules <path>]

Options:
  --mode   Change detection mode (default: staged)
           - staged: git diff --cached
           - diff:   git diff <base...head>
  --base   Base ref for diff mode (default: origin/main)
  --head   Head ref for diff mode (default: HEAD)
  --rules  Regex rule file path (default: .claude/skills/shared/contract-check.rules)

Rule file format:
  - One rule per line, comment starts with '#'
  - Format: <regex>|<message>
  - Example:
      \blifecycleStatus\b|Legacy status flag is deprecated
EOF
}

MODE="staged"
BASE_REF="origin/main"
HEAD_REF="HEAD"
RULES_FILE=".claude/skills/shared/contract-check.rules"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --base)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --head)
      HEAD_REF="${2:-}"
      shift 2
      ;;
    --rules)
      RULES_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[contract-check] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${MODE}" != "staged" && "${MODE}" != "diff" ]]; then
  echo "[contract-check] Invalid --mode: ${MODE}" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

collect_changed_files() {
  if [[ "${MODE}" == "staged" ]]; then
    git diff --cached --name-only --diff-filter=ACMR
  else
    git diff --name-only --diff-filter=ACMR "${BASE_REF}...${HEAD_REF}"
  fi
}

is_api_runtime_path() {
  local path="$1"
  [[ "${path}" == app/api/* ]] \
    || [[ "${path}" == app/lib/api/* ]] \
    || [[ "${path}" == lib/api-client/* ]] \
    || [[ "${path}" == lib/types/* ]]
}

is_swagger_path() {
  local path="$1"
  [[ "${path}" == docs/swagger/*.yaml ]] || [[ "${path}" == docs/swagger/*.yml ]]
}

CHANGED_FILES=()
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  CHANGED_FILES+=("${file}")
done < <(collect_changed_files)

if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
  echo "[contract-check] No changed files in mode='${MODE}'. Skipping."
  exit 0
fi

API_CHANGED="0"
SWAGGER_CHANGED="0"
for path in "${CHANGED_FILES[@]}"; do
  if is_api_runtime_path "${path}"; then
    API_CHANGED="1"
  fi
  if is_swagger_path "${path}"; then
    SWAGGER_CHANGED="1"
  fi
done

if [[ "${API_CHANGED}" != "1" && "${SWAGGER_CHANGED}" != "1" ]]; then
  echo "[contract-check] No API/Swagger changes detected. Skipping."
  exit 0
fi

failures=0

if [[ "${API_CHANGED}" == "1" && "${SWAGGER_CHANGED}" != "1" ]]; then
  echo "[contract-check] FAIL: API/runtime files changed without Swagger update."
  echo "[contract-check] Hint: update docs/swagger/*.yaml or document why contract is unchanged."
  failures=1
fi

if [[ -f "${RULES_FILE}" ]]; then
  FILES_TO_SCAN=()
  for file in "${CHANGED_FILES[@]}"; do
    [[ -f "${file}" ]] || continue
    [[ "${file}" == *.md ]] && continue
    FILES_TO_SCAN+=("${file}")
  done

  if [[ ${#FILES_TO_SCAN[@]} -gt 0 ]]; then
    while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
      line="$(echo "${raw_line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      [[ -z "${line}" ]] && continue
      [[ "${line}" == \#* ]] && continue

      regex="${line%%|*}"
      message="${line#*|}"
      if [[ "${regex}" == "${line}" ]]; then
        echo "[contract-check] WARN: skipping invalid rule (missing '|'): ${line}"
        continue
      fi

      if matches="$(rg -n --color never "${regex}" "${FILES_TO_SCAN[@]}" 2>/dev/null || true)"; then
        if [[ -n "${matches}" ]]; then
          echo "[contract-check] FAIL: ${message}"
          echo "${matches}" | sed -n '1,20p'
          failures=1
        fi
      fi
    done < "${RULES_FILE}"
  fi
else
  echo "[contract-check] INFO: rule file not found (${RULES_FILE}), skipping regex checks."
fi

if [[ "${failures}" -eq 0 ]]; then
  echo "[contract-check] PASS"
else
  echo "[contract-check] FAILED"
fi

exit "${failures}"
