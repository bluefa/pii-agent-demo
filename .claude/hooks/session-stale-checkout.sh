#!/usr/bin/env bash
# SessionStart hook: warn when this checkout is materially behind origin/main.
#
# Why this exists: reading a stale tree and reporting what it says produces
# confident, well-evidenced, wrong answers about what the app does TODAY. The
# repo has many long-lived branches, so the primary checkout is routinely tens
# of commits behind main. See the PR #704 post-mortem — a question about a field
# reaching the BFF was answered three times from a branch that forked before the
# fix that added it.
set -uo pipefail

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$repo_root" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Refresh origin/main, but never hold the session open on a slow or absent
# network. macOS has no coreutils `timeout`, hence the watchdog.
# `set +m` and `disown` keep bash from printing "Terminated: 15" when the
# watchdog is reaped — the hook's stdout is context, so it must stay clean.
set +m
git fetch --quiet origin main >/dev/null 2>&1 &
fetch_pid=$!
{ sleep 6; kill "$fetch_pid" >/dev/null 2>&1; } >/dev/null 2>&1 &
watchdog_pid=$!
disown "$watchdog_pid" 2>/dev/null || true
wait "$fetch_pid" 2>/dev/null
kill "$watchdog_pid" >/dev/null 2>&1 || true

behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
[ "${behind:-0}" -gt 0 ] || exit 0

branch="$(git branch --show-current 2>/dev/null)"
[ -n "$branch" ] || branch="(detached)"

echo "STALE CHECKOUT — '${branch}' is ${behind} commit(s) behind origin/main."
echo
echo "Code read here may predate merged work. Before stating what the app does,"
echo "or concluding a field/route/behavior is missing, check main:"
echo "  git log --oneline HEAD..origin/main -- <path>"
echo "  git show origin/main:<path> | sed -n 'N,Mp'"
echo "If the user reports behavior that contradicts this tree, this warning is"
echo "the likely reason — verify against origin/main before answering."
echo
echo "Merged commits missing here (newest first):"
git log --oneline HEAD..origin/main 2>/dev/null | head -5 | sed 's/^/  /'

exit 0
