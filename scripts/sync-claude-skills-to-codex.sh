#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${repo_root}" ]]; then
  echo "[sync-skills] Not inside a git repository." >&2
  exit 1
fi

src_dir="${repo_root}/.claude/skills"
if [[ ! -d "${src_dir}" ]]; then
  echo "[sync-skills] Source not found: ${src_dir}" >&2
  exit 0
fi

dest_root="${repo_root}/.codex/skills"

if ! mkdir -p "${dest_root}" 2>/dev/null; then
  echo "[sync-skills] Cannot write to ${dest_root}" >&2
  exit 1
fi

tmp_list="$(mktemp)"
trap 'rm -f "${tmp_list}"' EXIT

find "${src_dir}" -mindepth 1 -maxdepth 1 -type d | sort | while read -r skill_dir; do
  skill_name="$(basename "${skill_dir}")"
  skill_file="${skill_dir}/SKILL.md"
  if [[ ! -f "${skill_file}" ]]; then
    continue
  fi

  dest_dir="${dest_root}/${skill_name}"
  mkdir -p "${dest_dir}"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${skill_dir}/" "${dest_dir}/"
  else
    rm -rf "${dest_dir:?}"/*
    cp -R "${skill_dir}/." "${dest_dir}/"
  fi

  echo "${skill_name}" >> "${tmp_list}"
done

find "${dest_root}" -mindepth 1 -maxdepth 1 -type d | while read -r existing_dir; do
  existing_name="$(basename "${existing_dir}")"
  if ! grep -Fxq "${existing_name}" "${tmp_list}"; then
    rm -rf "${existing_dir}"
  fi
done

echo "[sync-skills] Synced Claude skills -> ${dest_root}"
