#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/remove-self-hosted-runner.sh [--repo owner/name] [--runner-dir /path]
USAGE
}

REPO=""
RUNNER_DIR="${HOME}/.local/share/pii-agent-runner"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --runner-dir)
      RUNNER_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[runner-remove] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "[runner-remove] gh CLI is required." >&2
  exit 1
fi

if [[ -z "${REPO}" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

if [[ ! -d "${RUNNER_DIR}" ]]; then
  echo "[runner-remove] Runner directory not found: ${RUNNER_DIR}" >&2
  exit 1
fi

cd "${RUNNER_DIR}"

if [[ ! -x "./config.sh" ]]; then
  echo "[runner-remove] config.sh not found in ${RUNNER_DIR}" >&2
  exit 1
fi

remove_token="$(gh api -X POST "repos/${REPO}/actions/runners/remove-token" --jq .token)"

echo "[runner-remove] Removing runner from ${REPO}"
./config.sh remove --token "${remove_token}"

echo "[runner-remove] Done"
