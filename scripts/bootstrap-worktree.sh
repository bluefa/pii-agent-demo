#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${1:-$(pwd)}"

if [[ ! -d "${WORKDIR}" ]]; then
  echo "[bootstrap-worktree] Directory not found: ${WORKDIR}" >&2
  exit 1
fi

if [[ ! -f "${WORKDIR}/package.json" ]]; then
  echo "[bootstrap-worktree] package.json not found in: ${WORKDIR}" >&2
  exit 1
fi

if [[ -x "${WORKDIR}/node_modules/.bin/next" && -x "${WORKDIR}/node_modules/.bin/eslint" ]]; then
  echo "[bootstrap-worktree] node_modules already ready: ${WORKDIR}"
  exit 0
fi

echo "[bootstrap-worktree] Installing dependencies in ${WORKDIR}"
cd "${WORKDIR}"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "[bootstrap-worktree] Done"
