#!/bin/bash
# Claude Code statusline for pii-agent-demo
# Two-line output:
#   line 1: [Model . s:<id4>]  worktree/dir [ | PR #<num> link]
#   line 2: <bar> <pct>% of <ctx-size>
# PR indicator: queries `gh pr view` for the current branch's OPEN/DRAFT PR,
# cached per session for 5 seconds to avoid repeated network calls.
# Skips main/master and detached HEAD.

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

# PR indicator: 5s per-session cache of `gh pr view` for current branch
CACHE_FILE="/tmp/claude-pr-$SESSION_FULL"
CACHE_TTL=5

cache_stale() {
  [ ! -f "$CACHE_FILE" ] && return 0
  local mtime now
  mtime=$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
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
  printf '%s\t%s\n' "$url" "$num" > "$CACHE_FILE"
}

PR_URL=""
PR_NUM=""
if cache_stale; then
  refresh_pr_cache
fi
if [ -f "$CACHE_FILE" ]; then
  IFS=$'\t' read -r PR_URL PR_NUM < "$CACHE_FILE" || true
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
