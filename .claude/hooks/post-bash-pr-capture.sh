#!/usr/bin/env bash
# PostToolUse hook for Bash: capture PR URL from `gh pr create` output.
# Stores per-session at /tmp/claude-pr-event-<session_id> so the statusline
# can surface the PR even when the main session's cwd is on main or a
# detached HEAD (e.g., PR was created inside a sibling worktree via a
# helper script, without the main session ever changing its cwd).

set -uo pipefail

input="$(cat)"

tool_name="$(echo "$input" | /usr/bin/jq -r '.tool_name // empty')"
[ "$tool_name" = "Bash" ] || exit 0

session_id="$(echo "$input" | /usr/bin/jq -r '.session_id // empty')"
[ -n "$session_id" ] || exit 0

command="$(echo "$input" | /usr/bin/jq -r '.tool_input.command // empty')"
case "$command" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

# Aggregate plausible text fields from tool_response (Bash output shape).
# Keep it defensive: any non-string field is coerced via tostring.
output="$(echo "$input" | /usr/bin/jq -r '
  .tool_response
  | [ .stdout // "", .stderr // "", .output // "", .result // "" ]
  | map(tostring)
  | join("\n")
' 2>/dev/null || true)"

pr_url="$(printf '%s' "$output" | /usr/bin/grep -oE 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | tail -1)"
[ -n "$pr_url" ] || exit 0

pr_num="$(printf '%s' "$pr_url" | /usr/bin/grep -oE '[0-9]+$')"
[ -n "$pr_num" ] || exit 0

cache_file="/tmp/claude-pr-event-$session_id"
printf '%s\t%s\n' "$pr_url" "$pr_num" > "$cache_file"

exit 0
