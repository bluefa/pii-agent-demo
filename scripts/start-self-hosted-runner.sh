#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/start-self-hosted-runner.sh [--runner-dir /path] [--service]

Options:
  --runner-dir  Runner install directory (default: ~/.local/share/pii-agent-runner)
  --service     Install/start as service via svc.sh (if supported)
USAGE
}

RUNNER_DIR="${HOME}/.local/share/pii-agent-runner"
SERVICE_MODE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner-dir)
      RUNNER_DIR="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_MODE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[runner-start] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -d "${RUNNER_DIR}" ]]; then
  echo "[runner-start] Runner directory not found: ${RUNNER_DIR}" >&2
  exit 1
fi

cd "${RUNNER_DIR}"

if [[ ! -x "./run.sh" ]]; then
  echo "[runner-start] run.sh not found. Run setup first." >&2
  exit 1
fi

if [[ "${SERVICE_MODE}" == "1" ]]; then
  if [[ ! -x "./svc.sh" ]]; then
    echo "[runner-start] svc.sh is unavailable on this platform." >&2
    exit 1
  fi
  echo "[runner-start] Installing and starting service"
  ./svc.sh install
  ./svc.sh start
  echo "[runner-start] Service started"
  exit 0
fi

echo "[runner-start] Starting runner in foreground"
./run.sh
