#!/usr/bin/env bash
# PostToolUse hook: warn when Korean text appears in files that must stay English.
# Enforced paths: skills, anti-pattern entries, ADRs, engineering reports.
# Korean is allowed in UI-facing content, domain docs, memory, and UX/requirements docs.
set -uo pipefail

input="$(cat)"
file="$(echo "$input" | /usr/bin/jq -r '.tool_input.file_path // empty')"

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

# Only apply to markdown files
case "$file" in
  *.md|*.mdx) ;;
  *) exit 0 ;;
esac

# Normalize to relative path against repo root for matching
repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file#$repo_root/}"

english_only=0
case "$rel" in
  .claude/skills/*|.claude/agents/*|.claude/commands/*|.claude/hooks/*)
    english_only=1
    ;;
  docs/adr/*)
    english_only=1
    ;;
  docs/reports/*anti-pattern*|docs/reports/*audit*|docs/reports/*retrospective*)
    english_only=1
    ;;
  **/CLAUDE.md|**/AGENTS.md|**/README.md)
    # repo-level READMEs and agent instructions stay English
    english_only=1
    ;;
esac

[ "$english_only" -eq 0 ] && exit 0

# Strip fenced code blocks before detecting Korean (code samples may legitimately contain Korean strings)
stripped="$(awk 'BEGIN{fence=0} /^```/{fence=1-fence; next} fence==0{print}' "$file")"

if echo "$stripped" | /usr/bin/grep -qE '[가-힣]'; then
  hits="$(echo "$stripped" | /usr/bin/grep -nE '[가-힣]' | head -3)"
  echo "⚠️  $rel" >&2
  echo "[Language] English-only path contains Korean prose. Rewrite in English." >&2
  echo "$hits" >&2
fi

exit 0
