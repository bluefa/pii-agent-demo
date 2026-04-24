#!/bin/bash
# Claude Code statusline for pii-agent-demo
# Two-line output:
#   line 1: [Model . s:<id4>]  worktree/dir [ | PR #<num> link]
#   line 2: <bar> <pct>% of <ctx-size>
#
# PR indicator (two sources, event > query):
#   1. Event cache at /tmp/claude-pr-event-<session_id>, written by the
#      PostToolUse hook whenever `gh pr create` completes in this session.
#      Survives even if the main session's cwd stays on main or detached
#      HEAD (e.g., PR was created inside a sibling worktree).
#   2. Fallback: `gh pr view` for the current branch's OPEN/DRAFT PR,
#      cached 5s per session. Skips main/master and detached HEAD.

set -u
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"')
SESSION_FULL=$(echo "$input" | jq -r '.session_id // "unknown"')
SESSION=$(printf '%s' "$SESSION_FULL" | cut -c1-4)
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
CTX_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
WORKTREE=$(echo "$input" | jq -r '.workspace.git_worktree // empty')
DIR=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')

if [ "$CTX_SIZE" -ge 1000000 ]; then
  CTX_DISPLAY="$((CTX_SIZE / 1000000))M"
elif [ "$CTX_SIZE" -ge 1000 ]; then
  CTX_DISPLAY="$((CTX_SIZE / 1000))k"
else
  CTX_DISPLAY="$CTX_SIZE"
fi

CYAN=$'\033[36m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
DIM=$'\033[2m'
RESET=$'\033[0m'
ESC=$'\033'
BEL=$'\a'

if [ "$PCT" -ge 90 ]; then
  BAR_COLOR="$RED"
elif [ "$PCT" -ge 70 ]; then
  BAR_COLOR="$YELLOW"
else
  BAR_COLOR="$GREEN"
fi

FILLED=$((PCT / 10))
[ "$FILLED" -gt 10 ] && FILLED=10
[ "$FILLED" -lt 0 ] && FILLED=0
EMPTY=$((10 - FILLED))
BAR=""
if [ "$FILLED" -gt 0 ]; then
  printf -v FILL "%${FILLED}s" ""
  BAR="${FILL// /█}"
fi
if [ "$EMPTY" -gt 0 ]; then
  printf -v PAD "%${EMPTY}s" ""
  BAR="${BAR}${PAD// /░}"
fi

EVENT_CACHE="/tmp/claude-pr-event-$SESSION_FULL"
QUERY_CACHE="/tmp/claude-pr-$SESSION_FULL"
CACHE_TTL=5

cache_stale() {
  [ ! -f "$QUERY_CACHE" ] && return 0
  local mtime now
  mtime=$(stat -f %m "$QUERY_CACHE" 2>/dev/null || stat -c %Y "$QUERY_CACHE" 2>/dev/null || echo 0)
  now=$(date +%s)
  [ "$((now - mtime))" -gt "$CACHE_TTL" ]
}

refresh_pr_cache() {
  local url="" num=""
  if [ -n "$DIR" ] && [ -d "$DIR" ] && git -C "$DIR" rev-parse --git-dir >/dev/null 2>&1; then
    local branch
    branch=$(git -C "$DIR" branch --show-current 2>/dev/null)
    case "$branch" in
      ""|main|master|HEAD) ;;
      *)
        local json state
        json=$(cd "$DIR" && gh pr view --json url,number,state 2>/dev/null)
        if [ -n "$json" ]; then
          state=$(printf '%s' "$json" | jq -r '.state // ""')
          case "$state" in
            OPEN|DRAFT)
              url=$(printf '%s' "$json" | jq -r '.url // ""')
              num=$(printf '%s' "$json" | jq -r '.number // ""')
              ;;
          esac
        fi
        ;;
    esac
  fi
  printf '%s\t%s\n' "$url" "$num" > "$QUERY_CACHE"
}

PR_URL=""
PR_NUM=""

# Priority 1: event cache (PostToolUse hook capturing `gh pr create`)
if [ -f "$EVENT_CACHE" ]; then
  IFS=$'\t' read -r PR_URL PR_NUM < "$EVENT_CACHE" || true
fi

# Priority 2: cwd-based gh pr view (skipped if event cache already filled)
if [ -z "$PR_URL" ] || [ -z "$PR_NUM" ]; then
  if cache_stale; then
    refresh_pr_cache
  fi
  if [ -f "$QUERY_CACHE" ]; then
    IFS=$'\t' read -r PR_URL PR_NUM < "$QUERY_CACHE" || true
  fi
fi

PR_PART=""
if [ -n "$PR_URL" ] && [ -n "$PR_NUM" ]; then
  PR_LINK="${ESC}]8;;${PR_URL}${BEL}🔗 PR #${PR_NUM}${ESC}]8;;${BEL}"
  PR_PART=" ${DIM}|${RESET} ${PR_LINK}"
fi

if [ -n "$WORKTREE" ]; then
  LOCATION="🌿 $WORKTREE"
else
  LOCATION="📁 ${DIR##*/}"
fi

printf '%s\n' "${CYAN}[$MODEL · s:$SESSION]${RESET} ${DIM}$LOCATION${RESET}${PR_PART}"
printf '%s\n' "${BAR_COLOR}${BAR}${RESET} ${PCT}% ${DIM}of $CTX_DISPLAY${RESET}"
