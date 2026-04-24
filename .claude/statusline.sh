#!/bin/bash
# Claude Code statusline for pii-agent-demo
# Two-line output:
#   line 1: [Model . s:<id4>]  worktree/dir
#   line 2: <bar> <pct>% of <ctx-size>
# Extend later with hook-driven task/PR state under /tmp/claude-*-$SESSION_ID

set -u
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"')
SESSION=$(echo "$input" | jq -r '.session_id // "unknown"' | cut -c1-4)
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

CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

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

if [ -n "$WORKTREE" ]; then
  LOCATION="🌿 $WORKTREE"
else
  LOCATION="📁 ${DIR##*/}"
fi
printf '%b\n' "${CYAN}[$MODEL · s:$SESSION]${RESET} ${DIM}$LOCATION${RESET}"
printf '%b\n' "${BAR_COLOR}${BAR}${RESET} ${PCT}% ${DIM}of $CTX_DISPLAY${RESET}"
