#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/setup-self-hosted-runner.sh [--repo owner/name] [--runner-dir /path] [--name runner-name] [--labels codex-review] [--ephemeral]

Examples:
  bash scripts/setup-self-hosted-runner.sh --labels codex-review
  bash scripts/setup-self-hosted-runner.sh --repo bluefa/pii-agent-demo --ephemeral
USAGE
}

REPO=""
RUNNER_DIR="${HOME}/.local/share/pii-agent-runner"
RUNNER_NAME="$(hostname)-codex-review"
RUNNER_LABELS="codex-review"
EPHEMERAL="0"

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
    --name)
      RUNNER_NAME="${2:-}"
      shift 2
      ;;
    --labels)
      RUNNER_LABELS="${2:-}"
      shift 2
      ;;
    --ephemeral)
      EPHEMERAL="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[runner-setup] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "[runner-setup] gh CLI is required." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "[runner-setup] curl is required." >&2
  exit 1
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "[runner-setup] tar is required." >&2
  exit 1
fi

if [[ -z "${REPO}" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

if [[ -z "${REPO}" || "${REPO}" == "null" ]]; then
  echo "[runner-setup] Repository could not be resolved. Set --repo owner/name." >&2
  exit 1
fi

gh auth status >/dev/null

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "${uname_s}" in
  Linux) RUNNER_OS="linux" ;;
  Darwin) RUNNER_OS="osx" ;;
  *)
    echo "[runner-setup] Unsupported OS: ${uname_s}" >&2
    exit 1
    ;;
esac

case "${uname_m}" in
  x86_64|amd64) RUNNER_ARCH="x64" ;;
  arm64|aarch64) RUNNER_ARCH="arm64" ;;
  *)
    echo "[runner-setup] Unsupported architecture: ${uname_m}" >&2
    exit 1
    ;;
esac

RUNNER_VERSION="${RUNNER_VERSION:-$(gh api repos/actions/runner/releases/latest --jq '.tag_name' | sed 's/^v//')}"
RUNNER_TGZ="actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TGZ}"

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

if [[ ! -f "${RUNNER_TGZ}" ]]; then
  echo "[runner-setup] Downloading ${RUNNER_URL}"
  curl -fsSL -o "${RUNNER_TGZ}" "${RUNNER_URL}"
fi

if [[ ! -x "./config.sh" ]]; then
  echo "[runner-setup] Extracting runner package"
  tar xzf "${RUNNER_TGZ}"
fi

reg_token="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"

config_args=(
  --url "https://github.com/${REPO}"
  --token "${reg_token}"
  --name "${RUNNER_NAME}"
  --labels "${RUNNER_LABELS}"
  --work "_work"
  --unattended
  --replace
)

if [[ "${EPHEMERAL}" == "1" ]]; then
  config_args+=(--ephemeral)
fi

echo "[runner-setup] Configuring runner ${RUNNER_NAME} for ${REPO}"
./config.sh "${config_args[@]}"

echo "[runner-setup] Done"
echo "  repo:       ${REPO}"
echo "  runner-dir: ${RUNNER_DIR}"
echo "  labels:     ${RUNNER_LABELS}"
echo "  ephemeral:  ${EPHEMERAL}"
echo ""
echo "Next:"
echo "  bash scripts/start-self-hosted-runner.sh --runner-dir '${RUNNER_DIR}'"
