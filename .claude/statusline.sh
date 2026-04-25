#!/bin/bash
# Claude Code statusline for pii-agent-demo
# Two-line output:
#   line 1: [Model . s:<id4>]  worktree/dir [ | PR link(s)]
#   line 2: <bar> <pct>% of <ctx-size>
#
# PR indicator (two sources, event > query):
#   1. Event cache at /tmp/claude-pr-event-<session_id>, appended by the
#      PostToolUse hook on every `gh pr create` in this session — collects
#      every PR a session produces (including subagent fan-out), even when
#      the main session's cwd stays on main or detached HEAD.
#      Each entry is rechecked via `gh pr view --repo` and only OPEN/DRAFT
#      PRs are rendered. Per-PR state is cached at
#      /tmp/claude-pr-state-<session_id> with a 30s TTL.
#   2. Fallback: `gh pr view` for the current branch's OPEN/DRAFT PR,
#      cached 5s per session. Skips main/master and detached HEAD. Used
#      only when the event cache yields no OPEN PR.

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
STATE_CACHE="/tmp/claude-pr-state-$SESSION_FULL"
QUERY_CACHE="/tmp/claude-pr-$SESSION_FULL"
CACHE_TTL=5
STATE_TTL=30
MAX_DISPLAY=3

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

# Lookup cached state for a PR number. Echoes "STATE\tURL" on fresh hit.
state_cache_lookup() {
  local num="$1" line state url epoch now
  [ -f "$STATE_CACHE" ] || return 1
  line=$(grep -E "^${num}"$'\t' "$STATE_CACHE" 2>/dev/null | tail -1)
  [ -z "$line" ] && return 1
  IFS=$'\t' read -r _ state url epoch <<< "$line"
  [ -z "$epoch" ] && return 1
  now=$(date +%s)
  [ "$((now - epoch))" -gt "$STATE_TTL" ] && return 1
  printf '%s\t%s\n' "$state" "$url"
}

# Replace any existing entry for $1 with $1\t$2\t$3\t<now>.
state_cache_write() {
  local num="$1" state="$2" url="$3" now tmp
  now=$(date +%s)
  tmp="${STATE_CACHE}.$$"
  if [ -f "$STATE_CACHE" ]; then
    grep -vE "^${num}"$'\t' "$STATE_CACHE" > "$tmp" 2>/dev/null || : > "$tmp"
  else
    : > "$tmp"
  fi
  printf '%s\t%s\t%s\t%s\n' "$num" "$state" "$url" "$now" >> "$tmp"
  mv -f "$tmp" "$STATE_CACHE"
}

# Query gh for the current state of $1 (number) using the repo from $2 (url).
# Echoes "STATE\tURL" on success; writes through to the state cache.
fetch_pr_state() {
  local num="$1" url="$2" repo json state new_url
  repo=$(printf '%s' "$url" | sed -nE 's#https://github\.com/([^/]+/[^/]+)/pull/.*#\1#p')
  [ -z "$repo" ] && return 1
  json=$(gh pr view "$num" --repo "$repo" --json state,url 2>/dev/null)
  [ -z "$json" ] && return 1
  state=$(printf '%s' "$json" | jq -r '.state // ""')
  new_url=$(printf '%s' "$json" | jq -r '.url // ""')
  [ -z "$state" ] && return 1
  [ -n "$new_url" ] && url="$new_url"
  state_cache_write "$num" "$state" "$url"
  printf '%s\t%s\n' "$state" "$url"
}

OPEN_NUMS=()
OPEN_URLS=()
SEEN_NUMS=""

# Priority 1: event cache — collect every captured PR that is still OPEN/DRAFT.
if [ -f "$EVENT_CACHE" ]; then
  while IFS=$'\t' read -r ev_url ev_num || [ -n "$ev_num" ]; do
    [ -z "$ev_num" ] && continue
    # Defensive dedup — the PostToolUse capture hook's check-then-append is
    # racy under parallel `gh pr create` (subagent fan-out), so the same PR
    # number can land twice in the event cache.
    case " $SEEN_NUMS " in *" $ev_num "*) continue ;; esac
    SEEN_NUMS="$SEEN_NUMS $ev_num"
    cached=$(state_cache_lookup "$ev_num") || cached=""
    if [ -n "$cached" ]; then
      IFS=$'\t' read -r ev_state ev_final_url <<< "$cached"
    else
      fresh=$(fetch_pr_state "$ev_num" "$ev_url") || fresh=""
      if [ -n "$fresh" ]; then
        IFS=$'\t' read -r ev_state ev_final_url <<< "$fresh"
      else
        ev_state=""
        ev_final_url="$ev_url"
      fi
    fi
    case "$ev_state" in
      OPEN|DRAFT)
        OPEN_NUMS+=("$ev_num")
        OPEN_URLS+=("$ev_final_url")
        ;;
    esac
  done < "$EVENT_CACHE"
fi

# Priority 2: cwd-based gh pr view (only when event cache yielded no OPEN PR).
if [ "${#OPEN_NUMS[@]}" -eq 0 ]; then
  if cache_stale; then
    refresh_pr_cache
  fi
  if [ -f "$QUERY_CACHE" ]; then
    IFS=$'\t' read -r FB_URL FB_NUM < "$QUERY_CACHE" || true
    if [ -n "${FB_URL:-}" ] && [ -n "${FB_NUM:-}" ]; then
      OPEN_NUMS+=("$FB_NUM")
      OPEN_URLS+=("$FB_URL")
    fi
  fi
fi

PR_PART=""
PR_COUNT=${#OPEN_NUMS[@]}
if [ "$PR_COUNT" -eq 1 ]; then
  PR_LINK="${ESC}]8;;${OPEN_URLS[0]}${BEL}🔗 PR #${OPEN_NUMS[0]}${ESC}]8;;${BEL}"
  PR_PART=" ${DIM}|${RESET} ${PR_LINK}"
elif [ "$PR_COUNT" -gt 1 ]; then
  shown=$PR_COUNT
  [ "$shown" -gt "$MAX_DISPLAY" ] && shown=$MAX_DISPLAY
  parts=""
  i=0
  while [ "$i" -lt "$shown" ]; do
    link="${ESC}]8;;${OPEN_URLS[$i]}${BEL}#${OPEN_NUMS[$i]}${ESC}]8;;${BEL}"
    if [ -z "$parts" ]; then
      parts="$link"
    else
      parts="$parts $link"
    fi
    i=$((i + 1))
  done
  if [ "$PR_COUNT" -gt "$MAX_DISPLAY" ]; then
    parts="$parts ${DIM}+$((PR_COUNT - MAX_DISPLAY))${RESET}"
  fi
  PR_PART=" ${DIM}|${RESET} 🔗 ${parts}"
fi

if [ -n "$WORKTREE" ]; then
  LOCATION="🌿 $WORKTREE"
else
  LOCATION="📁 ${DIR##*/}"
fi

printf '%s\n' "${CYAN}[$MODEL · s:$SESSION]${RESET} ${DIM}$LOCATION${RESET}${PR_PART}"
printf '%s\n' "${BAR_COLOR}${BAR}${RESET} ${PCT}% ${DIM}of $CTX_DISPLAY${RESET}"
